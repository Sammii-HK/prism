"use client";
import { useId, useLayoutEffect, useRef, useSyncExternalStore, type RefObject } from "react";
import { SPRINGS, useDismissLayer, usePresence, type DismissReason } from "./overlay";

/**
 * Attach a floating element to a trigger.
 *
 * The element goes in the top layer (`popover="manual"`), so no overflow,
 * transform or z-index on any ancestor can clip it or bury it. Then it is
 * placed one of two ways, chosen by feature detection:
 *
 * - CSS anchor positioning, where the browser has it: `position-area` puts it
 *   beside the trigger and `position-try-fallbacks` flips it when there is no
 *   room. Scrolling costs no JavaScript at all; the loop only reads which side
 *   it landed on, so the spring can come from the right direction.
 * - Otherwise JavaScript measures the trigger each frame, flips to the
 *   opposite side if it would overflow, and shifts it to stay in the viewport.
 */

export type Side = "top" | "bottom" | "left" | "right";
export type Align = "start" | "center" | "end";
/** "auto" uses CSS anchor positioning when the browser supports it. "js" always measures. */
export type Positioning = "auto" | "js";
export type Strategy = "anchor" | "js";

export const anchorPositioningSupported = (): boolean =>
  typeof CSS !== "undefined" && CSS.supports("anchor-name: --a") && CSS.supports("position-try-fallbacks: flip-block");

const noop = () => () => {};
/** Whether this browser has CSS anchor positioning. False on the server, so first paint matches. */
export const useAnchorSupport = () => useSyncExternalStore(noop, anchorPositioningSupported, () => false);

const OPPOSITE: Record<Side, Side> = { top: "bottom", bottom: "top", left: "right", right: "left" };
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));
const isVertical = (side: Side) => side === "top" || side === "bottom";

/** Where a floating box of `size` goes beside `anchor`: flipped if it does not fit, shifted to stay `pad` inside the viewport. */
export const computePlacement = (
  anchor: DOMRect,
  size: { width: number; height: number },
  side: Side,
  align: Align,
  offset: number,
  pad = 8
) => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const room: Record<Side, number> = {
    bottom: vh - anchor.bottom - offset - pad,
    top: anchor.top - offset - pad,
    right: vw - anchor.right - offset - pad,
    left: anchor.left - offset - pad,
  };
  const need = isVertical(side) ? size.height : size.width;
  const resolved = room[side] < need && room[OPPOSITE[side]] > room[side] ? OPPOSITE[side] : side;

  const along = (start: number, length: number, extent: number) =>
    align === "start" ? start : align === "end" ? start + length - extent : start + length / 2 - extent / 2;

  if (isVertical(resolved)) {
    const y = resolved === "bottom" ? anchor.bottom + offset : anchor.top - offset - size.height;
    const x = clamp(along(anchor.left, anchor.width, size.width), pad, vw - pad - size.width);
    return { x, y, side: resolved };
  }
  const x = resolved === "right" ? anchor.right + offset : anchor.left - offset - size.width;
  const y = clamp(along(anchor.top, anchor.height, size.height), pad, vh - pad - size.height);
  return { x, y, side: resolved };
};

const positionArea = (side: Side, align: Align) => {
  if (align === "center") return side;
  if (isVertical(side)) return `${side} ${align === "start" ? "span-right" : "span-left"}`;
  return `${side} ${align === "start" ? "span-bottom" : "span-top"}`;
};

const MARGIN: Record<Side, string> = { bottom: "margin-top", top: "margin-bottom", right: "margin-left", left: "margin-right" };

/** Which side the browser actually put it on, read from where it ended up. */
const landedOn = (anchor: DOMRect, float: DOMRect, side: Side): Side =>
  isVertical(side)
    ? float.top + float.height / 2 > anchor.top + anchor.height / 2
      ? "bottom"
      : "top"
    : float.left + float.width / 2 > anchor.left + anchor.width / 2
      ? "right"
      : "left";

