// @vitest-environment node
import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("node:fs/promises", async (original) => {
  const actual = await original<typeof import("node:fs/promises")>();
  return { ...actual, open: vi.fn(actual.open) };
});
import { byteRange, fileResponse } from "../file-response";
let directory: string;
let path: string;
beforeEach(async () => {
  directory = await fs.mkdtemp(join(tmpdir(), "playhead-stream-test-"));
  path = join(directory, "song.mp3");
  await fs.writeFile(path, "0123456789");
});
afterEach(async () => {
  vi.restoreAllMocks();
  await fs.rm(directory, { recursive: true, force: true });
});
const request = (range?: string, method = "GET", signal?: AbortSignal) =>
  new Request("https://audio.test/song", {
    method,
    signal,
    headers: range ? { Range: range } : {},
  });
it.each([
  [undefined, 200, "0123456789", null],
  ["bytes=2-4", 206, "234", "bytes 2-4/10"],
  ["bytes=-3", 206, "789", "bytes 7-9/10"],
  ["bytes=-50", 206, "0123456789", "bytes 0-9/10"],
  ["bytes=8-", 206, "89", "bytes 8-9/10"],
  ["bytes=8-50", 206, "89", "bytes 8-9/10"],
  ["bytes=0-1,5-6", 200, "0123456789", null],
])("serves %s with correct byte content and length", async (range, status, body, contentRange) => {
  const response = await fileResponse(path, request(range));
  expect(response.status).toBe(status);
  expect(response.headers.get("content-length")).toBe(String(body.length));
  expect(response.headers.get("content-range")).toBe(contentRange);
  expect(await response.text()).toBe(body);
});
it.each(["bytes=-", "bytes=-0", "bytes=10-", "bytes=9-8", "bytes=9007199254740992-", "bytes=bad"])(
  "rejects invalid range %s",
  async (range) => {
    const response = await fileResponse(path, request(range));
    expect(response.status).toBe(416);
    expect(response.headers.get("content-range")).toBe("bytes */10");
  },
);
it("supports HEAD without a body and maps file access failures", async () => {
  const head = await fileResponse(path, request(undefined, "HEAD"));
  expect(head.headers.get("content-length")).toBe("10");
  expect(await head.text()).toBe("");
  expect((await fileResponse(`${path}.missing`, request())).status).toBe(404);
  vi.spyOn(fs, "open").mockRejectedValue(
    Object.assign(new Error("private path"), { code: "EACCES" }),
  );
  const denied = await fileResponse(path, request());
  expect(denied.status).toBe(403);
  expect(await denied.text()).not.toContain("private path");
});
it("retries a transient mount error, completes short reads and closes its handle", async () => {
  const close = vi.fn().mockResolvedValue(undefined);
  const handle = {
    stat: async () => ({ size: 10, isFile: () => true }),
    close,
    read: vi.fn(async (buffer: Buffer, _offset: number, length: number, position: number) => {
      const chunk = Buffer.from("0123456789").subarray(position, position + Math.min(3, length));
      chunk.copy(buffer);
      return { bytesRead: chunk.length };
    }),
  };
  vi.spyOn(fs, "open")
    .mockRejectedValueOnce(Object.assign(new Error("mount waking"), { code: "EIO" }))
    .mockResolvedValue(handle as unknown as fs.FileHandle);
  expect(await (await fileResponse(path, request())).text()).toBe("0123456789");
  expect(handle.read).toHaveBeenCalledTimes(4);
  expect(close).toHaveBeenCalledOnce();
});
it("reports truncated streams instead of presenting partial audio as a complete response", async () => {
  const close = vi.fn().mockResolvedValue(undefined);
  vi.spyOn(fs, "open").mockResolvedValue({
    stat: async () => ({ size: 10, isFile: () => true }),
    close,
    read: async () => ({ bytesRead: 0 }),
  } as unknown as fs.FileHandle);
  const response = await fileResponse(path, request());
  await expect(response.text()).rejects.toThrow("ended before");
  expect(close).toHaveBeenCalledOnce();
});
it("closes the file when a reader cancels, and handles an already aborted request", async () => {
  const close = vi.fn().mockResolvedValue(undefined);
  vi.spyOn(fs, "open").mockResolvedValue({
    stat: async () => ({ size: 10, isFile: () => true }),
    close,
    read: async () => ({ bytesRead: 1 }),
  } as unknown as fs.FileHandle);
  const response = await fileResponse(path, request());
  await response.body!.cancel();
  expect(close).toHaveBeenCalledOnce();
  const controller = new AbortController();
  controller.abort();
  expect((await fileResponse(path, request(undefined, "GET", controller.signal))).status).toBe(499);
  expect(byteRange("bytes=0-", 0)).toBe("invalid");
});
