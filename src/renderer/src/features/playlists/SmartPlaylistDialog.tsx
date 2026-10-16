import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import {
  DialogForm,
  DialogOverlay,
  dialogOverlayMotion,
  dialogPanelMotion,
} from "@/components/ui/dialog-motion";
import { useIcons } from "@/lib/icon-context";
import { useTranslation } from "@/lib/i18n";
import type { LibraryTag, LibraryTrack } from "../../../../shared/library";
import {
  buildSmartPlaylistContext,
  matchesSmartPlaylist,
  smartPlaylistFields,
  smartPlaylistOperators,
  type SmartPlaylist,
  type SmartPlaylistField,
  type SmartPlaylistRule,
} from "../../../../shared/smart-playlist";

export type SmartPlaylistDraft = Pick<SmartPlaylist, "name" | "match" | "rules">;

const fieldOrder = Object.keys(smartPlaylistFields) as SmartPlaylistField[];
const controlClass =
  "h-8 rounded-[12px] border border-white/10 bg-white/[0.055] px-2 text-[13px] font-medium text-foreground outline-none focus:border-primary/70";

function newRule(field: SmartPlaylistField = "genre"): SmartPlaylistRule {
  const kind = smartPlaylistFields[field].kind;
  return {
    id: crypto.randomUUID(),
    field,
    operator: smartPlaylistOperators[kind][0].value,
    value: kind === "date" ? "30" : "",
  };
}

