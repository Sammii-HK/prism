"use client";
import { GripVertical } from "lucide-react";
import { flushSync } from "react-dom";
import { useCallback, useEffect, useId, useLayoutEffect, useReducer, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useSystemReducedMotion } from "./async-button";
import { pastelColour } from "../primitives/gradient";
import {
  flipDeltas, initialState, insertIndexFromMidpoints, keyAction, othersMidpoints, reorderReducer, slotTop,
  type Item, type Rect,
} from "../reorder-core";

export * from "../reorder-core";

export const INITIAL_ITEMS: Item[] = [
  "Write the explainer",
  "Record the screen capture",
  "Check the keyboard paths",
  "Run the axe scan",
  "Check the 390 px layout",
  "Draft the posts",
  "Read it once more",
].map((label, i) => ({ id: `item-${i + 1}`, label }));

const ROW_H = 56;
const GAP = 8;
const DURATION = 240;
const EASING = "cubic-bezier(0.2, 0.8, 0.2, 1)";

export interface ReorderObservation {
  /** Times the order changed, by any means. */
  changes: number;
  /** Last change: how many rows FLIP animated, the largest shift in px, and what caused it. */
  lastFlip: { animated: number; maxPx: number; via: "keyboard" | "pointer" | "button" } | null;
  /** Web Animations running on the rows right after the last change. */
  animationsRunning: number;
  /** Text of the live region after the last change, read from the DOM. */
  announcement: string;
  /** After a keyboard move: whether document.activeElement was still the moved row's button. */
  focusKept: boolean | null;
  grabbed: string | null;
  order: string[];
}

const btn =
  "rounded-lg border px-3 py-1.5 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black";
const btnStyle = { borderColor: "rgba(255,255,255,0.24)", background: "rgba(255,255,255,0.08)" } as const;

const Grip = () => (
  <GripVertical width="14" height="18"  aria-hidden="true"  />
);

