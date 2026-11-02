"use client";
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { useSystemReducedMotion } from "./async-button";

/* ------------------------------------------------------------------ */
/* Pure helpers                                                         */
/* ------------------------------------------------------------------ */

const focusablesIn = (root: HTMLElement | null): HTMLElement[] =>
  Array.from(root?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter((el) => el.offsetParent !== null || el === document.activeElement);

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Where Tab should go from `index` among `length` stops, or null to let the browser move focus normally. */
export const trapTarget = (index: number, length: number, shift: boolean): number | null => {
  if (length === 0) return 0;
  if (!shift && index === length - 1) return 0;
  if (shift && index <= 0) return length - 1;
  return null;
};

/** A short, human label for an element: what a person would call it. */
export const labelOf = (el: Element | null): string => {
  if (!el) return "(nothing)";
  if (el === document.body) return "(page body)";
  const explicit = el.getAttribute("data-trail-label");
  const aria = el.getAttribute("aria-label");
  const labelledBy = el.getAttribute("aria-labelledby");
  const fromIds = labelledBy
    ?.split(/\s+/)
    .map((id) => document.getElementById(id)?.textContent?.trim())
    .filter(Boolean)
    .join(" ");
  const own = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement ? el.labels?.[0]?.textContent?.trim() : undefined;
  const text = el.textContent?.trim().replace(/\s+/g, " ");
  const name = explicit || aria || fromIds || own || (text && text.length <= 40 ? text : text?.slice(0, 37) + "…") || el.id || el.tagName.toLowerCase();
  const role = el.getAttribute("role") ?? (el instanceof HTMLInputElement ? (el.type === "text" ? "text field" : el.type) : el.tagName.toLowerCase());
  return `${role} “${name}”`;
};

/* ------------------------------------------------------------------ */
/* Focus trail                                                          */
/* ------------------------------------------------------------------ */

export interface TrailEntry {
  n: number;
  /** Milliseconds since the first move in this trail (performance.now()). */
  atMs: number;
  label: string;
  /** Why focus moved: a reason the dialog reported, or what the page saw just before (Tab, Shift+Tab, pointer, script). */
  via: string;
  /** True when the newly focused element is inside the element passed as `within`. */
  inside: boolean;
}

/**
 * Records every focus move that lands inside `rootRef`, by element label,
 * with a timestamp. `note(reason)` lets code that is about to move focus say
 * why; the next move picks that reason up. Otherwise the reason is inferred
 * from the key or pointer event just before.
 */
export const useFocusTrail = (
  rootRef: RefObject<HTMLElement | null>,
  dialogRef: RefObject<HTMLElement | null>,
  onEntry?: (e: TrailEntry) => void,
  max = 40
) => {
  const [entries, setEntries] = useState<TrailEntry[]>([]);
  const t0 = useRef<number | null>(null);
  const counter = useRef(0);
  const pending = useRef<{ reason: string; at: number } | null>(null);
  const lastInput = useRef<{ via: string; at: number } | null>(null);
  const onEntryRef = useRef(onEntry);
  useEffect(() => {
    onEntryRef.current = onEntry;
  }, [onEntry]);

  const note = useCallback((reason: string) => {
    pending.current = { reason, at: performance.now() };
  }, []);

  const clear = useCallback(() => {
    t0.current = null;
    counter.current = 0;
    setEntries([]);
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      const key = e.key === "Tab" ? (e.shiftKey ? "Shift+Tab" : "Tab") : e.key === " " ? "Space" : e.key;
      if (["Tab", "Shift+Tab", "Escape", "Enter", "Space"].includes(key)) lastInput.current = { via: key, at: performance.now() };
    };
    const onPointer = () => {
      lastInput.current = { via: "pointer", at: performance.now() };
    };
    const onFocusIn = (e: FocusEvent) => {
      const target = e.target as Element;
      const now = performance.now();
      if (t0.current === null) t0.current = now;
      const input = lastInput.current && now - lastInput.current.at < 400 ? lastInput.current.via : null;
      const told = pending.current && now - pending.current.at < 300 ? pending.current.reason : null;
      const via = told ? (input ? `${told} (after ${input})` : told) : (input ?? "script");
      pending.current = null;
      const entry: TrailEntry = {
        n: ++counter.current,
        atMs: Math.round(now - t0.current),
        label: labelOf(target),
        via,
        inside: !!dialogRef.current && dialogRef.current.contains(target),
      };
      setEntries((rows) => [entry, ...rows].slice(0, max));
      onEntryRef.current?.(entry);
    };
    root.addEventListener("keydown", onKey, true);
    root.addEventListener("pointerdown", onPointer, true);
    root.addEventListener("focusin", onFocusIn);
    return () => {
      root.removeEventListener("keydown", onKey, true);
      root.removeEventListener("pointerdown", onPointer, true);
      root.removeEventListener("focusin", onFocusIn);
    };
  }, [rootRef, dialogRef, max]);

  return { entries, note, clear };
};

/* ------------------------------------------------------------------ */
/* Dialog                                                               */
/* ------------------------------------------------------------------ */

export type CloseVia = "escape" | "backdrop" | "button";

