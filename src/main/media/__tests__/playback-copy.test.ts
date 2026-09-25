// @vitest-environment node
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { PlaybackCopies } from "../playback-copy";
let directory: string;
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "playhead-copy-test-"));
});
afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});
it("copies locally, reuses unchanged data, invalidates edits and removes its temporary files", async () => {
  const source = join(directory, "source.flac");
  await writeFile(source, "first audio");
  const copies = new PlaybackCopies(directory);
  const signal = new AbortController().signal;
  const first = await copies.prepare(source, signal);
  expect(first).not.toBe(source);
  expect(await readFile(first, "utf8")).toBe("first audio");
  expect(await copies.prepare(source, signal)).toBe(first);
  await writeFile(source, "changed audio content");
  const second = await copies.prepare(source, signal);
  expect(second).not.toBe(first);
  expect(await readFile(second, "utf8")).toBe("changed audio content");
  await expect(stat(first)).rejects.toMatchObject({ code: "ENOENT" });
  await copies.dispose();
  await expect(stat(second)).rejects.toMatchObject({ code: "ENOENT" });
  expect(await readFile(source, "utf8")).toBe("changed audio content");
});
it("bounds retained copies without rejecting large recordings", async () => {
  const copies = new PlaybackCopies(directory, 10);
  const first = join(directory, "one.wav");
  const second = join(directory, "two.wav");
  await writeFile(first, "0123456789");
  await writeFile(second, "01234567890123456789");
  const signal = new AbortController().signal;
  const old = await copies.prepare(first, signal);
  const current = await copies.prepare(second, signal);
  await expect(stat(old)).rejects.toMatchObject({ code: "ENOENT" });
  expect((await stat(current)).size).toBe(20);
  await copies.dispose();
});
it("doesn't copy cancelled requests or leave partial files after missing sources", async () => {
  const copies = new PlaybackCopies(directory);
  const controller = new AbortController();
  controller.abort();
  await expect(copies.prepare("missing.wav", controller.signal)).rejects.toMatchObject({
    name: "AbortError",
  });
  await expect(copies.prepare("missing.wav", new AbortController().signal)).rejects.toMatchObject({
    code: "ENOENT",
  });
  expect(await readdir(directory)).toEqual([]);
});
