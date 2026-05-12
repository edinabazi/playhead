import playheadLogo from "@/assets/playhead-logo.svg";
import { WindowControls } from "@/components/WindowControls";
import { Tooltip } from "@/components/ui/tooltip";
import { useIcons } from "@/lib/icon-context";
import { getPrimaryModifierLabel } from "@/lib/platform";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import type {
  AppUpdateState,
  LibraryFolder,
  LibraryMode,
  LibraryPlaylist,
  LibraryTag,
  SelectedSource,
} from "../../../../shared/library";
import { SidebarContextMenu, type SidebarContextMenuState } from "./SidebarContextMenu";
import { SidebarGroup } from "./SidebarGroup";
import { SidebarEmpty, SidebarItem } from "./SidebarItem";

export function Sidebar({
  folders,
  libraryMode,
  artistCount,
  albumCount,
  trackCount,
  playlists,
  tags,
  lovedCount,
  selectedSource,
  isScanning,
  updateState,
  onAddFolder,
  onOpenSearch,
  onOpenSettings,
  onInstallUpdate,
  onCreatePlaylist,
  onCreateTag,
  onSelectSource,
  onDropTrackToPlaylist,
  onDropTrackToTag,
  onRemoveFolder,
  onRenamePlaylist,
  onDeletePlaylist,
  onRenameTag,
  onDeleteTag,
}: {
  folders: LibraryFolder[];
  libraryMode: LibraryMode;
  artistCount: number;
  albumCount: number;
  trackCount: number;
  playlists: LibraryPlaylist[];
  tags: LibraryTag[];
  lovedCount: number;
  selectedSource: SelectedSource | null;
  isScanning: boolean;
  updateState: AppUpdateState;
  onAddFolder: () => void;
  onOpenSearch: () => void;
  onOpenSettings: () => void;
  onInstallUpdate: () => void;
  onCreatePlaylist: () => void;
  onCreateTag: () => void;
  onSelectSource: (source: SelectedSource) => void;
  onDropTrackToPlaylist: (trackIds: string[], playlist: LibraryPlaylist) => void;
  onDropTrackToTag: (trackIds: string[], tag: LibraryTag) => void;
  onRemoveFolder: (folder: LibraryFolder) => void;
  onRenamePlaylist: (playlist: LibraryPlaylist) => void;
  onDeletePlaylist: (playlist: LibraryPlaylist) => void;
  onRenameTag: (tag: LibraryTag) => void;
  onDeleteTag: (tag: LibraryTag) => void;
}) {
  const icons = useIcons();
  const [foldersCollapsed, setFoldersCollapsed] = useState(false);
  const [playlistsCollapsed, setPlaylistsCollapsed] = useState(false);
  const [tagsCollapsed, setTagsCollapsed] = useState(false);
  const [contextMenu, setContextMenu] = useState<SidebarContextMenuState>(null);
  const FolderPlusIcon = icons["folder-plus"];
  const SearchIcon = icons.search;
  const SettingsIcon = icons.settings;
  const modifierLabel = getPrimaryModifierLabel();
  const isLibraryMode = libraryMode === "library";
  const hasReadyUpdate = updateState.status === "ready";

  return (
    <aside className="app-drag relative flex w-[260px] shrink-0 flex-col overflow-hidden rounded-[41px] bg-[rgba(0,0,0,0.2)] px-[18px] pb-[18px] pt-[54px] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <WindowControls />
      {hasReadyUpdate && (
        <Tooltip
          content={updateState.version ? `Install ${updateState.version}` : "Install update"}
          side="top"
          sideOffset={7}
        >
          <button
            type="button"
            className="absolute top-4.5 right-6 no-drag h-5 rounded-full bg-primary px-2 text-[11px] font-semibold leading-none text-primary-foreground transition hover:bg-primary/90 font-mono uppercase"
            aria-label="Install update and restart"
            onClick={onInstallUpdate}
          >
            Update
          </button>
        </Tooltip>
      )}
      <div className="relative flex min-h-[30px] shrink-0 items-center justify-between">
        <img className="h-[26px]" src={playheadLogo} alt="Playhead" draggable={false} />
        <div className="flex items-center gap-1 translate-y-0.5">
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

      <div className="thin-scrollbar -mx-2 mt-[30px] min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-2">
        <div className="flex flex-col gap-[30px] overflow-visible no-drag">
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
                  detail={`${artistCount}`}
                  onClick={() => onSelectSource({ type: "library-artists" })}
                />
                <SidebarItem
                  key="library-albums"
                  active={selectedSource?.type === "library-albums"}
                  icon={icons["square-library"]}
                  label="Albums"
                  detail={`${albumCount}`}
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
                    active={
                      selectedSource?.type === "playlist" && selectedSource.id === playlist.id
                    }
                    icon={icons["list-music"]}
                    label={playlist.name}
                    detail={`${playlist.trackIds.length}`}
                    onClick={() => onSelectSource({ type: "playlist", id: playlist.id })}
                    onDropTrack={(trackIds) => onDropTrackToPlaylist(trackIds, playlist)}
                    onContextMenu={(point) =>
                      setContextMenu({ type: "playlist", item: playlist, point })
                    }
                  />
                ))}
              </AnimatePresence>
            )}
          </SidebarGroup>

          <SidebarGroup
            title="Tags"
            collapsed={tagsCollapsed}
            onToggleCollapsed={() => setTagsCollapsed((value) => !value)}
            actionLabel="Create tag"
            actionIcon={icons.plus}
            onAction={onCreateTag}
          >
            {tags.length === 0 ? (
              <SidebarEmpty key="tags-empty">No tags yet</SidebarEmpty>
            ) : (
              <AnimatePresence>
                {tags.map((tag) => (
                  <SidebarItem
                    key={tag.id}
                    active={selectedSource?.type === "tag" && selectedSource.id === tag.id}
                    icon={icons.tag}
                    label={tag.name}
                    detail={`${tag.trackIds.length}`}
                    onClick={() => onSelectSource({ type: "tag", id: tag.id })}
                    onDropTrack={(trackIds) => onDropTrackToTag(trackIds, tag)}
                    onContextMenu={(point) => setContextMenu({ type: "tag", item: tag, point })}
                  />
                ))}
              </AnimatePresence>
            )}
          </SidebarGroup>
        </div>
      </div>

      <motion.button
        className="no-drag mt-[18px] hidden h-[49px] w-full shrink-0 items-center justify-center gap-2 rounded-[33px] bg-primary px-4 text-[14px] font-medium leading-none text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.48),0_14px_34px_rgba(255,255,0,0.08)] transition-colors disabled:opacity-55"
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
        onRenameTag={onRenameTag}
        onDeleteTag={onDeleteTag}
      />
    </aside>
  );
}
