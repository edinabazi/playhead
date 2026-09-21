import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EqualizerBandSlider } from "../EqualizerControls";

afterEach(cleanup);

describe("equalizer slider input", () => {
  it("previews pointer changes, commits on release, and restores keyboard focus styling", () => {
    const preview = vi.fn();
    const commit = vi.fn();
    const { getByRole } = render(
      <EqualizerBandSlider
        label="1k"
        ariaLabel="1 kHz"
        gainDb={0}
        onPreview={preview}
        onCommit={commit}
      />,
    );
    const slider = getByRole("slider");
    slider.setPointerCapture = vi.fn();
    // jsdom has no native PointerEvent. Supply the pointer fields used by the component.
    const down = new Event("pointerdown", { bubbles: true });
    Object.assign(down, { button: 0, pointerId: 1, clientY: 20 });
    fireEvent(slider, down);
    expect(preview).toHaveBeenCalledOnce();
    expect(commit).not.toHaveBeenCalled();
    expect(slider.className).not.toContain("focus-visible:ring-1");
    fireEvent.pointerUp(slider);
    expect(commit).toHaveBeenCalledWith(preview.mock.calls[0][0]);
    fireEvent.blur(slider);
    fireEvent.focus(slider);
    expect(slider.className).toContain("focus-visible:ring-1");
    expect(slider.getAttribute("aria-orientation")).toBe("vertical");
  });

  it("handles arrow keys without seeking the track and resets with Home", () => {
    const commit = vi.fn();
    const globalKey = vi.fn();
    window.addEventListener("keydown", globalKey);
    try {
      const { getByRole } = render(
        <EqualizerBandSlider
          label="1k"
          ariaLabel="1 kHz"
          gainDb={2}
          onPreview={vi.fn()}
          onCommit={commit}
        />,
      );
      const slider = getByRole("slider");
      fireEvent.keyDown(slider, { key: "ArrowUp" });
      expect(commit).toHaveBeenLastCalledWith(2.5);
      fireEvent.keyDown(slider, { key: "ArrowDown", shiftKey: true });
      expect(commit).toHaveBeenLastCalledWith(-1);
      fireEvent.keyDown(slider, { key: "Home" });
      expect(commit).toHaveBeenLastCalledWith(0);
      expect(globalKey).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener("keydown", globalKey);
    }
  });
});
