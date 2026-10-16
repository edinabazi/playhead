import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/lib/i18n";
import { WindowControls } from "../WindowControls";
import { WindowsWindowControls } from "../WindowsWindowControls";

type MaximizedListener = (maximized: boolean) => void;

const playhead = {
  closeWindow: vi.fn(async () => undefined),
  minimizeWindow: vi.fn(async () => undefined),
  toggleMaximizeWindow: vi.fn(async () => undefined),
  isWindowMaximized: vi.fn(async () => false),
  onWindowMaximizedChanged: vi.fn<(listener: MaximizedListener) => () => void>(() => () => undefined),
};

function setPlatform(platform: string) {
  Object.defineProperty(window.navigator, "platform", {
    value: platform,
    configurable: true,
  });
}

function renderControls() {
  return render(
    <I18nProvider language="en">
      <WindowsWindowControls />
    </I18nProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  playhead.isWindowMaximized.mockResolvedValue(false);
  playhead.onWindowMaximizedChanged.mockImplementation(() => () => undefined);
  Object.defineProperty(window, "playhead", { value: playhead, configurable: true, writable: true });
});

afterEach(cleanup);

describe("Windows window controls", () => {
  it("drives minimize, maximize and close over the window bridge", async () => {
    renderControls();

    fireEvent.click(screen.getByRole("button", { name: "Minimize window" }));
    expect(playhead.minimizeWindow).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole("button", { name: "Maximize window" }));
    expect(playhead.toggleMaximizeWindow).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole("button", { name: "Close window" }));
    expect(playhead.closeWindow).toHaveBeenCalledOnce();
  });

  it("shows the restore glyph once the window reports maximized", async () => {
    playhead.isWindowMaximized.mockResolvedValue(true);
    renderControls();

    const restore = await screen.findByRole("button", { name: "Restore window" });
    expect(restore).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Maximize window" })).toBeNull();
  });

  it("follows maximized changes made outside these controls", async () => {
    let emit: ((maximized: boolean) => void) | undefined;
    playhead.onWindowMaximizedChanged.mockImplementation(
      (callback: (maximized: boolean) => void) => {
        emit = callback;
        return () => undefined;
      },
    );
    renderControls();

    await screen.findByRole("button", { name: "Maximize window" });
    await act(async () => {
      emit?.(true);
    });
    await screen.findByRole("button", { name: "Restore window" });
    await act(async () => {
      emit?.(false);
    });
    await screen.findByRole("button", { name: "Maximize window" });
  });

  it("unsubscribes from maximized changes when unmounted", async () => {
    const unsubscribe = vi.fn();
    playhead.onWindowMaximizedChanged.mockImplementation(() => unsubscribe);
    const { unmount } = renderControls();

    await waitFor(() => expect(playhead.onWindowMaximizedChanged).toHaveBeenCalledOnce());
    unmount();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});

describe("platform-specific control rendering", () => {
  it("renders Windows controls instead of traffic lights on Windows", () => {
    setPlatform("Win32");
    const { container } = render(
      <I18nProvider language="en">
        <WindowControls />
      </I18nProvider>,
    );
    expect(container.querySelector(".window-control")).toBeNull();
  });

  it("still renders traffic lights on Linux", () => {
    setPlatform("Linux x86_64");
    const { container } = render(
      <I18nProvider language="en">
        <WindowControls />
      </I18nProvider>,
    );
    expect(container.querySelectorAll(".window-control")).toHaveLength(3);
  });

  it("renders nothing on macOS, which uses the system controls", () => {
    setPlatform("MacIntel");
    const { container } = render(
      <I18nProvider language="en">
        <WindowControls />
      </I18nProvider>,
    );
    expect(container.querySelectorAll(".window-control")).toHaveLength(0);
  });
});
