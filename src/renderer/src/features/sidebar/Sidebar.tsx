import playheadLogo from "@/assets/playhead-logo.svg";
import { Tooltip } from "@/components/ui/tooltip";
import { useIcons } from "@/lib/icon-context";
import { getPrimaryModifierLabel } from "@/lib/platform";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import type {
  LibraryFolder,
  LibraryMode,
  LibraryPlaylist,
  SelectedSource,
} from "../../../../shared/library";
import {
  SidebarContextMenu,
  type SidebarContextMenuState,
} from "./SidebarContextMenu";
import { SidebarGroup } from "./SidebarGroup";
import { SidebarEmpty, SidebarItem } from "./SidebarItem";

export function Sidebar({
  folders,
  libraryMode,
  trackCount,
  playlists,
  lovedCount,
  selectedSource,
  isScanning,
  onAddFolder,
  onOpenSearch,
  onOpenSettings,
  onCreatePlaylist,
  onSelectSource,
  onDropTrackToPlaylist,
  onRemoveFolder,
  onRenamePlaylist,
  onDeletePlaylist,
}: {
  folders: LibraryFolder[];
  libraryMode: LibraryMode;
  trackCount: number;
  playlists: LibraryPlaylist[];
  lovedCount: number;
  selectedSource: SelectedSource | null;
  isScanning: boolean;
  onAddFolder: () => void;
  onOpenSearch: () => void;
  onOpenSettings: () => void;
  onCreatePlaylist: () => void;
  onSelectSource: (source: SelectedSource) => void;
  onDropTrackToPlaylist: (trackId: string, playlist: LibraryPlaylist) => void;
  onRemoveFolder: (folder: LibraryFolder) => void;
  onRenamePlaylist: (playlist: LibraryPlaylist) => void;
  onDeletePlaylist: (playlist: LibraryPlaylist) => void;
}) {
  const icons = useIcons();
  const [foldersCollapsed, setFoldersCollapsed] = useState(false);
  const [playlistsCollapsed, setPlaylistsCollapsed] = useState(false);
  const [contextMenu, setContextMenu] = useState<SidebarContextMenuState>(null);
  const FolderPlusIcon = icons["folder-plus"];
  const SearchIcon = icons.search;
  const SettingsIcon = icons.settings;
  const modifierLabel = getPrimaryModifierLabel();
  const isLibraryMode = libraryMode === "library";

  return (
    <aside className="app-drag flex w-[260px] shrink-0 flex-col justify-between overflow-hidden rounded-[41px] bg-[rgba(0,0,0,0.2)] px-[18px] pb-[18px] pt-[54px] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="flex flex-col gap-[30px]">
        <div className="relative flex min-h-[30px] items-center justify-between">
          <img className="h-[29px] w-[84px]" src={playheadLogo} alt="Playhead" draggable={false} />
          <div className="flex items-center gap-1">
            <Tooltip content={`${modifierLabel} K`} side="top" sideOffset={7}>
              <button
                type="button"
                className="no-drag grid size-8 place-items-center rounded-full text-muted-foreground transition hover:bg-white/10 hover:text-foreground"
                aria-label="Search"
                onClick={onOpenSearch}
              >
                <SearchIcon size={16} strokeWidth={1.8} />
              </button>
            </Tooltip>
            <Tooltip content={`${modifierLabel} ,`} side="top" sideOffset={7}>
              <button
                type="button"
                className="no-drag grid size-8 place-items-center rounded-full text-muted-foreground transition hover:bg-white/10 hover:text-foreground"
                aria-label="Settings"
                onClick={onOpenSettings}
              >
                <SettingsIcon size={16} strokeWidth={1.8} />
              </button>
            </Tooltip>
          </div>
        </div>

        {libraryMode === "library" ? (
          <SidebarGroup
            title="Library"
            collapsed={foldersCollapsed}
            onToggleCollapsed={() => setFoldersCollapsed((value) => !value)}
            actionLabel="Add folder"
            actionIcon={icons["folder-plus"]}
            onAction={onAddFolder}
          >
            <AnimatePresence>
              <SidebarItem
                key="library-artists"
                active={selectedSource?.type === "library-artists"}
                icon={icons.user}
                label="Artists"
                detail=""
                onClick={() => onSelectSource({ type: "library-artists" })}
              />
              <SidebarItem
                key="library-albums"
                active={selectedSource?.type === "library-albums"}
                icon={icons["square-library"]}
                label="Albums"
                detail=""
                onClick={() => onSelectSource({ type: "library-albums" })}
              />
              <SidebarItem
                key="library-tracks"
                active={selectedSource?.type === "library-tracks"}
                icon={icons.music}
                label="Tracks"
                detail={`${trackCount}`}
                onClick={() => onSelectSource({ type: "library-tracks" })}
              />
            </AnimatePresence>
          </SidebarGroup>
        ) : (
          <SidebarGroup
            title="Folders"
            collapsed={foldersCollapsed}
            onToggleCollapsed={() => setFoldersCollapsed((value) => !value)}
            actionLabel="Add folder"
            actionIcon={icons["folder-plus"]}
            onAction={onAddFolder}
          >
            {folders.length === 0 ? (
              <SidebarEmpty key="folders-empty">
                {isScanning ? "Scanning..." : "No folders added"}
              </SidebarEmpty>
            ) : (
              <AnimatePresence>
                {folders.map((folder) => (
                  <SidebarItem
                    key={folder.id}
                    active={selectedSource?.type === "folder" && selectedSource.id === folder.id}
                    icon={icons["folder-open"]}
                    label={folder.name}
                    detail={`${folder.trackIds.length}`}
                    onClick={() => onSelectSource({ type: "folder", id: folder.id })}
                    onContextMenu={(point) =>
                      setContextMenu({ type: "folder", item: folder, point })
                    }
                  />
                ))}
              </AnimatePresence>
            )}
          </SidebarGroup>
        )}

        <SidebarGroup
          title="Playlists"
          collapsed={playlistsCollapsed}
          onToggleCollapsed={() => setPlaylistsCollapsed((value) => !value)}
          actionLabel="Create playlist"
          actionIcon={icons.plus}
          onAction={onCreatePlaylist}
        >
          {lovedCount === 0 && playlists.length === 0 ? (
            <SidebarEmpty key="playlists-empty">No playlists yet</SidebarEmpty>
          ) : (
            <AnimatePresence>
              {lovedCount > 0 && (
                <SidebarItem
                  key="loved"
                  active={selectedSource?.type === "loved"}
                  icon={icons.heart}
                  iconFilled
                  label="Loved"
                  detail={`${lovedCount}`}
                  onClick={() => onSelectSource({ type: "loved" })}
                />
              )}
              {playlists.map((playlist) => (
                <SidebarItem
                  key={playlist.id}
                  active={selectedSource?.type === "playlist" && selectedSource.id === playlist.id}
                  icon={icons["list-music"]}
                  label={playlist.name}
                  detail={`${playlist.trackIds.length}`}
                  onClick={() => onSelectSource({ type: "playlist", id: playlist.id })}
                  onDropTrack={(trackId) => onDropTrackToPlaylist(trackId, playlist)}
                  onContextMenu={(point) =>
                    setContextMenu({ type: "playlist", item: playlist, point })
                  }
                />
              ))}
            </AnimatePresence>
          )}
        </SidebarGroup>
      </div>

      <motion.button
        className="no-drag flex h-[49px] w-full items-center justify-center gap-2 rounded-[33px] bg-primary px-4 text-[14px] font-medium leading-none text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.48),0_14px_34px_rgba(255,255,0,0.08)] transition-colors disabled:opacity-55"
        title={isLibraryMode ? "Manage library" : "Add folder"}
        disabled={!isLibraryMode && isScanning}
        whileHover={{ y: -1 }}
        whileTap={{ scale: 0.985, y: 0 }}
        transition={{ type: "spring", stiffness: 520, damping: 34, mass: 0.7 }}
        onClick={isLibraryMode ? onOpenSettings : onAddFolder}
      >
        {isLibraryMode ? (
          <SettingsIcon size={17} strokeWidth={1.9} />
        ) : (
          <FolderPlusIcon size={17} strokeWidth={1.9} />
        )}
        {isLibraryMode ? "Manage Library" : isScanning ? "Scanning..." : "Add Folder"}
      </motion.button>

      <SidebarContextMenu
        state={contextMenu}
        onOpenChange={(nextState) => setContextMenu(nextState)}
        onRemoveFolder={onRemoveFolder}
        onRenamePlaylist={onRenamePlaylist}
        onDeletePlaylist={onDeletePlaylist}
      />
    </aside>
  );
}
