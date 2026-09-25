import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PlaybackError } from "../PlaybackError";
import { playbackFailure } from "../../../../../shared/playback";
afterEach(cleanup);
it("shows a useful network message and keeps Retry keyboard activation away from global playback", () => {
  const retry = vi.fn();
  const globalKey = vi.fn();
  document.addEventListener("keydown", globalKey);
  try {
    const view = render(
      <PlaybackError failure={playbackFailure({ code: "EIO" })} onRetry={retry} />,
    );
    expect(view.getByRole("alert").textContent).toContain("Drive unavailable");
    const button = view.getByRole("button", { name: "Retry" });
    fireEvent.keyDown(button, { key: "Enter" });
    fireEvent.click(button);
    expect(globalKey).not.toHaveBeenCalled();
    expect(retry).toHaveBeenCalledOnce();
  } finally {
    document.removeEventListener("keydown", globalKey);
  }
});
