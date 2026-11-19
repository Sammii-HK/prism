"use client";
import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { pastelColour } from "../primitives/gradient";
import { reducedMotionNow } from "../hooks/reduced-motion";
import { towardsTrigger, useFloating } from "../hooks/anchor";

export interface TooltipProps {
  /** What the tooltip says. Keep it short: a label or a shortcut. */
  content: ReactNode;
  /** The element it describes. A single element gets `aria-describedby` directly. */
  children: ReactNode;
  /** Which side of the trigger it sits on. Default: "top" */
  side?: "top" | "bottom";
  /** Hover delay before it appears, in ms. Keyboard focus shows it at once. Default: 300 */
  delay?: number;
  className?: string;
}

/**
 * A tooltip that stays put. It sits centred on its trigger, appears after a
 * short hover or straight away on keyboard focus, and closes on Escape. Its
 * border takes the Prism colour of where the trigger sits on the page, so it
 * belongs to the same light system without following the cursor around.
 *
 * It shares the overlay engine with Popover and Menu: it sits in the top
 * layer, so an overflow: hidden card cannot clip it, flips below when there
 * is no room above, and springs in. Its text is always in the page, hidden,
 * so the description is there the moment the trigger takes focus.
 *
 * @example
 * <Tooltip content="Undo (⌘Z)">
 *   <IconButton aria-label="Undo"><Undo2 size={15} /></IconButton>
 * </Tooltip>
 */
export const Tooltip = ({ content, children, side = "top", delay = 300, className = "" }: TooltipProps) => {
  const id = useId();
  const wrapRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [tint, setTint] = useState("255 255 255");

  useFloating({
    open,
    triggerRef: wrapRef,
    floatingRef: tipRef,
    side,
    align: "center",
    offset: 8,
    render: (p, landed) => {
      const el = tipRef.current;
      if (!el) return;
      const [, dy] = towardsTrigger(landed);
      el.style.opacity = Math.min(1, Math.max(0, p)).toFixed(3);
      el.style.transform = reducedMotionNow() ? "none" : `translateY(${(dy * (1 - p) * 3).toFixed(2)}px)`;
    },
  });

  const show = (immediate: boolean) => {
    window.clearTimeout(timer.current);
    const rect = wrapRef.current?.getBoundingClientRect();
    if (rect) {
      const c = pastelColour(((rect.left + rect.width / 2) / window.innerWidth) * 100, ((rect.top + rect.height / 2) / window.innerHeight) * 100, 0);
      setTint(`${c.r} ${c.g} ${c.b}`);
    }
    if (immediate) setOpen(true);
    else timer.current = window.setTimeout(() => setOpen(true), delay);
  };
  const hide = () => {
    window.clearTimeout(timer.current);
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") hide();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const only = Children.count(children) === 1 && isValidElement(children) ? (children as ReactElement<{ "aria-describedby"?: string }>) : null;
  const trigger = only
    ? cloneElement(only, {
        "aria-describedby": [only.props["aria-describedby"], id].filter(Boolean).join(" "),
      })
    : children;

  return (
    <span
      ref={wrapRef}
      className={`relative inline-flex ${className}`}
      onPointerEnter={(e) => e.pointerType === "mouse" && show(false)}
      onPointerLeave={hide}
      onFocus={(e) => (e.target as HTMLElement).matches(":focus-visible") && show(true)}
      onBlur={hide}
      aria-describedby={only ? undefined : id}
    >
      {trigger}
      <span
        ref={tipRef}
        id={id}
        role="tooltip"
        popover="manual"
        className="pointer-events-none m-0 overflow-visible whitespace-nowrap rounded-lg border bg-[#0b0b0b]/95 px-2.5 py-1.5 text-xs text-white/85 shadow-[0_8px_24px_rgba(0,0,0,0.5)] backdrop-blur"
        style={{ borderColor: `rgb(${tint} / 0.35)` }}
      >
        {content}
      </span>
    </span>
  );
};
