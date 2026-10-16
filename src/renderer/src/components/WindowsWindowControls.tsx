import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";

/**
 * Windows-style window controls (minimize / maximize–restore / close), matching
 * the Fluent look: a 46x32 hit target, 10px glyphs drawn as 1px strokes, a light
 * hover wash, and a red close button.
 *
 * The window is frameless on Windows, so these are the only way to control it
 * and must always remain clickable.
 */
const buttonClass =
  "grid h-8 w-[46px] place-items-center text-foreground/85 transition-colors " +
  "hover:bg-white/[0.09] active:bg-white/[0.05] focus-visible:outline-none " +
  "focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-primary/70";

export function WindowsWindowControls() {
  const t = useTranslation();
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    let active = true;
    void window.playhead.isWindowMaximized().then((value) => {
      if (active) setMaximized(value);
    });

    // Keep the glyph correct when the window is maximized by other means, such
    // as double-clicking the drag region or a system shortcut.
    const unsubscribe = window.playhead.onWindowMaximizedChanged((value) => setMaximized(value));

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return (
    <div className="app-window-controls no-drag right-0 top-0 z-[60] flex items-center">
      <button
        type="button"
        className={buttonClass}
        aria-label={t("window.minimize")}
        title={t("window.minimize")}
        onClick={() => void window.playhead.minimizeWindow()}
      >
        <Glyph>
          <line x1="1" y1="5.5" x2="9" y2="5.5" />
        </Glyph>
      </button>

      <button
        type="button"
        className={buttonClass}
        aria-label={maximized ? t("window.restore") : t("window.maximize")}
        title={maximized ? t("window.restore") : t("window.maximize")}
        onClick={() => void window.playhead.toggleMaximizeWindow()}
      >
        {maximized ? (
          <Glyph>
            {/* Two offset squares, the Windows "restore down" glyph. */}
            <path d="M2.5 3.5h5v5" />
            <rect x="0.5" y="1.5" width="5" height="5" rx="0.5" />
          </Glyph>
        ) : (
          <Glyph>
            <rect x="0.5" y="0.5" width="9" height="9" rx="0.5" />
          </Glyph>
        )}
      </button>

      <button
        type="button"
        className={`${buttonClass} hover:bg-[#c42b1c] hover:text-white active:bg-[#b32a1c]`}
        aria-label={t("window.close")}
        title={t("window.close")}
        onClick={() => void window.playhead.closeWindow()}
      >
        <Glyph>
          <line x1="0.5" y1="0.5" x2="9.5" y2="9.5" />
          <line x1="9.5" y1="0.5" x2="0.5" y2="9.5" />
        </Glyph>
      </button>
    </div>
  );
}

/** Shared 10x10 viewBox so every glyph is identical in weight and alignment. */
function Glyph({ children }: { children: React.ReactNode }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}
