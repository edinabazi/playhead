import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ColumnResizeHandle } from "../ColumnResizeHandle";

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("PointerEvent", MouseEvent);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function setup() {
  const onPreview = vi.fn();
  const onCommit = vi.fn();
  const view = render(
    <div>
      <ColumnResizeHandle
        id="title"
        label="Title"
        width={300}
        onPreview={onPreview}
        onCommit={onCommit}
      />
    </div>,
  );
  const handle = view.getByRole("separator");
  handle.setPointerCapture = vi.fn();
  handle.releasePointerCapture = vi.fn();
  vi.spyOn(handle.parentElement!, "getBoundingClientRect").mockReturnValue({
    width: 300,
  } as DOMRect);
  return { handle, onPreview, onCommit };
}

it("previews during drag, clamps at minimum, and saves once on release", () => {
  const { handle, onPreview, onCommit } = setup();
  fireEvent.pointerDown(handle, { button: 0, clientX: 300 });
  fireEvent.pointerMove(handle, { clientX: 250 });
  expect(onPreview).toHaveBeenLastCalledWith(250);
  fireEvent.pointerMove(handle, { clientX: 10 });
  expect(onPreview).toHaveBeenLastCalledWith(180);
  expect(onCommit).not.toHaveBeenCalled();
  fireEvent.pointerUp(handle);
  expect(onCommit).toHaveBeenCalledExactlyOnceWith(180);
  expect(onPreview).toHaveBeenLastCalledWith(null);
  expect(document.body.style.cursor).toBe("");
});

it.each(["Escape", "pointercancel"])("cancels with %s without saving", (action) => {
  const { handle, onPreview, onCommit } = setup();
  fireEvent.pointerDown(handle, { button: 0, clientX: 300 });
  fireEvent.pointerMove(handle, { clientX: 400 });
  if (action === "Escape") fireEvent.keyDown(handle, { key: "Escape" });
  else fireEvent.pointerCancel(handle);
  fireEvent.pointerUp(handle);
  expect(onCommit).not.toHaveBeenCalled();
  expect(onPreview).toHaveBeenLastCalledWith(null);
});

it("supports keyboard sizing and resets without propagating playback shortcuts", () => {
  const { handle, onCommit } = setup();
  const globalKey = vi.fn();
  document.addEventListener("keydown", globalKey);
  try {
    fireEvent.keyDown(handle, { key: "ArrowRight" });
    expect(onCommit).toHaveBeenLastCalledWith(310);
    fireEvent.keyDown(handle, { key: "ArrowLeft", shiftKey: true });
    expect(onCommit).toHaveBeenLastCalledWith(260);
    fireEvent.keyDown(handle, { key: "Enter" });
    expect(onCommit).toHaveBeenLastCalledWith(undefined);
    expect(globalKey).not.toHaveBeenCalled();
    fireEvent.doubleClick(handle);
    expect(onCommit).toHaveBeenLastCalledWith(undefined);
  } finally {
    document.removeEventListener("keydown", globalKey);
  }
});
