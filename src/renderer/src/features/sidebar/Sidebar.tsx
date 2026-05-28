import { useIcons } from "@/lib/icon-context";
import { panelContentVariants } from "@/lib/motion-variants";
import { motion } from "framer-motion";
import { useState } from "react";
import type {
  AppUpdateState,
  LibraryFolder,
  LibraryMode,
  LibraryPlaylist,
  LibraryTag,
  SelectedSource,
  SoundCloudCollection,
} from "../../../../shared/library";
import { SidebarContextMenu, type SidebarContextMenuState } from "./SidebarContextMenu";
import { SidebarGroup } from "./SidebarGroup";
import { SidebarEmpty, SidebarItem } from "./SidebarItem";
import { SidebarShell } from "./SidebarShell";

function SidebarDetailSpinner() {
  return (
    <span className="flex h-[14px] w-[18px] items-center justify-end text-primary/80">
      <svg className="h-[14px] w-[14px]" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M 12 12 C 14 8.5 19 8.5 19 12 C 19 15.5 14 15.5 12 12 C 10 8.5 5 8.5 5 12 C 5 15.5 10 15.5 12 12 Z"
          stroke="currentColor"
          strokeWidth="1.45"
          strokeLinecap="round"
          pathLength="100"
          className="sidebar-detail-spinner-path"
        />
      </svg>
    </span>
  );
}

