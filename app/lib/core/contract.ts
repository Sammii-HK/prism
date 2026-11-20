import type { ReactNode } from "react";

/**
 * The shared API. Every expression implements exactly these props, so a
 * product written against them can change its whole visual and motion
 * language without touching a line of product code.
 *
 * The behaviour each one promises (roles, keys, focus) is written down
 * beside it, and the contract tests in `tests/contract.spec.ts` hold every
 * expression to it.
 */

/** role="switch"; Space and Enter toggle; aria-checked mirrors state. */
export type SwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Visible label. Names the switch. */
  label: string;
  disabled?: boolean;
};

/** A real checkbox; Space toggles; the label is clickable and names it. */
export type CheckboxProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
};

/**
 * role="tablist" of role="tab"s; one tab stop (roving tabindex); Left/Right
 * move and select; Home/End jump; aria-selected and aria-controls wired.
 */
export type TabsProps = {
  tabs: string[];
  value: number;
  onChange: (index: number) => void;
  label: string;
  /** Ids are `${id}-tab-${i}` and `${id}-panel-${i}`, so the page can render role="tabpanel". */
  id: string;
};

/**
 * role="slider" with aria-valuenow/min/max; arrows step; Page Up/Down step
 * by 10%; Home/End jump; pointer drags land exactly where you put them.
 */
export type SliderProps = {
  value: number;
  onChange: (value: number) => void;
  label: string;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
};

/**
 * A select. Opens with Enter, Space or Alt+Down; arrows move; Enter picks;
 * Escape closes and returns focus. Native or ARIA combobox are both valid.
 */
export type SelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  label: string;
  disabled?: boolean;
};

/** A labelled text input; an error is announced and linked with aria-describedby. */
export type TextFieldProps = {
  value: string;
  onChange: (value: string) => void;
  label: string;
  type?: "text" | "email" | "search" | "url";
  placeholder?: string;
  error?: string;
};

/**
 * A description that appears on hover (after a delay) and on keyboard focus
 * (at once), closes on Escape, and is linked with aria-describedby.
 */
export type TooltipProps = {
  content: string;
  /** One focusable element. */
  children: ReactNode;
};

/** A native <button>. */
export type ButtonProps = {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "quiet";
  disabled?: boolean;
  type?: "button" | "submit";
};
