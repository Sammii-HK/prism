"use client";
import { createContext, useContext, type ReactNode } from "react";
import type { ButtonProps, CheckboxProps, SelectProps, SliderProps, SwitchProps, TabsProps, TextFieldProps, TooltipProps } from "../core/contract";
import * as editorial from "../expressions/editorial";
import * as luminous from "../expressions/luminous";
import * as reserved from "../expressions/reserved";
import { useExpression, type Expression } from "../expressions/store";

/**
 * Prism's public components. Write a product once against these, and it
 * renders in whichever expression is active: site-wide from the switcher,
 * or forced for one subtree with <ExpressionScope>.
 *
 * @example
 * <Switch label="Daily digest" checked={on} onChange={setOn} />
 * <ExpressionScope expression="editorial"><SettingsForm /></ExpressionScope>
 */

const IMPLEMENTATIONS = { luminous, reserved, editorial } as const;

const ScopeContext = createContext<Expression | null>(null);

/** Render everything inside in one expression, whatever the site is set to. */
export const ExpressionScope = ({ expression, children }: { expression: Expression; children: ReactNode }) => (
  <ScopeContext.Provider value={expression}>
    <div data-expression={expression}>{children}</div>
  </ScopeContext.Provider>
);

const useImplementation = () => {
  const scoped = useContext(ScopeContext);
  const global = useExpression();
  return IMPLEMENTATIONS[scoped ?? global];
};

export const Switch = (props: SwitchProps) => {
  const { Switch: Impl } = useImplementation();
  return <Impl {...props} />;
};
export const Checkbox = (props: CheckboxProps) => {
  const { Checkbox: Impl } = useImplementation();
  return <Impl {...props} />;
};
export const Tabs = (props: TabsProps) => {
  const { Tabs: Impl } = useImplementation();
  return <Impl {...props} />;
};
export const Slider = (props: SliderProps) => {
  const { Slider: Impl } = useImplementation();
  return <Impl {...props} />;
};
export const Select = (props: SelectProps) => {
  const { Select: Impl } = useImplementation();
  return <Impl {...props} />;
};
export const TextField = (props: TextFieldProps) => {
  const { TextField: Impl } = useImplementation();
  return <Impl {...props} />;
};
export const Tooltip = (props: TooltipProps) => {
  const { Tooltip: Impl } = useImplementation();
  return <Impl {...props} />;
};
export const Button = (props: ButtonProps) => {
  const { Button: Impl } = useImplementation();
  return <Impl {...props} />;
};

export type { Expression };
