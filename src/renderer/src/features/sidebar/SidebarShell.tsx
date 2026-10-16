import playheadLogo from "@/assets/playhead-logo.svg";
import { WindowControls } from "@/components/WindowControls";
import { Tooltip } from "@/components/ui/tooltip";
import { useIcons } from "@/lib/icon-context";
import { useTranslation } from "@/lib/i18n";
import { getPrimaryModifierLabel } from "@/lib/platform";
import type { AppUpdateState } from "../../../../shared/library";

export function SidebarShell({
  updateState,
  queueOpen,
  onToggleQueue,
  onOpenSearch,
  onOpenSettings,
  onInstallUpdate,
  children,
  footer,
}: {
  updateState: AppUpdateState;
  queueOpen: boolean;
  onToggleQueue: () => void;
  onOpenSearch: () => void;
  onOpenSettings: () => void;
  onInstallUpdate: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const icons = useIcons();
  const t = useTranslation();
  const QueueIcon = icons["list-plus"];
  const SearchIcon = icons.search;
  const SettingsIcon = icons.settings;
  const modifierLabel = getPrimaryModifierLabel();
  const hasReadyUpdate = updateState.status === "ready";
  const queueAction = queueOpen ? t("nav.hideQueue") : t("nav.showQueue");
  const queueTooltip = t("nav.queueWithShortcut", {
    action: queueAction,
    shortcut: `${modifierLabel} L`,
  });
  const searchTooltip = t("nav.searchLibraryTooltip", { shortcut: `${modifierLabel} K` });
  const settingsTooltip = t("nav.openSettingsTooltip", { shortcut: `${modifierLabel} ,` });

  return (
    <aside className="app-drag relative flex size-full flex-col overflow-hidden app-panel-radius bg-[rgba(0,0,0,0.2)] px-[18px] pb-[18px] pt-[54px] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <WindowControls />
      {hasReadyUpdate && (
        <Tooltip
          content={
            updateState.version
              ? t("nav.installVersion", { version: updateState.version })
              : t("nav.installUpdateTooltip")
          }
          side="top"
          sideOffset={7}
        >
          <button
            type="button"
            className="absolute top-4.5 right-6 no-drag h-5 rounded-full bg-primary px-2 text-[11px] font-semibold leading-none text-primary-foreground transition hover:bg-primary/90 font-mono uppercase"
            aria-label={t("nav.installUpdateAria")}
            onClick={onInstallUpdate}
          >
            {t("nav.updateButton")}
          </button>
        </Tooltip>
      )}

      <div className="relative flex min-h-[30px] shrink-0 items-center justify-between">
        <img className="h-[26px]" src={playheadLogo} alt="Playhead" draggable={false} />
        <div className="flex items-center gap-0 translate-y-0.5 -mr-2">
          <Tooltip content={queueTooltip} side="top" sideOffset={7}>
            <button
              type="button"
              className={`no-drag grid size-8 place-items-center rounded-full transition ${
                queueOpen
                  ? "bg-primary/15 text-primary hover:bg-primary/20"
                  : "text-muted-foreground hover:bg-white/10 hover:text-foreground"
              }`}
              aria-label={queueOpen ? t("nav.hideQueue") : t("nav.queue")}
              aria-pressed={queueOpen}
              onClick={onToggleQueue}
            >
              <QueueIcon size={16} strokeWidth={1.8} />
            </button>
          </Tooltip>
          <Tooltip content={searchTooltip} side="top" sideOffset={7}>
            <button
              type="button"
              className="no-drag grid size-8 place-items-center rounded-full text-muted-foreground transition hover:bg-white/10 hover:text-foreground"
              aria-label={t("common.search")}
              onClick={onOpenSearch}
            >
              <SearchIcon size={16} strokeWidth={1.8} />
            </button>
          </Tooltip>
          <Tooltip content={settingsTooltip} side="top" sideOffset={7}>
            <button
              type="button"
              className="no-drag grid size-8 place-items-center rounded-full text-muted-foreground transition hover:bg-white/10 hover:text-foreground"
              aria-label={t("common.settings")}
              onClick={onOpenSettings}
            >
              <SettingsIcon size={16} strokeWidth={1.8} />
            </button>
          </Tooltip>
        </div>
      </div>

      {children}
      {footer}
    </aside>
  );
}
