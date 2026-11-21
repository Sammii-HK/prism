"use client";
import { Check, ChevronDown } from "lucide-react";
import { cloneElement, isValidElement, useId, type CSSProperties, type ReactElement } from "react";
import { flushSync } from "react-dom";
import { useCombobox, useSlider, useTabs, useTooltip } from "../core/behaviour";
import type { ButtonProps, CheckboxProps, SelectProps, SliderProps, SwitchProps, TabsProps, TextFieldProps, TooltipProps } from "../core/contract";
import { useReducedMotion } from "../hooks/reduced-motion";
import { SPRINGS, springTransition } from "./spring-css";

/**
 * Reserved: native CSS motion.
 *
 * No animation loop runs here. Every movement is a CSS transition whose
 * easing is the Luminous spring (k 180, d 22) compiled to `linear()`, so it
 * overshoots and settles the same way, on the compositor, with no script.
 * The tab indicator uses the View Transitions API. Precision controls (the
 * slider) do not move with a spring at all.
 */

const HAIRLINE = "border-white/[0.16]";
const FOCUS = "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050505]";

/** The transition for these properties, or none when motion is reduced. */
const useSpring = (properties: string[], spring = SPRINGS.settle): CSSProperties => {
  const reduced = useReducedMotion();
  return { transition: reduced ? "none" : springTransition(properties, spring) };
};

export const Switch = ({ checked, onChange, label, disabled }: SwitchProps) => {
  const id = useId();
  const motion = useSpring(["transform"]);
  const fade = useSpring(["background-color", "border-color"], SPRINGS.soft);
  return (
    <div className="flex items-center justify-between gap-4">
      <span id={id} className={`text-[13px] tracking-[0.01em] ${disabled ? "text-white/35" : "text-white/80"}`}>
        {label}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={id}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        style={fade}
        className={`relative h-5 w-9 shrink-0 rounded-full border disabled:opacity-40 ${FOCUS} ${
          checked ? "border-white/70 bg-white/[0.12]" : `${HAIRLINE} bg-transparent`
        }`}
      >
        <span
          aria-hidden="true"
          style={{ ...motion, transform: `translateX(${checked ? 16 : 0}px)` }}
          className={`absolute left-[3px] top-[3px] h-3 w-3 rounded-full ${checked ? "bg-white" : "bg-white/45"}`}
        />
      </button>
    </div>
  );
};

/** Length of Lucide's check path in its 24-unit box, so the stroke can draw on from nothing. */
const CHECK_LENGTH = 23;

