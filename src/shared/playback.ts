export type PlaybackFailure = {
  kind: "unavailable" | "missing" | "denied" | "decode" | "unknown";
  title: string;
  message: string;
};
export type PlaybackCopyResult =
  | { url: string; failure?: never }
  | { url?: never; failure: PlaybackFailure };

export function playbackFailure(error: unknown): PlaybackFailure {
  const code = (error as { code?: string | number } | null)?.code;
  if (
    [
      "EIO",
      "ESTALE",
      "ETIMEDOUT",
      "ENOTCONN",
      "ENODEV",
      "ENXIO",
      "EHOSTUNREACH",
      "ENETUNREACH",
      "ENETDOWN",
      "ECONNRESET",
    ].includes(String(code))
  )
    return {
      kind: "unavailable",
      title: "Drive unavailable",
      message: "Check the drive or network connection, then retry.",
    };
  if (code === "ENOENT" || code === "ENOTDIR")
    return {
      kind: "missing",
      title: "File unavailable",
      message: "The file may have moved, or its drive is disconnected.",
    };
  if (code === "EACCES" || code === "EPERM")
    return {
      kind: "denied",
      title: "Can't access this file",
      message: "Check the file or shared folder permissions, then retry.",
    };
  if (code === "ENOSPC")
    return {
      kind: "unavailable",
      title: "Not enough disk space",
      message: "Free some space for temporary playback, then retry.",
    };
  if (
    code === 3 ||
    code === 4 ||
    (error instanceof Error && /decod|not supported|no supported source/i.test(error.message))
  )
    return {
      kind: "decode",
      title: "Couldn't play this track",
      message: "The audio may be damaged or use an unsupported format.",
    };
  return {
    kind: "unknown",
    title: "Playback interrupted",
    message: "This track couldn't be played. Try loading it again.",
  };
}
