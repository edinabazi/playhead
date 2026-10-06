/** Error message for display, without Electron's IPC wrapper text. */
export function getErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error) || !error.message) return fallback;

  return error.message.replace(/^Error invoking remote method '[^']+': Error: /, "");
}
