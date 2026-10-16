export function isMacPlatform() {
  return navigator.platform.toLowerCase().includes("mac");
}

/**
 * True on Windows, where the window is frameless and therefore needs custom
 * controls that look and behave like the platform's own.
 *
 * Several signals are checked because `navigator.platform` is deprecated and is
 * not guaranteed to be populated: if detection failed the window would render no
 * close button at all, leaving the user unable to quit.
 */
export function isWindowsPlatform() {
  if (typeof navigator === "undefined") return false;

  const platform = navigator.platform?.toLowerCase() ?? "";
  if (platform.includes("win")) return true;
  if (platform) return false;

  return /windows/i.test(navigator.userAgent ?? "");
}

export function usesCustomWindowControls() {
  return !isMacPlatform();
}

/**
 * Whether to draw the Windows-style control cluster. Linux keeps the original
 * macOS-style controls the app shipped with.
 */
export function usesWindowsWindowControls() {
  return isWindowsPlatform();
}

export function getPrimaryModifierLabel() {
  return isMacPlatform() ? "⌘" : "Ctrl";
}

export function getFolderPickerName() {
  const platform = navigator.platform.toLowerCase();

  if (platform.includes("mac")) return "Finder";
  if (platform.includes("win")) return "Explorer";
  return "your file manager";
}
