import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { motion } from "framer-motion";
import type { LibraryTrack } from "../../../../shared/library";
import { activeLyricIndex, type Lyrics } from "../../../../shared/lyrics";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { useIcons } from "@/lib/icon-context";
import { formatTime } from "@/lib/format";
import type { PlaybackClock } from "../player/playback-clock";
import { useTrackLyrics } from "./use-track-lyrics";
import { LyricsMenu } from "./LyricsMenu";

export function LyricsPanel({
  track,
  clock,
  reduceMotion,
  onSeek,
  onClose,
}: {
  track: LibraryTrack | null;
  clock: PlaybackClock;
  reduceMotion: boolean;
  onSeek: (time: number) => void;
  onClose: () => void;
}) {
  const local = Boolean(track && track.source !== "soundcloud" && !track.soundcloud);
  const { result, loading, choosing, error, setError, refresh, choose } = useTrackLyrics(
    local ? track!.id : null,
  );
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const icons = useIcons();
  const LyricsIcon = icons["captions"];
  const CloseIcon = icons.x;
  const message = error || result?.error;
  const lyrics = result?.lyrics;
  return (
    <motion.section
      id="lyrics-panel"
      aria-label="Lyrics"
      className="no-drag relative -mb-4 flex min-h-0 flex-1 flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduceMotion ? 0 : 0.18 }}
      onKeyDown={(event) => {
        // Navigation belongs to lyrics while focused here; Space still controls playback on the scroll area.
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        } else if (
          ["ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown", "Enter"].includes(
            event.key,
          ) ||
          (event.key === " " && (event.target as HTMLElement).closest('button,[role="menuitem"]'))
        )
          event.stopPropagation();
      }}
      onDragEnter={(event) => {
        if (!local || !event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        dragDepth.current++;
        setDragging(true);
      }}
      onDragLeave={() => {
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (!dragDepth.current) setDragging(false);
      }}
      onDragOver={(event) => {
        if (local && event.dataTransfer.types.includes("Files")) {
          event.preventDefault();
          event.dataTransfer.dropEffect = "link";
        }
      }}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        dragDepth.current = 0;
        setDragging(false);
        if (!local) return;
        const files = [...event.dataTransfer.files];
        if (files.length !== 1 || !files[0].name.toLowerCase().endsWith(".lrc")) {
          setError("Drop one .lrc lyrics file here.");
          return;
        }
        const path = window.playhead.getDroppedFilePath(files[0]);
        if (path) void choose(path);
        else setError("Couldn't open that file. Try Choose lyrics file instead.");
      }}
    >
      <div className="mx-4 flex h-11 shrink-0 items-center gap-2 border-b border-white/[0.08]">
        <LyricsIcon size={15} strokeWidth={1.6} className="text-muted-foreground" />
        <h2 className="text-[12px] font-medium">Lyrics</h2>
        <span
          className="min-w-0 flex-1 truncate pl-1 text-[11px] text-muted-foreground"
          title={result?.fileName}
        >
          {lyrics
            ? `${lyrics.synced ? "Synced" : "Text"} · ${result?.source === "embedded" ? "Embedded" : result?.fileName}`
            : loading
              ? "Loading…"
              : ""}
        </span>
        <LyricsMenu
          custom={Boolean(result?.custom)}
          disabled={!local || choosing}
          reduceMotion={reduceMotion}
          onChoose={() => void choose()}
          onRefresh={() => void refresh()}
          onAutomatic={() => void choose(null)}
        />
        <Tooltip content="Back to library">
          <Button variant="ghost" size="icon-sm" aria-label="Close lyrics" onClick={onClose}>
            <CloseIcon size={14} />
          </Button>
        </Tooltip>
      </div>
      {message && (
        <div
          role="alert"
          className="mx-4 mt-2 flex shrink-0 items-center gap-3 rounded-lg bg-white/[0.05] px-3 py-2 text-[12px] text-muted-foreground"
        >
          <span className="flex-1">{message}</span>
          <Button variant="ghost" size="sm" onClick={() => void refresh()}>
            Retry
          </Button>
        </div>
      )}
      {lyrics ? (
        <LyricLines
          key={`${result?.source}:${result?.fileName}`}
          lyrics={lyrics}
          clock={clock}
          reduceMotion={reduceMotion}
          onSeek={onSeek}
        />
      ) : (
        <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto">
          <div className="flex min-h-full flex-col items-center justify-center px-8 py-5 text-center">
            <LyricsIcon
              size={32}
              strokeWidth={1.2}
              className="mb-4 shrink-0 text-muted-foreground/50 [@media(max-height:650px)]:hidden"
            />
            <p role="status" className="text-[15px] font-medium">
              {loading
                ? "Loading lyrics…"
                : !track
                  ? "Play a track to see its lyrics"
                  : !local
                    ? "Lyrics are available for local tracks"
                    : message
                      ? "Lyrics unavailable"
                      : "No lyrics found"}
            </p>
            {!loading && local && (
              <>
                <p className="mt-2 max-w-[320px] text-[13px] leading-relaxed text-muted-foreground">
                  Choose a lyrics file, or place a matching .lrc file beside this track.
                </p>
                <Button
                  className="mt-5 shrink-0 [@media(max-height:650px)]:mt-3"
                  variant="secondary"
                  size="md"
                  leadingIcon={icons["folder-open"]}
                  loading={choosing}
                  onClick={() => void choose()}
                >
                  Choose lyrics file…
                </Button>
                <p className="mt-3 text-[11px] text-muted-foreground/60 [@media(max-height:650px)]:hidden">
                  You can also drop an .lrc file here
                </p>
              </>
            )}
          </div>
        </div>
      )}
      {dragging && (
        <div className="pointer-events-none absolute inset-2 z-40 flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-primary/60 bg-[rgba(15,15,15,0.96)] text-primary">
          <LyricsIcon size={32} />
          <span className="text-[14px] font-medium">Drop lyrics for this track</span>
        </div>
      )}
    </motion.section>
  );
}

