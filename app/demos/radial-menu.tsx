"use client";
import { useCallback, useState } from "react";
import { RadialMenu, type RadialMenuItem } from "../lib/components/radial-menu";
import { useSystemReducedMotion } from "../lib/components/async-button";
import type { DemoPanelProps } from "./async-button";

const ITEMS: RadialMenuItem[] = [
  { id: "reply", label: "Reply" },
  { id: "pin", label: "Pin" },
  { id: "share", label: "Share" },
  { id: "move", label: "Move" },
  { id: "archive", label: "Archive" },
  { id: "mute", label: "Mute" },
];

export const RADIAL_DEMO_ITEMS = ITEMS;

export type RadialObservation =
  | { kind: "open"; open: boolean }
  | { kind: "focus"; label: string; index: number }
  | { kind: "select"; label: string };

export function RadialMenuPanel({
  embedded = false,
  forceReduced: hostReduced = false,
  onObserve,
}: DemoPanelProps & { onObserve?: (o: RadialObservation) => void }) {
  const [localReduced, setLocalReduced] = useState(false);
  const forceReduced = hostReduced || localReduced;
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
  const [trail, setTrail] = useState<string[]>([]);
  const systemReduced = useSystemReducedMotion();

  const onActiveChange = useCallback((item: RadialMenuItem) => {
    const index = ITEMS.findIndex((i) => i.id === item.id);
    setFocused(index);
    setTrail((t) => [...t, item.label].slice(-8));
    onObserve?.({ kind: "focus", label: item.label, index });
  }, [onObserve]);
  const onOpenChange = useCallback((o: boolean) => {
    setOpen(o);
    if (o) setTrail([]);
    else setFocused(null);
    onObserve?.({ kind: "open", open: o });
  }, [onObserve]);

  return (
      <div className="mx-auto grid w-full max-w-4xl gap-12 md:grid-cols-2">
        <section className="flex min-w-0 flex-col items-center gap-6">
          {!embedded && (
            <p className="self-start text-xs uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.25)" }}>
              radial-menu
            </p>
          )}
          <RadialMenu
            items={ITEMS}
            label="Message actions"
            reducedMotion={forceReduced ? true : undefined}
            onSelect={(item) => {
              setChosen(item.label);
              onObserve?.({ kind: "select", label: item.label });
            }}
            onActiveChange={onActiveChange}
            onOpenChange={onOpenChange}
          />
          <p className="max-w-sm text-center text-xs italic leading-relaxed" style={{ color: "rgba(255,255,255,0.3)" }}>
            Tab to the plus, press Enter or Space. Arrow keys walk the ring, Home and End jump, type a letter to jump
            to a label, Escape closes and puts focus back on the plus.
          </p>
        </section>

        <section className="flex min-w-0 flex-col gap-6" aria-label="Menu state">
          <div>
            <h3 className="mb-2 text-xs uppercase tracking-widest text-white/40">Last chosen</h3>
            <p data-testid="chosen" className="text-2xl text-white/90">
              {chosen ?? <span className="text-white/30">Nothing yet</span>}
            </p>
          </div>

          <div>
            <h3 className="mb-2 text-xs uppercase tracking-widest text-white/40">Focus order</h3>
            <ol className="flex flex-wrap gap-2" data-testid="order">
              {ITEMS.map((item, i) => (
                <li
                  key={item.id}
                  aria-current={focused === i ? "true" : undefined}
                  className="rounded-lg px-3 py-1.5 text-sm"
                  style={{
                    color: focused === i ? "#050505" : "rgba(255,255,255,0.5)",
                    background: focused === i ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.06)",
                  }}
                >
                  {i + 1}. {item.label}
                </li>
              ))}
            </ol>
            <p className="mt-3 text-sm text-white/50">
              Menu is {open ? "open" : "closed"}. Only the highlighted item is a tab stop (roving tabindex).
            </p>
            <p data-testid="trail" className="mt-1 font-mono text-xs text-white/40">
              Focus trail: {trail.length ? trail.join(" → ") : "none yet"}
            </p>
          </div>

          {!embedded && (
            <label className="flex items-center gap-2 text-sm text-white/70">
              <input type="checkbox" checked={localReduced} onChange={(e) => setLocalReduced(e.target.checked)} />
              Preview reduced motion
              <span className="text-white/30">(system setting: {systemReduced ? "on" : "off"})</span>
            </label>
          )}
        </section>
      </div>
  );
}

export default function RadialMenuDemo() {
  return (
    <div className="min-h-screen px-6 py-16" style={{ background: "#050505" }}>
      <RadialMenuPanel />
    </div>
  );
}
