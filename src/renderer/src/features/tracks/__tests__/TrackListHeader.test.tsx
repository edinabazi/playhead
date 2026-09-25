import { useState } from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { TrackListControls, TrackListHeader } from "../TrackListHeader";
import { defaultTrackListSettings } from "../../../../../shared/track-list";

afterEach(cleanup);
function Header() {
  const [settings, setSettings] = useState(defaultTrackListSettings);
  return (
    <>
      <TrackListControls settings={settings} onChange={setSettings} />
      <TrackListHeader settings={settings} onChange={setSettings} gridTemplateColumns="" />
    </>
  );
}
it("lets users show, sort, reverse, reset and hide a metadata column", () => {
  const view = render(<Header />);
  fireEvent.click(view.getByRole("button", { name: "Columns" }));
  fireEvent.click(view.getByRole("checkbox", { name: "Genre" }));
  fireEvent.keyDown(view.getByRole("checkbox", { name: "Genre" }), { key: "Escape" });
  expect(document.activeElement).toBe(view.getByRole("button", { name: "Columns" }));
  fireEvent.click(view.getByRole("button", { name: "Sort by Genre" }));
  expect(view.getByRole("columnheader", { name: "Genre" }).getAttribute("aria-sort")).toBe(
    "ascending",
  );
  fireEvent.click(view.getByRole("button", { name: "Sort by Genre" }));
  expect(view.getByRole("columnheader", { name: "Genre" }).getAttribute("aria-sort")).toBe(
    "descending",
  );
  fireEvent.click(view.getByRole("button", { name: "Reset sort" }));
  expect(view.queryByRole("button", { name: "Reset sort" })).toBeNull();
  fireEvent.click(view.getByRole("button", { name: "Sort by Genre" }));
  fireEvent.click(view.getByRole("button", { name: "Columns" }));
  fireEvent.click(view.getByRole("checkbox", { name: "Genre" }));
  expect(view.queryByRole("button", { name: "Sort by Genre" })).toBeNull();
  expect(view.queryByRole("button", { name: "Reset sort" })).toBeNull();
});

it("keeps Enter and Space on column controls out of global playback shortcuts", () => {
  const globalKeyDown = vi.fn();
  window.addEventListener("keydown", globalKeyDown);
  try {
    const view = render(<Header />);
    for (const name of ["Columns", "Sort by Title"]) {
      const button = view.getByRole("button", { name });
      fireEvent.keyDown(button, { key: "Enter", code: "Enter" });
      fireEvent.keyDown(button, { key: " ", code: "Space" });
    }
    expect(globalKeyDown).not.toHaveBeenCalled();
  } finally {
    window.removeEventListener("keydown", globalKeyDown);
  }
});
