import { createPortal } from "react-dom";

/**
 * Clicks on `-webkit-app-region: drag` areas never reach the DOM, so popovers that
 * dismiss on outside `pointerdown` stay open when the user clicks the window chrome.
 * While mounted, this layer marks the whole window as no-drag (it is last in the body,
 * so it overrides earlier drag regions) without intercepting any pointer events.
 */
export function DragRegionBlocker() {
  return createPortal(
    <div aria-hidden="true" className="no-drag pointer-events-none fixed inset-0" />,
    document.body,
  );
}
