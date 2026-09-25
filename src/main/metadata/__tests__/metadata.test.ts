import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  parseFile: vi.fn(),
  disc: vi.fn(),
  save: vi.fn(),
  dispose: vi.fn(),
}));
vi.mock("music-metadata", () => ({ parseFile: mocks.parseFile }));
vi.mock("../../library/scanner", () => ({ buildTrack: vi.fn() }));
vi.mock("node-taglib-sharp", () => ({
  ByteVector: {},
  Picture: {},
  PictureType: {},
  File: {
    createFromPath: () => ({
      tag: {
        set disc(value: number) {
          mocks.disc(value);
        },
      },
      save: mocks.save,
      dispose: mocks.dispose,
    }),
  },
}));

import { readTrackMetadata, saveTrackMetadata } from "../metadata";
afterEach(() => vi.resetAllMocks());

it("does not erase a native text Disc tag when saving unrelated metadata", async () => {
  mocks.parseFile.mockResolvedValue({
    common: { title: "Track", track: {}, disk: {} },
    format: {},
    native: { "ID3v2.4": [{ id: "TPOS", value: "Warm-up" }] },
  });
  const metadata = await readTrackMetadata("track.mp3");
  await saveTrackMetadata("track.mp3", "folder", { ...metadata.editable, album: "New album" });
  expect(mocks.disc).not.toHaveBeenCalled();
  expect(mocks.save).toHaveBeenCalledOnce();
  expect(mocks.dispose).toHaveBeenCalledOnce();
  await saveTrackMetadata("track.mp3", "folder", { ...metadata.editable, diskNumber: "3" });
  expect(mocks.disc).toHaveBeenCalledWith(3);
});
