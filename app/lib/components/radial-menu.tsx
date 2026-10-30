"use client";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useSystemReducedMotion } from "./async-button";

export interface RadialMenuItem {
  id: string;
  label: string;
  /** Optional glyph shown above the label. Decorative: the label is the accessible name. */
  icon?: ReactNode;
}

export interface RadialMenuProps {
  items: RadialMenuItem[];
  /** Accessible name for the trigger and the menu. */
  label?: string;
  /** Distance from the trigger centre to each item centre, in px. */
  radius?: number;
  /** Angle of the first item in degrees. -90 is straight up. */
  startAngle?: number;
  /** Degrees covered by the ring. 360 closes the ring; less fans the items across an arc. */
  sweep?: number;
  /** Spring stiffness (higher is snappier). */
  stiffness?: number;
  /** Spring damping (lower overshoots more). */
  damping?: number;
  /** Delay between one item starting and the next, in ms. */
  staggerMs?: number;
  /** Force reduced motion on or off. Leave undefined to follow the system setting. */
  reducedMotion?: boolean;
  onSelect?: (item: RadialMenuItem, index: number) => void;
  /** Fired when keyboard or pointer focus lands on an item (the roving tab stop). */
  onActiveChange?: (item: RadialMenuItem, index: number) => void;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

const ITEM = 64;
const TRIGGER = 56;

/**
 * Pure helper, exported so layout can be tested: the offset of item `index`
 * from the trigger centre. A 360 degree sweep spreads items evenly round a
 * closed ring; a smaller sweep puts the first item at the start angle and the
 * last at the end of the arc.
 */
export const radialPosition = (index: number, count: number, radius: number, startAngle: number, sweep: number) => {
  const step = sweep >= 360 ? sweep / count : count > 1 ? sweep / (count - 1) : 0;
  const rad = ((startAngle + step * index) * Math.PI) / 180;
  return { x: Math.cos(rad) * radius, y: Math.sin(rad) * radius };
};

/**
 * A menu whose items spring out of its trigger. The motion is decoration; the
 * behaviour is the standard menu-button pattern: roving tabindex, arrow keys
 * walk the ring (wrapping), Home and End jump, typing a letter jumps to a
 * matching label, Escape closes and returns focus to the trigger, and the
 * chosen item is announced through a polite live region.
 *
 * With reduced motion the items appear instantly at their final positions
 * with no spring and no fade.
 *
 * @example
 * <RadialMenu items={[{ id: "copy", label: "Copy" }]} onSelect={(item) => run(item.id)} />
 */
export const RadialMenu = ({
  items,
  label = "Actions",
  radius = 112,
  startAngle = -90,
  sweep = 360,
  stiffness = 300,
  damping = 17,
  staggerMs = 28,
  reducedMotion,
  onSelect,
  onActiveChange,
  onOpenChange,
  className = "",
}: RadialMenuProps) => {
  const systemReduced = useSystemReducedMotion();
  const reduced = reducedMotion ?? systemReduced;
  const menuId = useId();

  const [open, setOpen] = useState(false);
  /** Items stay in the DOM while they spring back in, so closing can animate. */
  const [mounted, setMounted] = useState(false);
  const [active, setActive] = useState(0);
  const [announcement, setAnnouncement] = useState("");

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemEls = useRef<(HTMLButtonElement | null)[]>([]);
  const springs = useRef<{ p: number; v: number }[]>([]);
  const typed = useRef({ text: "", at: 0 });
  const onOpenChangeRef = useRef(onOpenChange);
  const onActiveChangeRef = useRef(onActiveChange);
  useEffect(() => {
    onOpenChangeRef.current = onOpenChange;
    onActiveChangeRef.current = onActiveChange;
  }, [onOpenChange, onActiveChange]);

  const openMenu = useCallback(
    (index: number) => {
      setActive(index);
      setMounted(true);
      setOpen(true);
      setAnnouncement("");
      onOpenChangeRef.current?.(true);
    },
    []
  );

  const closeMenu = useCallback(
    (returnFocus: boolean) => {
      setOpen(false);
      if (reduced) setMounted(false);
      onOpenChangeRef.current?.(false);
      if (returnFocus) triggerRef.current?.focus();
    },
    [reduced]
  );

  const moveTo = useCallback((index: number) => {
    setActive(index);
    itemEls.current[index]?.focus();
  }, []);

  const choose = (index: number) => {
    const item = items[index];
    setAnnouncement(`${item.label} selected`);
    onSelect?.(item, index);
    closeMenu(true);
  };

  /** Spring the items to their targets (or snap them under reduced motion). */
  useLayoutEffect(() => {
    if (!mounted) {
      springs.current = [];
      return;
    }
    const n = items.length;
    const target = open ? 1 : 0;
    for (let i = 0; i < n; i++) springs.current[i] ??= { p: 0, v: 0 };

    const apply = (i: number) => {
      const el = itemEls.current[i];
      const s = springs.current[i];
      if (!el || !s) return;
      const { x, y } = radialPosition(i, n, radius, startAngle, sweep);
      const p = s.p;
      el.style.transform = `translate(-50%, -50%) translate(${x * p}px, ${y * p}px) scale(${0.4 + 0.6 * p})`;
      el.style.opacity = String(Math.max(0, Math.min(1, p * 1.4)));
    };

    if (reduced) {
      for (let i = 0; i < n; i++) {
        springs.current[i] = { p: target, v: 0 };
        apply(i);
      }
      return;
    }

    for (let i = 0; i < n; i++) apply(i);
    let raf = 0;
    const start = performance.now();
    let last = start;
    const tick = (now: number) => {
      const dt = Math.min(0.032, (now - last) / 1000);
      last = now;
      const elapsed = now - start;
      let settled = true;
      for (let i = 0; i < n; i++) {
        const s = springs.current[i];
        const delay = (open ? i : n - 1 - i) * staggerMs;
        if (elapsed < delay) {
          settled = false;
          continue;
        }
        const steps = Math.max(1, Math.ceil(dt / (1 / 240)));
        const h = dt / steps;
        for (let k = 0; k < steps; k++) {
          s.v += (stiffness * (target - s.p) - damping * s.v) * h;
          s.p += s.v * h;
        }
        // Closing must not swing past the trigger to the far side.
        if (!open && s.p < 0) {
          s.p = 0;
          s.v = 0;
        }
        if (Math.abs(s.p - target) > 0.002 || Math.abs(s.v) > 0.01) settled = false;
        else {
          s.p = target;
          s.v = 0;
        }
        apply(i);
      }
      if (settled) {
        if (!open) setMounted(false);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [open, mounted, reduced, items.length, radius, startAngle, sweep, stiffness, damping, staggerMs]);

  /** Move focus into the ring on open. */
  useEffect(() => {
    if (open) itemEls.current[active]?.focus();
    // Only when the menu opens; arrow keys move focus themselves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /** Click or tap outside closes without stealing focus back. */
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) closeMenu(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open, closeMenu]);

  const onTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault();
      openMenu(0);
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault();
      openMenu(items.length - 1);
    }
  };

  const onMenuKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const n = items.length;
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        e.preventDefault();
        moveTo((active + 1) % n);
        return;
      case "ArrowLeft":
      case "ArrowUp":
        e.preventDefault();
        moveTo((active - 1 + n) % n);
        return;
      case "Home":
        e.preventDefault();
        moveTo(0);
        return;
      case "End":
        e.preventDefault();
        moveTo(n - 1);
        return;
      case "Escape":
        e.preventDefault();
        closeMenu(true);
        return;
      case "Tab":
        // Close and hand focus back to the trigger; the browser then moves on from there.
        closeMenu(true);
        return;
    }
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && e.key !== " ") {
      const now = Date.now();
      const t = typed.current;
      const ch = e.key.toLowerCase();
      t.text = now - t.at > 600 ? ch : t.text + ch;
      t.at = now;
      // Pressing the same letter again cycles through matches instead of building a prefix.
      if (t.text.length > 1 && [...t.text].every((c) => c === ch)) t.text = ch;
      // A repeated single letter cycles through matches; a longer prefix narrows to one.
      const order = Array.from({ length: n }, (_, k) => (active + 1 + k) % n);
      const hit = (t.text.length > 1 ? [active, ...order] : order).find((i) =>
        items[i].label.toLowerCase().startsWith(t.text)
      );
      if (hit !== undefined) {
        e.preventDefault();
        moveTo(hit);
      }
    }
  };

  const size = radius * 2 + ITEM + 16;

  return (
    <div className={`inline-block ${className}`}>
      <div ref={rootRef} className="relative" style={{ width: size, height: size }}>
        <button
          ref={triggerRef}
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={mounted ? menuId : undefined}
          aria-label={label}
          data-open={open}
          onClick={() => (open ? closeMenu(false) : openMenu(0))}
          onKeyDown={onTriggerKeyDown}
          className="absolute left-1/2 top-1/2 z-10 grid place-items-center rounded-full text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          style={{
            width: TRIGGER,
            height: TRIGGER,
            transform: "translate(-50%, -50%)",
            background: open ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.28)",
            transition: reduced ? "none" : "background 200ms",
          }}
        >
          <svg
            aria-hidden
            width="20"
            height="20"
            viewBox="0 0 20 20"
            style={{
              transform: open ? "rotate(45deg)" : "rotate(0deg)",
              transition: reduced ? "none" : "transform 260ms cubic-bezier(.3,1.4,.5,1)",
            }}
          >
            <path d="M10 3v14M3 10h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>

        {mounted && (
          <div
            id={menuId}
            role="menu"
            aria-label={label}
            aria-orientation="horizontal"
            onKeyDown={onMenuKeyDown}
            className="absolute inset-0"
            style={{ pointerEvents: "none" }}
          >
            {items.map((item, i) => (
              <button
                key={item.id}
                ref={(el) => {
                  itemEls.current[i] = el;
                }}
                type="button"
                role="menuitem"
                tabIndex={i === active ? 0 : -1}
                data-index={i}
                onFocus={() => {
                  setActive(i);
                  onActiveChangeRef.current?.(item, i);
                }}
                onClick={() => choose(i)}
                className="absolute left-1/2 top-1/2 flex flex-col items-center justify-center gap-0.5 rounded-full text-[11px] font-medium text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/90 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                style={{
                  width: ITEM,
                  height: ITEM,
                  pointerEvents: "auto",
                  background: i === active ? "rgba(140,160,255,0.28)" : "rgba(255,255,255,0.08)",
                  border: `1px solid ${i === active ? "rgba(140,160,255,0.7)" : "rgba(255,255,255,0.2)"}`,
                  opacity: reduced ? 1 : 0,
                  transform: "translate(-50%, -50%)",
                }}
              >
                {item.icon && <span aria-hidden>{item.icon}</span>}
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <span role="status" aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </div>
  );
};
