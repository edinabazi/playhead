const audioMimeTypes: Record<string, string> = {
  ".aac": "audio/aac",
  ".aiff": "audio/aiff",
  ".flac": "audio/flac",
  ".m4a": "audio/mp4",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".opus": "audio/ogg; codecs=opus",
  ".wav": "audio/wav",
};

export function getAudioMimeType(path: string): string {
  const extensionStart = path.lastIndexOf(".");
  const extension = extensionStart >= 0 ? path.slice(extensionStart).toLowerCase() : "";
  return audioMimeTypes[extension] || "application/octet-stream";
}

export function toArrayBuffer(value: ArrayBuffer | Uint8Array): ArrayBuffer {
  if (value instanceof ArrayBuffer) return value;
  const copy = new Uint8Array(value.byteLength);
  copy.set(value);
  return copy.buffer;
}
