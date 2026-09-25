// @vitest-environment node
import { EventEmitter } from "node:events";
import type { Worker } from "node:worker_threads";
import { expect, it, vi } from "vitest";
import { ScanService } from "../scan-service";

function fixture() {
  const workers: Array<
    EventEmitter & { terminate: ReturnType<typeof vi.fn>; postMessage: ReturnType<typeof vi.fn> }
  > = [];
  const service = new ScanService({
    createWorker: () => {
      const worker = Object.assign(new EventEmitter(), {
        terminate: vi.fn().mockResolvedValue(0),
        postMessage: vi.fn(),
      });
      workers.push(worker);
      return worker as unknown as Worker;
    },
    getTracks: async () => ({}),
    artworkDirectory: "/artwork",
    writeArtwork: async () => ({ mimeType: "image/png", src: "artwork" }),
  });
  return { service, workers };
}
const request = (id: string) => ({ id, paths: ["/music"] });
it("serializes scans and waits for cancelled workers to stop before starting another", async () => {
  const { service, workers } = fixture();
  const first = service.run(1, request("first"), vi.fn());
  const next = service.run(1, request("next"), vi.fn());
  await vi.waitFor(() => expect(workers).toHaveLength(1));
  let terminate!: () => void;
  workers[0].terminate.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        terminate = resolve;
      }),
  );
  service.cancel(2, "first"); // Another window cannot cancel this scan.
  expect(workers[0].terminate).not.toHaveBeenCalled();
  service.cancel(1, "first");
  expect(await first).toEqual({ status: "cancelled" });
  expect(workers).toHaveLength(1);
  terminate();
  await vi.waitFor(() => expect(workers).toHaveLength(2));
  workers[1].emit("message", { type: "complete", folders: [] });
  expect(await next).toEqual({ status: "completed", folders: [] });
});
it("removes queued scans on cancellation and rejects worker failures without returning partial folders", async () => {
  const { service, workers } = fixture();
  const first = service.run(1, request("first"), vi.fn());
  const rejected = expect(first).rejects.toThrow("Disconnected");
  const queued = service.run(1, request("queued"), vi.fn());
  service.cancel(1, "queued");
  expect(await queued).toEqual({ status: "cancelled" });
  await vi.waitFor(() => expect(workers).toHaveLength(1));
  workers[0].emit("message", { type: "error", message: "Disconnected" });
  await rejected;
  expect(workers[0].terminate).toHaveBeenCalledOnce();
});