export const Checkbox = ({ checked, onChange, label, disabled }: CheckboxProps) => {
  const draw = useSpring(["stroke-dashoffset"]);
  return (
    <label className={`group flex cursor-pointer items-center gap-3 text-[13px] ${disabled ? "cursor-not-allowed text-white/35" : "text-white/80"}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className={`grid h-4 w-4 shrink-0 place-items-center rounded-[4px] border peer-focus-visible:ring-1 peer-focus-visible:ring-white/80 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[#050505] ${
          checked ? "border-white/80" : HAIRLINE
        }`}
      >
        {/* Dash properties inherit from the svg to its path, so the spring draws the tick on and off. */}
        <Check
          width="10"
          height="10"
          color="white"
          strokeWidth={1.4}
          absoluteStrokeWidth
          style={{ ...draw, strokeDasharray: CHECK_LENGTH, strokeDashoffset: checked ? 0 : CHECK_LENGTH }}
        />
      </span>
      {label}
    </label>
  );
};

export const Tabs = ({ tabs, value, onChange, label, id }: TabsProps) => {
  const reduced = useReducedMotion();
  // The indicator lives inside the active tab. When the tab changes, a view
  // transition morphs it from the old tab to the new one with the spring easing.
  const change = (i: number) => {
    const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
    if (reduced || !doc.startViewTransition) {
      onChange(i);
      return;
    }
    doc.startViewTransition(() => flushSync(() => onChange(i)));
  };
  const { tabProps } = useTabs(tabs.length, value, change);
  const name = `tabs-${id.replace(/[^a-z0-9-]/gi, "")}`;
  return (
    <>
      <style>{`::view-transition-group(${name}){animation-duration:${SPRINGS.settle.durationMs}ms;animation-timing-function:${SPRINGS.settle.easing}}`}</style>
      <div role="tablist" aria-label={label} className={`flex gap-6 border-b ${HAIRLINE}`}>
        {tabs.map((tab, i) => (
          <button
            key={tab}
            type="button"
            {...tabProps(i, id)}
            className={`relative -mb-px pb-2.5 pt-1 text-[13px] tracking-[0.01em] ${FOCUS} ${i === value ? "text-white" : "text-white/45 hover:text-white/75"}`}
          >
            {tab}
            {i === value && (
              <span aria-hidden="true" style={{ viewTransitionName: name }} className="absolute inset-x-0 bottom-0 h-px bg-white" />
            )}
          </button>
        ))}
      </div>
    </>
  );
};

export const Slider = ({ value, onChange, label, min = 0, max = 100, step = 1, disabled }: SliderProps) => {
  const id = useId();
  const { fraction, trackRef, sliderProps, trackProps } = useSlider({ value, onChange, min, max, step, disabled });
  return (
    <div className={disabled ? "opacity-40" : ""}>
      <div className="mb-3 flex items-baseline justify-between text-[13px]">
        <span id={id} className="text-white/80">
          {label}
        </span>
        <span className="font-mono text-[12px] tabular-nums text-white/55">{value}</span>
      </div>
      {/* Precision doesn't spring: the thumb is exactly where the value is. */}
      <div ref={(el) => void (trackRef.current = el)} {...trackProps} className="relative h-5 cursor-pointer touch-none">
        <div className={`absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-white/[0.16]`} />
        <div className="absolute left-0 top-1/2 h-px -translate-y-1/2 bg-white" style={{ width: `${fraction * 100}%` }} />
        <div
          {...sliderProps}
          aria-labelledby={id}
          className={`absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-[#050505] ${FOCUS}`}
          style={{ left: `${fraction * 100}%` }}
        />
      </div>
    </div>
  );
};

export const Select = ({ value, onChange, options, label, disabled }: SelectProps) => {
  const labelId = useId();
  const { open, active, selected, buttonProps, listProps, optionProps } = useCombobox({ value, onChange, options, disabled });
  const motion = useSpring(["opacity", "transform", "visibility"], SPRINGS.settle);
  return (
    <div className="relative">
      <span id={labelId} className="mb-2 block text-[11px] uppercase tracking-[0.16em] text-white/45">
        {label}
      </span>
      <button
        {...buttonProps}
        aria-labelledby={labelId}
        className={`flex w-full items-center justify-between border-b pb-2 text-left text-[14px] text-white/90 disabled:opacity-40 ${FOCUS} ${open ? "border-white/70" : HAIRLINE}`}
      >
        {options[selected]?.label}
        <ChevronDown width="10" height="10" strokeWidth={1.2} absoluteStrokeWidth aria-hidden="true" style={{ ...motion, transform: `rotate(${open ? 180 : 0}deg)` }} />
      </button>
      <ul
        {...listProps}
        aria-labelledby={labelId}
        style={{ ...motion, opacity: open ? 1 : 0, transform: `translateY(${open ? 0 : -4}px)`, visibility: open ? "visible" : "hidden" }}
        className={`absolute inset-x-0 top-full z-20 mt-2 border ${HAIRLINE} bg-[#080808] py-1`}
      >
        {options.map((o, i) => (
          <li
            key={o.value}
            {...optionProps(i)}
            className={`flex cursor-pointer items-center justify-between px-3 py-2 text-[13px] ${i === active ? "bg-white/[0.07] text-white" : "text-white/65"}`}
          >
            {o.label}
            {i === selected && <span aria-hidden="true" className="h-1 w-1 rounded-full bg-white" />}
          </li>
        ))}
      </ul>
    </div>
  );
};

export const TextField = ({ value, onChange, label, type = "text", placeholder, error }: TextFieldProps) => {
  const id = useId();
  const fade = useSpring(["border-color"], SPRINGS.soft);
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-[11px] uppercase tracking-[0.16em] text-white/45">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        style={fade}
        className={`w-full border-b bg-transparent pb-2 text-[14px] text-white/90 placeholder:text-white/30 focus:outline-none ${
          error ? "border-[#ff9d8a]/80" : `${HAIRLINE} focus:border-white/80`
        }`}
      />
      {error && (
        <p id={`${id}-error`} className="mt-2 text-[12px] text-[#ffb4a6]">
          {error}
        </p>
      )}
    </div>
  );
};

export const Tooltip = ({ content, children }: TooltipProps) => {
  const { id, open, triggerProps } = useTooltip(300);
  // visibility is transitioned too, so a closed tooltip leaves the
  // accessibility tree once its fade ends, not just the eye.
  const motion = useSpring(["opacity", "transform", "visibility"], SPRINGS.soft);
  const { "aria-describedby": describedBy, ...handlers } = triggerProps;
  const child = isValidElement(children) ? cloneElement(children as ReactElement<Record<string, unknown>>, { "aria-describedby": describedBy }) : children;
  return (
    <span className="relative inline-flex" {...handlers}>
      {child}
      <span
        id={id}
        role="tooltip"
        style={{ ...motion, opacity: open ? 1 : 0, transform: `translate(-50%, ${open ? 0 : 3}px)`, visibility: open ? "visible" : "hidden" }}
        className={`pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 whitespace-nowrap border ${HAIRLINE} bg-[#0a0a0a] px-2 py-1 text-[11px] text-white/85`}
      >
        {content}
      </span>
    </span>
  );
};

export const Button = ({ children, onClick, variant = "primary", disabled, type = "button" }: ButtonProps) => {
  const press = useSpring(["transform", "background-color"], SPRINGS.settle);
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={press}
      className={`h-9 rounded-md px-4 text-[13px] tracking-[0.01em] active:scale-[0.98] disabled:opacity-40 ${FOCUS} ${
        variant === "primary" ? "bg-white text-[#050505] hover:bg-white/90" : `border ${HAIRLINE} text-white/80 hover:border-white/40 hover:text-white`
      }`}
    >
      {children}
    </button>
  );
};