export function FlipReorderPanel({
  embedded = false,
  forceReduced = false,
  onObserve,
}: {
  embedded?: boolean;
  forceReduced?: boolean;
  onObserve?: (o: ReorderObservation) => void;
}) {
  const uid = useId();
  const systemReduced = useSystemReducedMotion();
  const reduced = forceReduced || systemReduced;
  const [state, dispatch] = useReducer(reorderReducer, INITIAL_ITEMS, initialState);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const rowRefs = useRef(new Map<string, HTMLLIElement>());
  const btnRefs = useRef(new Map<string, HTMLButtonElement>());
  const liveRef = useRef<HTMLDivElement>(null);
  const firstRef = useRef<Map<string, Rect> | null>(null);
  const viaRef = useRef<"keyboard" | "pointer" | "button">("keyboard");
  const movingRef = useRef(false);
  const changes = useRef(0);
  const reducedRef = useRef(reduced);
  const onObserveRef = useRef(onObserve);
  const drag = useRef<{ id: string; origin: number; startY: number; startTop: number; ty: number } | null>(null);
  const stateRef = useRef(state);

  // Layout effect, declared before the FLIP one below, so both see this render's values.
  useLayoutEffect(() => {
    reducedRef.current = reduced;
    onObserveRef.current = onObserve;
    stateRef.current = state;
  });

  /** Where every row is painted right now, including any animation in flight. FLIP's "First". */
  const snapshot = useCallback((via: "keyboard" | "pointer" | "button") => {
    const m = new Map<string, Rect>();
    rowRefs.current.forEach((el, id) => {
      const r = el.getBoundingClientRect();
      m.set(id, { x: r.left, y: r.top });
    });
    firstRef.current = m;
    viaRef.current = via;
  }, []);

  const applyDragTransform = useCallback(() => {
    const d = drag.current;
    if (!d) return;
    const el = rowRefs.current.get(d.id);
    const idx = stateRef.current.items.findIndex((i) => i.id === d.id);
    if (!el || idx < 0) return;
    el.style.transform = `translateY(${d.ty - slotTop(idx, ROW_H, GAP)}px)`;
  }, []);

  // FLIP: First was taken before the change, Last is read here, Invert and Play are the animation.
  useLayoutEffect(() => {
    const first = firstRef.current;
    if (!first) return;
    firstRef.current = null;
    rowRefs.current.forEach((el, id) => {
      if (drag.current?.id !== id) el.getAnimations().forEach((a) => a.cancel());
    });
    const last = new Map<string, Rect>();
    rowRefs.current.forEach((el, id) => {
      const saved = el.style.transform;
      if (drag.current?.id === id) el.style.transform = "";
      const r = el.getBoundingClientRect();
      if (drag.current?.id === id) el.style.transform = saved;
      last.set(id, { x: r.left, y: r.top });
    });
    const deltas = flipDeltas(first, last).filter((d) => d.id !== drag.current?.id);
    if (!reducedRef.current) {
      for (const d of deltas) {
        rowRefs.current.get(d.id)?.animate(
          [{ transform: `translate(${d.dx}px, ${d.dy}px)` }, { transform: "translate(0, 0)" }],
          { duration: DURATION, easing: EASING }
        );
      }
    }
    applyDragTransform();

    const grabbedId = stateRef.current.grabbed?.id;
    if (movingRef.current && grabbedId) {
      const b = btnRefs.current.get(grabbedId);
      if (b && document.activeElement !== b) b.focus({ preventScroll: true });
    }
    movingRef.current = false;

    changes.current += 1;
    let running = 0;
    rowRefs.current.forEach((el) => (running += el.getAnimations().length));
    const kept = viaRef.current === "keyboard" && grabbedId ? document.activeElement === btnRefs.current.get(grabbedId) : null;
    onObserveRef.current?.({
      changes: changes.current,
      lastFlip: { animated: deltas.length, maxPx: deltas.reduce((m, d) => Math.max(m, Math.abs(d.dy), Math.abs(d.dx)), 0), via: viaRef.current },
      animationsRunning: running,
      announcement: liveRef.current?.textContent ?? "",
      focusKept: kept,
      grabbed: grabbedId ?? null,
      order: stateRef.current.items.map((i) => i.label),
    });
  }, [state.items, applyDragTransform]);

  const finishDrag = useCallback((announce: boolean) => {
    const d = drag.current;
    if (!d) return;
    const el = rowRefs.current.get(d.id);
    const idx = stateRef.current.items.findIndex((i) => i.id === d.id);
    if (el && idx >= 0) {
      const ty = d.ty - slotTop(idx, ROW_H, GAP);
      el.style.transform = "";
      if (!reducedRef.current && Math.abs(ty) > 0.5) {
        el.animate([{ transform: `translateY(${ty}px)` }, { transform: "translateY(0)" }], { duration: DURATION, easing: EASING });
      }
    }
    drag.current = null;
    setDraggingId(null);
    if (announce) dispatch({ type: "pointerDrop", id: d.id });
  }, []);

  // Listeners live on window for the length of a drag: moving a row in the DOM can drop pointer capture, and the drag must survive that.
  const listeners = useRef<{ move: (e: globalThis.PointerEvent) => void; up: () => void } | null>(null);
  const endDrag = useCallback(
    (announce: boolean) => {
      const l = listeners.current;
      if (l) {
        window.removeEventListener("pointermove", l.move);
        window.removeEventListener("pointerup", l.up);
        window.removeEventListener("pointercancel", l.up);
        listeners.current = null;
      }
      finishDrag(announce);
    },
    [finishDrag]
  );

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>, id: string) => {
    if (e.button !== 0 || drag.current) return;
    const origin = state.items.findIndex((i) => i.id === id);
    drag.current = { id, origin, startY: e.clientY, startTop: slotTop(origin, ROW_H, GAP), ty: slotTop(origin, ROW_H, GAP) };
    setDraggingId(id);
    const move = (ev: globalThis.PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const n = stateRef.current.items.length;
      const top = Math.max(0, Math.min(slotTop(n - 1, ROW_H, GAP), d.startTop + (ev.clientY - d.startY)));
      d.ty = top;
      const cur = stateRef.current.items.findIndex((i) => i.id === d.id);
      const to = insertIndexFromMidpoints(othersMidpoints(n, cur, ROW_H, GAP), top + ROW_H / 2);
      if (to !== cur) {
        snapshot("pointer");
        // Commit now, inside the event, so the new order and the FLIP start are painted together.
        flushSync(() => dispatch({ type: "pointerMove", id: d.id, to }));
      } else {
        applyDragTransform();
      }
    };
    const up = () => endDrag(true);
    listeners.current = { move, up };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  useEffect(() => () => endDrag(false), [endDrag]);

  /* ---------------- keyboard ---------------- */

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, id: string) => {
    if (drag.current) {
      if (e.key === "Escape") {
        e.preventDefault();
        const d = drag.current;
        snapshot("pointer");
        dispatch({ type: "pointerMove", id: d.id, to: d.origin });
        endDrag(false);
      }
      return;
    }
    const isGrabbed = state.grabbed?.id === id;
    const a = keyAction(e.key, isGrabbed);
    if (!a) return;
    e.preventDefault();
    if (a.type === "toggle") {
      dispatch(isGrabbed ? { type: "drop" } : { type: "grab", id });
      return;
    }
    if (!state.grabbed) return;
    snapshot("keyboard");
    movingRef.current = true;
    dispatch(a);
  };

  const onBlur = (id: string) => {
    if (movingRef.current) return;
    if (stateRef.current.grabbed?.id === id) dispatch({ type: "drop" });
  };

  /* ---------------- pointer ---------------- */

  /* ---------------- buttons ---------------- */

  const reverse = () => {
    snapshot("button");
    dispatch({ type: "reset", items: [...stateRef.current.items].reverse(), announcement: "List reversed." });
  };
  const restore = () => {
    snapshot("button");
    dispatch({ type: "reset", items: INITIAL_ITEMS, announcement: "Original order restored." });
  };

  const n = state.items.length;
  const listHeight = n * ROW_H + (n - 1) * GAP;

  return (
    <div className="mx-auto flex w-full max-w-2xl min-w-0 flex-col gap-5">
      {!embedded && <p className="text-xs uppercase tracking-widest text-white/25">flip-reorder</p>}

      <p id={`${uid}-help`} className="text-sm leading-relaxed text-white/70">
        Drag a row, or Tab to one, press <kbd className="rounded border border-white/25 px-1.5 text-[11px] text-white/85">Space</kbd> to pick it up, move it with the arrow keys, and press Space to drop it. Escape puts it back.
      </p>

      <ul
        aria-label="Launch checklist, in order"
        className="m-0 flex list-none flex-col p-0"
        style={{ gap: GAP, height: listHeight }}
        data-testid="reorder-list"
      >
        {state.items.map((item, i) => {
          const grabbed = state.grabbed?.id === item.id;
          const lifted = grabbed || draggingId === item.id;
          const c = pastelColour((i / Math.max(1, n - 1)) * 100, 35, 0);
          return (
            <li
              key={item.id}
              ref={(el) => {
                if (el) rowRefs.current.set(item.id, el);
                else rowRefs.current.delete(item.id);
              }}
              data-item={item.id}
              className="relative"
              style={{ height: ROW_H, zIndex: lifted ? 2 : 0 }}
            >
              <button
                type="button"
                ref={(el) => {
                  if (el) btnRefs.current.set(item.id, el);
                  else btnRefs.current.delete(item.id);
                }}
                aria-pressed={grabbed}
                aria-describedby={`${uid}-help`}
                aria-label={`${item.label}, position ${i + 1} of ${n}${grabbed ? ", picked up" : ""}`}
                onKeyDown={(e) => onKeyDown(e, item.id)}
                onBlur={() => onBlur(item.id)}
                onPointerDown={(e) => onPointerDown(e, item.id)}
                className="flex h-full w-full cursor-grab select-none items-center gap-4 rounded-xl border px-4 text-left text-[15px] text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/90 focus-visible:ring-offset-2 focus-visible:ring-offset-black active:cursor-grabbing"
                style={{
                  touchAction: "none",
                  borderColor: lifted ? `rgba(${c.r},${c.g},${c.b},0.9)` : "rgba(255,255,255,0.14)",
                  background: lifted ? `rgba(${c.r},${c.g},${c.b},0.2)` : "rgba(255,255,255,0.05)",
                  boxShadow: lifted ? "0 14px 32px rgba(0,0,0,0.55)" : "none",
                }}
              >
                <span
                  aria-hidden
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-medium text-black"
                  style={{ background: `rgb(${c.r},${c.g},${c.b})`, fontFamily: "var(--font-geist-mono), monospace" }}
                >
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                <span className="shrink-0 text-white/55">
                  <Grip />
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div
        ref={liveRef}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-testid="reorder-live"
        className={`min-h-[3.2rem] rounded-lg border px-3 py-2 font-mono text-[12.5px] leading-relaxed ${state.announcement ? "text-white/85" : "text-white/60"}`}
        style={{ borderColor: "rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.03)" }}
      >
        {state.announcement || "Announcements appear here."}
      </div>

      <div className="flex flex-wrap gap-3">
        <button type="button" className={btn} style={btnStyle} onClick={reverse} data-testid="reorder-reverse">
          Reverse the list
        </button>
        <button type="button" className={btn} style={btnStyle} onClick={restore} data-testid="reorder-restore">
          Restore the original order
        </button>
      </div>
    </div>
  );
}

