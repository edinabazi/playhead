import { AnimatePresence, motion } from "framer-motion";
import { formatTime } from "@/lib/format";
import type { MenuAnchorPoint } from "@/lib/menu-position";
import type { LibraryPlaylist, LibraryTag, LibraryTrack } from "../../../../shared/library";
import { FavoriteHeartButton } from "./FavoriteHeartButton";
import { TrackArtwork } from "./TrackArtwork";
import { TrackCell } from "./TrackCell";
import { TrackRowMenu } from "./TrackRowMenu";

type TrackListRowProps = {
  track: LibraryTrack;
  index: number;
  activeTrackId: string | null;
  isPlaying: boolean;
  selected: boolean;
  dragging: boolean;
  favorite: boolean;
  selectedTracks: LibraryTrack[];
  selectedPlaylist: LibraryPlaylist | null;
  selectedTag: LibraryTag | null;
  playlists: LibraryPlaylist[];
  tags: LibraryTag[];
  menuOpen: boolean;
  menuAnchorPoint: MenuAnchorPoint | null;
  menuIcon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  artworkFallbackIcon: React.ComponentType<{
    size?: number;
    strokeWidth?: number;
    className?: string;
  }>;
  onSelect: (track: LibraryTrack, event?: React.MouseEvent<HTMLDivElement>) => void;
  onPlay: (track: LibraryTrack) => void;
  onContextMenu: (track: LibraryTrack, point: MenuAnchorPoint) => void;
  onKeyPlay: (track: LibraryTrack) => void;
  onDragStart: (track: LibraryTrack, event: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  onDragOver: React.DragEventHandler<HTMLDivElement>;
  onDragLeave: React.DragEventHandler<HTMLDivElement>;
  onDrop: React.DragEventHandler<HTMLDivElement>;
  onToggleFavorite: (track: LibraryTrack) => void;
  onMenuOpenChange: (open: boolean, point: MenuAnchorPoint | null) => void;
  onAddToPlaylist: (track: LibraryTrack, playlist: LibraryPlaylist) => void;
  onAddTracksToPlaylist: (tracks: LibraryTrack[], playlist: LibraryPlaylist) => void;
  onCreatePlaylist: (tracks: LibraryTrack[]) => void;
  onAddTracksToTag: (tracks: LibraryTrack[], tag: LibraryTag) => void;
  onCreateTag: (tracks: LibraryTrack[]) => void;
  onRemoveFromPlaylist: (trackIds: string[]) => void;
  onRemoveFromTag: (trackIds: string[]) => void;
  onShowInFolder: (track: LibraryTrack) => void;
  onShowMetadata: (track: LibraryTrack) => void;
  onViewArtist?: (track: LibraryTrack) => void;
  onViewAlbum?: (track: LibraryTrack) => void;
};

export function TrackListRow({
  track,
  index,
  activeTrackId,
  isPlaying,
  selected,
  dragging,
  favorite,
  selectedTracks,
  selectedPlaylist,
  selectedTag,
  playlists,
  tags,
  menuOpen,
  menuAnchorPoint,
  menuIcon,
  artworkFallbackIcon,
  onSelect,
  onPlay,
  onContextMenu,
  onKeyPlay,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
  onToggleFavorite,
  onMenuOpenChange,
  onAddToPlaylist,
  onAddTracksToPlaylist,
  onCreatePlaylist,
  onAddTracksToTag,
  onCreateTag,
  onRemoveFromPlaylist,
  onRemoveFromTag,
  onShowInFolder,
  onShowMetadata,
  onViewArtist,
  onViewAlbum,
}: TrackListRowProps) {
  return (
    <TrackCell
      draggable
      trackId={track.id}
      selected={selected}
      dragging={dragging}
      onClick={(event) => onSelect(track, event)}
      onDoubleClick={() => onPlay(track)}
      onContextMenu={(event) => {
        event.preventDefault();
        onContextMenu(track, { x: event.clientX, y: event.clientY, align: "left" });
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") onKeyPlay(track);
      }}
      onDragStart={(event) => onDragStart(track, event)}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3 pr-6">
        <TrackNumberOrIndicator
          index={index}
          active={activeTrackId === track.id}
          isPlaying={isPlaying}
        />
        <TrackArtwork track={track} fallbackIcon={artworkFallbackIcon} />
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold leading-[1.18]">{track.title}</p>
          <p className="mt-0.5 truncate text-[13px] font-medium leading-[1.25] text-muted-foreground">
            {track.artist}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-4 text-[13px] font-medium tabular-nums text-muted-foreground">
        <span>{formatTime(track.duration)}</span>
        <FavoriteHeartButton
          active={favorite}
          tooltipSide="top"
          onClick={(event) => {
            event.stopPropagation();
            void onToggleFavorite(track);
          }}
        />
        <TrackRowMenu
          track={track}
          selectedTracks={selectedTracks}
          playlists={playlists}
          tags={tags}
          selectedPlaylist={selectedPlaylist}
          selectedTag={selectedTag}
          menuIcon={menuIcon}
          open={menuOpen}
          anchorPoint={menuAnchorPoint}
          onOpenChange={onMenuOpenChange}
          onAddToPlaylist={onAddToPlaylist}
          onAddTracksToPlaylist={onAddTracksToPlaylist}
          onCreatePlaylist={onCreatePlaylist}
          onAddTracksToTag={onAddTracksToTag}
          onCreateTag={onCreateTag}
          onRemoveFromPlaylist={onRemoveFromPlaylist}
          onRemoveFromTag={onRemoveFromTag}
          onShowInFolder={onShowInFolder}
          onShowMetadata={onShowMetadata}
          onViewArtist={onViewArtist}
          onViewAlbum={onViewAlbum}
        />
      </div>
    </TrackCell>
  );
}

function TrackNumberOrIndicator({
  index,
  active,
  isPlaying,
}: {
  index: number;
  active: boolean;
  isPlaying: boolean;
}) {
  return (
    <div className="relative grid h-4 w-5 shrink-0 place-items-center font-mono text-[12px] font-medium tabular-nums text-muted-foreground">
      <AnimatePresence initial={false}>
        {active && isPlaying ? (
          <motion.span
            key="active-waveform"
            className="absolute inset-0 grid place-items-center"
            initial={{ opacity: 0, x: -3, filter: "blur(3px)" }}
            animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, x: 3, filter: "blur(3px)" }}
            transition={{
              x: { type: "spring", stiffness: 520, damping: 36, mass: 0.72 },
              opacity: { duration: 0.14 },
              filter: { duration: 0.16 },
            }}
          >
            <ActiveTrackIndicator />
          </motion.span>
        ) : (
          <motion.span
            key="track-number"
            className="absolute inset-0 grid place-items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ opacity: { duration: 0.14 } }}
          >
            {index + 1}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

function ActiveTrackIndicator() {
  return (
    <span className="flex size-4 items-center justify-center gap-[1.5px] text-primary">
      {[5, 10, 7, 13].map((height, index) => (
        <span
          key={index}
          className="w-[2px] animate-[active-waveform_2.18s_ease-in-out_infinite] rounded-full bg-current"
          style={{
            height,
            animationDelay: `${[0.22, 0, 0.33, 0.11][index]}s`,
          }}
        />
      ))}
    </span>
  );
}
