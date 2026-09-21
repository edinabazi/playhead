import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SidebarDisclosure } from "../SidebarDisclosure";

afterEach(cleanup);

describe("lazy sidebar disclosure", () => {
  it("does not construct descendants until expanded and releases them after closing", async () => {
    const children = vi.fn(() => <button>Nested folder</button>);
    const { rerender } = render(<SidebarDisclosure open={false}>{children}</SidebarDisclosure>);
    expect(children).not.toHaveBeenCalled();
    rerender(<SidebarDisclosure open>{children}</SidebarDisclosure>);
    expect(screen.getByRole("button", { name: "Nested folder" })).toBeTruthy();
    rerender(<SidebarDisclosure open={false}>{children}</SidebarDisclosure>);
    expect(screen.queryByRole("button", { name: "Nested folder" })).toBeNull();
    await waitFor(() => expect(screen.queryByText("Nested folder")).toBeNull());
    children.mockClear();
    rerender(<SidebarDisclosure open={false}>{children}</SidebarDisclosure>);
    expect(children).not.toHaveBeenCalled();
    rerender(<SidebarDisclosure open>{children}</SidebarDisclosure>);
    expect(screen.getByRole("button", { name: "Nested folder" })).toBeTruthy();
  });

  it("keeps reopened content mounted when a closing transition is interrupted", async () => {
    const { rerender } = render(
      <SidebarDisclosure open>
        <button>Folder</button>
      </SidebarDisclosure>,
    );
    rerender(
      <SidebarDisclosure open={false}>
        <button>Folder</button>
      </SidebarDisclosure>,
    );
    rerender(
      <SidebarDisclosure open>
        <button>Folder</button>
      </SidebarDisclosure>,
    );
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(screen.getByRole("button", { name: "Folder" })).toBeTruthy();
  });
});
