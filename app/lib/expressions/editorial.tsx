"use client";
import { ArrowDown } from "lucide-react";
import { cloneElement, isValidElement, useId, type ReactElement } from "react";
import { useTabs, useTooltip } from "../core/behaviour";
import type { ButtonProps, CheckboxProps, SelectProps, SliderProps, SwitchProps, TabsProps, TextFieldProps, TooltipProps } from "../core/contract";

/**
 * Editorial: the platform itself.
 *
 * Wherever HTML has the control, this expression uses it: a real checkbox
 * with role="switch", a native range, a native select, real labels. The
 * browser supplies the keyboard behaviour, and CSS supplies everything
 * else. No easing anywhere: a state change is instant and absolute. Type is
 * bold, edges are square, rules are 2px, and text meets AAA contrast.
 */

const RULE = "border-2 border-white";
const FOCUS = "focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-[3px] focus-visible:outline-white";
const LABEL = "font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-white";

export const Switch = ({ checked, onChange, label, disabled }: SwitchProps) => {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4">
      <label htmlFor={id} className={`${LABEL} ${disabled ? "opacity-50" : ""}`}>
        {label}
      </label>
      {/* A native checkbox announced as a switch; the thumb is a background, so nothing animates. */}
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className={`h-6 w-11 shrink-0 cursor-pointer appearance-none ${RULE} bg-[#050505] bg-[length:16px_16px] bg-[position:2px_2px] bg-no-repeat bg-[linear-gradient(#fff,#fff)] checked:bg-white checked:bg-[position:22px_2px] checked:bg-[linear-gradient(#050505,#050505)] disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`}
      />
    </div>
  );
};

export const Checkbox = ({ checked, onChange, label, disabled }: CheckboxProps) => (
  <label className={`flex cursor-pointer items-center gap-3 ${LABEL} ${disabled ? "cursor-not-allowed opacity-50" : ""}`}>
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
      className={`h-5 w-5 shrink-0 cursor-pointer appearance-none ${RULE} bg-[#050505] bg-center bg-no-repeat checked:bg-white checked:bg-[url("data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2012%2012'%3E%3Cpath%20d='M2%206.5l2.5%202.5L10%203'%20stroke='%23050505'%20stroke-width='2.2'%20fill='none'%20stroke-linecap='square'/%3E%3C/svg%3E")] ${FOCUS}`}
    />
    {label}
  </label>
);

export const Tabs = ({ tabs, value, onChange, label, id }: TabsProps) => {
  // HTML has no native tabs, so this one uses the shared behaviour hook.
  const { tabProps } = useTabs(tabs.length, value, onChange);
  return (
    <div role="tablist" aria-label={label} className={`grid ${RULE}`} style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
      {tabs.map((tab, i) => (
        <button
          key={tab}
          type="button"
          {...tabProps(i, id)}
          className={`h-10 border-white font-mono text-[11px] font-bold uppercase tracking-[0.14em] [&:not(:first-child)]:border-l-2 ${FOCUS} focus-visible:outline-offset-[-6px] ${
            i === value ? "bg-white text-[#050505]" : "bg-[#050505] text-white hover:underline hover:underline-offset-4"
          }`}
        >
          {tab}
        </button>
      ))}
    </div>
  );
};

export const Slider = ({ value, onChange, label, min = 0, max = 100, step = 1, disabled }: SliderProps) => {
  const id = useId();
  return (
    <div className={disabled ? "opacity-50" : ""}>
      <div className="mb-3 flex items-baseline justify-between">
        <label htmlFor={id} className={LABEL}>
          {label}
        </label>
        <output htmlFor={id} className="font-mono text-[13px] font-bold tabular-nums text-white">
          {String(value).padStart(3, "0")}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`editorial-range w-full cursor-pointer ${FOCUS}`}
      />
    </div>
  );
};

export const Select = ({ value, onChange, options, label, disabled }: SelectProps) => {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className={`mb-2 block ${LABEL}`}>
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className={`h-11 w-full cursor-pointer appearance-none rounded-none ${RULE} bg-[#050505] px-3 pr-10 text-[14px] font-bold text-white disabled:opacity-50 ${FOCUS}`}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 grid w-10 place-items-center border-l-2 border-white font-mono text-[12px] font-bold text-white">
          <ArrowDown size={14} strokeWidth={2.75} strokeLinecap="square" strokeLinejoin="miter" aria-hidden="true" className="inline-block align-middle" />
        </span>
      </div>
    </div>
  );
};

export const TextField = ({ value, onChange, label, type = "text", placeholder, error }: TextFieldProps) => {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className={`mb-2 block ${LABEL}`}>
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
        className={`h-11 w-full rounded-none ${RULE} bg-[#050505] px-3 text-[14px] font-bold text-white placeholder:font-normal placeholder:text-white/60 focus:outline-none focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-[3px] focus-visible:outline-white`}
      />
      {error && (
        <p id={`${id}-error`} className="mt-0 border-2 border-t-0 border-white bg-white px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-[#050505]">
          {error}
        </p>
      )}
    </div>
  );
};

export const Tooltip = ({ content, children }: TooltipProps) => {
  const { id, open, triggerProps } = useTooltip(0);
  const { "aria-describedby": describedBy, ...handlers } = triggerProps;
  const child = isValidElement(children) ? cloneElement(children as ReactElement<Record<string, unknown>>, { "aria-describedby": describedBy }) : children;
  return (
    <span className="relative inline-flex" {...handlers}>
      {child}
      <span
        id={id}
        role="tooltip"
        hidden={!open}
        className="pointer-events-none absolute bottom-full left-0 z-30 mb-1 whitespace-nowrap border-2 border-white bg-white px-2 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-[#050505]"
      >
        {content}
      </span>
    </span>
  );
};

export const Button = ({ children, onClick, variant = "primary", disabled, type = "button" }: ButtonProps) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled}
    className={`h-11 ${RULE} px-5 font-mono text-[12px] font-bold uppercase tracking-[0.14em] shadow-[4px_4px_0_0_#fff] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none disabled:opacity-50 ${FOCUS} ${
      variant === "primary" ? "bg-white text-[#050505]" : "bg-[#050505] text-white"
    }`}
  >
    {children}
  </button>
);
