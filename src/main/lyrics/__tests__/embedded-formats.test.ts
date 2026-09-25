// @vitest-environment node
import { parseBuffer } from "music-metadata";
import { expect, it } from "vitest";
import { embeddedLyrics } from "../lyrics";

function id3Frame(id: string, payload: Buffer) {
  const frame = Buffer.alloc(10);
  frame.write(id);
  frame.writeUInt32BE(payload.length, 4);
  const length = frame.length + payload.length;
  return Buffer.concat([
    Buffer.from([
      0x49,
      0x44,
      0x33,
      3,
      0,
      0,
      (length >> 21) & 127,
      (length >> 14) & 127,
      (length >> 7) & 127,
      length & 127,
    ]),
    frame,
    payload,
  ]);
}
it("reads real MP3 USLT text and timestamped embedded LRC", async () => {
  for (const text of ["First line\nSecond line", "[00:01.20][00:03]Repeated\n[offset:200]"]) {
    const buffer = id3Frame(
      "USLT",
      Buffer.concat([Buffer.from([3]), Buffer.from("eng\0"), Buffer.from(text)]),
    );
    const lyrics = embeddedLyrics(await parseBuffer(buffer, { mimeType: "audio/mpeg" }));
    expect(lyrics?.synced).toBe(text.startsWith("["));
    if (lyrics?.synced)
      expect(lyrics.lines).toEqual([
        { time: 1, text: "Repeated" },
        { time: 2.8, text: "Repeated" },
      ]);
    else expect(lyrics?.lines.map((line) => line.text)).toEqual(["First line", "Second line"]);
  }
});
it("reads real ID3 synchronized lyrics in milliseconds", async () => {
  const first = Buffer.alloc(4);
  first.writeUInt32BE(1250);
  const second = Buffer.alloc(4);
  second.writeUInt32BE(2500);
  const payload = Buffer.concat([
    Buffer.from([3]),
    Buffer.from("eng"),
    Buffer.from([2, 1, 0]),
    Buffer.from("First\0"),
    first,
    Buffer.from("Second\0"),
    second,
  ]);
  const lyrics = embeddedLyrics(
    await parseBuffer(id3Frame("SYLT", payload), { mimeType: "audio/mpeg" }),
  );
  expect(lyrics?.lines).toEqual([
    { time: 1.25, text: "First" },
    { time: 2.5, text: "Second" },
  ]);
});
it("reads FLAC Vorbis lyrics without losing repeated timestamps or offsets", async () => {
  const stream = Buffer.alloc(34);
  stream.writeUInt16BE(4096, 0);
  stream.writeUInt16BE(4096, 2);
  stream.writeBigUInt64BE((44100n << 44n) | (15n << 36n) | 1323000n, 10);
  const tag = Buffer.from("LYRICS=[00:01][00:02]FLAC line\n[offset:-500]");
  const comment = Buffer.alloc(12);
  comment.writeUInt32LE(1, 4);
  comment.writeUInt32LE(tag.length, 8);
  const block = Buffer.alloc(4);
  block[0] = 0x84;
  block.writeUIntBE(comment.length + tag.length, 1, 3);
  const file = Buffer.concat([
    Buffer.from("fLaC"),
    Buffer.from([0, 0, 0, 34]),
    stream,
    block,
    comment,
    tag,
  ]);
  expect(embeddedLyrics(await parseBuffer(file, { mimeType: "audio/flac" }))?.lines).toEqual([
    { time: 1.5, text: "FLAC line" },
    { time: 2.5, text: "FLAC line" },
  ]);
});
it("reads MP4 lyrics atoms", async () => {
  const box = (name: string, payload: Buffer) => {
    const header = Buffer.alloc(8);
    header.writeUInt32BE(8 + payload.length);
    header.write(name, 4, "latin1");
    return Buffer.concat([header, payload]);
  };
  const valueHeader = Buffer.alloc(8);
  valueHeader.writeUInt32BE(1);
  const lyrics = box(
    "©lyr",
    box("data", Buffer.concat([valueHeader, Buffer.from("MP4 first line\nSecond line")])),
  );
  const file = Buffer.concat([
    box("ftyp", Buffer.from("M4A \0\0\0\0M4A isom")),
    box("moov", box("udta", box("meta", Buffer.concat([Buffer.alloc(4), box("ilst", lyrics)])))),
  ]);
  expect(embeddedLyrics(await parseBuffer(file, { mimeType: "audio/mp4" }))?.lines[0].text).toBe(
    "MP4 first line",
  );
});
