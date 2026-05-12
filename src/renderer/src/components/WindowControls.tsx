import { usesCustomWindowControls } from "@/lib/platform";

export function WindowControls() {
  if (!usesCustomWindowControls()) return null;

  return (
    <div className="app-window-controls no-drag left-[19px] top-[12px] z-[60] flex items-center gap-2">
      <button
        type="button"
        className="window-control bg-[#ff5f57] hover:bg-[#ff716a]"
        aria-label="Close window"
        onClick={() => void window.playhead.closeWindow()}
      />
      <button
        type="button"
        className="window-control bg-[#ffbd2e] hover:bg-[#ffc94d]"
        aria-label="Minimize window"
        onClick={() => void window.playhead.minimizeWindow()}
      />
      <button
        type="button"
        className="window-control bg-[#28c840] hover:bg-[#3fd455]"
        aria-label="Maximize window"
        onClick={() => void window.playhead.toggleMaximizeWindow()}
      />
    </div>
  );
}
