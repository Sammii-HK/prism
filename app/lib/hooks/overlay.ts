"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";

/**
 * The overlay layer: what every popover, menu, dialog, sheet and toast shares.
 *
 * - Springs that are integrated against real time, so a 120Hz screen moves
 *   them at the same speed as a 60Hz one.
 * - Presence: an overlay stays mounted until its exit spring has finished,
 *   then unmounts. Closing is never a cut.
 * - One dismiss stack: Escape closes the top layer only, and a click outside
 *   closes every layer that does not hold it, from the top down.
 * - Scroll lock and focus return for modals.
 *
 * Why not the browser's light dismiss? `popover="auto"` and `<dialog>` close
 * instantly, which leaves no room for an exit spring. So overlays use
 * `popover="manual"` for the top layer and do the dismissing here.
 */

// --- Springs ---------------------------------------------------------------

export type Spring = { k: number; d: number };
export type SpringState = { x: number; v: number };

/** The same constants the command palette and select use, so every overlay feels like one family. */
export const SPRINGS = {
  panel: { k: 200, d: 24 },
  indicator: { k: 180, d: 22 },
  stack: { k: 220, d: 26 },
} as const satisfies Record<string, Spring>;

/** Advance a spring by `dt` seconds, in fixed 1/120s substeps (semi-implicit Euler). */
export const stepSpring = (s: SpringState, target: number, { k, d }: Spring, dt: number) => {
  let left = Math.min(Math.max(dt, 0), 0.064); // a long pause (tab switch) does not fling it
  while (left > 0) {
    const h = Math.min(left, 1 / 120);
    s.v += (k * (target - s.x) - d * s.v) * h;
    s.x += s.v * h;
    left -= h;
  }
};

export const atRest = (s: SpringState, target: number, eps = 0.0005) =>
  Math.abs(target - s.x) < eps && Math.abs(s.v) < eps * 20;

// --- Presence --------------------------------------------------------------

/**
 * Keep something mounted while it animates out.
 *
 * `render(p)` is called every frame with progress from 0 (gone) to 1 (fully
 * present) and should write styles straight to the DOM, so nothing re-renders
 * per frame. Reversing mid-flight carries the velocity over.
 *
 * Returns `drive` and `kick` so a drag can move the progress by hand and
 * hand it back to the spring on release.
 */
