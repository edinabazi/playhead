import { usesCustomWindowControls, usesWindowsWindowControls } from "@/lib/platform";
import { useTranslation } from "@/lib/i18n";

/**
 * macOS-style traffic-light controls, drawn on Linux where the window is also
 * frameless. Windows renders its own native-style cluster instead, and macOS
 * uses the real system controls so this renders nothing.
 */
export function WindowControls() {
  const t = useTranslation();
  if (!usesCustomWindowControls() || usesWindowsWindowControls()) return null;

  return (
    <div className="app-window-controls no-drag left-[19px] top-[12px] z-[60] flex items-center gap-2">
      <button
        type="button"
        className="window-control bg-[#ff5f57] hover:bg-[#ff716a]"
        aria-label={t("window.close")}
        title={t("window.close")}
        onClick={() => void window.playhead.closeWindow()}
      />
      <button
        type="button"
        className="window-control bg-[#ffbd2e] hover:bg-[#ffc94d]"
        aria-label={t("window.minimize")}
        title={t("window.minimize")}
        onClick={() => void window.playhead.minimizeWindow()}
      />
      <button
        type="button"
        className="window-control bg-[#28c840] hover:bg-[#3fd455]"
        aria-label={t("window.maximize")}
        title={t("window.maximize")}
        onClick={() => void window.playhead.toggleMaximizeWindow()}
      />
    </div>
  );
}
