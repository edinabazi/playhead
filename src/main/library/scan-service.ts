import type { Worker } from "node:worker_threads";
import type { LibraryArtwork, LibraryState } from "../../shared/library";
import type {
  LibraryScanProgress,
  LibraryScanRequest,
  LibraryScanResult,
} from "../../shared/library-scan";
import type { ScanWorkerData, ScanWorkerMessage } from "./scan-worker";

type ScanJob = {
  request: LibraryScanRequest & { paths: string[] };
  owner: number;
  progress: (progress: LibraryScanProgress) => void;
  resolve: (result: LibraryScanResult) => void;
  reject: (error: Error) => void;
  cancelled: boolean;
  worker?: Worker;
  stop?: () => void;
};

// One worker across foreground imports and watcher rescans bounds disk/CPU concurrency.
export class ScanService {
  private queue: ScanJob[] = [];
  private current: ScanJob | null = null;
  constructor(
    private readonly dependencies: {
      createWorker: (data: ScanWorkerData) => Worker;
      getTracks: () => Promise<LibraryState["tracks"]>;
      artworkDirectory: string;
      writeArtwork: (key: string, bytes: Uint8Array) => Promise<LibraryArtwork>;
    },
  ) {}

  run(
    owner: number,
    request: LibraryScanRequest & { paths: string[] },
    progress: ScanJob["progress"],
  ): Promise<LibraryScanResult> {
    return new Promise((resolve, reject) => {
      const job: ScanJob = { owner, request, progress, resolve, reject, cancelled: false };
      this.queue.push(job);
      progress({
        id: request.id,
        phase: "queued",
        folderName: "",
        folderIndex: 0,
        folderCount: request.paths.length,
        discovered: 0,
        processed: 0,
        directories: 0,
      });
      void this.next();
    });
  }

  cancel(owner: number, id?: string) {
    for (const job of [...this.queue, ...(this.current ? [this.current] : [])]) {
      if (job.owner !== owner || (id && job.request.id !== id)) continue;
      job.cancelled = true;
      job.resolve({ status: "cancelled" });
      job.stop?.();
    }
    this.queue = this.queue.filter((job) => !job.cancelled);
  }

  private async next() {
    if (this.current || !this.queue.length) return;
    const job = this.queue.shift()!;
    this.current = job;
    try {
      const tracks = await this.dependencies.getTracks();
      if (job.cancelled) return;
      const worker = this.dependencies.createWorker({
        ...job.request,
        existingTracks: tracks,
        artworkDirectory: this.dependencies.artworkDirectory,
      });
      job.worker = worker;
      await new Promise<void>((finish) => {
        let settled = false;
        let lastProgress: LibraryScanProgress | undefined;
        const stop = () => {
          if (settled) return;
          settled = true;
          worker.removeAllListeners();
          // An error already in flight during cancellation must not become unhandled.
          worker.on("error", () => {});
          // Wait for termination before starting another job, even if it was cancelled.
          void worker
            .terminate()
            .catch(() => {})
            .finally(() => {
              worker.removeAllListeners();
              finish();
            });
        };
        job.stop = stop;
        worker.on("message", (message: ScanWorkerMessage) => {
          if (job.cancelled || settled) return;
          if (message.type === "progress") {
            lastProgress = message.progress;
            job.progress(message.progress);
          } else if (message.type === "artwork") {
            void this.dependencies.writeArtwork(message.key, message.bytes).then(
              (artwork) => {
                if (!settled) worker.postMessage({ id: message.id, artwork });
              },
              () => {
                if (!settled) worker.postMessage({ id: message.id, error: "Artwork unavailable" });
              },
            );
          } else if (message.type === "complete") {
            if (lastProgress) job.progress({ ...lastProgress, phase: "finishing" });
            job.resolve({ status: "completed", folders: message.folders });
            stop();
          } else {
            job.reject(new Error(message.message));
            stop();
          }
        });
        worker.once("error", (error) => {
          job.reject(error instanceof Error ? error : new Error("Library scan failed."));
          stop();
        });
        worker.once("exit", () => {
          if (!settled) {
            job.reject(new Error("Library scanning stopped unexpectedly. Please try again."));
            stop();
          }
        });
      });
    } catch (error) {
      if (!job.cancelled)
        job.reject(error instanceof Error ? error : new Error("Could not scan the library."));
    } finally {
      this.current = null;
      void this.next();
    }
  }
}
