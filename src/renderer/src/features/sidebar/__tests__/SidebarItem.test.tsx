import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SidebarItem } from "../SidebarItem";

afterEach(cleanup);
const Icon = () => <svg />;

describe("folder disclosure accessibility", () => {
  it("exposes separate selection and expansion buttons without nested buttons", () => {
    const select = vi.fn();
    const toggle = vi.fn();
    const { container, rerender } = render(
      <SidebarItem
        icon={Icon}
        label="Techno"
        active={false}
        expanded={false}
        onClick={select}
        onToggleExpanded={toggle}
      />,
    );
    const disclosure = screen.getByRole("button", { name: "Expand Techno" });
    expect(disclosure.getAttribute("aria-expanded")).toBe("false");
    expect(disclosure.tabIndex).toBe(0);
    expect(container.querySelector("button button")).toBeNull();
    fireEvent.click(disclosure);
    expect(toggle).toHaveBeenCalledOnce();
    expect(select).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Techno" }));
    expect(select).toHaveBeenCalledOnce();
    rerender(
      <SidebarItem
        icon={Icon}
        label="Techno"
        active={false}
        expanded
        onClick={select}
        onToggleExpanded={toggle}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Collapse Techno" }).getAttribute("aria-expanded"),
    ).toBe("true");
  });

  it("keeps disclosure activation keys out of global playback shortcuts", () => {
    const shortcut = vi.fn();
    render(
      <div onKeyDown={shortcut} onKeyUp={shortcut}>
        <SidebarItem
          icon={Icon}
          label="House"
          active={false}
          expanded={false}
          onClick={vi.fn()}
          onToggleExpanded={vi.fn()}
        />
      </div>,
    );
    const disclosure = screen.getByRole("button", { name: "Expand House" });
    for (const key of ["Enter", " "]) {
      expect(fireEvent.keyDown(disclosure, { key })).toBe(true);
      expect(fireEvent.keyUp(disclosure, { key })).toBe(true);
    }
    expect(shortcut).not.toHaveBeenCalled();
  });
});
