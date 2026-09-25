import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, mkdtemp, rm, stat } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { pipeline } from "node:stream/promises";
import { retryFileOperation } from "./file-response";

// Disk-backed and bounded: long recordings must not be duplicated into renderer memory.
export class PlaybackCopies {
  private directory: Promise<string> | null = null;
  private copies = new Map<string, { path: string; size: number; mtimeMs: number }>();
  constructor(
    private readonly parent: string,
    private readonly maxBytes = 512 * 1024 * 1024,
  ) {}

  async prepare(source: string, signal: AbortSignal): Promise<string> {
    signal.throwIfAborted();
    const before = await retryFileOperation(() => stat(source), signal);
    if (!before.isFile()) throw Object.assign(new Error("Not an audio file"), { code: "ENOENT" });
    signal.throwIfAborted();
    let cached = this.copies.get(source);
    if (cached && !(await stat(cached.path).catch(() => null))) {
      this.copies.delete(source);
      cached = undefined;
    }
    if (cached && cached.size === before.size && cached.mtimeMs === before.mtimeMs) {
      this.copies.delete(source);
      this.copies.set(source, cached);
      return cached.path;
    }
    this.directory ??= (async () => {
      await mkdir(this.parent, { recursive: true });
      return mkdtemp(join(this.parent, "playhead-playback-"));
    })();
    const directory = await this.directory;
    const destination = join(directory, `${randomUUID()}${extname(basename(source))}`);
    try {
      await retryFileOperation(async () => {
        signal.throwIfAborted();
        await pipeline(createReadStream(source), createWriteStream(destination, { mode: 0o600 }), {
          signal,
        });
        const [after, copy] = await Promise.all([stat(source), stat(destination)]);
        if (
          copy.size !== before.size ||
          after.size !== before.size ||
          after.mtimeMs !== before.mtimeMs
        )
          throw Object.assign(new Error("Audio file changed or became unavailable while copying"), {
            code: "EIO",
          });
      }, signal);
      signal.throwIfAborted();
      if (cached) await rm(cached.path, { force: true });
      signal.throwIfAborted();
      this.copies.delete(source);
      this.copies.set(source, { path: destination, size: before.size, mtimeMs: before.mtimeMs });
      // Keep at most two tracks, or one oversized recording. Never evict the newly prepared track.
      let bytes = [...this.copies.values()].reduce((total, copy) => total + copy.size, 0);
      for (const [key, copy] of this.copies) {
        if (key === source || (this.copies.size <= 2 && bytes <= this.maxBytes)) break;
        this.copies.delete(key);
        bytes -= copy.size;
        await rm(copy.path, { force: true }).catch(() => {});
      }
      return destination;
    } catch (error) {
      await rm(destination, { force: true }).catch(() => {});
      throw error;
    }
  }
  async dispose() {
    if (this.directory) await rm(await this.directory, { recursive: true, force: true });
    this.copies.clear();
  }
}
