// @vitest-environment node
import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { aiffToWav, parseAiff, WAV_HEADER_SIZE } from "../aiff";
import { fileResponse } from "../file-response";

function extended(value: number) {
  const buffer = Buffer.alloc(10);
  const exponent = Math.floor(Math.log2(value));
  buffer.writeUInt16BE(exponent + 16383, 0);
  buffer.writeUInt32BE(Math.floor(value * 2 ** (31 - exponent)) >>> 0, 2);
  return buffer;
}

function chunk(id: string, body: Buffer) {
  const header = Buffer.alloc(8);
  header.write(id, 0, "ascii");
  header.writeUInt32BE(body.length, 4);
  return Buffer.concat([header, body, body.length % 2 ? Buffer.alloc(1) : Buffer.alloc(0)]);
}

// 16-bit stereo AIFF with big-endian samples, plus an unrelated chunk before COMM.
function aiff(samples: number[], { aifc = "" } = {}) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((sample, index) =>
    aifc === "sowt" ? data.writeInt16LE(sample, index * 2) : data.writeInt16BE(sample, index * 2),
  );
  const comm = Buffer.concat([
    Buffer.from([0, 2]),
    Buffer.alloc(4),
    Buffer.from([0, 16]),
    extended(44100),
    ...(aifc ? [Buffer.from(aifc, "ascii"), Buffer.from([0])] : []),
  ]);
  comm.writeUInt32BE(samples.length / 2, 2);
  const body = Buffer.concat([
    Buffer.from(aifc ? "AIFC" : "AIFF", "ascii"),
    chunk("NAME", Buffer.from("odd", "ascii")),
    chunk("COMM", comm),
    chunk("SSND", Buffer.concat([Buffer.alloc(8), data])),
  ]);
  const form = Buffer.alloc(8);
  form.write("FORM", 0, "ascii");
  form.writeUInt32BE(body.length, 4);
  return Buffer.concat([form, body]);
}

const samples = [1, -2, 300, -400, 32767, -32768];
const pcm = Buffer.alloc(samples.length * 2);
samples.forEach((sample, index) => pcm.writeInt16LE(sample, index * 2));

it("parses AIFF and AIFF-C sowt layouts", async () => {
  const bytes = aiff(samples);
  const layout = await parseAiff(async (p, l) => bytes.subarray(p, p + l), bytes.length);
  expect(layout).toMatchObject({
    channels: 2,
    sampleRate: 44100,
    bitsPerSample: 16,
    bigEndian: true,
    dataSize: 12,
  });
  const sowt = aiff(samples, { aifc: "sowt" });
  expect(await parseAiff(async (p, l) => sowt.subarray(p, p + l), sowt.length)).toMatchObject({
    bigEndian: false,
  });
});

it("converts AIFF to little-endian WAV", async () => {
  for (const bytes of [aiff(samples), aiff(samples, { aifc: "sowt" })]) {
    const wav = await aiffToWav(bytes);
    expect(wav.toString("ascii", 0, 4)).toBe("RIFF");
    expect(wav.readUInt16LE(20)).toBe(1);
    expect(wav.readUInt32LE(24)).toBe(44100);
    expect(wav.subarray(WAV_HEADER_SIZE)).toEqual(pcm);
  }
});

let directory: string;
beforeEach(async () => {
  directory = await fs.mkdtemp(join(tmpdir(), "playhead-aiff-test-"));
});
afterEach(async () => {
  await fs.rm(directory, { recursive: true, force: true });
});

it("serves AIFF files as WAV with working byte ranges", async () => {
  const path = join(directory, "song.aiff");
  await fs.writeFile(path, aiff(samples));
  const wav = await aiffToWav(aiff(samples));

  const full = await fileResponse(path, new Request("https://audio.test/song"));
  expect(full.headers.get("Content-Type")).toBe("audio/wav");
  expect(Buffer.from(await full.arrayBuffer())).toEqual(wav);

  // A range that starts mid-sample still returns correctly swapped bytes.
  const partial = await fileResponse(
    path,
    new Request("https://audio.test/song", { headers: { Range: "bytes=40-48" } }),
  );
  expect(partial.status).toBe(206);
  expect(partial.headers.get("Content-Range")).toBe(`bytes 40-48/${wav.length}`);
  expect(Buffer.from(await partial.arrayBuffer())).toEqual(wav.subarray(40, 49));
});
