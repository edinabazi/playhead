import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { app } from "electron";
import { emptyLibraryState, type LibraryState } from "../../shared/library";
import { materializeStoredArtwork } from "../artwork";

function libraryPath(): string {
  return join(app.getPath("userData"), "library.json");
}

export async function readLibraryState(): Promise<LibraryState> {
  try {
    const raw = await readFile(libraryPath(), "utf8");
    return materializeStoredArtwork({ ...emptyLibraryState(), ...JSON.parse(raw) });
  } catch {
    return emptyLibraryState();
  }
}

export async function writeLibraryState(state: LibraryState): Promise<LibraryState> {
  await writeFile(libraryPath(), `${JSON.stringify(state, null, 2)}\n`, "utf8");
  return state;
}
