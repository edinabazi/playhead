import type { IconComponent } from "@/lib/icon-context";
import type { AdvancedSettingsAction } from "./SettingsDialog";

type AdvancedAction = {
  id: AdvancedSettingsAction;
  title: string;
  description: string;
  icon: IconComponent;
};

export function AdvancedSettingsPane({
  actions,
  pendingAction,
  loaderIcon: LoaderIcon,
  chevronRightIcon: ChevronRightIcon,
  onRunAction,
}: {
  actions: AdvancedAction[];
  pendingAction: AdvancedSettingsAction | null;
  loaderIcon: IconComponent;
  chevronRightIcon: IconComponent;
  onRunAction: (action: AdvancedSettingsAction) => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="thin-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {actions.map((action) => {
          const ActionIcon = action.icon;
          const isPending = pendingAction === action.id;

          return (
            <button
              key={action.id}
              type="button"
              className="group flex w-full items-center justify-between gap-4 rounded-[22px] border border-white/10 bg-white/[0.035] p-4 text-left transition hover:bg-white/[0.065]"
              disabled={Boolean(pendingAction)}
              onClick={() => onRunAction(action.id)}
            >
              <span className="flex min-w-0 items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-[14px] bg-white/10 text-muted-foreground">
                  <ActionIcon size={17} strokeWidth={1.8} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[14px] font-semibold leading-5 text-foreground">
                    {action.title}
                  </span>
                  <span className="mt-1 block max-w-[460px] text-[12px] font-medium leading-4 text-muted-foreground">
                    {action.description}
                  </span>
                </span>
              </span>
              <span className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground transition group-hover:text-foreground">
                {isPending ? (
                  <LoaderIcon size={16} strokeWidth={1.8} className="animate-spin" />
                ) : (
                  <ChevronRightIcon size={17} strokeWidth={1.8} />
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