export interface FocusDialogOpenInfo {
  role: string | null;
  ariaModal: string | null;
  /** Computed CSS animation-name on the dialog once it is on screen ("none" when reduced). */
  animationName: string;
}

export interface FocusDialogProps {
  open: boolean;
  onClose: (via: CloseVia) => void;
  title: string;
  description?: string;
  children: ReactNode;
  /** Ref to the element that should hold the dialog node (so a trail can tell inside from outside). */
  dialogRef?: RefObject<HTMLDivElement | null>;
  /** Called just before the dialog moves focus itself, so a trail can say why. */
  onFocusIntent?: (reason: string) => void;
  /** Called after a frame once the dialog is open, with what the DOM reports. */
  onOpened?: (info: FocusDialogOpenInfo) => void;
  /** Called after focus has been given back, with whether it really landed on the invoker. */
  onClosed?: (info: { returnedToInvoker: boolean; invoker: string }) => void;
  /** Force reduced motion on or off. Leave undefined to follow the system setting. */
  reducedMotion?: boolean;
}

/**
 * A modal dialog that behaves like one: role=dialog and aria-modal, focus
 * moves in on open, Tab and Shift+Tab wrap inside it, focus that escapes by
 * any other route is pulled back, Escape closes, and focus returns to
 * whatever opened it. The entrance animation is skipped with reduced motion.
 *
 * Mark the control that should take focus first with `data-autofocus`.
 * It does not make the rest of the page inert; aria-modal and the trap do the work.
 */
