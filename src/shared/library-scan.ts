import type { ScannedFolder } from "./library";

export type ScanProgress = {
  phase: "discovering" | "reading";
  discovered: number;
  processed: number;
  directories: number;
};

export type LibraryScanProgress = Omit<ScanProgress, "phase"> & {
  id: string;
  phase: ScanProgress["phase"] | "queued" | "finishing";
  folderName: string;
  folderIndex: number;
  folderCount: number;
};

export type LibraryScanRequest = { id: string; paths?: string[]; extensions?: string[] };
export type LibraryScanResult =
  | { status: "completed"; folders: ScannedFolder[] }
  | { status: "cancelled" };
