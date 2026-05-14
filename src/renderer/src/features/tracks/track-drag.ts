import type { LibraryTrack } from "../../../../shared/library";

const trackIdMimeType = "application/x-playhead-track-id";
const trackIdsMimeType = "application/x-playhead-track-ids";
const queueItemIdMimeType = "application/x-playhead-queue-item-id";
const queueItemIdsMimeType = "application/x-playhead-queue-item-ids";

export function setDraggedTrackIds(
  dataTransfer: DataTransfer,
  trackIds: string[],
  fallbackId: string,
) {
  dataTransfer.setData(trackIdMimeType, fallbackId);
  dataTransfer.setData(trackIdsMimeType, JSON.stringify(trackIds));
}

export function getDraggedTrackIds(dataTransfer: DataTransfer) {
  const trackIdsPayload = dataTransfer.getData(trackIdsMimeType);
  const fallbackTrackId = dataTransfer.getData(trackIdMimeType);

  if (!trackIdsPayload) return fallbackTrackId ? [fallbackTrackId] : [];

  try {
    const parsedTrackIds = JSON.parse(trackIdsPayload);
    if (Array.isArray(parsedTrackIds)) {
      return parsedTrackIds.filter((trackId): trackId is string => typeof trackId === "string");
    }
  } catch {
    return fallbackTrackId ? [fallbackTrackId] : [];
  }

  return fallbackTrackId ? [fallbackTrackId] : [];
}

export function setDraggedQueueItemIds(
  dataTransfer: DataTransfer,
  itemIds: string[],
  fallbackId: string,
) {
  dataTransfer.setData(queueItemIdMimeType, fallbackId);
  dataTransfer.setData(queueItemIdsMimeType, JSON.stringify(itemIds));
}

export function getDraggedQueueItemIds(dataTransfer: DataTransfer) {
  const itemIdsPayload = dataTransfer.getData(queueItemIdsMimeType);
  const fallbackItemId = dataTransfer.getData(queueItemIdMimeType);

  if (!itemIdsPayload) return fallbackItemId ? [fallbackItemId] : [];

  try {
    const parsedItemIds = JSON.parse(itemIdsPayload);
    if (Array.isArray(parsedItemIds)) {
      return parsedItemIds.filter((itemId): itemId is string => typeof itemId === "string");
    }
  } catch {
    return fallbackItemId ? [fallbackItemId] : [];
  }

  return fallbackItemId ? [fallbackItemId] : [];
}

export function createTrackStackDragImage(tracks: LibraryTrack[]) {
  const preview = document.createElement("div");
  const visibleTracks = tracks.slice(0, 3);

  Object.assign(preview.style, {
    position: "fixed",
    top: "-1000px",
    left: "-1000px",
    width: "244px",
    height: "72px",
    pointerEvents: "none",
    zIndex: "9999",
  });

  visibleTracks
    .slice()
    .reverse()
    .forEach((track, reversedIndex) => {
      const index = visibleTracks.length - 1 - reversedIndex;
      const card = document.createElement("div");
      const title = document.createElement("div");
      const artist = document.createElement("div");
      const badge = document.createElement("div");

      Object.assign(card.style, {
        position: "absolute",
        inset: "0",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: "3px",
        boxSizing: "border-box",
        padding: "10px 44px 10px 14px",
        border: "1px solid rgba(255, 255, 255, 0.13)",
        borderRadius: "16px",
        background: "rgba(22, 22, 22, 0.94)",
        boxShadow: "0 18px 38px rgba(0, 0, 0, 0.34)",
        color: "white",
        transform: `translate(${index * 7}px, ${index * 6}px) rotate(${(index - 1) * 1.5}deg)`,
        opacity: `${1 - index * 0.14}`,
      });

      Object.assign(title.style, {
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        fontSize: "13px",
        fontWeight: "700",
        lineHeight: "16px",
      });

      Object.assign(artist.style, {
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        color: "rgba(255, 255, 255, 0.62)",
        fontSize: "12px",
        fontWeight: "600",
        lineHeight: "15px",
      });

      Object.assign(badge.style, {
        position: "absolute",
        right: "11px",
        top: "50%",
        display: "grid",
        width: "28px",
        height: "28px",
        placeItems: "center",
        borderRadius: "999px",
        background: "var(--color-primary, #ffff00)",
        color: "black",
        fontSize: "12px",
        fontWeight: "800",
        transform: "translateY(-50%)",
      });

      title.textContent = track.title;
      artist.textContent = track.artist;
      badge.textContent = `${tracks.length}`;
      card.append(title, artist, badge);
      preview.appendChild(card);
    });

  return preview;
}