function SidebarGroupSkeleton() {
  return (
    <div
      className="flex flex-col gap-1"
      role="status"
      aria-label="Loading SoundCloud collections"
    >
      {[72, 54, 64].map((width, index) => (
        <div
          key={index}
          className="relative -mx-2 flex min-h-7 w-[calc(100%+16px)] animate-pulse items-center gap-2 px-2 py-1"
        >
          <span className="h-[17px] w-[17px] shrink-0 rounded-[5px] bg-white/[0.07]" />
          <span
            className="h-3 rounded-full bg-white/[0.075]"
            style={{ width: `${width}%` }}
          />
          <span className="ml-auto h-2.5 w-5 shrink-0 rounded-full bg-white/[0.055]" />
        </div>
      ))}
    </div>
  );
}

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
  soundcloudEnabled,
  soundcloudCollections,
  soundcloudLoadingCollectionId,
  isScanning,
  updateState,
  onAddFolder,
  onOpenSearch,
  onOpenSettings,
  onInstallUpdate,
  onCreatePlaylist,
  onCreateTag,
  onSelectSource,
  onSelectSoundCloudSource,
  onRefreshSoundCloud,
  onDropTrackToPlaylist,
  onDropTrackToTag,
  onRemoveFolder,
  onRenamePlaylist,
  onDeletePlaylist,
  onRenameTag,
  onDeleteTag,
  queueOpen,
  onToggleQueue,
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
  soundcloudEnabled: boolean;
  soundcloudCollections: SoundCloudCollection[];
  soundcloudLoadingCollectionId: string | null;
  isScanning: boolean;
  updateState: AppUpdateState;
  onAddFolder: () => void;
  onOpenSearch: () => void;
  onOpenSettings: () => void;
  onInstallUpdate: () => void;
  onCreatePlaylist: () => void;
  onCreateTag: () => void;
  onSelectSource: (source: SelectedSource) => void;
  onSelectSoundCloudSource: (collectionId: string) => void;
  onRefreshSoundCloud: () => void;
  onDropTrackToPlaylist: (trackIds: string[], playlist: LibraryPlaylist) => void;
  onDropTrackToTag: (trackIds: string[], tag: LibraryTag) => void;
  onRemoveFolder: (folder: LibraryFolder) => void;
  onRenamePlaylist: (playlist: LibraryPlaylist) => void;
  onDeletePlaylist: (playlist: LibraryPlaylist) => void;
  onRenameTag: (tag: LibraryTag) => void;
  onDeleteTag: (tag: LibraryTag) => void;
  queueOpen: boolean;
  onToggleQueue: () => void;
}) {
  const icons = useIcons();
  const [foldersCollapsed, setFoldersCollapsed] = useState(false);
  const [playlistsCollapsed, setPlaylistsCollapsed] = useState(false);
  const [tagsCollapsed, setTagsCollapsed] = useState(false);
  const [soundcloudCollapsed, setSoundcloudCollapsed] = useState(false);
  const [contextMenu, setContextMenu] = useState<SidebarContextMenuState>(null);
  const FolderPlusIcon = icons["folder-plus"];
  const SettingsIcon = icons.settings;
  const isLibraryMode = libraryMode === "library";
  const soundcloudSidebarCollections = soundcloudCollections.filter(
    (collection) => collection.kind === "tracks",
  );

  return (
    <SidebarShell
      updateState={updateState}
      queueOpen={queueOpen}
      onToggleQueue={onToggleQueue}
      onOpenSearch={onOpenSearch}
      onOpenSettings={onOpenSettings}
      onInstallUpdate={onInstallUpdate}
      footer={
        <button
          className="no-drag mt-[18px] hidden h-[49px] w-full shrink-0 items-center justify-center gap-2 rounded-[33px] bg-primary px-4 text-[14px] font-medium leading-none text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.48),0_14px_34px_rgba(255,255,0,0.08)] transition-colors disabled:opacity-55"
          title={isLibraryMode ? "Manage library" : "Add folder"}
          disabled={!isLibraryMode && isScanning}
          onClick={isLibraryMode ? onOpenSettings : onAddFolder}
        >
          {isLibraryMode ? (
            <SettingsIcon size={17} strokeWidth={1.9} />
          ) : (
            <FolderPlusIcon size={17} strokeWidth={1.9} />
          )}
          {isLibraryMode ? "Manage Library" : isScanning ? "Scanning..." : "Add Folder"}
        </button>
      }
    >
      <div className="thin-scrollbar -mx-2 mt-[30px] min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-2">
        <motion.div
          className="flex flex-col gap-[30px] overflow-visible no-drag"
          variants={panelContentVariants}
          initial="hidden"
          animate="show"
        >
          {libraryMode === "library" ? (
            <SidebarGroup
              title="Library"
              collapsed={foldersCollapsed}
              onToggleCollapsed={() => setFoldersCollapsed((value) => !value)}
              actionLabel="Add folder"
              actionIcon={icons["folder-plus"]}
              onAction={onAddFolder}
            >
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
                folders.map((folder) => (
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
                ))
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
              <>
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
              </>
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
              tags.map((tag) => (
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
              ))
            )}
          </SidebarGroup>
          {soundcloudEnabled && (
            <SidebarGroup
              title="SoundCloud"
              collapsed={soundcloudCollapsed}
              onToggleCollapsed={() => setSoundcloudCollapsed((value) => !value)}
              actionLabel="Refresh SoundCloud"
              actionIcon={icons["radio-tower"]}
              onAction={onRefreshSoundCloud}
            >
              {soundcloudSidebarCollections.length === 0 ? (
                soundcloudLoadingCollectionId ? (
                  <SidebarGroupSkeleton />
                ) : (
                  <SidebarEmpty key="soundcloud-empty">No SoundCloud collections</SidebarEmpty>
                )
              ) : (
                soundcloudSidebarCollections.map((collection) => (
                  <SidebarItem
                    key={collection.id}
                    active={
                      selectedSource?.type === "soundcloud" && selectedSource.id === collection.id
                    }
                    icon={icons["radio-tower"]}
                    label={collection.title}
                    detail={
                      soundcloudLoadingCollectionId === collection.id
                        ? <SidebarDetailSpinner />
                        : collection.trackCount !== undefined
                          ? `${collection.trackCount}`
                          : undefined
                    }
                    onClick={() => onSelectSoundCloudSource(collection.id)}
                  />
                ))
              )}
            </SidebarGroup>
          )}
        </motion.div>
      </div>

      <SidebarContextMenu
        state={contextMenu}
        onOpenChange={(nextState) => setContextMenu(nextState)}
        onRemoveFolder={onRemoveFolder}
        onRenamePlaylist={onRenamePlaylist}
        onDeletePlaylist={onDeletePlaylist}
        onRenameTag={onRenameTag}
        onDeleteTag={onDeleteTag}
      />
    </SidebarShell>
  );
}
