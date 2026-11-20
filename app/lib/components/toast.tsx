"use client";
import { useEffect, useRef, useSyncExternalStore, type PointerEvent } from "react";
import { X } from "lucide-react";
import { reducedMotionNow } from "../hooks/reduced-motion";
import { SPRINGS, stepSpring, type SpringState } from "../hooks/overlay";
import { QUIET_MS } from "../hooks/latency";

// --- Store -----------------------------------------------------------------

export type ToastTone = "neutral" | "success" | "error" | "loading";

export interface ToastOptions {
  /** Reuse an id to update a toast in place instead of adding another. */
  id?: string;
  description?: string;
  tone?: ToastTone;
  /** How long it stays, in ms. Infinity keeps it until dismissed. */
  duration?: number;
  /** One action, such as Undo. A toast with an action stays until dismissed unless you set a duration. */
  action?: { label: string; onClick: () => void };
}

type ToastRecord = {
  id: string;
  title: string;
  description?: string;
  tone: ToastTone;
  duration: number;
  action?: ToastOptions["action"];
  open: boolean;
  /** Bumped on every update, so the timer restarts and the update is announced. */
  version: number;
};

const DURATION: Record<ToastTone, number> = { neutral: 5000, success: 4000, error: 8000, loading: Infinity };

let toasts: ToastRecord[] = [];
let counter = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((notify) => notify());
const subscribe = (notify: () => void) => {
  listeners.add(notify);
  return () => listeners.delete(notify);
};
const EMPTY: ToastRecord[] = [];

const upsert = (title: string, opts: ToastOptions = {}) => {
  const id = opts.id ?? `toast-${++counter}`;
  const tone = opts.tone ?? "neutral";
  const existing = toasts.find((t) => t.id === id);
  const record: ToastRecord = {
    id,
    title,
    description: opts.description,
    tone,
    // Something to act on needs time to be read and reached (WCAG 2.2.1), so it waits.
    duration: opts.duration ?? (opts.action ? Infinity : DURATION[tone]),
    action: opts.action,
    open: true,
    version: (existing?.version ?? 0) + 1,
  };
  toasts = existing ? toasts.map((t) => (t.id === id ? record : t)) : [...toasts, record];
  emit();
  return id;
};

const dismiss = (id?: string) => {
  toasts = toasts.map((t) => (!id || t.id === id ? { ...t, open: false } : t));
  emit();
};

const remove = (id: string) => {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
};

type Message<T> = string | ((value: T) => string);
const say = <T,>(m: Message<T>, value: T) => (typeof m === "function" ? m(value) : m);

/**
 * Show a toast. Returns its id.
 *
 * `toast.promise` follows the latency rule: nothing appears for a request
 * that settles inside `quietMs`, so a fast save goes straight to "Saved"
 * without a loading toast flashing first.
 */
export const toast = Object.assign((title: string, opts?: ToastOptions) => upsert(title, opts), {
  success: (title: string, opts?: Omit<ToastOptions, "tone">) => upsert(title, { ...opts, tone: "success" }),
  error: (title: string, opts?: Omit<ToastOptions, "tone">) => upsert(title, { ...opts, tone: "error" }),
  dismiss,
  promise: <T,>(
    promise: Promise<T>,
    messages: { loading: string; success: Message<T>; error: Message<unknown> },
    { quietMs = QUIET_MS }: { quietMs?: number } = {}
  ) => {
    const id = `toast-${++counter}`;
    const timer = window.setTimeout(() => upsert(messages.loading, { id, tone: "loading" }), quietMs);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        upsert(say(messages.success, value), { id, tone: "success" });
      },
      (err: unknown) => {
        window.clearTimeout(timer);
        upsert(say(messages.error, err), { id, tone: "error" });
      }
    );
    return promise;
  },
});

// --- Toaster ---------------------------------------------------------------

export interface ToasterProps {
  /** The corner it stacks in. Default: "bottom-right" */
  position?: "bottom-right" | "bottom-left" | "top-right" | "top-left";
  /** How many show in the collapsed stack. Default: 3 */
  visible?: number;
  /** Key that moves focus to the notifications, so keyboard users can reach an action. Default: "F8" */
  hotkey?: string;
  /** Accessible name of the region. Default: "Notifications" */
  label?: string;
}

