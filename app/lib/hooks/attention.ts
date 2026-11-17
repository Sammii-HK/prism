"use client";

/**
 * Where the user's attention is, whatever they are using to give it.
 *
 * Prism's components react to a point on the screen. With a mouse that point
 * is the cursor. This module widens it so the same components also respond to:
 *
 * - **Touch**: the point follows a finger while it is down, then lets go a
 *   moment after the finger lifts, so a tap glows and settles instead of
 *   leaving a hover state stuck on the screen.
 * - **Keyboard**: when focus moves by keyboard, the point jumps to the centre
 *   of the focused element, so tabbing through the page lights things up the
 *   way the cursor does. Mouse clicks that move focus do not count.
 *
 * One set of window listeners serves every subscriber.
 */

export type AttentionKind = "mouse" | "touch" | "keyboard" | "none";

export type Attention = {
  /** Viewport x in px. */
  x: number;
  /** Viewport y in px. */
  y: number;
  kind: AttentionKind;
};

/** A point far enough off-screen that every proximity effect is at rest. */
export const FAR_AWAY = -100000;

/** How long a tap keeps its glow after the finger lifts. */
const TOUCH_RELEASE_MS = 700;

let state: Attention = { x: FAR_AWAY, y: FAR_AWAY, kind: "none" };
const listeners = new Set<(attention: Attention) => void>();

let bound = false;
let modality: "pointer" | "keyboard" = "pointer";
let focused: Element | null = null;
let releaseTimer: number | undefined;

const emit = (next: Attention) => {
  state = next;
  listeners.forEach((listener) => listener(next));
};

const centreOf = (el: Element) => {
  const rect = el.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
};

const release = () => {
  focused = null;
  emit({ x: FAR_AWAY, y: FAR_AWAY, kind: "none" });
};

const bind = () => {
  if (bound || typeof window === "undefined") return;
  bound = true;

  const onPointer = (e: PointerEvent) => {
    window.clearTimeout(releaseTimer);
    modality = "pointer";
    focused = null;
    emit({ x: e.clientX, y: e.clientY, kind: e.pointerType === "touch" ? "touch" : "mouse" });
  };

  const onPointerEnd = (e: PointerEvent) => {
    if (e.pointerType !== "touch") return;
    window.clearTimeout(releaseTimer);
    releaseTimer = window.setTimeout(release, TOUCH_RELEASE_MS);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    modality = "keyboard";
  };

  const onFocusIn = (e: FocusEvent) => {
    if (modality !== "keyboard" || !(e.target instanceof Element)) return;
    window.clearTimeout(releaseTimer);
    focused = e.target;
    emit({ ...centreOf(e.target), kind: "keyboard" });
  };

  const onFocusOut = (e: FocusEvent) => {
    if (state.kind !== "keyboard" || e.target !== focused) return;
    // If focus is moving to another element, focusin fires before this frame.
    requestAnimationFrame(() => {
      if (focused === e.target) release();
    });
  };

  // A focused element moves when the page scrolls or resizes; keep up with it.
  const onReflow = () => {
    if (state.kind === "keyboard" && focused) emit({ ...centreOf(focused), kind: "keyboard" });
  };

  window.addEventListener("pointermove", onPointer, { passive: true });
  window.addEventListener("pointerdown", onPointer, { passive: true });
  window.addEventListener("pointerup", onPointerEnd, { passive: true });
  window.addEventListener("pointercancel", onPointerEnd, { passive: true });
  window.addEventListener("keydown", onKeyDown, true);
  document.addEventListener("focusin", onFocusIn);
  document.addEventListener("focusout", onFocusOut);
  window.addEventListener("scroll", onReflow, { passive: true, capture: true });
  window.addEventListener("resize", onReflow, { passive: true });
};

/**
 * Subscribe to the attention point. The listener is called straight away with
 * the current value, then on every change. Returns an unsubscribe function.
 *
 * @example
 * useEffect(() => subscribeAttention(({ x, y }) => { mouseX = x; mouseY = y; }), []);
 */
export const subscribeAttention = (listener: (attention: Attention) => void) => {
  bind();
  listeners.add(listener);
  listener(state);
  return () => {
    listeners.delete(listener);
  };
};

/** The current attention point, for code that polls inside a rAF loop. */
export const getAttention = (): Attention => state;
