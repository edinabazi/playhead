import { Slider } from "@/components/ui/slider";

export function SettingsFooter({
  status,
  changed,
  disabled = false,
  onReset,
  onSave,
}: {
  status: string;
  changed: boolean;
  disabled?: boolean;
  onReset: () => void;
  onSave: () => void;
}) {
  return (
    <div className="mt-4 flex shrink-0 items-center justify-between">
      <span className="text-[12px] font-medium text-muted-foreground">{status}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="h-9 rounded-full px-4 text-[13px] font-medium text-muted-foreground transition hover:bg-white/10 hover:text-foreground disabled:opacity-40"
          disabled={!changed || disabled}
          onClick={onReset}
        >
          Reset
        </button>
        <button
          type="button"
          className="h-9 rounded-full bg-primary px-4 text-[13px] font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-45"
          disabled={!changed || disabled}
          onClick={onSave}
        >
          Save
        </button>
      </div>
    </div>
  );
}

export function TransparencySlider({
  value,
  onChange,
  onPreviewStart,
  onPreviewEnd,
}: {
  value: number;
  onChange: (value: number) => void;
  onPreviewStart: () => void;
  onPreviewEnd: () => void;
}) {
  return (
    <div className="mt-4">
      <Slider
        value={value}
        onChange={(nextValue) => {
          if (typeof nextValue === "number") onChange(nextValue);
        }}
        min={45}
        max={100}
        step={1}
        showValue
        valuePosition="tooltip"
        label="Transparency"
        formatValue={(nextValue) => `${nextValue}%`}
        className="no-drag cursor-ew-resize"
        trackClassName="cursor-ew-resize"
        onInteractionStart={onPreviewStart}
        onInteractionEnd={onPreviewEnd}
      />
    </div>
  );
}

export function SettingsOptionGroup({
  title,
  description,
  options,
  value,
  onChange,
}: {
  title: string;
  description: string;
  options: Array<{ label: string; value: number }>;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-white/[0.035] p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h4 className="text-[14px] font-semibold leading-5 text-foreground">{title}</h4>
          <p className="mt-1 max-w-[420px] text-[12px] font-medium leading-4 text-muted-foreground">
            {description}
          </p>
        </div>
        <div className="flex shrink-0 rounded-full bg-white/[0.06] p-1">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`h-7 rounded-full px-3 text-[12px] font-medium transition ${
                value === option.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => onChange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
