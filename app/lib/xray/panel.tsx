"use client";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { accessibleName, interactiveElements, roleOf, tabSequence, XRAY_ROOT_ATTR } from "./measure";
import { LAYERS, toggleLayer, toggleSimulatedReducedMotion, toggleXray, useXray } from "./store";

type Summary = { targets: number; small: number; stops: number; unnamed: number };

/** Counts for the whole page, refreshed twice a second. */
const useSummary = () => {
  const [summary, setSummary] = useState<Summary | null>(null);
  useEffect(() => {
    const scan = () => {
      const elements = interactiveElements();
      setSummary({
        targets: elements.length,
        small: elements.filter((el) => {
          const r = el.getBoundingClientRect();
          return Math.min(r.width, r.height) < 24;
        }).length,
        stops: tabSequence(elements).length,
        unnamed: elements.filter((el) => !accessibleName(el)).length,
      });
    };
    scan();
    const id = window.setInterval(scan, 500);
    return () => window.clearInterval(id);
  }, []);
  return summary;
};

/** What keyboard focus is on, announced politely so X-ray works without sight too. */
const useFocusedDescription = () => {
  const [text, setText] = useState("");
  useEffect(() => {
    const onFocus = (e: FocusEvent) => {
      const el = e.target;
      if (!(el instanceof HTMLElement) || el.closest(`[${XRAY_ROOT_ATTR}]`)) return;
      const sequence = tabSequence(interactiveElements());
      const stop = sequence.indexOf(el);
      const r = el.getBoundingClientRect();
      const name = accessibleName(el);
      setText(
        `${roleOf(el)}, ${name ? `"${name.slice(0, 60)}"` : "no accessible name"}, ${Math.round(r.width)} by ${Math.round(r.height)} pixels${
          stop >= 0 ? `, tab stop ${stop + 1} of ${sequence.length}` : ""
        }`,
      );
    };
    document.addEventListener("focusin", onFocus);
    return () => document.removeEventListener("focusin", onFocus);
  }, []);
  return text;
};

const Switch = ({ on }: { on: boolean }) => (
  <span
    aria-hidden="true"
    className={`relative inline-block h-3.5 w-6 shrink-0 rounded-full border transition-colors ${on ? "border-white/40 bg-white/25" : "border-white/15 bg-transparent"}`}
  >
    <span className={`absolute top-[2px] h-2 w-2 rounded-full bg-white transition-[left] ${on ? "left-[12px]" : "left-[2px] bg-white/45"}`} />
  </span>
);

const ToggleRow = ({ label, hint, on, onClick }: { label: string; hint: string; on: boolean; onClick: () => void }) => (
  <li>
    <button
      type="button"
      aria-pressed={on}
      title={hint}
      onClick={onClick}
      className="flex min-h-[32px] w-full items-center justify-between gap-3 rounded-lg px-2 text-left text-[12px] text-white/75 hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
    >
      <span>{label}</span>
      <Switch on={on} />
    </button>
  </li>
);

/**
 * The X-ray control panel. It is itself a plain, accessible control: real
 * buttons with aria-pressed, a polite live region describing whatever
 * keyboard focus lands on, and nothing that depends on seeing the canvas.
 */
export const XrayPanel = () => {
  const xray = useXray();
  const summary = useSummary();
  const focused = useFocusedDescription();
  // On a phone the full panel would cover the page being inspected, so it
  // starts collapsed to its header. (The panel only renders client-side.)
  const [open, setOpen] = useState(() => typeof window === "undefined" || window.innerWidth >= 640);

  return (
    <section
      {...{ [XRAY_ROOT_ATTR]: "" }}
      aria-label="X-ray mode"
      className="fixed bottom-4 left-4 z-[95] w-[min(272px,calc(100vw-32px))] rounded-2xl border border-white/[0.1] bg-[#070707]/92 font-mono text-white shadow-[0_30px_80px_-30px_rgba(0,0,0,0.95)] backdrop-blur-xl"
    >
      <div className="flex items-center justify-between gap-2 px-3 pb-2 pt-3">
        <button
          type="button"
          aria-expanded={open}
          aria-controls="xray-controls"
          onClick={() => setOpen((o) => !o)}
          className="flex min-h-[28px] items-center gap-2 rounded-md px-1 text-[11px] uppercase tracking-[0.22em] text-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-[#86efac] shadow-[0_0_8px_#86efac]" aria-hidden="true" />
          X-ray
        </button>
        <div className="flex items-center gap-1.5">
          <kbd className="hidden rounded border border-white/[0.14] px-1 py-px text-[10px] text-white/50 sm:inline-block">⌥X</kbd>
          <button
            type="button"
            onClick={() => toggleXray(false)}
            aria-label="Turn off X-ray mode"
            className="grid h-7 w-7 place-items-center rounded-md text-white/55 hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            <X width="10" height="10"  aria-hidden="true" />
          </button>
        </div>
      </div>

      <div id="xray-controls" hidden={!open} className="px-1.5 pb-2">
        <ul className="grid">
          {LAYERS.map((layer) => (
            <ToggleRow key={layer.id} label={layer.label} hint={layer.hint} on={xray.layers[layer.id]} onClick={() => toggleLayer(layer.id)} />
          ))}
        </ul>
        <div className="mx-2 my-1.5 h-px bg-white/[0.07]" />
        <ul>
          <ToggleRow
            label="Simulate reduced motion"
            hint="See what every component does when someone asks their OS for less motion"
            on={xray.reducedMotion}
            onClick={toggleSimulatedReducedMotion}
          />
        </ul>
        {summary && (
          <dl className="mx-2 mt-2 grid grid-cols-2 gap-x-3 gap-y-1 border-t border-white/[0.07] pt-2.5 text-[10.5px] tabular-nums">
            <dt className="text-white/40">targets</dt>
            <dd className="text-right text-white/80">{summary.targets}</dd>
            <dt className="text-white/40">under 24px</dt>
            <dd className={`text-right ${summary.small ? "text-[#ff9d8a]" : "text-white/80"}`}>{summary.small}</dd>
            <dt className="text-white/40">tab stops</dt>
            <dd className="text-right text-white/80">{summary.stops}</dd>
            <dt className="text-white/40">unnamed</dt>
            <dd className={`text-right ${summary.unnamed ? "text-[#ff9d8a]" : "text-white/80"}`}>{summary.unnamed}</dd>
          </dl>
        )}
      </div>
      <p aria-live="polite" className="sr-only">
        {focused}
      </p>
    </section>
  );
};
