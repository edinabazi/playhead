import { Switch } from "@/components/ui/switch";
import { useTranslation } from "@/lib/i18n";
import type { AppLanguage } from "../../../../shared/language";
import { windowCornerRadiusOptions, type AppearanceSettings } from "../../../../shared/library";
import { SettingsFooter, SettingsOptionGroup, TransparencySlider } from "./SettingsControls";

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
  const t = useTranslation();
  const languageOptions: Array<{ label: string; value: AppLanguage }> = [
    { label: t("settings.appearance.language.system"), value: "system" },
    { label: t("settings.appearance.language.en"), value: "en" },
    { label: t("settings.appearance.language.zhCN"), value: "zh-CN" },
  ];

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
              {t("settings.appearance.transparency.title")}
            </h4>
            <p className="mt-1 max-w-[420px] text-[12px] font-medium leading-4 text-muted-foreground">
              {t("settings.appearance.transparency.description")}
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
                {t("settings.appearance.reduceMotion.title")}
              </h4>
              <p className="mt-1 max-w-[420px] text-[12px] font-medium leading-4 text-muted-foreground">
                {t("settings.appearance.reduceMotion.description")}
              </p>
            </div>
            <Switch
              checked={settings.reduceMotion}
              onCheckedChange={(checked) => onChange({ ...settings, reduceMotion: checked })}
            />
          </div>
        </div>

        <div
          className={`transition-opacity ${
            isTransparencyPreviewing ? "pointer-events-none opacity-0" : ""
          }`}
        >
          <SettingsOptionGroup
            title={t("settings.appearance.language.title")}
            description={t("settings.appearance.language.description")}
            options={languageOptions}
            value={settings.language}
            onChange={(language) => onChange({ ...settings, language })}
          />
        </div>

        <div
          className={`transition-opacity ${
            isTransparencyPreviewing ? "pointer-events-none opacity-0" : ""
          }`}
        >
          <SettingsOptionGroup
            title={t("settings.appearance.windowCorners.title")}
            description={t("settings.appearance.windowCorners.description")}
            options={windowCornerRadiusOptions}
            value={settings.windowCornerRadius}
            onChange={(windowCornerRadius) => onChange({ ...settings, windowCornerRadius })}
          />
        </div>
      </div>

      <div
        className={`transition-opacity ${
          isTransparencyPreviewing ? "pointer-events-none opacity-0" : ""
        }`}
      >
        <SettingsFooter
          status={
            changed
              ? t("settings.status.unsaved")
              : t("settings.status.upToDate", {
                  category: t("settings.category.appearance"),
                })
          }
          changed={changed}
          onReset={onReset}
          onSave={onSave}
        />
      </div>
    </>
  );
}