/** CSS transform-origin for a panel that grows out of its trigger. */
export const originFor = (side: Side, align: Align) => {
  const cross = align === "start" ? "0%" : align === "end" ? "100%" : "50%";
  switch (side) {
    case "bottom":
      return `${cross} 0%`;
    case "top":
      return `${cross} 100%`;
    case "right":
      return `0% ${cross}`;
    case "left":
      return `100% ${cross}`;
  }
};

/** Unit vector pointing from the panel back towards its trigger, for the entrance offset. */
export const towardsTrigger = (side: Side) =>
  ({ bottom: [0, -1], top: [0, 1], right: [-1, 0], left: [1, 0] })[side] as [number, number];

export interface FloatingOptions {
  open: boolean;
  /** The element it is attached to. */
  triggerRef: RefObject<HTMLElement | null>;
  /** The floating element. Render it with `popover="manual"`. */
  floatingRef: RefObject<HTMLElement | null>;
  side?: Side;
  align?: Align;
  /** Gap from the trigger in px. */
  offset?: number;
  positioning?: Positioning;
  /** Put it on the dismiss stack (Escape, click outside). Leave out for tooltips. */
  onDismiss?: (reason: DismissReason) => void;
  /** Called every frame while it moves, with spring progress 0..1 and the side it is on. */
  render: (p: number, side: Side) => void;
}

/** Presence, top layer, placement and dismissal for anything attached to a trigger. */
export const useFloating = ({
  open,
  triggerRef,
  floatingRef,
  side = "bottom",
  align = "start",
  offset = 6,
  positioning = "auto",
  onDismiss,
  render,
}: FloatingOptions) => {
  const sideRef = useRef<Side>(side);
  const presence = usePresence(open, (p) => render(p, sideRef.current), SPRINGS.panel);
  const { mounted } = presence;
  const name = `--prism-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const supported = useAnchorSupport();
  const strategy: Strategy = positioning === "auto" && supported ? "anchor" : "js";

  useLayoutEffect(() => {
    const trigger = triggerRef.current;
    const el = floatingRef.current;
    if (!mounted || !trigger || !el) return;
    const s = el.style;
    s.position = "fixed";
    s.inset = "auto";
    s.margin = "0";
    if (strategy === "anchor") {
      trigger.style.setProperty("anchor-name", name);
      s.setProperty("position-anchor", name);
      s.setProperty("position-area", positionArea(side, align));
      s.setProperty(
        "position-try-fallbacks",
        isVertical(side) ? "flip-block, flip-inline, flip-block flip-inline" : "flip-inline, flip-block, flip-inline flip-block"
      );
      s.setProperty(MARGIN[side], `${offset}px`);
    }
    try {
      if (!el.matches(":popover-open")) el.showPopover();
    } catch {
      // No Popover API: it still renders, fixed-position, just without the top layer.
    }

    let raf = 0;
    let last = "";
    const place = () => {
      const a = trigger.getBoundingClientRect();
      if (strategy === "anchor") {
        sideRef.current = landedOn(a, el.getBoundingClientRect(), side);
      } else {
        const p = computePlacement(a, { width: el.offsetWidth, height: el.offsetHeight }, side, align, offset);
        const key = `${Math.round(p.x * 2)},${Math.round(p.y * 2)}`;
        if (key !== last) {
          s.left = `${p.x}px`;
          s.top = `${p.y}px`;
          last = key;
        }
        sideRef.current = p.side;
      }
      raf = requestAnimationFrame(place);
    };
    place();

    return () => {
      cancelAnimationFrame(raf);
      trigger.style.removeProperty("anchor-name");
      for (const prop of ["position-anchor", "position-area", "position-try-fallbacks", "left", "top", ...Object.values(MARGIN)]) {
        s.removeProperty(prop);
      }
      try {
        el.hidePopover();
      } catch {
        // Already hidden or unsupported.
      }
    };
  }, [mounted, strategy, side, align, offset, name, triggerRef, floatingRef]);

  useDismissLayer(
    open && !!onDismiss,
    (node) => !!floatingRef.current?.contains(node) || !!triggerRef.current?.contains(node),
    (reason) => onDismiss?.(reason)
  );

  return { ...presence, strategy, sideRef };
};
