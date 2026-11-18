"use client";
import { useSyncExternalStore } from "react";

/**
 * Which expression of the library is showing.
 *
 * Prism's components share one API and one behaviour contract (keyboard,
 * roles, focus, state). An expression is a complete visual and motion
 * language on top of that contract, built with its own technique:
 *
 * - luminous: JavaScript physics. rAF springs and attention-mapped colour.
 * - reserved: native CSS motion. The same spring constants, compiled to
 *   CSS `linear()` easings; hairlines and type, almost no runtime JS.
 * - editorial: the platform itself. Native controls, a hard grid, AAA
 *   contrast and no easing at all.
 */
export type Expression = "luminous" | "reserved" | "editorial";

export const EXPRESSIONS: Array<{ id: Expression; label: string; technique: string; summary: string }> = [
  {
    id: "luminous",
    label: "Luminous",
    technique: "JavaScript physics",
    summary: "requestAnimationFrame springs tuned by eye, with colour mapped from wherever your attention is.",
  },
  {
    id: "reserved",
    label: "Reserved",
    technique: "Native CSS motion",
    summary: "The same spring constants compiled to CSS linear() easings. Hairlines, type and almost no runtime JavaScript.",
  },
  {
    id: "editorial",
    label: "Editorial",
    technique: "The platform itself",
    summary: "Native controls, a hard grid, AAA contrast and no easing: every state change is instant and absolute.",
  },
];

const STORAGE_KEY = "prism:expression";
const isExpression = (v: unknown): v is Expression => v === "luminous" || v === "reserved" || v === "editorial";

let current: Expression = "luminous";
let hydrated = false;
const listeners = new Set<() => void>();

const apply = () => {
  if (typeof document !== "undefined") document.documentElement.dataset.expression = current;
};

const hydrate = () => {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  const param = new URLSearchParams(window.location.search).get("expression");
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    stored = null;
  }
  current = isExpression(param) ? param : isExpression(stored) ? stored : "luminous";
  apply();
};

export const setExpression = (next: Expression) => {
  if (next === current) return;
  current = next;
  apply();
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Storage may be blocked; the switch still works for this visit.
  }
  listeners.forEach((notify) => notify());
};

const subscribe = (notify: () => void) => {
  hydrate();
  listeners.add(notify);
  return () => {
    listeners.delete(notify);
  };
};

/** The active expression. Luminous on the server, so first paint matches. */
export const useExpression = (): Expression =>
  useSyncExternalStore(subscribe, () => current, () => "luminous");