export const FocusDialog = ({
  open, onClose, title, description, children, dialogRef, onFocusIntent, onOpened, onClosed, reducedMotion,
}: FocusDialogProps) => {
  const systemReduced = useSystemReducedMotion();
  const reduced = reducedMotion ?? systemReduced;
  const ownRef = useRef<HTMLDivElement>(null);
  const ref = dialogRef ?? ownRef;
  const titleId = useId();
  const descId = useId();

  const cb = useRef({ onFocusIntent, onOpened, onClosed });
  useEffect(() => {
    cb.current = { onFocusIntent, onOpened, onClosed };
  });

  /** Open: remember the invoker, move focus in. Close (cleanup): give it back. */
  useEffect(() => {
    if (!open) return;
    const invoker = document.activeElement as HTMLElement | null;
    const invokerLabel = labelOf(invoker);
    const first = ref.current?.querySelector<HTMLElement>("[data-autofocus]") ?? focusablesIn(ref.current)[0] ?? ref.current;
    cb.current.onFocusIntent?.("dialog opened: focus moved in");
    first?.focus();
    const raf = window.requestAnimationFrame(() => {
      const el = ref.current;
      if (el) cb.current.onOpened?.({ role: el.getAttribute("role"), ariaModal: el.getAttribute("aria-modal"), animationName: getComputedStyle(el).animationName });
    });
    return () => {
      window.cancelAnimationFrame(raf);
      if (invoker && invoker.isConnected) {
        cb.current.onFocusIntent?.("dialog closed: focus returned to the invoker");
        invoker.focus();
      }
      cb.current.onClosed?.({ returnedToInvoker: !!invoker && document.activeElement === invoker, invoker: invokerLabel });
    };
  }, [open, ref]);

  /** Focus that gets out by any route other than Tab is pulled back in. */
  useEffect(() => {
    if (!open) return;
    const onDocFocusIn = (e: FocusEvent) => {
      const el = ref.current;
      if (el && e.target instanceof Node && !el.contains(e.target)) {
        cb.current.onFocusIntent?.("focus escaped the dialog: pulled back in");
        (el.querySelector<HTMLElement>("[data-autofocus]") ?? focusablesIn(ref.current)[0] ?? el).focus();
      }
    };
    document.addEventListener("focusin", onDocFocusIn);
    return () => document.removeEventListener("focusin", onDocFocusIn);
  }, [open, ref]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose("escape");
      return;
    }
    if (e.key !== "Tab") return;
    const stops = focusablesIn(ref.current);
    const index = stops.indexOf(document.activeElement as HTMLElement);
    const to = trapTarget(index, stops.length, e.shiftKey);
    if (to !== null) {
      e.preventDefault();
      onFocusIntent?.(e.shiftKey ? "trap wrapped: first to last" : "trap wrapped: last to first");
      (stops[to] ?? ref.current)?.focus();
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 md:justify-start md:pl-[max(1rem,calc(50vw-30rem))]"
      style={{ background: "rgba(0,0,0,0.45)", animation: reduced ? "none" : "prism-focus-fade 180ms ease-out both" }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose("backdrop");
      }}
    >
      <style>{`
        @keyframes prism-focus-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes prism-focus-pop { from { opacity: 0; transform: translateY(8px) scale(0.98); } to { opacity: 1; transform: none; } }
      `}</style>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        data-testid="focus-dialog"
        onKeyDown={onKeyDown}
        className="w-full max-w-sm rounded-2xl border p-5 text-white focus:outline-none"
        style={{
          borderColor: "rgba(255,255,255,0.22)",
          background: "#111113",
          animation: reduced ? "none" : "prism-focus-pop 200ms ease-out both",
        }}
      >
        <h3 id={titleId} className="text-base font-medium text-white/95">
          {title}
        </h3>
        {description && (
          <p id={descId} className="mt-1 text-sm text-white/60">
            {description}
          </p>
        )}
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Demo panel                                                           */
/* ------------------------------------------------------------------ */

export type FocusObservation =
  | { kind: "move"; entry: TrailEntry; dialogOpen: boolean }
  | { kind: "open"; info: FocusDialogOpenInfo }
  | { kind: "close"; returnedToInvoker: boolean; invoker: string; via: CloseVia | "button" };

const btn =
  "rounded-lg border px-3.5 py-2 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black";
const btnStyle = { borderColor: "rgba(255,255,255,0.24)", background: "rgba(255,255,255,0.08)" } as const;

export function FocusTrailPanel({
  embedded = false,
  forceReduced = false,
  onObserve,
}: {
  embedded?: boolean;
  forceReduced?: boolean;
  onObserve?: (o: FocusObservation) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("Untitled project");
  const [saved, setSaved] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const openRef = useRef(false);
  const closeVia = useRef<CloseVia>("button");

  const onEntry = useCallback(
    (entry: TrailEntry) => onObserve?.({ kind: "move", entry, dialogOpen: openRef.current }),
    [onObserve]
  );
  const { entries, note, clear } = useFocusTrail(rootRef, dialogRef, onEntry);

  const show = () => {
    openRef.current = true;
    closeVia.current = "button";
    setOpen(true);
  };
  const close = (via: CloseVia) => {
    closeVia.current = via;
    openRef.current = false;
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="mx-auto grid w-full max-w-4xl gap-10 md:grid-cols-2">
      <section className="flex min-w-0 flex-col gap-5" aria-label="Dialog">
        {!embedded && <p className="text-xs uppercase tracking-widest text-white/25">focus-trail</p>}
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className={btn} style={btnStyle} onClick={show} data-testid="open-dialog">
            Rename project
          </button>
          <button type="button" className={btn} style={btnStyle} onClick={clear} data-testid="clear-trail">
            Clear trail
          </button>
        </div>
        <p className="text-sm text-white/65" data-testid="saved-name">
          Project name: <span className="text-white/90">{saved ?? name}</span>
        </p>
        <p className="max-w-sm text-xs leading-relaxed text-white/50">
          Open the dialog, then press Tab repeatedly. The trail on the right adds a line for every element that receives focus.
        </p>

        <FocusDialog
          open={open}
          onClose={close}
          title="Rename project"
          description="Changes apply when you press Save."
          dialogRef={dialogRef}
          reducedMotion={forceReduced ? true : undefined}
          onFocusIntent={note}
          onOpened={(info) => onObserve?.({ kind: "open", info })}
          onClosed={(info) => onObserve?.({ kind: "close", ...info, via: closeVia.current })}
        >
          <div className="mb-3 flex justify-end">
            <button
              type="button"
              aria-label="Close dialog"
              className="rounded-md px-2 py-1 text-sm text-white/70 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
              onClick={() => close("button")}
            >
              <span aria-hidden>×</span>
            </button>
          </div>
          <label className="flex flex-col gap-1.5 text-sm text-white/75">
            Project name
            <input
              data-autofocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-lg border bg-transparent px-3 py-2 text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
              style={{ borderColor: "rgba(255,255,255,0.28)" }}
            />
          </label>
          <div className="mt-5 flex justify-end gap-3">
            <button type="button" className={btn} style={btnStyle} onClick={() => close("button")}>
              Cancel
            </button>
            <button
              type="button"
              className={btn}
              style={{ borderColor: "rgba(130,220,170,0.7)", background: "rgba(130,220,170,0.16)" }}
              onClick={() => {
                setSaved(name);
                close("button");
              }}
            >
              Save
            </button>
          </div>
        </FocusDialog>
      </section>

      <section className="flex min-w-0 flex-col gap-3" aria-label="Focus trail">
        <h3 className="text-xs uppercase tracking-widest text-white/40">Focus trail</h3>
        {entries.length === 0 ? (
          <p className="text-sm text-white/40" data-testid="trail-empty">
            Nothing yet. Tab to a control, or press “Rename project”.
          </p>
        ) : (
          <ol data-testid="trail-log" className="flex max-h-72 flex-col gap-1 overflow-y-auto pr-1 font-mono text-xs text-white/65">
            {entries.map((e) => (
              <li key={e.n} data-via={e.via} data-inside={e.inside} className="grid grid-cols-[4.5rem_1fr] gap-x-2">
                <span className="text-white/45">+{e.atMs} ms</span>
                <span className="min-w-0 break-words">
                  <span className="text-white/90">{e.label}</span>
                  <span className="text-white/45"> · {e.via}</span>
                </span>
              </li>
            ))}
          </ol>
        )}
        <p className="max-w-sm text-xs italic leading-relaxed text-white/40">
          Times are performance.now() since the first move in the trail. Only moves inside this demo are listed. Newest first.
        </p>
      </section>
    </div>
  );
}
