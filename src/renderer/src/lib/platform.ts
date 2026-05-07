export function isMacPlatform() {
  return navigator.platform.toLowerCase().includes("mac");
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
