"use client";
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";

/**
 * Shared behaviour. Expressions that build their own controls (rather than
 * using native ones) take their keyboard and pointer handling from here, so
 * the behaviour is written once and the look is all that differs.
 */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Roving-tabindex tabs: one tab stop, arrows move and select, Home and End jump. */
export const useTabs = (count: number, value: number, onChange: (i: number) => void) => {
  const refs = useRef<Array<HTMLElement | null>>([]);
  const select = useCallback(
    (i: number) => {
      const next = (i + count) % count;
      onChange(next);
      refs.current[next]?.focus();
    },
    [count, onChange],
  );
  const onKeyDown = (e: KeyboardEvent) => {
    const keys: Record<string, () => void> = {
      ArrowRight: () => select(value + 1),
      ArrowLeft: () => select(value - 1),
      Home: () => select(0),
      End: () => select(count - 1),
    };
    const run = keys[e.key];
    if (!run) return;
    e.preventDefault();
    run();
  };
  const tabProps = (i: number, id: string) => ({
    ref: (el: HTMLElement | null) => {
      refs.current[i] = el;
    },
    role: "tab" as const,
    id: `${id}-tab-${i}`,
    "aria-selected": i === value,
    "aria-controls": `${id}-panel-${i}`,
    tabIndex: i === value ? 0 : -1,
    onClick: () => onChange(i),
    onKeyDown,
  });
  return { tabProps };
};

/** Slider keys and an exact-landing pointer drag. */
export const useSlider = ({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
}) => {
  const trackRef = useRef<HTMLElement | null>(null);
  const snap = (v: number) => clamp(Math.round((v - min) / step) * step + min, min, max);
  const big = Math.max(step, (max - min) / 10);

  const onKeyDown = (e: KeyboardEvent) => {
    if (disabled) return;
    const keys: Record<string, number> = {
      ArrowRight: value + step,
      ArrowUp: value + step,
      ArrowLeft: value - step,
      ArrowDown: value - step,
      PageUp: value + big,
      PageDown: value - big,
      Home: min,
      End: max,
    };
    if (!(e.key in keys)) return;
    e.preventDefault();
    onChange(snap(keys[e.key]));
  };

  const fromPointer = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return;
    onChange(snap(min + ((clientX - rect.left) / rect.width) * (max - min)));
  };

  const onPointerDown = (e: ReactPointerEvent) => {
    if (disabled) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    fromPointer(e.clientX);
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    if (disabled || !(e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) return;
    fromPointer(e.clientX);
  };

  return {
    fraction: (value - min) / (max - min || 1),
    trackRef,
    sliderProps: {
      role: "slider" as const,
      tabIndex: disabled ? -1 : 0,
      "aria-valuenow": value,
      "aria-valuemin": min,
      "aria-valuemax": max,
      "aria-disabled": disabled || undefined,
      onKeyDown,
    },
    trackProps: { onPointerDown, onPointerMove },
  };
};

/**
 * An ARIA combobox with a listbox popup: Enter, Space or Alt+Down open it,
 * arrows move, Enter picks, Escape closes, typing jumps to a match, and focus
 * stays on the button the whole time (aria-activedescendant).
 */
export const useCombobox = ({
  value,
  onChange,
  options,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
}) => {
  const id = useId();
  const [open, setOpen] = useState(false);
  const selected = Math.max(0, options.findIndex((o) => o.value === value));
  const [active, setActive] = useState(selected);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const typed = useRef({ text: "", at: 0 });

  const show = () => {
    if (disabled) return;
    setActive(selected);
    setOpen(true);
  };
  const pick = (i: number) => {
    onChange(options[i].value);
    setOpen(false);
    buttonRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!buttonRef.current?.parentElement?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (disabled) return;
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        show();
      }
      return;
    }
    const keys: Record<string, () => void> = {
      ArrowDown: () => setActive((a) => Math.min(options.length - 1, a + 1)),
      ArrowUp: () => setActive((a) => Math.max(0, a - 1)),
      Home: () => setActive(0),
      End: () => setActive(options.length - 1),
      Enter: () => pick(active),
      " ": () => pick(active),
      Escape: () => setOpen(false),
      Tab: () => setOpen(false),
    };
    if (keys[e.key]) {
      if (e.key !== "Tab") e.preventDefault();
      keys[e.key]();
      return;
    }
    if (e.key.length === 1) {
      const now = Date.now();
      typed.current.text = now - typed.current.at > 600 ? e.key : typed.current.text + e.key;
      typed.current.at = now;
      const match = options.findIndex((o) => o.label.toLowerCase().startsWith(typed.current.text.toLowerCase()));
      if (match >= 0) setActive(match);
    }
  };

  return {
    open,
    active,
    selected,
    setActive,
    pick,
    buttonProps: {
      ref: buttonRef,
      type: "button" as const,
      role: "combobox" as const,
      "aria-haspopup": "listbox" as const,
      "aria-expanded": open,
      "aria-controls": `${id}-list`,
      "aria-activedescendant": open ? `${id}-opt-${active}` : undefined,
      disabled,
      onClick: () => (open ? setOpen(false) : show()),
      onKeyDown,
    },
    listProps: { id: `${id}-list`, role: "listbox" as const },
    optionProps: (i: number) => ({
      id: `${id}-opt-${i}`,
      role: "option" as const,
      "aria-selected": i === selected,
      onPointerEnter: () => setActive(i),
      onPointerDown: (e: ReactPointerEvent) => e.preventDefault(),
      onClick: () => pick(i),
    }),
  };
};

/** Tooltip timing: hover after a delay, focus at once, Escape hides. */
export const useTooltip = (delay = 300) => {
  const id = useId();
  const [open, setOpen] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return {
    id,
    open,
    triggerProps: {
      "aria-describedby": id,
      onPointerEnter: () => {
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setOpen(true), delay);
      },
      onPointerLeave: () => {
        window.clearTimeout(timer.current);
        setOpen(false);
      },
      onFocus: () => setOpen(true),
      onBlur: () => setOpen(false),
    },
  };
};
