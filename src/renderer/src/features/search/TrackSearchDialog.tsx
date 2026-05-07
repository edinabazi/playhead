import { useEffect, useMemo, useRef, useState } from "react";
import {
  DialogOverlay,
  DialogPanel,
  dialogOverlayMotion,
  dialogPanelMotion,
} from "@/components/ui/dialog-motion";
import { useIcons } from "@/lib/icon-context";
import type { LibraryFolder, LibraryMode, LibraryTrack } from "../../../../shared/library";
import { TrackArtwork } from "@/features/tracks/TrackArtwork";

export function TrackSearchDialog({
  tracks,
  folders,
  libraryMode,
  onSelectTrack,
  onClose,
}: {
  tracks: LibraryTrack[];
  folders: LibraryFolder[];
  libraryMode: LibraryMode;
  onSelectTrack: (track: LibraryTrack) => void;
  onClose: () => void;
}) {
  const icons = useIcons();
  const MusicIcon = icons.music;
  const SearchIcon = icons.search;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const resultRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const folderNames = useMemo(
    () => new Map(folders.map((folder) => [folder.id, folder.name])),
    [folders],
  );
  const results = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const searchableTracks = tracks.slice().sort((a, b) => a.title.localeCompare(b.title));
    if (!normalizedQuery) return searchableTracks.slice(0, 24);

    return searchableTracks
      .filter((track) =>
        [
          track.title,
          track.artist,
          track.album || "",
          track.fileName,
          folderNames.get(track.folderId) || "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery),
      )
      .slice(0, 24);
  }, [folderNames, query, tracks]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    resultRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const activeTrack = results[activeIndex] || results[0] || null;

  return (
    <DialogOverlay
      {...dialogOverlayMotion}
      className="app-modal-overlay fixed inset-0 z-50 flex justify-center bg-black/45 px-6 pt-[12vh]"
      onClick={onClose}
    >
      <DialogPanel
        {...dialogPanelMotion}
        className="no-drag selectable w-[620px] max-w-[calc(100vw-48px)] self-start overflow-hidden rounded-[28px] border border-white/10 bg-[rgba(8,8,8,0.97)] p-2 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex h-12 items-center gap-3 border-b border-white/10 px-3">
          <SearchIcon size={18} strokeWidth={1.8} className="text-muted-foreground" />
          <input
            ref={inputRef}
            className="h-full min-w-0 flex-1 bg-transparent text-[15px] font-medium text-foreground outline-none placeholder:text-muted-foreground"
            value={query}
            placeholder="Search tracks"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                onClose();
                return;
              }
              if (event.key === "ArrowDown" && results.length > 0) {
                event.preventDefault();
                setActiveIndex((index) => Math.min(index + 1, results.length - 1));
                return;
              }
              if (event.key === "ArrowUp" && results.length > 0) {
                event.preventDefault();
                setActiveIndex((index) => Math.max(index - 1, 0));
                return;
              }
              if (event.key === "Enter" && activeTrack) {
                event.preventDefault();
                onSelectTrack(activeTrack);
              }
            }}
          />
          <span className="rounded-full border border-white/10 px-2 py-1 font-mono text-[10px] text-muted-foreground">
            Cmd K
          </span>
        </div>

        <div className="thin-scrollbar max-h-[420px] overflow-y-auto p-1">
          {results.length === 0 ? (
            <div className="grid h-32 place-items-center text-[13px] text-muted-foreground">
              No tracks found.
            </div>
          ) : (
            results.map((track, index) => (
              <button
                key={track.id}
                ref={(node) => {
                  resultRefs.current[index] = node;
                }}
                className={`flex w-full items-center gap-3 rounded-[18px] px-3 py-2 text-left transition-colors duration-150 ${
                  index === activeIndex
                    ? "bg-[var(--surface-track-active)]"
                    : "hover:bg-[var(--surface-track-hover)]"
                }`}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => onSelectTrack(track)}
              >
                <TrackArtwork track={track} fallbackIcon={MusicIcon} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-semibold leading-[1.2] text-foreground">
                    {track.title}
                  </div>
                  <div className="mt-1 truncate text-[13px] font-medium leading-[1.2] text-muted-foreground">
                    {track.artist}
                  </div>
                </div>
                {libraryMode === "folder" && (
                  <div className="max-w-[170px] truncate text-right text-[12px] font-medium text-[var(--text-tertiary)]">
                    {folderNames.get(track.folderId) || "Folder"}
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      </DialogPanel>
    </DialogOverlay>
  );
}
