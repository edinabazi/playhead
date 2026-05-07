import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DialogOverlay,
  DialogPanel,
  dialogOverlayMotion,
  dialogPanelMotion,
} from "@/components/ui/dialog-motion";
import { formatTime } from "@/lib/format";
import { getArtworkSrc } from "@/lib/artwork";
import type {
  EditableTrackMetadata,
  LibraryTrack,
  TrackMetadata,
} from "../../../../shared/library";

export type MetadataDialogState = {
  track: LibraryTrack;
} | null;

export function MetadataDialog({
  track,
  onSave,
  onClose,
}: {
  track: LibraryTrack;
  onSave: (track: LibraryTrack, metadata: EditableTrackMetadata) => Promise<LibraryTrack>;
  onClose: () => void;
}) {
  const [metadata, setMetadata] = useState<TrackMetadata | null>(null);
  const [form, setForm] = useState<EditableTrackMetadata>({
    title: track.title,
    artist: track.artist,
    album: track.album || "",
    albumArtist: "",
    genre: "",
    year: "",
    trackNumber: "",
    diskNumber: "",
    composer: "",
    bpm: "",
    comment: "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [artworkPreview, setArtworkPreview] = useState<string | null>(getArtworkSrc(track));
  const artworkInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError("");
    setArtworkPreview(getArtworkSrc(track));

    void window.playhead
      .getTrackMetadata(track.path)
      .then((nextMetadata) => {
        if (cancelled) return;
        setMetadata(nextMetadata);
        setForm({
          ...nextMetadata.editable,
          title: nextMetadata.editable.title || track.title,
          artist: nextMetadata.editable.artist || track.artist,
          album: nextMetadata.editable.album || track.album || "",
        });
      })
      .catch(() => {
        if (!cancelled) setError("Could not read metadata for this file.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [track]);

  const updateField = (key: keyof EditableTrackMetadata, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const selectArtwork = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Choose a PNG or JPEG image.");
      return;
    }

    const data = await file.arrayBuffer();
    setForm((current) => ({
      ...current,
      artwork: {
        mimeType: file.type,
        data,
      },
    }));
    setArtworkPreview(URL.createObjectURL(file));
  };

  const editableFields: {
    key: Exclude<keyof EditableTrackMetadata, "artwork">;
    label: string;
  }[] = [
    { key: "title", label: "Title" },
    { key: "artist", label: "Artist" },
    { key: "album", label: "Album" },
    { key: "albumArtist", label: "Album artist" },
    { key: "genre", label: "Genre" },
    { key: "year", label: "Year" },
    { key: "trackNumber", label: "Track" },
    { key: "diskNumber", label: "Disc" },
    { key: "composer", label: "Composer" },
    { key: "bpm", label: "BPM" },
  ];

  const save = async () => {
    setIsSaving(true);
    setError("");

    try {
      await onSave(track, form);
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save metadata.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <DialogOverlay
      {...dialogOverlayMotion}
      className="app-modal-overlay fixed inset-0 z-50 grid place-items-center bg-black/45 p-6"
      onClick={onClose}
    >
      <DialogPanel
        {...dialogPanelMotion}
        className="no-drag selectable max-h-[84vh] w-full max-w-2xl overflow-hidden rounded-[32px] border border-white/10 bg-[rgba(10,10,10,0.96)] p-4 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="truncate text-[16px] font-semibold">Metadata</h2>
            <p className="truncate text-[13px] text-muted-foreground">{track.title}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button className="no-drag" size="sm" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              className="no-drag"
              size="sm"
              disabled={isLoading || isSaving || !metadata?.canSave}
              onClick={save}
            >
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>

        <div className="max-h-[64vh] overflow-y-auto pr-1">
          {isLoading ? (
            <div className="py-8 text-center text-[13px] text-muted-foreground">
              Loading metadata...
            </div>
          ) : (
            <>
              {!metadata?.canSave && (
                <div className="mb-3 rounded-[16px] border border-white/10 bg-white/[0.04] px-3 py-2 text-[12px] text-muted-foreground">
                  {metadata?.saveUnsupportedReason}
                </div>
              )}
              {error && (
                <div className="mb-3 rounded-[16px] border border-primary/30 bg-primary/10 px-3 py-2 text-[12px] text-primary">
                  {error}
                </div>
              )}

              <div className="mb-4 flex items-center gap-4 rounded-[20px] border border-white/10 bg-white/[0.035] p-3">
                <div className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-[16px] bg-white/10 text-center text-[12px] text-muted-foreground">
                  {artworkPreview ? (
                    <img className="size-full object-contain" src={artworkPreview} alt="" />
                  ) : (
                    "No artwork"
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium text-foreground">Artwork</div>
                  <div className="mt-1 text-[12px] leading-4 text-muted-foreground">
                    Replace the embedded cover image for this track.
                  </div>
                  <div className="mt-3">
                    <input
                      ref={artworkInputRef}
                      className="hidden"
                      type="file"
                      accept="image/png,image/jpeg"
                      disabled={!metadata?.canSave}
                      onChange={(event) => void selectArtwork(event.target.files?.[0])}
                    />
                    <Button
                      className="no-drag"
                      size="sm"
                      variant="secondary"
                      disabled={!metadata?.canSave}
                      onClick={() => artworkInputRef.current?.click()}
                    >
                      Choose Image
                    </Button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {editableFields.map((field) => (
                  <label
                    key={field.key}
                    className="flex min-w-0 flex-col gap-1 text-[12px] text-muted-foreground"
                  >
                    <span>{field.label}</span>
                    <input
                      className="h-9 rounded-[13px] border border-white/10 bg-white/[0.045] px-3 text-[13px] text-foreground outline-none disabled:opacity-60"
                      value={form[field.key]}
                      disabled={!metadata?.canSave}
                      onChange={(event) => updateField(field.key, event.target.value)}
                    />
                  </label>
                ))}
              </div>

              <label className="mt-3 flex min-w-0 flex-col gap-1 text-[12px] text-muted-foreground">
                <span>Comment</span>
                <textarea
                  className="min-h-20 resize-none rounded-[13px] border border-white/10 bg-white/[0.045] px-3 py-2 text-[13px] text-foreground outline-none disabled:opacity-60"
                  value={form.comment}
                  disabled={!metadata?.canSave}
                  onChange={(event) => updateField("comment", event.target.value)}
                />
              </label>

              <MetadataSection
                title="File"
                rows={{
                  Name: track.fileName,
                  Path: track.path,
                  Duration: formatTime(track.duration),
                  Artwork: track.artwork ? track.artwork.mimeType : "None",
                  "Track ID": track.id,
                }}
              />
              {metadata && (
                <>
                  <MetadataSection title="Format" rows={metadata.format} />
                  <MetadataSection title="Common Tags" rows={metadata.common} />
                  <NativeMetadataSection rows={metadata.native} />
                </>
              )}
            </>
          )}
        </div>
      </DialogPanel>
    </DialogOverlay>
  );
}

function MetadataSection({ title, rows }: { title: string; rows: Record<string, string> }) {
  const entries = Object.entries(rows).filter(([, value]) => value);
  if (entries.length === 0) return null;

  return (
    <div className="mt-5">
      <h3 className="mb-2 text-[12px] font-semibold text-muted-foreground">{title}</h3>
      <div className="overflow-hidden rounded-[18px] border border-white/10">
        {entries.map(([label, value]) => (
          <div
            key={label}
            className="grid grid-cols-[132px_1fr] gap-3 border-t border-white/10 px-3 py-2 first:border-t-0 text-[12px]"
          >
            <div className="text-muted-foreground">{label}</div>
            <div className="min-w-0 break-words text-foreground">{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NativeMetadataSection({ rows }: { rows: { id: string; value: string }[] }) {
  if (rows.length === 0) return null;

  return (
    <div className="mt-5">
      <h3 className="mb-2 text-[12px] font-semibold text-muted-foreground">Native Tags</h3>
      <div className="overflow-hidden rounded-[18px] border border-white/10">
        {rows.map((row, index) => (
          <div
            key={`${row.id}-${index}`}
            className="grid grid-cols-[132px_1fr] gap-3 border-t border-white/10 px-3 py-2 first:border-t-0 text-[12px]"
          >
            <div className="text-muted-foreground">{row.id}</div>
            <div className="min-w-0 break-words text-foreground">{row.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
