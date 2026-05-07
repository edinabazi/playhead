type Shortcut = {
  action: string;
  keys: string[];
  secondaryKeys?: string[];
  detail?: string;
};

export function ShortcutsSettingsPane({ shortcuts }: { shortcuts: Shortcut[] }) {
  return (
    <div className="overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.035]">
      {shortcuts.map((shortcut, index) => (
        <div
          key={shortcut.action}
          className={`flex min-h-[58px] items-center justify-between gap-4 px-4 py-3 ${
            index > 0 ? "border-t border-white/10" : ""
          }`}
        >
          <div>
            <p className="text-[13px] font-semibold leading-5 text-foreground">
              {shortcut.action}
            </p>
            {shortcut.detail && (
              <p className="text-[12px] font-medium leading-4 text-muted-foreground">
                {shortcut.detail}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {[...shortcut.keys, ...(shortcut.secondaryKeys || [])].map((key) => (
              <kbd
                key={key}
                className="rounded-[9px] border border-white/10 bg-white/10 px-2 py-1 font-mono text-[11px] font-medium leading-none text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
              >
                {key}
              </kbd>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
