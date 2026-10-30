"use client";
import { useCallback, useState } from "react";
import { RadialMenu, type RadialMenuItem } from "../lib/components/radial-menu";
import { useSystemReducedMotion } from "../lib/components/async-button";

const ITEMS: RadialMenuItem[] = [
  { id: "reply", label: "Reply" },
  { id: "pin", label: "Pin" },
  { id: "share", label: "Share" },
  { id: "move", label: "Move" },
  { id: "archive", label: "Archive" },
  { id: "mute", label: "Mute" },
];

export default function RadialMenuDemo() {
  const [forceReduced, setForceReduced] = useState(false);
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
  const [trail, setTrail] = useState<string[]>([]);
  const systemReduced = useSystemReducedMotion();

  const onActiveChange = useCallback((item: RadialMenuItem) => {
    setFocused(ITEMS.findIndex((i) => i.id === item.id));
    setTrail((t) => [...t, item.label].slice(-8));
  }, []);
  const onOpenChange = useCallback((o: boolean) => {
    setOpen(o);
    if (o) setTrail([]);
    else setFocused(null);
  }, []);

  return (
    <div className="min-h-screen px-6 py-16" style={{ background: "#050505" }}>
      <div className="mx-auto grid w-full max-w-4xl gap-12 md:grid-cols-2">
        <section className="flex flex-col items-center gap-6">
          <p className="self-start text-xs uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.25)" }}>
            radial-menu
          </p>
          <RadialMenu
            items={ITEMS}
            label="Message actions"
            reducedMotion={forceReduced ? true : undefined}
            onSelect={(item) => setChosen(item.label)}
            onActiveChange={onActiveChange}
            onOpenChange={onOpenChange}
          />
          <p className="max-w-sm text-center text-xs italic leading-relaxed" style={{ color: "rgba(255,255,255,0.3)" }}>
            Tab to the plus, press Enter or Space. Arrow keys walk the ring, Home and End jump, type a letter to jump
            to a label, Escape closes and puts focus back on the plus.
          </p>
        </section>

        <section className="flex flex-col gap-6" aria-label="Menu state">
          <div>
            <h2 className="mb-2 text-xs uppercase tracking-widest text-white/40">Last chosen</h2>
            <p data-testid="chosen" className="text-2xl text-white/90">
              {chosen ?? <span className="text-white/30">Nothing yet</span>}
            </p>
          </div>

          <div>
            <h2 className="mb-2 text-xs uppercase tracking-widest text-white/40">Focus order</h2>
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

          <label className="flex items-center gap-2 text-sm text-white/70">
            <input type="checkbox" checked={forceReduced} onChange={(e) => setForceReduced(e.target.checked)} />
            Preview reduced motion
            <span className="text-white/30">(system setting: {systemReduced ? "on" : "off"})</span>
          </label>
        </section>
      </div>
    </div>
  );
}
