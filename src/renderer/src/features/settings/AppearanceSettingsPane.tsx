import { Switch } from "@/components/ui/switch";
import type { AppearanceSettings } from "../../../../shared/library";
import { SettingsFooter, TransparencySlider } from "./SettingsControls";

export function AppearanceSettingsPane({
  settings,
  changed,
  isTransparencyPreviewing,
  onChange,
  onTransparencyChange,
  onPreviewStart,
  onPreviewEnd,
  onReset,
  onSave,
}: {
  settings: AppearanceSettings;
  changed: boolean;
  isTransparencyPreviewing: boolean;
  onChange: (settings: AppearanceSettings) => void;
  onTransparencyChange: (appTransparency: number) => void;
  onPreviewStart: () => void;
  onPreviewEnd: () => void;
  onReset: () => void;
  onSave: () => void;
}) {
  return (
    <>
      <div className="thin-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto pb-20 pr-1">
        <div
          className={`rounded-[22px] border border-white/10 bg-white/[0.035] p-4 transition-opacity ${
            isTransparencyPreviewing ? "pointer-events-auto border-0 !bg-transparent" : ""
          }`}
        >
          <div
            className={`transition-opacity ${
              isTransparencyPreviewing ? "pointer-events-none opacity-0" : ""
            }`}
          >
            <h4 className="text-[14px] font-semibold leading-5 text-foreground">
              App transparency
            </h4>
            <p className="mt-1 max-w-[420px] text-[12px] font-medium leading-4 text-muted-foreground">
              Adjust how much of the desktop shows through Playhead.
            </p>
          </div>
          <TransparencySlider
            value={settings.appTransparency}
            onChange={onTransparencyChange}
            onPreviewStart={onPreviewStart}
            onPreviewEnd={onPreviewEnd}
          />
        </div>

        <div
          className={`rounded-[22px] border border-white/10 bg-white/[0.035] p-4 transition-opacity ${
            isTransparencyPreviewing
              ? "pointer-events-none border-transparent bg-transparent opacity-0"
              : ""
          }`}
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <h4 className="text-[14px] font-semibold leading-5 text-foreground">
                Reduce motion
              </h4>
              <p className="mt-1 max-w-[420px] text-[12px] font-medium leading-4 text-muted-foreground">
                Simplify animation and transition effects.
              </p>
            </div>
            <Switch
              checked={settings.reduceMotion}
              onCheckedChange={(checked) => onChange({ ...settings, reduceMotion: checked })}
            />
          </div>
        </div>
      </div>

      <SettingsFooter
        status={changed ? "Changes will apply after saving." : "Appearance settings are up to date."}
        changed={changed}
        onReset={onReset}
        onSave={onSave}
      />
    </>
  );
}