type Motion = {
  y: SpringState;
  scale: SpringState;
  h: SpringState;
  x: SpringState;
  /** 0 entering or gone, 1 present. */
  presence: SpringState;
  remaining: number;
  version: number;
  xTarget: number;
  drag: { id: number; start: number; last: number; lastT: number; v: number; live: boolean } | null;
};

const GAP = 8;
const PEEK = 10;
const SWIPE_AT = 80;

const TONE_DOT: Record<ToastTone, string> = {
  neutral: "bg-white/50",
  success: "bg-[#86efac] shadow-[0_0_8px_#86efac]",
  error: "bg-[#fca5a5] shadow-[0_0_8px_#fca5a5]",
  loading: "bg-white/70 motion-safe:animate-pulse",
};

/**
 * Where toasts appear. Render one, near the root, then call `toast()` from
 * anywhere.
 *
 * The newest sits in front with the last few peeking out behind it. Hover or
 * focus fans the stack out so each can be read, and pauses every timer, as
 * does switching away from the tab. A toast can be swiped sideways to dismiss;
 * the spring picks up the swipe's speed. Each one is announced through a live
 * region (errors assertively), and F8 moves focus to them so an Undo is
 * reachable from the keyboard.
 *
 * @example
 * <Toaster />
 * toast.success("Saved");
 * toast("Moved to archive", { action: { label: "Undo", onClick: restore } });
 * toast.promise(save(), { loading: "Saving…", success: "Saved", error: "Could not save" });
 */