export function SmartPlaylistDialog({
  initial,
  tracks,
  favoriteTrackIds,
  tags,
  onSave,
  onClose,
}: {
  initial?: SmartPlaylistDraft;
  tracks: LibraryTrack[];
  favoriteTrackIds: string[];
  tags: LibraryTag[];
  onSave: (draft: SmartPlaylistDraft) => void;
  onClose: () => void;
}) {
  const icons = useIcons();
  const t = useTranslation();
  const [name, setName] = useState(initial?.name ?? "");
  const [match, setMatch] = useState<SmartPlaylistDraft["match"]>(initial?.match ?? "all");
  const [rules, setRules] = useState<SmartPlaylistRule[]>(initial?.rules ?? [newRule()]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const matchCount = useMemo(() => {
    const context = buildSmartPlaylistContext(favoriteTrackIds, tags);
    return tracks.filter((track) => matchesSmartPlaylist(track, { match, rules }, context)).length;
  }, [favoriteTrackIds, match, rules, tags, tracks]);

  const updateRule = (id: string, change: Partial<SmartPlaylistRule>) =>
    setRules((current) =>
      current.map((rule) => {
        if (rule.id !== id) return rule;
        // Changing the field resets the operator and value to fit the new field.
        return change.field && change.field !== rule.field
          ? { ...newRule(change.field), id }
          : { ...rule, ...change };
      }),
    );

  return createPortal(
    <DialogOverlay
      {...dialogOverlayMotion}
      className="app-modal-overlay no-drag fixed inset-0 z-[10000] grid place-items-center bg-black/40 px-5"
      onPointerDown={onClose}
    >
      <DialogForm
        {...dialogPanelMotion}
        className="selectable w-full max-w-[600px] rounded-[28px] border border-white/10 bg-[rgba(10,10,10,0.96)] p-3 shadow-2xl"
        onPointerDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim() && rules.length > 0) onSave({ name: name.trim(), match, rules });
        }}
      >
        <div className="flex items-start justify-between gap-3 px-2 pt-1">
          <div>
            <h2 className="text-[15px] font-semibold leading-6 text-foreground">
              {t(initial ? "playlistDialog.editSmart.title" : "playlistDialog.newSmart.title")}
            </h2>
            <p className="mt-1 text-[13px] font-medium leading-5 text-muted-foreground">
              {t("playlistDialog.smart.description")}
            </p>
          </div>
          <button
            type="button"
            className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-white/10 hover:text-foreground"
            title={t("common.close")}
            onClick={onClose}
          >
            <icons.x size={16} strokeWidth={1.8} />
          </button>
        </div>

        <div className="mt-4 space-y-3 px-2">
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="h-10 w-full rounded-[18px] border border-white/10 bg-white/[0.055] px-3 text-[14px] font-medium text-foreground outline-none"
            placeholder={t("playlist.name")}
          />
          <div className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground">
            {t("playlistDialog.match")}
            <select
              className={controlClass}
              value={match}
              onChange={(event) => setMatch(event.target.value as SmartPlaylistDraft["match"])}
            >
              <option value="all">{t("playlistDialog.matchAll")}</option>
              <option value="any">{t("playlistDialog.matchAny")}</option>
            </select>
            {t("playlistDialog.ofTheseRules")}
          </div>
          <div className="thin-scrollbar max-h-[300px] space-y-2 overflow-y-auto">
            {rules.map((rule) => {
              const kind = smartPlaylistFields[rule.field].kind;
              return (
                <div key={rule.id} className="flex items-center gap-2">
                  <select
                    aria-label={t("playlistDialog.field")}
                    className={controlClass}
                    value={rule.field}
                    onChange={(event) =>
                      updateRule(rule.id, { field: event.target.value as SmartPlaylistField })
                    }
                  >
                    {fieldOrder.map((field) => (
                      <option key={field} value={field}>
                        {t(smartPlaylistFields[field].labelKey)}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label={t("playlistDialog.condition")}
                    className={controlClass}
                    value={rule.operator}
                    onChange={(event) =>
                      updateRule(rule.id, {
                        operator: event.target.value as SmartPlaylistRule["operator"],
                      })
                    }
                  >
                    {smartPlaylistOperators[kind].map((operator) => (
                      <option key={operator.value} value={operator.value}>
                        {t(operator.labelKey)}
                      </option>
                    ))}
                  </select>
                  {kind === "tag" ? (
                    <select
                      aria-label={t("playlistDialog.tag")}
                      className={`${controlClass} min-w-0 flex-1`}
                      value={rule.value}
                      onChange={(event) => updateRule(rule.id, { value: event.target.value })}
                    >
                      <option value="">{t("playlistDialog.chooseTag")}</option>
                      {tags.map((tag) => (
                        <option key={tag.id} value={tag.id}>
                          {tag.name}
                        </option>
                      ))}
                    </select>
                  ) : kind === "boolean" ? (
                    <span className="flex-1 text-[13px] font-medium text-muted-foreground">
                      {t("playlistDialog.loved")}
                    </span>
                  ) : (
                    <>
                      <input
                        aria-label={t("playlistDialog.value")}
                        className={`${controlClass} min-w-0 flex-1`}
                        inputMode={kind === "text" ? undefined : "decimal"}
                        value={rule.value}
                        onChange={(event) => updateRule(rule.id, { value: event.target.value })}
                      />
                      {rule.operator === "between" && (
                        <>
                          <span className="text-[13px] text-muted-foreground">
                            {t("playlistDialog.and")}
                          </span>
                          <input
                            aria-label={t("playlistDialog.upperValue")}
                            className={`${controlClass} w-20`}
                            inputMode="decimal"
                            value={rule.value2 ?? ""}
                            onChange={(event) =>
                              updateRule(rule.id, { value2: event.target.value })
                            }
                          />
                        </>
                      )}
                    </>
                  )}
                  <button
                    type="button"
                    aria-label={t("playlistDialog.removeRule")}
                    className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-white/10 hover:text-foreground disabled:opacity-30"
                    disabled={rules.length === 1}
                    onClick={() =>
                      setRules((current) => current.filter((item) => item.id !== rule.id))
                    }
                  >
                    <icons.x size={14} strokeWidth={1.8} />
                  </button>
                </div>
              );
            })}
          </div>
          <button
            type="button"
            className="flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground transition hover:text-foreground"
            onClick={() => setRules((current) => [...current, newRule()])}
          >
            <icons.plus size={14} strokeWidth={1.8} />
            {t("playlistDialog.addRule")}
          </button>
        </div>

        <div className="mt-4 flex items-center justify-between gap-2 px-2 pb-1">
          <span className="text-[12px] font-medium tabular-nums text-muted-foreground">
            {t(matchCount === 1 ? "playlistDialog.trackMatches" : "playlistDialog.tracksMatch", {
              count: matchCount,
            })}
          </span>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={!name.trim() || rules.length === 0}>
              {t(initial ? "common.save" : "common.create")}
            </Button>
          </div>
        </div>
      </DialogForm>
    </DialogOverlay>,
    document.body,
  );
}
