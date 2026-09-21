import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { LevelsPanel } from "../LevelsPanel";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it("detaches sampling on pause, close, hide and unmount, then resumes only when needed", () => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  const change = vi.fn();
  const read = vi.fn(() => false);
  const view = (open: boolean, playing: boolean) => (
    <LevelsPanel
      open={open}
      isPlaying={playing}
      reduceMotion={false}
      readLevels={read}
      onMeteringChange={change}
    />
  );
  const { rerender, unmount } = render(view(false, true));
  expect(change).toHaveBeenLastCalledWith(false);
  rerender(view(true, true));
  expect(change).toHaveBeenLastCalledWith(true);
  rerender(view(true, false));
  expect(change).toHaveBeenLastCalledWith(false);
  rerender(view(true, true));
  visibility.mockReturnValue("hidden");
  fireEvent(document, new Event("visibilitychange"));
  expect(change).toHaveBeenLastCalledWith(false);
  visibility.mockReturnValue("visible");
  fireEvent(document, new Event("visibilitychange"));
  expect(change).toHaveBeenLastCalledWith(true);
  rerender(view(false, true));
  expect(change).toHaveBeenLastCalledWith(false);
  unmount();
  expect(change).toHaveBeenLastCalledWith(false);
});
