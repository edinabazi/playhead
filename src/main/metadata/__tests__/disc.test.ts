import { parseBuffer } from "music-metadata";
import { describe, expect, it } from "vitest";
import { getDiscMetadata } from "../disc";

function id3Disc(value: string): Buffer {
  const text = Buffer.from(`\x03${value}`, "utf8");
  const frame = Buffer.alloc(10);
  frame.write("TPOS");
  frame.writeUInt32BE(text.length, 4);
  const header = Buffer.from([0x49, 0x44, 0x33, 4, 0, 0, 0, 0, 0, frame.length + text.length]);
  return Buffer.concat([header, frame, text]);
}

describe("native Disc tags", () => {
  it.each(["Warm-up", "Peak time", "2/10"])(
    "preserves %s through the real ID3 parser",
    async (value) => {
      const metadata = await parseBuffer(id3Disc(value), { mimeType: "audio/mpeg" });
      expect(getDiscMetadata(metadata)).toBe(value);
    },
  );
});
