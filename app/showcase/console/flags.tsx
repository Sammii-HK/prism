"use client";
import { useId } from "react";
import { AsyncButton, GlowBadge, GlowSlider, SpringToggle } from "../../lib/components";

export type Flag = { key: string; name: string; description: string; on: boolean; rollout: number };

export const INITIAL_FLAGS: Flag[] = [
  { key: "checkout-v2", name: "New checkout", description: "Single-page checkout with saved cards", on: true, rollout: 25 },
  { key: "edge-image-resize", name: "Edge image resizing", description: "Resize uploads at the edge, not the origin", on: true, rollout: 100 },
  { key: "note-summaries", name: "Note summaries", description: "Two-line summaries in the note list", on: false, rollout: 10 },
  { key: "offline-sync", name: "Offline sync", description: "Queue edits locally when the connection drops", on: true, rollout: 5 },
];

export const flagChanged = (a: Flag, b: Flag) => a.on !== b.on || a.rollout !== b.rollout;

type Props = {
  saved: Flag[];
  draft: Flag[];
  onChange: (key: string, patch: Partial<Flag>) => void;
  onSave: () => Promise<void>;
  onDiscard: () => void;
};

export const FlagsPanel = ({ saved, draft, onChange, onSave, onDiscard }: Props) => {
  const id = useId();
  const dirty = draft.filter((f, i) => flagChanged(f, saved[i])).length;

  return (
    <section aria-labelledby={`${id}-title`} className="rounded-3xl border border-white/[0.07] bg-white/[0.015] p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/50">Feature flags</p>
          <h2 id={`${id}-title`} className="mt-1.5 text-base font-light text-white/90">
            Rollout
          </h2>
        </div>
        {dirty > 0 ? (
          <GlowBadge variant="warning" pulse={false}>
            {dirty} unsaved
          </GlowBadge>
        ) : (
          <span className="font-mono text-[11px] text-white/50">All changes saved</span>
        )}
      </div>

      <ul className="mt-5 flex flex-col divide-y divide-white/[0.06]">
        {draft.map((f, i) => {
          const edited = flagChanged(f, saved[i]);
          const nameId = `${id}-${f.key}`;
          return (
            <li key={f.key} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-baseline gap-x-2 text-sm text-white/85">
                    <span id={nameId}>{f.name}</span>
                    <code className="font-mono text-[11px] text-white/50">{f.key}</code>
                    {edited && (
                      <span className="font-mono text-[11px]" style={{ color: "rgb(230,195,140)" }}>
                        edited
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-white/50">{f.description}</p>
                </div>
                <SpringToggle checked={f.on} onChange={(on) => onChange(f.key, { on })} aria-labelledby={nameId} />
              </div>
              <div className="flex items-center gap-4">
                <span className="w-14 shrink-0 font-mono text-[11px] uppercase tracking-[0.12em] text-white/50" aria-hidden>
                  Rollout
                </span>
                <GlowSlider
                  className="min-w-0 flex-1"
                  value={f.rollout}
                  onChange={(rollout) => onChange(f.key, { rollout })}
                  step={5}
                  showValue={false}
                  disabled={!f.on}
                  ariaLabel={`${f.name} rollout percentage`}
                />
                <span className="w-11 shrink-0 text-right font-mono text-[12px] tabular-nums text-white/70">
                  {f.on ? `${f.rollout}%` : "off"}
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
        {dirty > 0 && (
          <button
            type="button"
            onClick={onDiscard}
            className="rounded-xl px-4 py-3 text-sm text-white/60 transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            Discard
          </button>
        )}
        <AsyncButton
          onPress={onSave}
          slowAfterMs={1500}
          labels={{
            idle: dirty > 0 ? `Save ${dirty} ${dirty === 1 ? "change" : "changes"}` : "Save flags",
            pending: "Saving",
            slow: "Still saving",
            success: "Flags saved",
            error: "Could not save. Try again",
          }}
        />
      </div>
    </section>
  );
};