export const Toaster = ({ position = "bottom-right", visible = 3, hotkey = "F8", label = "Notifications" }: ToasterProps) => {
  const list = useSyncExternalStore(subscribe, () => toasts, () => EMPTY);
  const sectionRef = useRef<HTMLElement>(null);
  const itemRefs = useRef(new Map<string, HTMLLIElement>());
  const cardRefs = useRef(new Map<string, HTMLDivElement>());
  const innerRefs = useRef(new Map<string, HTMLDivElement>());
  const motion = useRef(new Map<string, Motion>());
  const hovering = useRef(false);
  const focusWithin = useRef(false);
  const listRef = useRef(list);
  const politeRef = useRef<HTMLDivElement>(null);
  const assertiveRef = useRef<HTMLDivElement>(null);
  const announced = useRef(new Map<string, number>());
  const top = position.startsWith("top");
  const dir = top ? 1 : -1; // which way the stack grows

  useEffect(() => {
    listRef.current = list;
  }, [list]);

  // Top layer, so a toast is never buried under a stacking context. Raise it again when a new one arrives.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    try {
      if (focusWithin.current) return;
      if (el.matches(":popover-open")) el.hidePopover();
      el.showPopover();
    } catch {
      // No Popover API: it is still fixed-position.
    }
  }, [list.length]);

  // Announce what is new or changed. Visible toasts are not a live region, so nothing is read twice.
  useEffect(() => {
    for (const t of list) {
      if (!t.open || announced.current.get(t.id) === t.version) continue;
      announced.current.set(t.id, t.version);
      const text = [t.title, t.description].filter(Boolean).join(". ");
      // Cleared first, then written, so the same message twice is still read twice.
      const region = (t.tone === "error" ? assertiveRef : politeRef).current;
      if (!region) continue;
      region.textContent = "";
      window.setTimeout(() => (region.textContent = text), 60);
    }
  }, [list]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== hotkey) return;
      const el = sectionRef.current;
      if (!el || listRef.current.every((t) => !t.open)) return;
      e.preventDefault();
      el.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hotkey]);

  const hasToasts = list.length > 0;

  // One loop moves the whole stack.
  useEffect(() => {
    if (!hasToasts) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const reduced = reducedMotionNow();
      const records = listRef.current;
      const paused = hovering.current || focusWithin.current || document.hidden;
      const live = records.filter((t) => t.open).reverse(); // newest first
      const expanded = hovering.current || focusWithin.current;

      // Natural heights, newest first, for the expanded layout.
      const heights = live.map((t) => innerRefs.current.get(t.id)?.offsetHeight ?? 56);
      const frontHeight = heights[0] ?? 0;
      // Fanned out, each toast sits past every newer one.
      const offsets: number[] = [];
      let offset = 0;
      for (const height of heights) {
        offsets.push(offset);
        offset += height + GAP;
      }

      for (const t of records) {
        let m = motion.current.get(t.id);
        if (!m) {
          m = {
            y: { x: 0, v: 0 },
            scale: { x: 1, v: 0 },
            h: { x: innerRefs.current.get(t.id)?.offsetHeight ?? 56, v: 0 },
            x: { x: 0, v: 0 },
            presence: { x: 0, v: 0 },
            remaining: t.duration,
            version: t.version,
            xTarget: 0,
            drag: null,
          };
          motion.current.set(t.id, m);
        }
        if (m.version !== t.version) {
          m.version = t.version;
          m.remaining = t.duration;
        }

        const slot = live.indexOf(t);
        const natural = innerRefs.current.get(t.id)?.offsetHeight ?? m.h.x;
        let yTarget = m.y.x;
        let scaleTarget = 1;
        let hTarget = natural;
        let shown = 0;

        if (slot >= 0) {
          if (expanded) {
            yTarget = dir * offsets[slot];
          } else {
            yTarget = dir * slot * PEEK;
            scaleTarget = 1 - slot * 0.05;
            // Behind the front one, a toast takes the front's height so only its edge shows.
            if (slot > 0) hTarget = frontHeight;
          }
          shown = slot < visible || expanded ? 1 : 0;
          if (!paused && Number.isFinite(m.remaining) && !m.drag) {
            m.remaining -= dt * 1000;
            if (m.remaining <= 0) dismiss(t.id);
          }
        }

        const presenceTarget = t.open ? shown : 0;
        if (reduced) {
          m.y = { x: yTarget, v: 0 };
          m.scale = { x: scaleTarget, v: 0 };
          m.h = { x: hTarget, v: 0 };
        } else {
          stepSpring(m.y, yTarget, SPRINGS.stack, dt);
          stepSpring(m.scale, scaleTarget, SPRINGS.stack, dt);
          stepSpring(m.h, hTarget, SPRINGS.stack, dt);
        }
        stepSpring(m.presence, presenceTarget, SPRINGS.panel, dt);
        if (!m.drag) stepSpring(m.x, m.xTarget, SPRINGS.panel, dt);

        if (!t.open && m.presence.x <= 0.01 && m.presence.v <= 0) {
          motion.current.delete(t.id);
          announced.current.delete(t.id);
          remove(t.id);
          continue;
        }

        const li = itemRefs.current.get(t.id);
        const card = cardRefs.current.get(t.id);
        if (li && card) {
          const p = Math.min(1, Math.max(0, m.presence.x));
          // Entering toasts rise in from the edge; with reduced motion they only fade.
          const enter = reduced ? 0 : (1 - p) * 16 * -dir;
          li.style.transform = `translate(${m.x.x.toFixed(2)}px, ${(m.y.x + enter).toFixed(2)}px) scale(${m.scale.x.toFixed(4)})`;
          li.style.opacity = (p * (1 - Math.min(1, Math.abs(m.x.x) / 360))).toFixed(3);
          li.style.zIndex = String(slot >= 0 ? 100 - slot : 0);
          li.style.pointerEvents = t.open && shown ? "auto" : "none";
          card.style.height = `${Math.max(0, m.h.x).toFixed(2)}px`;
          const inner = innerRefs.current.get(t.id);
          if (inner) inner.style.opacity = slot > 0 && !expanded ? "0" : "1";
        }
      }

      const section = sectionRef.current;
      if (section) section.style.height = `${Math.max(frontHeight, expanded ? offset - GAP : frontHeight + Math.min(live.length - 1, visible - 1) * PEEK) + GAP}px`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [hasToasts, visible, dir]);

  const onPointerDown = (id: string) => (e: PointerEvent<HTMLLIElement>) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest("button")) return;
    const m = motion.current.get(id);
    if (!m) return;
    m.drag = { id: e.pointerId, start: e.clientX, last: e.clientX, lastT: e.timeStamp, v: 0, live: false };
  };

  const onPointerMove = (id: string) => (e: PointerEvent<HTMLLIElement>) => {
    const m = motion.current.get(id);
    const d = m?.drag;
    if (!m || !d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.start;
    if (!d.live && Math.abs(dx) > 6) {
      d.live = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    if (!d.live) return;
    d.v = (e.clientX - d.last) / Math.max(1, e.timeStamp - d.lastT);
    d.last = e.clientX;
    d.lastT = e.timeStamp;
    m.x = { x: dx, v: 0 };
  };

  const onPointerUp = (id: string) => (e: PointerEvent<HTMLLIElement>) => {
    const m = motion.current.get(id);
    const d = m?.drag;
    if (!m || !d || d.id !== e.pointerId) return;
    m.drag = null;
    if (!d.live) return;
    m.x.v = d.v * 1000;
    const dx = m.x.x;
    if (Math.abs(dx) > SWIPE_AT || Math.abs(d.v) > 0.5) {
      m.xTarget = Math.sign(dx || d.v) * 420;
      dismiss(id);
    } else {
      m.xTarget = 0;
    }
  };

  const corner = {
    // A popover starts at inset: 0, so the far edges are unset explicitly.
    "bottom-right": "top-auto left-auto bottom-4 right-4",
    "bottom-left": "top-auto right-auto bottom-4 left-4",
    "top-right": "bottom-auto left-auto top-4 right-4",
    "top-left": "bottom-auto right-auto top-4 left-4",
  }[position];

  return (
    <>
      <div ref={politeRef} className="sr-only" role="status" aria-live="polite" aria-atomic="true" />
      <div ref={assertiveRef} className="sr-only" role="alert" aria-live="assertive" aria-atomic="true" />
      <section
        ref={sectionRef}
        popover="manual"
        aria-label={`${label} (${hotkey})`}
        tabIndex={-1}
        onPointerEnter={() => (hovering.current = true)}
        onPointerLeave={() => (hovering.current = false)}
        onFocus={() => (focusWithin.current = true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) focusWithin.current = false;
        }}
        className={`pointer-events-none fixed m-0 w-[min(360px,calc(100vw-2rem))] overflow-visible border-0 bg-transparent p-0 text-white outline-none ${corner}`}
      >
        <ol className="relative h-full">
          {list.map((t) => (
            <li
              key={t.id}
              ref={(el) => {
                if (el) itemRefs.current.set(t.id, el);
                else itemRefs.current.delete(t.id);
              }}
              onPointerDown={onPointerDown(t.id)}
              onPointerMove={onPointerMove(t.id)}
              onPointerUp={onPointerUp(t.id)}
              onPointerCancel={onPointerUp(t.id)}
              className={`absolute inset-x-0 touch-pan-y select-none ${top ? "top-0 origin-top pb-2" : "bottom-0 origin-bottom pt-2"}`}
              style={{ opacity: 0 }}
            >
              <div
                ref={(el) => {
                  if (el) cardRefs.current.set(t.id, el);
                  else cardRefs.current.delete(t.id);
                }}
                className="overflow-hidden rounded-xl border border-white/[0.1] bg-[#0d0d0d]/95 shadow-[0_14px_40px_rgba(0,0,0,0.5)] backdrop-blur-md"
              >
                <div
                  ref={(el) => {
                    if (el) innerRefs.current.set(t.id, el);
                    else innerRefs.current.delete(t.id);
                  }}
                  className="flex items-start gap-3 py-3 pl-4 pr-2"
                >
                  <span aria-hidden="true" className={`mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full ${TONE_DOT[t.tone]}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] leading-5 text-white/90">{t.title}</p>
                    {t.description && <p className="mt-0.5 text-[12px] leading-relaxed text-white/50">{t.description}</p>}
                  </div>
                  {t.action && (
                    <button
                      type="button"
                      onClick={() => {
                        t.action?.onClick();
                        dismiss(t.id);
                      }}
                      className="shrink-0 rounded-lg border border-white/[0.12] bg-white/[0.05] px-2.5 py-1 text-[12px] text-white/85 hover:bg-white/[0.09] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                    >
                      {t.action.label}
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label={`Dismiss: ${t.title}`}
                    onClick={() => dismiss(t.id)}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white/40 hover:bg-white/[0.06] hover:text-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
};
