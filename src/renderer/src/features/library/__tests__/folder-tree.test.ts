import { describe, expect, it } from "vitest";
import { getFolderTree, getParentPath, getPathName, isPathInFolder } from "../folder-tree";
import type { LibraryFolder, LibraryState, LibraryTrack } from "../../../../../shared/library";

function makeTracks(paths: string[], folderId = "folder-1"): LibraryState["tracks"] {
  return Object.fromEntries(
    paths.map((path, index): [string, LibraryTrack] => [
      `track-${index + 1}`,
      {
        id: `track-${index + 1}`,
        path,
        fileName: getPathName(path),
        title: getPathName(path),
        artist: "Artist",
        duration: 1,
        folderId,
      },
    ]),
  );
}

function makeFolder(path: string, tracks: LibraryState["tracks"]): LibraryFolder {
  return { id: "folder-1", name: getPathName(path), path, trackIds: Object.keys(tracks) };
}

describe("folder tree", () => {
  it("groups tracks into nested subfolders with sorted children", () => {
    const tracks = makeTracks([
      "/music/intro.mp3",
      "/music/Techno/warehouse.mp3",
      "/music/Techno/2024/pulse.mp3",
      "/music/Techno/2023/rumble.mp3",
      "/music/Techno/2023/dust.mp3",
      "/music/House/deep.mp3",
    ]);
    const tree = getFolderTree(makeFolder("/music", tracks), tracks);

    expect(tree).toMatchObject({ path: "/music", name: "music", trackCount: 6 });
    expect(tree.directTrackCount).toBe(1);
    expect(tree.children.map((child) => child.name)).toEqual(["House", "Techno"]);

    const techno = tree.children[1];
    expect(techno).toMatchObject({
      path: "/music/Techno",
      trackCount: 4,
      directTrackCount: 1,
    });
    expect(techno.children.map((child) => [child.name, child.trackCount])).toEqual([
      ["2023", 2],
      ["2024", 1],
    ]);
    expect(techno.children[0].path).toBe("/music/Techno/2023");
  });

  it("keeps Windows separators in subfolder paths", () => {
    const tracks = makeTracks(["C:\\Music\\House\\a.mp3", "C:\\Music\\House\\Deep\\b.mp3"]);
    const tree = getFolderTree(makeFolder("C:\\Music", tracks), tracks);

    expect(tree.children[0].path).toBe("C:\\Music\\House");
    expect(tree.children[0].children[0]).toMatchObject({
      path: "C:\\Music\\House\\Deep",
      name: "Deep",
      trackCount: 1,
    });
  });

  it("ignores missing tracks and tracks outside the folder", () => {
    const tracks = makeTracks(["/music/a.mp3", "/musical/b.mp3"]);
    const folder = { ...makeFolder("/music", tracks), trackIds: ["track-1", "track-2", "gone"] };
    const tree = getFolderTree(folder, tracks);

    expect(tree.trackCount).toBe(1);
    expect(tree.children).toEqual([]);
  });

  it("matches direct and nested paths", () => {
    expect(isPathInFolder("/music/house/a.mp3", "/music", true)).toBe(true);
    expect(isPathInFolder("/music/house/a.mp3", "/music", false)).toBe(false);
    expect(isPathInFolder("/music/a.mp3", "/music/", false)).toBe(true);
    expect(isPathInFolder("/musical/a.mp3", "/music", true)).toBe(false);
    expect(isPathInFolder("C:\\Music\\House\\a.mp3", "C:\\Music\\House", false)).toBe(true);
  });

  it("reads folder names and parent paths", () => {
    expect(getPathName("/music/Techno/2024")).toBe("2024");
    expect(getPathName("C:\\Music\\House\\")).toBe("House");
    expect(getParentPath("/music/Techno/pulse.mp3")).toBe("/music/Techno");
    expect(getParentPath("C:\\Music\\House\\a.mp3")).toBe("C:\\Music\\House");
  });
});
