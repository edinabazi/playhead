import { act, cleanup, render } from "@testing-library/react";
import { MotionConfig } from "framer-motion";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NowPlayingBars } from "../NowPlayingBars";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "performance"] });
  vi.spyOn(document, "hasFocus").mockReturnValue(true);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function Bars({ reduced = false }: { reduced?: boolean }) {
  return (
    <MotionConfig reducedMotion={reduced ? "always" : "never"}>
      <NowPlayingBars heights={[5, 10, 7, 13]} className="bars" />
    </MotionConfig>
  );
}
const advance = () => act(() => vi.advanceTimersByTime(400));

describe("live motion preference", () => {
  it("stops and resumes existing bars without remounting, and stops the idle timer", () => {
    const { container, rerender } = render(<Bars />);
    const bar = container.querySelector(".bars span") as HTMLElement;
    const initial = bar.style.transform;
    advance();
    expect(bar.style.transform).not.toBe(initial);
    rerender(<Bars reduced />);
    expect(container.querySelector(".bars span")).toBe(bar);
    const resting = bar.style.transform;
    expect(vi.getTimerCount()).toBe(0);
    advance();
    expect(bar.style.transform).toBe(resting);
    rerender(<Bars />);
    advance();
    expect(bar.style.transform).not.toBe(resting);
    expect(vi.getTimerCount()).toBe(1);
  });

  it("does not start a timer when mounted with reduced motion", () => {
    const { container } = render(<Bars reduced />);
    expect(vi.getTimerCount()).toBe(0);
    expect((container.querySelector(".bars span") as HTMLElement).style.transform).toContain(
      "scaleY",
    );
  });

  it("shares one timer, suspends it on blur, and cleans up the last subscriber", () => {
    const first = render(<Bars />);
    const second = render(<Bars />);
    expect(vi.getTimerCount()).toBe(1);
    vi.mocked(document.hasFocus).mockReturnValue(false);
    act(() => window.dispatchEvent(new Event("blur")));
    expect(vi.getTimerCount()).toBe(0);
    vi.mocked(document.hasFocus).mockReturnValue(true);
    act(() => window.dispatchEvent(new Event("focus")));
    expect(vi.getTimerCount()).toBe(1);
    first.unmount();
    expect(vi.getTimerCount()).toBe(1);
    second.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
