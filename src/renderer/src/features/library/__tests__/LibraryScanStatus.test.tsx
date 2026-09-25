import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { LibraryScanStatus } from "../LibraryScanStatus";
import type { LibraryScanProgress } from "../../../../../shared/library-scan";
afterEach(cleanup);
it("shows real counts, ignores other jobs and cancels only the visible scan", () => {
  let update!: (p: LibraryScanProgress) => void;
  const cancelLibraryScan = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(window, "playhead", {
    configurable: true,
    value: {
      onLibraryScanProgress: (callback: typeof update) => {
        update = callback;
        return vi.fn();
      },
      cancelLibraryScan,
    },
  });
  const view = render(<LibraryScanStatus scanId="mine" />);
  const progress: LibraryScanProgress = {
    id: "other",
    phase: "reading",
    folderName: "NAS Music",
    discovered: 110000,
    processed: 55000,
    directories: 5501,
    folderIndex: 1,
    folderCount: 1,
  };
  act(() => update(progress));
  expect(view.queryByRole("progressbar")).toBeNull();
  act(() => update({ ...progress, id: "mine" }));
  expect(view.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("50");
  expect(view.getByText("55,000 of 110,000 tracks")).toBeTruthy();
  fireEvent.click(view.getByRole("button", { name: "Cancel" }));
  expect(cancelLibraryScan).toHaveBeenCalledExactlyOnceWith("mine");
  expect(view.getByRole("status").textContent).toBe("Cancelling scan…");
});
