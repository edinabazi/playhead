import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type SwitchProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> & {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
};

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(
  ({ checked, onCheckedChange, className, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={checked}
        className={cn(
          "relative h-7 w-12 shrink-0 rounded-full border transition",
          checked ? "border-primary bg-primary" : "border-white/10 bg-white/10",
          className,
        )}
        onClick={() => onCheckedChange(!checked)}
        {...props}
      >
        <span
          className={`absolute top-[3px] grid size-5 place-items-center rounded-full bg-white shadow-[0_6px_15px_rgba(0,0,0,0.85),0_0_0_1px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.9)] transition-transform ${
            checked ? "translate-x-[22px]" : "translate-x-1"
          }`}
        />
      </button>
    );
  },
);

Switch.displayName = "Switch";
