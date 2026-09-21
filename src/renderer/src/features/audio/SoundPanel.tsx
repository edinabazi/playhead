import { Switch } from "@/components/ui/switch";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { EqualizerSettings } from "../../../../shared/library";
import {
  equalizerBandLabels,
  equalizerPresetLabels,
  equalizerPresetOrder,
  quietListeningStrengthLabels,
  quietListeningStrengthOrder,
  selectEqualizerPreset,
  selectQuietListeningStrength,
  setEqualizerBandGain,
  setEqualizerPreamp,
} from "./equalizer";
import { EqualizerBandSlider, EqualizerCurve } from "./EqualizerControls";

export function SoundPanel({
  open,
  id,
  extraHeaderHeight = 0,
  equalizer,
  volumeBoostEnabled,
  onEqualizerPreview,
  onEqualizerChange,
  onVolumeBoostChange,
}: {
  open: boolean;
  id: string;
  extraHeaderHeight?: number;
  equalizer: EqualizerSettings;
  volumeBoostEnabled: boolean;
  onEqualizerPreview: (equalizer: EqualizerSettings) => void;
  onEqualizerChange: (equalizer: EqualizerSettings) => void;
  onVolumeBoostChange: (enabled: boolean) => void;
}) {
  const [draft, setDraft] = useState(equalizer);
  const draftRef = useRef(equalizer);

  useEffect(() => {
    draftRef.current = equalizer;
    setDraft(equalizer);
  }, [equalizer]);

  const preview = (next: EqualizerSettings) => {
    draftRef.current = next;
    setDraft(next);
    onEqualizerPreview(next);
  };
  const commit = (next: EqualizerSettings) => {
    draftRef.current = next;
    setDraft(next);
    onEqualizerChange(next);
  };
  const editGains = (next: EqualizerSettings) => ({ ...next, enabled: true });

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          id={id}
          role="region"
          aria-label="Sound settings"
          onKeyDown={(event) => {
            if (event.key !== "Escape") event.stopPropagation();
          }}
          className="no-drag absolute left-0 top-full z-50 mt-2 w-[min(470px,calc(100vw-340px))] overflow-y-auto overscroll-contain rounded-[22px] border border-white/10 bg-[rgba(10,10,10,0.96)] p-4 shadow-[0_24px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl"
          style={{ maxHeight: `calc(100dvh - ${300 + extraHeaderHeight}px)` }}
          initial={{ opacity: 0, y: -6, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.98 }}
          transition={{ type: "spring", stiffness: 520, damping: 36, mass: 0.6 }}
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <h4 className="text-[14px] font-semibold leading-5 text-foreground">Equalizer</h4>
              <p className="mt-1 text-[12px] font-medium leading-4 text-muted-foreground">
                Applies to everything Playhead plays.
              </p>
            </div>
            <Switch
              checked={draft.enabled}
              aria-label="Equalizer"
              onCheckedChange={(enabled) => commit({ ...draftRef.current, enabled })}
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {equalizerPresetOrder.map((preset) => {
              const active = draft.preset === preset;
              return (
                <button
                  key={preset}
                  type="button"
                  aria-pressed={active}
                  className={`h-7 rounded-full border px-3 text-[12px] font-medium transition ${
                    active
                      ? "border-primary/45 bg-primary/15 text-foreground"
                      : "border-white/10 bg-white/[0.035] text-muted-foreground hover:bg-white/[0.07] hover:text-foreground"
                  }`}
                  onClick={() =>
                    commit({ ...selectEqualizerPreset(draftRef.current, preset), enabled: true })
                  }
                >
                  {equalizerPresetLabels[preset]}
                </button>
              );
            })}
          </div>

          {draft.preset === "quiet" && (
            <div className="mt-2.5 rounded-[14px] border border-primary/15 bg-primary/[0.05] px-3 py-2">
              <div className="flex items-center gap-2.5">
                <span className="text-[12px] font-medium text-muted-foreground">Strength</span>
                <div className="flex rounded-full bg-white/[0.06] p-0.5">
                  {quietListeningStrengthOrder.map((strength) => (
                    <button
                      key={strength}
                      type="button"
                      aria-pressed={draft.strength === strength}
                      className={`h-6 rounded-full px-2.5 text-[12px] font-medium transition ${
                        draft.strength === strength
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                      onClick={() =>
                        commit({
                          ...selectQuietListeningStrength(draftRef.current, strength),
                          enabled: true,
                        })
                      }
                    >
                      {quietListeningStrengthLabels[strength]}
                    </button>
                  ))}
                </div>
              </div>
              <p className="mt-1.5 text-[12px] font-medium leading-4 text-muted-foreground">
                Bass stays put, mids and highs step back. For low system volume.
              </p>
            </div>
          )}

          <div className="mt-3">
            <EqualizerCurve settings={draft} />
          </div>

          <div className="mt-2 flex items-start gap-0.5">
            <div className="mr-2 flex">
              <EqualizerBandSlider
                label="Pre"
                ariaLabel="Preamp"
                gainDb={draft.preampDb}
                disabled={!draft.enabled}
                onPreview={(gainDb) =>
                  preview(editGains(setEqualizerPreamp(draftRef.current, gainDb)))
                }
                onCommit={(gainDb) =>
                  commit(editGains(setEqualizerPreamp(draftRef.current, gainDb)))
                }
              />
            </div>
            {equalizerBandLabels.map((label, index) => (
              <EqualizerBandSlider
                key={label}
                label={label}
                ariaLabel={`${label} Hz`}
                gainDb={draft.gainsDb[index]}
                disabled={!draft.enabled}
                onPreview={(gainDb) =>
                  preview(editGains(setEqualizerBandGain(draftRef.current, index, gainDb)))
                }
                onCommit={(gainDb) =>
                  commit(editGains(setEqualizerBandGain(draftRef.current, index, gainDb)))
                }
              />
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between gap-4 border-t border-white/[0.08] pt-3">
            <div>
              <h4 className="text-[13px] font-semibold leading-5 text-foreground">Volume boost</h4>
              <p className="mt-0.5 text-[12px] font-medium leading-4 text-muted-foreground">
                Lets volume go up to 200% and lifts quiet tracks when normalizing. A limiter
                controls output peaks.
              </p>
            </div>
            <Switch
              checked={volumeBoostEnabled}
              aria-label="Volume boost"
              onCheckedChange={onVolumeBoostChange}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
