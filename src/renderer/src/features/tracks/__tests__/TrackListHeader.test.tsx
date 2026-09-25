import { useState } from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
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
it("lets users show, sort, reverse, reset and hide a metadata column", async () => {
  const view = render(<Header />);
  fireEvent.click(view.getByRole("button", { name: "Columns" }));
  fireEvent.click(view.getByRole("menuitemcheckbox", { name: "Genre" }));
  fireEvent.keyDown(view.getByRole("menuitemcheckbox", { name: "Genre" }), { key: "Escape" });
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
  await waitFor(() => expect(view.queryByRole("button", { name: "Reset sort" })).toBeNull());
  fireEvent.click(view.getByRole("button", { name: "Sort by Genre" }));
  fireEvent.click(view.getByRole("button", { name: "Columns" }));
  fireEvent.click(view.getByRole("menuitemcheckbox", { name: "Genre" }));
  expect(view.queryByRole("button", { name: "Sort by Genre" })).toBeNull();
  await waitFor(() => expect(view.queryByRole("button", { name: "Reset sort" })).toBeNull());
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

it("keeps the menu open when toggling a row's text or empty space", () => {
  const view = render(<Header />);
  fireEvent.click(view.getByRole("button", { name: "Columns" }));
  const genre = view.getByRole("menuitemcheckbox", { name: "Genre" });
  const label = genre.querySelector("span.flex-1 > span:last-child")!;
  fireEvent.pointerDown(label);
  fireEvent.click(label);
  expect(genre.getAttribute("aria-checked")).toBe("true");
  expect(view.getByRole("button", { name: "Columns" }).getAttribute("aria-expanded")).toBe("true");
  fireEvent.pointerDown(genre);
  fireEvent.click(genre);
  expect(genre.getAttribute("aria-checked")).toBe("false");
  expect(view.getByRole("menu", { name: "Visible columns" })).toBeTruthy();
});

it("supports keyboard navigation, toggling, dismissal and focus restoration", () => {
  const view = render(<Header />);
  const trigger = view.getByRole("button", { name: "Columns" });
  trigger.focus();
  fireEvent.keyDown(trigger, { key: "ArrowDown" });
  const artist = view.getByRole("menuitemcheckbox", { name: "Artist" });
  expect(document.activeElement).toBe(artist);
  fireEvent.keyDown(artist, { key: " " });
  expect(artist.getAttribute("aria-checked")).toBe("true");
  fireEvent.keyDown(artist, { key: "ArrowDown" });
  const album = view.getByRole("menuitemcheckbox", { name: "Album" });
  expect(document.activeElement).toBe(album);
  fireEvent.keyDown(album, { key: "Enter" });
  expect(album.getAttribute("aria-checked")).toBe("true");
  fireEvent.keyDown(album, { key: "Escape" });
  expect(document.activeElement).toBe(trigger);
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
});

it("resets columns without closing the menu and dismisses on an outside click", () => {
  const view = render(<Header />);
  fireEvent.click(view.getByRole("button", { name: "Columns" }));
  fireEvent.click(view.getByRole("menuitemcheckbox", { name: "Genre" }));
  fireEvent.click(view.getByRole("menuitem", { name: "Reset columns" }));
  expect(view.getByRole("menuitemcheckbox", { name: "Genre" }).getAttribute("aria-checked")).toBe(
    "false",
  );
  expect(view.getByRole("menuitemcheckbox", { name: "Title" }).getAttribute("aria-checked")).toBe(
    "true",
  );
  expect(view.getByRole("menuitemcheckbox", { name: "Time" }).getAttribute("aria-checked")).toBe(
    "true",
  );
  fireEvent.pointerDown(document.body);
  expect(view.getByRole("button", { name: "Columns" }).getAttribute("aria-expanded")).toBe("false");
});
