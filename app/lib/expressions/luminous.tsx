"use client";
import { GlowCheckbox } from "../components/glow-checkbox";
import { GlowInput } from "../components/glow-input";
import { GlowSelect } from "../components/glow-select";
import { GlowSlider } from "../components/glow-slider";
import { MorphTabs } from "../components/morph-tabs";
import { RippleButton } from "../components/ripple-button";
import { SpringToggle } from "../components/spring-toggle";
import { Tooltip as LuminousTooltip } from "../components/tooltip";
import type { ButtonProps, CheckboxProps, SelectProps, SliderProps, SwitchProps, TabsProps, TextFieldProps, TooltipProps } from "../core/contract";
import { useId } from "react";

/**
 * Luminous: the original Prism components, adapted to the shared API.
 * These are thin adapters only. The components, and every spring and colour
 * value in them, are untouched.
 */

export const Switch = ({ checked, onChange, label, disabled }: SwitchProps) => {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4">
      <span id={id} className="text-sm text-white/75">
        {label}
      </span>
      <SpringToggle checked={checked} onChange={onChange} disabled={disabled} aria-labelledby={id} />
    </div>
  );
};

export const Checkbox = (props: CheckboxProps) => <GlowCheckbox {...props} />;

export const Tabs = ({ tabs, value, onChange, label, id }: TabsProps) => (
  <MorphTabs tabs={tabs} activeIndex={value} onChange={onChange} ariaLabel={label} idPrefix={id} />
);

export const Slider = ({ value, onChange, label, min, max, step, disabled }: SliderProps) => (
  <GlowSlider value={value} onChange={onChange} label={label} min={min} max={max} step={step} disabled={disabled} showValue />
);

export const Select = (props: SelectProps) => <GlowSelect {...props} />;

export const TextField = ({ value, onChange, label, type, placeholder, error }: TextFieldProps) => (
  <GlowInput value={value} onChange={onChange} label={label} type={type} placeholder={placeholder} error={error} />
);

export const Tooltip = ({ content, children }: TooltipProps) => <LuminousTooltip content={content}>{children}</LuminousTooltip>;

export const Button = ({ children, onClick, variant = "primary", disabled, type = "button" }: ButtonProps) => (
  <RippleButton type={type} onClick={onClick} disabled={disabled} glowOnHover={variant === "primary"}>
    {children}
  </RippleButton>
);
