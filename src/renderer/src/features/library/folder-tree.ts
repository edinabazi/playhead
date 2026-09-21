import type { LibraryFolder, LibraryState } from "../../../../shared/library";

export type FolderTreeNode = {
  path: string;
  name: string;
  trackCount: number;
  directTrackCount: number;
  children: FolderTreeNode[];
};

const pathSeparatorPattern = /[\\/]/;

function trimTrailingSeparators(path: string): string {
  return path.replace(/[\\/]+$/, "");
}

export function getPathName(path: string): string {
  return trimTrailingSeparators(path).split(pathSeparatorPattern).pop() || path;
}

export function getParentPath(path: string): string {
  return path.slice(0, Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\")));
}

export function isPathInFolder(
  filePath: string,
  folderPath: string,
  includeSubfolders: boolean,
): boolean {
  const basePath = trimTrailingSeparators(folderPath);
  if (!filePath.startsWith(basePath)) return false;
  if (!pathSeparatorPattern.test(filePath.charAt(basePath.length))) return false;
  return includeSubfolders || !pathSeparatorPattern.test(filePath.slice(basePath.length + 1));
}

function createFolderTreeNode(path: string, name: string): FolderTreeNode {
  return { path, name, trackCount: 0, directTrackCount: 0, children: [] };
}

function sortFolderTreeNodes(nodes: FolderTreeNode[]): void {
  nodes.sort((a, b) => a.name.localeCompare(b.name));
  for (const node of nodes) sortFolderTreeNodes(node.children);
}

export function getFolderTree(
  folder: LibraryFolder,
  tracks: LibraryState["tracks"],
): FolderTreeNode {
  const root = createFolderTreeNode(folder.path, folder.name);
  const basePath = trimTrailingSeparators(folder.path);
  const nodesByPath = new Map<string, FolderTreeNode>();

  for (const trackId of folder.trackIds) {
    const track = tracks[trackId];
    if (!track || !isPathInFolder(track.path, basePath, true)) continue;

    const separator = track.path.charAt(basePath.length);
    const directoryNames = track.path
      .slice(basePath.length + 1)
      .split(pathSeparatorPattern)
      .slice(0, -1)
      .filter(Boolean);
    let node = root;
    let nodePath = basePath;
    root.trackCount += 1;

    for (const directoryName of directoryNames) {
      nodePath = `${nodePath}${separator}${directoryName}`;
      let child = nodesByPath.get(nodePath);
      if (!child) {
        child = createFolderTreeNode(nodePath, directoryName);
        nodesByPath.set(nodePath, child);
        node.children.push(child);
      }
      child.trackCount += 1;
      node = child;
    }

    node.directTrackCount += 1;
  }

  sortFolderTreeNodes(root.children);
  return root;
}
