// Chromium cannot decode AIFF, but AIFF is plain PCM: expose it as a virtual WAV file whose
// byte ranges map straight onto the AIFF sound data, byte-swapped where needed.

export type AiffLayout = {
  channels: number;
  sampleRate: number;
  bitsPerSample: number;
  float: boolean;
  /** AIFF stores big-endian samples; AIFF-C "sowt" is already little-endian. */
  bigEndian: boolean;
  dataOffset: number;
  dataSize: number;
};

export const WAV_HEADER_SIZE = 44;

type ReadAt = (position: number, length: number) => Promise<Buffer>;

function unsupported(message: string) {
  return Object.assign(new Error(`Unsupported AIFF file: ${message}`), { code: "EUNSUPPORTED" });
}

// 80-bit IEEE 754 extended precision, as used for the AIFF sample rate.
function readExtended(buffer: Buffer, offset: number) {
  const exponent = buffer.readUInt16BE(offset) & 0x7fff;
  const sign = buffer[offset] & 0x80 ? -1 : 1;
  const hi = buffer.readUInt32BE(offset + 2);
  const lo = buffer.readUInt32BE(offset + 6);
  if (exponent === 0 && hi === 0 && lo === 0) return 0;
  return sign * (hi * 2 ** (exponent - 16383 - 31) + lo * 2 ** (exponent - 16383 - 63));
}

export async function parseAiff(readAt: ReadAt, fileSize: number): Promise<AiffLayout> {
  const form = await readAt(0, 12);
  if (form.length < 12 || form.toString("ascii", 0, 4) !== "FORM") throw unsupported("no FORM");
  const formType = form.toString("ascii", 8, 12);
  if (formType !== "AIFF" && formType !== "AIFC") throw unsupported(`form type ${formType}`);

  let comm: Omit<AiffLayout, "dataOffset" | "dataSize"> | null = null;
  let sound: { dataOffset: number; dataSize: number } | null = null;
  let position = 12;
  while (position + 8 <= fileSize && (!comm || !sound)) {
    const chunk = await readAt(position, 8);
    if (chunk.length < 8) break;
    const id = chunk.toString("ascii", 0, 4);
    const size = chunk.readUInt32BE(4);
    const body = position + 8;
    if (id === "COMM") {
      const data = await readAt(body, Math.min(size, 64));
      const channels = data.readUInt16BE(0);
      const bitsPerSample = data.readUInt16BE(6);
      const sampleRate = readExtended(data, 8);
      let compression = "NONE";
      if (formType === "AIFC" && data.length >= 22) compression = data.toString("ascii", 18, 22);
      const float = compression === "fl32" || compression === "FL32" || compression === "fl64";
      if (compression !== "NONE" && compression !== "sowt" && !float)
        throw unsupported(`compression ${compression}`);
      comm = {
        channels,
        sampleRate: Math.round(sampleRate),
        bitsPerSample: compression === "fl64" ? 64 : float ? 32 : bitsPerSample,
        float,
        bigEndian: compression !== "sowt",
      };
    } else if (id === "SSND") {
      const header = await readAt(body, 8);
      const offset = header.readUInt32BE(0);
      const dataOffset = body + 8 + offset;
      sound = {
        dataOffset,
        dataSize: Math.max(0, Math.min(size - 8 - offset, fileSize - dataOffset)),
      };
    }
    position = body + size + (size % 2);
  }
  if (!comm || !sound) throw unsupported("missing COMM or SSND chunk");
  if (!comm.channels || !comm.sampleRate || !comm.bitsPerSample)
    throw unsupported("invalid format");
  const frameSize = comm.channels * Math.ceil(comm.bitsPerSample / 8);
  // Keep the data a whole number of frames so the WAV stays well formed.
  return { ...comm, ...sound, dataSize: sound.dataSize - (sound.dataSize % frameSize) };
}

export function wavHeader(layout: AiffLayout): Buffer {
  const bytesPerSample = Math.ceil(layout.bitsPerSample / 8);
  const blockAlign = layout.channels * bytesPerSample;
  const header = Buffer.alloc(WAV_HEADER_SIZE);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + layout.dataSize, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(layout.float ? 3 : 1, 20);
  header.writeUInt16LE(layout.channels, 22);
  header.writeUInt32LE(layout.sampleRate, 24);
  header.writeUInt32LE(layout.sampleRate * blockAlign, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bytesPerSample * 8, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(layout.dataSize, 40);
  return header;
}

export function wavSize(layout: AiffLayout) {
  return WAV_HEADER_SIZE + layout.dataSize;
}

/** Reads `length` bytes of the virtual WAV file starting at `start`. */
export async function readWav(
  layout: AiffLayout,
  readAt: ReadAt,
  start: number,
  length: number,
): Promise<Buffer> {
  const end = Math.min(start + length, wavSize(layout));
  const parts: Buffer[] = [];
  if (start < WAV_HEADER_SIZE)
    parts.push(wavHeader(layout).subarray(start, Math.min(end, WAV_HEADER_SIZE)));
  const dataStart = Math.max(start, WAV_HEADER_SIZE) - WAV_HEADER_SIZE;
  const dataEnd = end - WAV_HEADER_SIZE;
  if (dataEnd > dataStart) {
    const width = Math.ceil(layout.bitsPerSample / 8);
    // Convert whole samples, then trim to the requested range.
    const alignedStart = dataStart - (dataStart % width);
    const alignedEnd = Math.min(layout.dataSize, Math.ceil(dataEnd / width) * width);
    const samples = await readAt(layout.dataOffset + alignedStart, alignedEnd - alignedStart);
    convertSamples(samples, width, layout);
    parts.push(samples.subarray(dataStart - alignedStart, dataEnd - alignedStart));
  }
  return parts.length === 1 ? parts[0] : Buffer.concat(parts);
}

function convertSamples(samples: Buffer, width: number, layout: AiffLayout) {
  const whole = samples.length - (samples.length % width);
  if (width === 1) {
    // AIFF 8-bit PCM is signed, WAV 8-bit PCM is unsigned.
    for (let index = 0; index < whole; index += 1) samples[index] ^= 0x80;
    return;
  }
  if (!layout.bigEndian) return;
  if (width === 2) samples.subarray(0, whole).swap16();
  else if (width === 4) samples.subarray(0, whole).swap32();
  else if (width === 8) samples.subarray(0, whole).swap64();
  else {
    for (let index = 0; index < whole; index += width)
      samples.subarray(index, index + width).reverse();
  }
}

export function isAiffPath(filePath: string) {
  return /\.aiff?$/i.test(filePath);
}

/** Converts a whole in-memory AIFF file to WAV for Web Audio decoding. */
export async function aiffToWav(bytes: Buffer): Promise<Buffer> {
  const readAt = async (position: number, length: number) =>
    bytes.subarray(position, position + length);
  const layout = await parseAiff(readAt, bytes.length);
  // readWav converts samples in place, so work on a copy of the source bytes.
  const copy = Buffer.from(bytes);
  return readWav(
    layout,
    async (position, length) => copy.subarray(position, position + length),
    0,
    wavSize(layout),
  );
}
