import { Switch } from "@/components/ui/switch";
import { useTranslation } from "@/lib/i18n";
import type { PlaybackSettings } from "../../../../shared/library";
import { SettingsFooter, SettingsOptionGroup } from "./SettingsControls";

export function PlaybackSettingsPane({
  settings,
  changed,
  onChange,
  onReset,
  onSave,
}: {
  settings: PlaybackSettings;
  changed: boolean;
  onChange: (settings: PlaybackSettings) => void;
  onReset: () => void;
  onSave: () => void;
}) {
  const t = useTranslation();

  return (
    <>
      <div className="thin-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto pb-20 pr-1">
        <SettingsOptionGroup
          title={t("settings.playback.seekStep.title")}
          description={t("settings.playback.seekStep.description")}
          options={[
            { label: "5s", value: 5 },
            { label: "10s", value: 10 },
            { label: "15s", value: 15 },
            { label: "30s", value: 30 },
          ]}
          value={settings.seekStepSeconds}
          onChange={(value) => onChange({ ...settings, seekStepSeconds: value })}
        />

        <SettingsOptionGroup
          title={t("settings.playback.volumeStep.title")}
          description={t("settings.playback.volumeStep.description")}
          options={[
            { label: "2%", value: 2 },
            { label: "5%", value: 5 },
            { label: "10%", value: 10 },
          ]}
          value={settings.volumeStepPercent}
          onChange={(value) => onChange({ ...settings, volumeStepPercent: value })}
        />

        <PlaybackSwitch
          title={t("settings.playback.normalizeVolume.title")}
          description={t("settings.playback.normalizeVolume.description")}
          checked={settings.normalizeVolume}
          onCheckedChange={(checked) => onChange({ ...settings, normalizeVolume: checked })}
        />
        <PlaybackSwitch
          title={t("settings.playback.rememberPositions.title")}
          description={t("settings.playback.rememberPositions.description")}
          checked={settings.rememberTrackPositions}
          onCheckedChange={(checked) => onChange({ ...settings, rememberTrackPositions: checked })}
        />
        <PlaybackSwitch
          title={t("settings.playback.restoreSession.title")}
          description={t("settings.playback.restoreSession.description")}
          checked={settings.restoreLastSession}
          onCheckedChange={(checked) => onChange({ ...settings, restoreLastSession: checked })}
        />
        <PlaybackSwitch
          title={t("settings.playback.skipUnavailable.title")}
          description={t("settings.playback.skipUnavailable.description")}
          checked={settings.skipUnavailableTracks}
          onCheckedChange={(checked) => onChange({ ...settings, skipUnavailableTracks: checked })}
        />
      </div>

      <SettingsFooter
        status={
          changed
            ? t("settings.status.unsaved")
            : t("settings.status.upToDate", { category: t("settings.category.playback") })
        }
        changed={changed}
        onReset={onReset}
        onSave={onSave}
      />
    </>
  );
}

function PlaybackSwitch({
  title,
  description,
  checked,
  onCheckedChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-white/[0.035] p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h4 className="text-[14px] font-semibold leading-5 text-foreground">{title}</h4>
          <p className="mt-1 max-w-[420px] text-[12px] font-medium leading-4 text-muted-foreground">
            {description}
          </p>
        </div>
        <Switch checked={checked} onCheckedChange={onCheckedChange} />
      </div>
    </div>
  );
}
