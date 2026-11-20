"use client";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type FocusEvent, type MouseEvent, type ReactElement, type ReactNode } from "react";
import { pastelColour } from "../primitives/gradient";
import { reducedMotionNow } from "../hooks/reduced-motion";
import { focusInitial, type DismissReason } from "../hooks/overlay";
import { originFor, towardsTrigger, useFloating, type Align, type Positioning, type Side } from "../hooks/anchor";

export interface PopoverProps {
  /** The control that opens it, usually a button. It gets aria-expanded, aria-haspopup and aria-controls. */
  trigger: ReactElement;
  /** What it holds. Pass a function to get a `close` you can call from inside. */
  children: ReactNode | ((close: () => void) => ReactNode);
  /** Accessible name for the panel, read when focus moves into it. */
  label: string;
  /** Preferred side. It flips when there is no room. Default: "bottom" */
  side?: Side;
  /** Alignment along the trigger. Default: "start" */
  align?: Align;
  /** Gap from the trigger in px. Default: 8 */
  offset?: number;
  /** Controlled open state. Leave undefined to let it manage itself. */
  open?: boolean;
  /** Called whenever it opens or closes. */
  onOpenChange?: (open: boolean) => void;
  /** "auto" uses CSS anchor positioning where the browser has it, "js" always measures. Default: "auto" */
  positioning?: Positioning;
  className?: string;
}

/**
 * A panel attached to a button, for things you act on: a share link, a
 * filter, a small form. It sits in the top layer, so a clipped, scrolling or
 * transformed parent cannot trap it, and is placed with CSS anchor
 * positioning where the browser has it.
 *
 * Focus moves in when it opens. Escape or a choice closes it and gives focus
 * back to the trigger; a click elsewhere or tabbing away closes it and leaves
 * focus where you put it. It springs out of the side it is attached to.
 *
 * @example
 * <Popover label="Share" trigger={<button>Share</button>}>
 *   {(close) => <CopyLink onCopied={close} />}
 * </Popover>
 */
export const Popover = ({
  trigger,
  children,
  label,
  side = "bottom",
  align = "start",
  offset = 8,
  open: controlled,
  onOpenChange,
  positioning = "auto",
  className = "",
}: PopoverProps) => {
  const [uncontrolled, setUncontrolled] = useState(false);
  const open = controlled ?? uncontrolled;
  const id = useId();
  const wrapRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const liveOpen = useRef(open);
  const [tint, setTint] = useState("255 255 255");

  useLayoutEffect(() => {
    triggerRef.current = (wrapRef.current?.firstElementChild as HTMLElement | null) ?? null;
    liveOpen.current = open;
  });

  const setOpen = useCallback(
    (next: boolean) => {
      if (controlled === undefined) setUncontrolled(next);
      onOpenChange?.(next);
    },
    [controlled, onOpenChange]
  );

  const close = useCallback(
    (reason: DismissReason) => {
      // Escape, a choice or a close button hand focus back. A click elsewhere
      // or tabbing away leaves it where the user put it.
      if (reason !== "outside" && reason !== "focus-out") triggerRef.current?.focus({ preventScroll: true });
      setOpen(false);
    },
    [setOpen]
  );

  const { mounted } = useFloating({
    open,
    triggerRef,
    floatingRef: panelRef,
    side,
    align,
    offset,
    positioning,
    onDismiss: close,
    render: (p, landed) => {
      const el = panelRef.current;
      if (!el) return;
      const [dx, dy] = towardsTrigger(landed);
      const travel = (1 - p) * 6;
      el.style.opacity = String(Math.min(1, Math.max(0, p)));
      el.style.transformOrigin = originFor(landed, align);
      // Reduced motion keeps the fade and drops the movement.
      el.style.transform = reducedMotionNow() ? "none" : `translate(${dx * travel}px, ${dy * travel}px) scale(${0.96 + 0.04 * p})`;
      el.style.pointerEvents = liveOpen.current ? "auto" : "none";
    },
  });

  useEffect(() => {
    const t = triggerRef.current;
    if (!t) return;
    t.setAttribute("aria-haspopup", "dialog");
    t.setAttribute("aria-expanded", String(open));
    if (open) t.setAttribute("aria-controls", id);
    else t.removeAttribute("aria-controls");
  }, [open, id]);

  useEffect(() => {
    if (open && mounted) focusInitial(panelRef.current);
  }, [open, mounted]);

  const onTriggerClick = (e: MouseEvent) => {
    const t = triggerRef.current;
    if (!t || !(e.target instanceof Node) || !t.contains(e.target)) return;
    if (!open) {
      const r = t.getBoundingClientRect();
      const c = pastelColour(((r.left + r.width / 2) / window.innerWidth) * 100, ((r.top + r.height / 2) / window.innerHeight) * 100, 0);
      setTint(`${c.r} ${c.g} ${c.b}`);
    }
    setOpen(!open);
  };

  const onBlur = (e: FocusEvent) => {
    const to = e.relatedTarget;
    if (to instanceof Node && !panelRef.current?.contains(to) && !triggerRef.current?.contains(to)) close("focus-out");
  };

  return (
    <>
      <span ref={wrapRef} className="contents" onClick={onTriggerClick}>
        {trigger}
      </span>
      {mounted && (
        <div
          ref={panelRef}
          id={id}
          popover="manual"
          role="dialog"
          aria-label={label}
          tabIndex={-1}
          onBlur={onBlur}
          className={`overflow-visible rounded-2xl border bg-[#0b0b0b]/95 p-4 text-sm text-white/85 shadow-[0_18px_48px_rgba(0,0,0,0.55)] outline-none backdrop-blur-md ${className}`}
          style={{ borderColor: `rgb(${tint} / 0.28)` }}
        >
          {/* `close` is a callback for the content to call later, never during render. */}
          {/* eslint-disable-next-line react-hooks/refs */}
          {typeof children === "function" ? children(() => close("button")) : children}
        </div>
      )}
    </>
  );
};
