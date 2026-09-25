import { open, type FileHandle } from "node:fs/promises";
import { extname } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { playbackFailure } from "../../shared/playback";

const mimeTypes: Record<string, string> = {
  ".aac": "audio/aac",
  ".aif": "audio/aiff",
  ".aiff": "audio/aiff",
  ".flac": "audio/flac",
  ".m4a": "audio/mp4",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".opus": "audio/ogg",
  ".wav": "audio/wav",
};
const retryable = new Set(["EIO", "ESTALE", "ETIMEDOUT", "ENOTCONN", "EAGAIN", "EINTR", "EBUSY"]);
export async function retryFileOperation<T>(
  operation: () => Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!retryable.has((error as NodeJS.ErrnoException).code || "") || signal?.aborted) throw error;
    await delay(150, undefined, { signal });
    return operation();
  }
}

export function byteRange(
  header: string | null,
  size: number,
): { start: number; end: number } | null | "invalid" {
  if (!header || !header.toLowerCase().startsWith("bytes=")) return null;
  // Multiple ranges may be ignored; a full response is valid and avoids malformed multipart data.
  if (header.includes(",")) return null;
  const match = /^bytes=(\d*)-(\d*)$/i.exec(header.trim());
  if (!match || (!match[1] && !match[2]) || size === 0) return "invalid";
  const first = Number(match[1]);
  const last = match[2] ? Number(match[2]) : size - 1;
  if (!Number.isSafeInteger(first) || !Number.isSafeInteger(last)) return "invalid";
  if (!match[1]) return last > 0 ? { start: Math.max(0, size - last), end: size - 1 } : "invalid";
  if (first >= size || first > last) return "invalid";
  return { start: first, end: Math.min(last, size - 1) };
}

export async function fileResponse(filePath: string, request: Request): Promise<Response> {
  const baseHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-store",
  };
  if (request.method !== "GET" && request.method !== "HEAD")
    return new Response(null, { status: 405, headers: { ...baseHeaders, Allow: "GET, HEAD" } });
  let file: FileHandle | undefined;
  let closed = false;
  let bodyController: ReadableStreamDefaultController<Uint8Array> | undefined;
  const close = async () => {
    if (closed) return;
    closed = true;
    request.signal.removeEventListener("abort", onAbort);
    await file?.close().catch(() => {});
  };
  const onAbort = () => {
    if (!closed) bodyController?.error(new DOMException("Cancelled", "AbortError"));
    void close();
  };
  try {
    file = await retryFileOperation(() => open(filePath, "r"), request.signal);
    if (request.signal.aborted) {
      await close();
      return new Response(null, { status: 499 });
    }
    const info = await retryFileOperation(() => file!.stat(), request.signal);
    if (!info.isFile()) {
      await close();
      return new Response(null, { status: 404, headers: baseHeaders });
    }
    if (request.signal.aborted) {
      await close();
      return new Response(null, { status: 499 });
    }
    const range =
      request.method === "HEAD" ? null : byteRange(request.headers.get("range"), info.size);
    if (range === "invalid") {
      await close();
      return new Response(null, {
        status: 416,
        headers: { ...baseHeaders, "Content-Range": `bytes */${info.size}` },
      });
    }
    const start = range?.start ?? 0;
    const end = range?.end ?? info.size - 1;
    const headers = {
      ...baseHeaders,
      "Content-Type": mimeTypes[extname(filePath).toLowerCase()] || "application/octet-stream",
      "Content-Length": String(end - start + 1),
      ...(range ? { "Content-Range": `bytes ${start}-${end}/${info.size}` } : {}),
    };
    if (request.method === "HEAD" || info.size === 0) {
      await close();
      return new Response(null, { headers });
    }
    let position = start;
    const handle = file;
    request.signal.addEventListener("abort", onAbort, { once: true });
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        bodyController = controller;
      },
      async pull(controller) {
        if (closed || request.signal.aborted) {
          controller.error(new DOMException("Cancelled", "AbortError"));
          await close();
          return;
        }
        try {
          const buffer = Buffer.allocUnsafe(Math.min(64 * 1024, end - position + 1));
          const { bytesRead } = await retryFileOperation(async () => {
            const result = await handle.read(buffer, 0, buffer.length, position);
            if (!result.bytesRead)
              throw Object.assign(
                new Error("Audio stream ended before the requested range was read"),
                { code: "EIO" },
              );
            return result;
          }, request.signal);
          if (closed) return;
          position += bytesRead;
          controller.enqueue(new Uint8Array(buffer.buffer, buffer.byteOffset, bytesRead));
          if (position > end) {
            controller.close();
            await close();
          }
        } catch (error) {
          if (!closed) controller.error(error);
          await close();
        }
      },
      cancel: close,
    });
    return new Response(stream, { status: range ? 206 : 200, headers });
  } catch (error) {
    await close();
    const failure = playbackFailure(error);
    const status = failure.kind === "missing" ? 404 : failure.kind === "denied" ? 403 : 503;
    return new Response(failure.message, { status, headers: baseHeaders });
  }
}
