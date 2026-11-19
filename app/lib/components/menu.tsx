"use client";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { Check } from "lucide-react";
import { pastelColour } from "../primitives/gradient";
import { reducedMotionNow } from "../hooks/reduced-motion";
import { SPRINGS, atRest, stepSpring, type DismissReason } from "../hooks/overlay";
import { originFor, towardsTrigger, useFloating, type Align, type Positioning, type Side } from "../hooks/anchor";

export type MenuItem =
  | {
      type?: "item";
      label: string;
      onSelect?: () => void;
      icon?: ReactNode;
      /** Shown on the right, for reference. It does not bind the key. */
      shortcut?: string;
      disabled?: boolean;
      tone?: "default" | "danger";
      /** Makes it a checkbox item (menuitemcheckbox) that stays open when toggled. */
      checked?: boolean;
    }
  | { type: "separator" }
  | { type: "label"; label: string };

export interface MenuProps {
  /** The button that opens it. It gets aria-haspopup, aria-expanded and aria-controls. */
  trigger: ReactElement;
  items: MenuItem[];
  /** Preferred side. It flips when there is no room. Default: "bottom" */
  side?: Side;
  /** Alignment along the trigger. Default: "start" */
  align?: Align;
  /** Gap from the trigger in px. Default: 6 */
  offset?: number;
  /** "auto" uses CSS anchor positioning where the browser has it, "js" always measures. Default: "auto" */
  positioning?: Positioning;
  /** Called whenever it opens or closes. */
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

type Action = Extract<MenuItem, { label: string; type?: "item" }>;
const isAction = (item: MenuItem): item is Action => item.type === undefined || item.type === "item";

/**
 * An action menu that follows the WAI-ARIA menu button pattern. Arrow keys
 * move, Home and End jump, typing a letter jumps to the next item that
 * starts with it, Enter or Space chooses, and Escape closes and gives focus
 * back to the button. ArrowUp on the button opens it at the last item.
 *
 * A pill springs between items as focus moves, whether you move it with the
 * keyboard or the pointer, so there is only ever one highlighted item.
 *
 * @example
 * <Menu
 *   trigger={<IconButton aria-label="Project actions"><MoreHorizontal size={16} /></IconButton>}
 *   items={[
 *     { label: "Rename", shortcut: "R", onSelect: rename },
 *     { type: "separator" },
 *     { label: "Delete", tone: "danger", onSelect: remove },
 *   ]}
 * />
 */
export const Menu = ({ trigger, items, side = "bottom", align = "start", offset = 6, positioning = "auto", onOpenChange, className = "" }: MenuProps) => {
  const [open, setOpenState] = useState(false);
  const [focused, setFocused] = useState(-1);
  const [tint, setTint] = useState("255 255 255");
  const id = useId();
  const wrapRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const pendingFocus = useRef<"first" | "last" | "menu">("menu");
  const typeahead = useRef({ text: "", at: 0 });
  const liveOpen = useRef(open);
  const focusedRef = useRef(focused);

  useLayoutEffect(() => {
    const t = (wrapRef.current?.firstElementChild as HTMLElement | null) ?? null;
    if (t && !t.id) t.id = `${id}-trigger`;
    triggerRef.current = t;
    liveOpen.current = open;
    focusedRef.current = focused;
    // The menu is named by its button, whatever id that button already had.
    if (t && panelRef.current) panelRef.current.setAttribute("aria-labelledby", t.id);
  });

  const enabled = items.flatMap((item, i) => (isAction(item) && !item.disabled ? [i] : []));

  const setOpen = useCallback(
    (next: boolean) => {
      setOpenState(next);
      onOpenChange?.(next);
    },
    [onOpenChange]
  );

  const close = useCallback(
    (reason: DismissReason) => {
      if (reason !== "outside" && reason !== "focus-out") triggerRef.current?.focus({ preventScroll: true });
      setFocused(-1);
      setOpen(false);
    },
    [setOpen]
  );

  const openWith = (where: "first" | "last" | "menu") => {
    const t = triggerRef.current;
    if (t) {
      const r = t.getBoundingClientRect();
      const c = pastelColour(((r.left + r.width / 2) / window.innerWidth) * 100, ((r.top + r.height / 2) / window.innerHeight) * 100, 0);
      setTint(`${c.r} ${c.g} ${c.b}`);
    }
    pendingFocus.current = where;
    setOpen(true);
  };

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
      el.style.transform = reducedMotionNow() ? "none" : `translate(${dx * travel}px, ${dy * travel}px) scale(${0.96 + 0.04 * p})`;
      el.style.pointerEvents = liveOpen.current ? "auto" : "none";
    },
  });

  // Trigger semantics, written onto whatever element was passed in.
  useEffect(() => {
    const t = triggerRef.current;
    if (!t) return;
    t.setAttribute("aria-haspopup", "menu");
    t.setAttribute("aria-expanded", String(open));
    if (open) t.setAttribute("aria-controls", id);
    else t.removeAttribute("aria-controls");
  }, [open, id]);

  // Where focus lands once it is on screen.
  useEffect(() => {
    if (!open || !mounted) return;
    const where = pendingFocus.current;
    const index = where === "first" ? enabled[0] : where === "last" ? enabled[enabled.length - 1] : undefined;
    if (index === undefined) panelRef.current?.focus({ preventScroll: true });
    else itemRefs.current[index]?.focus({ preventScroll: true });
    // Only on open; later moves are handled by the keys.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mounted]);

  // The highlight pill: one spring for where it is, one for how tall, one for whether it shows.
  useEffect(() => {
    if (!mounted) return;
    const y = { x: 0, v: 0 };
    const h = { x: 0, v: 0 };
    const o = { x: 0, v: 0 };
    let placed = false;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const pill = pillRef.current;
      const item = itemRefs.current[focusedRef.current];
      if (pill) {
        const showing = !!item && focusedRef.current >= 0;
        if (item) {
          if (!placed || reducedMotionNow()) {
            // The first highlight appears where it is rather than sliding in from the top.
            y.x = item.offsetTop;
            h.x = item.offsetHeight;
            y.v = h.v = 0;
            placed = true;
          } else {
            stepSpring(y, item.offsetTop, SPRINGS.indicator, dt);
            stepSpring(h, item.offsetHeight, SPRINGS.indicator, dt);
          }
        }
        stepSpring(o, showing ? 1 : 0, SPRINGS.indicator, dt);
        if (item && atRest(y, item.offsetTop, 0.05) && atRest(h, item.offsetHeight, 0.05)) {
          y.x = item.offsetTop;
          h.x = item.offsetHeight;
        }
        // Unchanged values are not re-written as motion, so a resting pill costs nothing.
        pill.style.transform = `translateY(${y.x.toFixed(2)}px)`;
        pill.style.height = `${h.x.toFixed(2)}px`;
        pill.style.opacity = Math.min(1, Math.max(0, o.x)).toFixed(3);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [mounted]);

  const focusItem = (index: number | undefined) => {
    if (index === undefined) return;
    itemRefs.current[index]?.focus({ preventScroll: true });
  };

  const move = (delta: 1 | -1) => {
    if (enabled.length === 0) return;
    const at = enabled.indexOf(focused);
    const next = at === -1 ? (delta === 1 ? 0 : enabled.length - 1) : (at + delta + enabled.length) % enabled.length;
    focusItem(enabled[next]);
  };

  const onTriggerClick = (e: MouseEvent) => {
    const t = triggerRef.current;
    if (!t || !(e.target instanceof Node) || !t.contains(e.target)) return;
    if (open) close("button");
    // detail 0 means Enter or Space, so start on the first item; a pointer opens on the menu itself.
    else openWith(e.detail === 0 ? "first" : "menu");
  };

  const onTriggerKeyDown = (e: KeyboardEvent) => {
    const t = triggerRef.current;
    if (!t || !(e.target instanceof Node) || !t.contains(e.target)) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) openWith(e.key === "ArrowDown" ? "first" : "last");
    }
  };

  const onMenuKeyDown = (e: KeyboardEvent) => {
    const keys: Record<string, () => void> = {
      ArrowDown: () => move(1),
      ArrowUp: () => move(-1),
      Home: () => focusItem(enabled[0]),
      End: () => focusItem(enabled[enabled.length - 1]),
    };
    if (keys[e.key]) {
      e.preventDefault();
      keys[e.key]();
      return;
    }
    if (e.key === "Tab") {
      close("focus-out");
      return;
    }
    if (e.key.length === 1 && /\S/.test(e.key) && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const now = performance.now();
      const t = typeahead.current;
      t.text = now - t.at > 500 ? e.key.toLowerCase() : t.text + e.key.toLowerCase();
      t.at = now;
      const start = Math.max(0, enabled.indexOf(focused));
      // A single repeated letter cycles; a typed word matches from the current item on.
      const order = [...enabled.slice(start + (t.text.length === 1 ? 1 : 0)), ...enabled.slice(0, start + (t.text.length === 1 ? 1 : 0))];
      const hit = order.find((i) => (items[i] as Action).label.toLowerCase().startsWith(t.text));
      if (hit !== undefined) focusItem(hit);
    }
  };

  const choose = (item: Action) => {
    if (item.disabled) return;
    if (item.checked !== undefined) {
      item.onSelect?.();
      return;
    }
    // Focus goes back first, so anything the item opens (a dialog) remembers the button, not this menu.
    close("select");
    item.onSelect?.();
  };

  const focusedItem = focused >= 0 ? items[focused] : undefined;
  const pillDanger = !!focusedItem && isAction(focusedItem) && focusedItem.tone === "danger";

  return (
    <>
      <span ref={wrapRef} className="contents" onClick={onTriggerClick} onKeyDown={onTriggerKeyDown}>
        {trigger}
      </span>
      {mounted && (
        <div
          ref={panelRef}
          id={id}
          popover="manual"
          role="menu"
          tabIndex={-1}
          onKeyDown={onMenuKeyDown}
          // Only while open: closing turns pointer events off, which fires a leave that must not pull focus back in.
          onPointerLeave={() => liveOpen.current && panelRef.current?.focus({ preventScroll: true })}
          onFocus={(e) => e.target === panelRef.current && setFocused(-1)}
          className={`min-w-[200px] overflow-visible rounded-xl border bg-[#0b0b0b]/95 p-1 text-white/85 shadow-[0_18px_48px_rgba(0,0,0,0.55)] outline-none backdrop-blur-md ${className}`}
          style={{ borderColor: `rgb(${tint} / 0.26)` }}
        >
          <div
            ref={pillRef}
            aria-hidden="true"
            className="pointer-events-none absolute left-1 right-1 top-0 rounded-lg"
            style={{
              opacity: 0,
              background: pillDanger ? "rgb(252 165 165 / 0.12)" : `rgb(${tint} / 0.11)`,
              boxShadow: pillDanger ? "inset 0 0 0 1px rgb(252 165 165 / 0.18)" : `inset 0 0 0 1px rgb(${tint} / 0.14)`,
            }}
          />
          {items.map((item, i) => {
            if (item.type === "separator") return <div key={`sep-${i}`} role="separator" className="mx-2 my-1 h-px bg-white/[0.08]" />;
            if (item.type === "label")
              return (
                <div key={`label-${i}`} role="presentation" className="px-3 pb-1 pt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">
                  {item.label}
                </div>
              );
            const danger = item.tone === "danger";
            const isCheck = item.checked !== undefined;
            return (
              <button
                key={`${item.label}-${i}`}
                ref={(el) => {
                  itemRefs.current[i] = el;
                }}
                type="button"
                role={isCheck ? "menuitemcheckbox" : "menuitem"}
                aria-checked={isCheck ? item.checked : undefined}
                aria-disabled={item.disabled || undefined}
                tabIndex={-1}
                onClick={() => choose(item)}
                onFocus={() => setFocused(i)}
                onPointerMove={() => {
                  if (!liveOpen.current) return;
                  if (item.disabled) panelRef.current?.focus({ preventScroll: true });
                  else if (document.activeElement !== itemRefs.current[i]) itemRefs.current[i]?.focus({ preventScroll: true });
                }}
                className={`relative flex min-h-9 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[13px] outline-none ${
                  item.disabled ? "cursor-default text-white/30" : danger ? "text-[#fca5a5]" : focused === i ? "text-white" : "text-white/80"
                }`}
              >
                {isCheck ? (
                  <span aria-hidden="true" className="flex w-4 justify-center">
                    {item.checked && <Check size={14} />}
                  </span>
                ) : (
                  item.icon && (
                    <span aria-hidden="true" className="flex w-4 justify-center text-white/55">
                      {item.icon}
                    </span>
                  )
                )}
                <span className="flex-1">{item.label}</span>
                {item.shortcut && <kbd className="font-mono text-[11px] text-white/40">{item.shortcut}</kbd>}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
};
