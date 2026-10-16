import { join, parse as parsePath } from "node:path";
import { describe, expect, it } from "vitest";
import type { LibraryPlaylist } from "../../../shared/library";
import {
  buildPlaylistExportContent,
  parsePlaylistImportFile,
  sanitizePlaylistExportFileName,
} from "../playlist-export";

/**
 * A platform-native absolute directory used to build fixtures.
 *
 * The parser resolves relative paths and serialises absolute ones, so fixtures
 * must look like real paths on the host. Hard-coding "/music" made these tests
 * pass on macOS and fail on Windows; deriving from the volume root exercises the
 * same logic on both.
 */
const mediaRoot = join(parsePath(process.cwd()).root, "media");

const playlist: LibraryPlaylist = {
  id: "playlist-1",
  name: "Peak Time",
  trackIds: ["track-1", "track-2"],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("playlist export", () => {
  it("builds extended M3U content in playlist order", () => {
    const result = buildPlaylistExportContent(playlist, [
      {
        artist: "A",
        duration: 123.4,
        path: "/music/a.mp3",
        title: "First",
      },
      {
        artist: "B",
        duration: 0,
        path: "/music/b.flac",
        title: "Second",
      },
    ]);

    expect(result).toEqual({
      content:
        "#EXTM3U\n#PLAYLIST:Peak Time\n#EXTINF:123,A - First\n/music/a.mp3\n#EXTINF:-1,B - Second\n/music/b.flac\n",
      exportedTrackCount: 2,
      skippedTrackCount: 0,
    });
  });

  it("skips streaming tracks", () => {
    const result = buildPlaylistExportContent(playlist, [
      {
        artist: "Remote",
        duration: 180,
        path: "soundcloud:123",
        source: "soundcloud",
        title: "Stream",
      },
      {
        artist: "Local",
        duration: 180,
        path: "/music/local.mp3",
        title: "File",
      },
    ]);

    expect(result.exportedTrackCount).toBe(1);
    expect(result.skippedTrackCount).toBe(1);
    expect(result.content).toContain("/music/local.mp3");
    expect(result.content).not.toContain("soundcloud:123");
  });

  it("sanitizes default export file names", () => {
    expect(sanitizePlaylistExportFileName("Warmup: 10/10 <test>")).toBe("Warmup 10 10 test");
    expect(sanitizePlaylistExportFileName("")).toBe("playlist");
  });

  it("builds and parses Playhead playlist JSON", () => {
    const exported = buildPlaylistExportContent(
      playlist,
      [
        {
          id: "track-1",
          fileName: "a.mp3",
          artist: "A",
          duration: 123,
          path: "/music/a.mp3",
          title: "First",
          bpm: 128,
        },
      ],
      "playhead",
    );
    const imported = parsePlaylistImportFile(
      "/tmp/Peak Time.playhead-playlist.json",
      Buffer.from(exported.content, "utf8"),
    );

    expect(imported).toEqual({
      format: "playhead",
      playlists: [
        {
          name: "Peak Time",
          tracks: [
            {
              artist: "A",
              bpm: 128,
              duration: 123,
              path: "/music/a.mp3",
              title: "First",
            },
          ],
        },
      ],
    });
  });

  it("parses M3U files with relative paths and EXTINF metadata", () => {
    const imported = parsePlaylistImportFile(
      join(mediaRoot, "sets", "warmup.m3u8"),
      Buffer.from("#EXTM3U\n#EXTINF:210,Artist - Title\n../Artist/Title.mp3\n", "utf8"),
    );

    expect(imported).toEqual({
      format: "m3u8",
      playlists: [
        {
          name: "warmup",
          tracks: [
            {
              artist: "Artist",
              duration: 210,
              path: join(mediaRoot, "Artist", "Title.mp3"),
              title: "Title",
            },
          ],
        },
      ],
    });
  });

  it("builds and parses rekordbox XML playlists", () => {
    const exported = buildPlaylistExportContent(
      playlist,
      [
        {
          artist: "A",
          duration: 123,
          path: join(mediaRoot, "a.mp3"),
          title: "First",
          album: "Album",
          bpm: 128,
        },
      ],
      "rekordbox",
    );
    const imported = parsePlaylistImportFile(
      join(mediaRoot, "rekordbox.xml"),
      Buffer.from(exported.content),
    );

    expect(imported.format).toBe("rekordbox");
    expect(imported.playlists[0]).toEqual({
      name: "Peak Time",
      tracks: [
        {
          album: "Album",
          artist: "A",
          bpm: 128,
          duration: 123,
          path: join(mediaRoot, "a.mp3"),
          title: "First",
        },
      ],
    });
  });

  it("builds and parses Traktor NML playlists", () => {
    const trackPath = join(mediaRoot, "a.mp3");
    const exported = buildPlaylistExportContent(
      playlist,
      [
        {
          artist: "A",
          duration: 123,
          path: trackPath,
          title: "First",
          bpm: 128,
        },
      ],
      "traktor",
    );
    const imported = parsePlaylistImportFile(
      join(mediaRoot, "traktor.nml"),
      Buffer.from(exported.content),
    );

    expect(imported.format).toBe("traktor");
    // The playlist entry is keyed on the collection path, so metadata survives
    // the round trip. It used to arrive as a bare { path } on Windows because
    // the written DIR used "\" while the key used "/".
    expect(imported.playlists[0]).toEqual({
      name: "Peak Time",
      tracks: [
        {
          artist: "A",
          bpm: 128,
          duration: 123,
          path: trackPath,
          title: "First",
        },
      ],
    });
  });

  it("reads Serato crates whose path uses either separator style", () => {
    const crateBytes = Buffer.concat([
      seratoRecord("vrsn", utf16be("1.0/Serato ScratchLive Crate")),
      seratoRecord("otrk", seratoRecord("ptrk", utf16be("Music/Track.mp3"))),
    ]);
    const expected = {
      format: "serato-crate",
      playlists: [{ name: "Set", tracks: [{ path: join(mediaRoot, "Music", "Track.mp3") }] }],
    };

    // Native separators, and a crate written on the other platform.
    const cratePaths = [
      join(mediaRoot, "_Serato_", "Subcrates", "Set.crate"),
      `${mediaRoot}${"/_Serato_/Subcrates/Set.crate"}`,
      `${mediaRoot}${"\\_Serato_\\Subcrates\\Set.crate"}`,
    ];

    for (const cratePath of cratePaths) {
      expect(parsePlaylistImportFile(cratePath, crateBytes)).toEqual(expected);
    }
  });
});

function seratoRecord(tag: string, data: Buffer): Buffer {
  const header = Buffer.alloc(8);
  header.write(tag, 0, 4, "ascii");
  header.writeUInt32BE(data.length, 4);
  return Buffer.concat([header, data]);
}

function utf16be(value: string): Buffer {
  const data = Buffer.alloc(value.length * 2);
  for (let index = 0; index < value.length; index += 1) {
    data.writeUInt16BE(value.charCodeAt(index), index * 2);
  }
  return data;
}