function LyricLines({
  lyrics,
  clock,
  reduceMotion,
  onSeek,
}: {
  lyrics: Lyrics;
  clock: PlaybackClock;
  reduceMotion: boolean;
  onSeek: (time: number) => void;
}) {
  // The snapshot is a line index, so React only renders when a lyric changes, even though the clock is precise.
  const index = useSyncExternalStore(clock.subscribePrecise, () =>
    lyrics.synced ? activeLyricIndex(lyrics.lines, clock.getTime()) : -1,
  );
  const [following, setFollowing] = useState(true);
  const container = useRef<HTMLDivElement>(null);
  const icons = useIcons();
  const FollowIcon = icons["arrow-down"];
  useEffect(() => {
    const viewport = container.current;
    if (!viewport || !following || !lyrics.synced) return;
    const scroll = () => {
      const line = viewport.querySelector<HTMLElement>('[aria-current="true"]');
      const top = line ? line.offsetTop - viewport.clientHeight * 0.38 + line.offsetHeight / 2 : 0;
      viewport.scrollTo({ top: Math.max(0, top), behavior: reduceMotion ? "instant" : "smooth" });
    };
    scroll();
    const observer = new ResizeObserver(scroll);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [index, following, lyrics.synced, lyrics.lines, reduceMotion]);
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={container}
        aria-label="Lyric lines"
        tabIndex={0}
        className="thin-scrollbar relative min-h-0 flex-1 overflow-y-auto overscroll-contain outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-primary/40"
        style={{
          maskImage:
            "linear-gradient(to bottom, transparent, black 18px, black calc(100% - 24px), transparent)",
        }}
        onWheel={() => setFollowing(false)}
        onTouchMove={() => setFollowing(false)}
        onPointerDown={(event) => {
          if (event.target === event.currentTarget) setFollowing(false);
        }}
        onKeyDown={(event) => {
          if (
            ["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", "Tab"].includes(event.key)
          )
            setFollowing(false);
        }}
      >
        <div className={`mx-auto max-w-[720px] px-6 ${lyrics.synced ? "pb-[40vh] pt-10" : "py-8"}`}>
          {lyrics.lines.map((line, lineIndex) => {
            const active = lyrics.synced && lineIndex === index;
            return line.time !== null ? (
              <button
                key={lineIndex}
                type="button"
                aria-current={active ? "true" : undefined}
                aria-label={`${line.text || "Instrumental"} — seek to ${formatTime(line.time)}`}
                onClick={() => {
                  onSeek(line.time!);
                  setFollowing(true);
                }}
                className={`group relative flex w-full items-baseline gap-3 rounded-lg py-3 text-left outline-none transition-colors duration-200 hover:text-foreground focus-visible:ring-1 focus-visible:ring-primary/50 ${active ? "text-foreground" : "text-muted-foreground/60"}`}
              >
                <span
                  className="min-w-0 flex-1 whitespace-pre-wrap break-words text-[clamp(20px,2.7vw,30px)] font-semibold leading-[1.45]"
                  dir="auto"
                >
                  {line.text || "···"}
                </span>
                <span
                  aria-hidden="true"
                  className="shrink-0 text-[10px] font-normal tabular-nums text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                >
                  {formatTime(line.time)}
                </span>
              </button>
            ) : (
              <p
                key={lineIndex}
                dir="auto"
                className="min-h-7 whitespace-pre-wrap break-words py-1 text-[20px] font-medium leading-[1.7] text-foreground/80"
              >
                {line.text || "\u00a0"}
              </p>
            );
          })}
        </div>
      </div>
      {lyrics.synced && (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
          {!following && (
            <Button
              variant="secondary"
              size="sm"
              leadingIcon={FollowIcon}
              className="pointer-events-auto border border-white/10 bg-[rgba(35,35,35,0.96)] shadow-lg"
              onClick={() => setFollowing(true)}
            >
              Follow playback
            </Button>
          )}
        </div>
      )}
      <div className="mx-4 flex h-7 shrink-0 items-center justify-between text-[10px] text-muted-foreground/60">
        <span>{lyrics.synced ? "Click a line to seek" : "These lyrics have no timestamps"}</span>
        <span>{lyrics.synced && following ? "Following playback" : ""}</span>
      </div>
    </div>
  );
}