export const usePresence = (open: boolean, render: (p: number) => void, spring: Spring = SPRINGS.panel) => {
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true);

  const state = useRef<SpringState>({ x: 0, v: 0 });
  const raf = useRef(0);
  const openRef = useRef(open);
  const renderRef = useRef(render);
  useLayoutEffect(() => {
    renderRef.current = render;
    openRef.current = open;
  });

  const kick = useCallback(() => {
    if (raf.current) return;
    let last = performance.now();
    const tick = (now: number) => {
      const target = openRef.current ? 1 : 0;
      stepSpring(state.current, target, spring, (now - last) / 1000);
      last = now;
      // Leaving is done once it is invisible; there is no need to wait out the tail.
      const done = target === 1 ? atRest(state.current, 1) : state.current.x <= 0.01;
      if (done) state.current = { x: target, v: 0 };
      renderRef.current(state.current.x);
      if (done) {
        raf.current = 0;
        if (!openRef.current) setMounted(false);
        return;
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  }, [spring]);

  useLayoutEffect(() => {
    if (!mounted) return;
    renderRef.current(state.current.x); // first frame before paint, so it never flashes in at full size
    kick();
  }, [open, mounted, kick]);

  useEffect(
    () => () => {
      cancelAnimationFrame(raf.current);
      raf.current = 0;
    },
    []
  );

  /** Set progress (and velocity, in progress per second) by hand. Call `kick` to let the spring carry on. */
  const drive = useCallback((x: number, v = 0) => {
    state.current = { x, v };
  }, []);

  return { mounted, drive, kick };
};

// --- Dismiss stack ---------------------------------------------------------

export type DismissReason = "escape" | "outside" | "focus-out" | "select" | "button";

type Layer = { contains: (node: Node) => boolean; dismiss: (reason: DismissReason) => void };

const layers: Layer[] = [];

const onKeyDown = (e: KeyboardEvent) => {
  if (e.key !== "Escape" || e.isComposing) return;
  const top = layers[layers.length - 1];
  if (!top) return;
  // Default-prevented, so a native dialog underneath does not also close.
  e.preventDefault();
  e.stopPropagation();
  top.dismiss("escape");
};

const onPointerDown = (e: PointerEvent) => {
  const target = e.target;
  if (!(target instanceof Node)) return;
  for (const layer of [...layers].reverse()) {
    if (layer.contains(target)) break;
    layer.dismiss("outside");
  }
};

const listen = (on: boolean) => {
  if (on) {
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("pointerdown", onPointerDown, true);
  } else {
    window.removeEventListener("keydown", onKeyDown, true);
    window.removeEventListener("pointerdown", onPointerDown, true);
  }
};

/**
 * Put a layer on the dismiss stack while `active`. Layers opened later sit
 * above earlier ones, so a menu inside a dialog closes before the dialog does.
 */
export const useDismissLayer = (active: boolean, contains: (node: Node) => boolean, dismiss: (reason: DismissReason) => void) => {
  const live = useRef({ contains, dismiss });
  useLayoutEffect(() => {
    live.current = { contains, dismiss };
  });
  useEffect(() => {
    if (!active) return;
    const layer: Layer = {
      contains: (node) => live.current.contains(node),
      dismiss: (reason) => live.current.dismiss(reason),
    };
    layers.push(layer);
    if (layers.length === 1) listen(true);
    return () => {
      const i = layers.indexOf(layer);
      if (i >= 0) layers.splice(i, 1);
      if (layers.length === 0) listen(false);
    };
  }, [active]);
};

// --- Focus -----------------------------------------------------------------

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

export const focusablesIn = (root: Element | null): HTMLElement[] =>
  root ? [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.getClientRects().length > 0) : [];

/** Focus `[data-autofocus]` if there is one, else the first focusable, else the root itself. */
export const focusInitial = (root: HTMLElement | null) => {
  if (!root) return;
  const el = root.querySelector<HTMLElement>("[data-autofocus]") ?? focusablesIn(root)[0] ?? root;
  el.focus({ preventScroll: true });
};

// --- Scroll lock -----------------------------------------------------------

let locks = 0;
let saved = { overflow: "", paddingRight: "" };

/** Stop the page scrolling behind a modal, without the layout jumping when the scrollbar goes. Nested locks count. */
export const lockScroll = () => {
  const html = document.documentElement;
  if (locks++ === 0) {
    const gap = window.innerWidth - html.clientWidth;
    saved = { overflow: html.style.overflow, paddingRight: html.style.paddingRight };
    html.style.overflow = "hidden";
    if (gap > 0) html.style.paddingRight = `${gap}px`;
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--locks === 0) {
      html.style.overflow = saved.overflow;
      html.style.paddingRight = saved.paddingRight;
    }
  };
};

// --- Modal -----------------------------------------------------------------

export interface ModalOptions {
  open: boolean;
  onDismiss: (reason: DismissReason) => void;
  dialogRef: RefObject<HTMLDialogElement | null>;
  /** The visible panel. A press anywhere else (the backdrop) is outside. */
  panelRef: RefObject<HTMLElement | null>;
  /** Whether a press on the backdrop dismisses. Off for confirmations. */
  dismissOnOutside?: boolean;
  render: (p: number) => void;
}

/**
 * A native `<dialog>` opened with showModal(), so the browser makes the rest
 * of the page inert and puts it in the top layer, with a spring on both ways.
 *
 * Focus moves to `[data-autofocus]` (or the first control) on open and back to
 * whatever opened it once it has gone.
 */
export const useModal = ({ open, onDismiss, dialogRef, panelRef, dismissOnOutside = true, render }: ModalOptions) => {
  const presence = usePresence(open, render);
  const { mounted } = presence;
  const onDismissRef = useRef(onDismiss);
  useLayoutEffect(() => {
    onDismissRef.current = onDismiss;
  });

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!mounted || !dialog) return;
    const invoker = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const release = lockScroll();
    if (!dialog.open) dialog.showModal();
    focusInitial(panelRef.current);
    return () => {
      release();
      if (dialog.open) dialog.close();
      if (invoker?.isConnected) invoker.focus({ preventScroll: true });
    };
  }, [mounted, dialogRef, panelRef]);

  // The browser can still ask to close (Android back, a close watcher): route it through the spring.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!mounted || !dialog) return;
    const onCancel = (e: Event) => {
      e.preventDefault();
      onDismissRef.current("escape");
    };
    dialog.addEventListener("cancel", onCancel);
    return () => dialog.removeEventListener("cancel", onCancel);
  }, [mounted, dialogRef]);

  useDismissLayer(
    open,
    (node) => !!panelRef.current?.contains(node) || !dismissOnOutside,
    onDismiss
  );

  return presence;
};
