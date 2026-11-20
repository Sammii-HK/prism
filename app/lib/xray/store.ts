"use client";
import { useSyncExternalStore } from "react";
import { simulateReducedMotion } from "../hooks/reduced-motion";

/**
 * X-ray mode state: whether it is on, and which layers are drawn.
 *
 * A tiny external store (like the attention source) so the nav toggle, the
 * panel and the overlay share one value without a provider. The choice is
 * remembered per viewer, and `?xray=1` opens a page with it on, so a link can
 * show someone the craft directly.
 */

export type XrayLayer = "attention" | "springs" | "targets" | "focus" | "roles" | "contrast";

export const LAYERS: Array<{ id: XrayLayer; label: string; hint: string }> = [
  { id: "attention", label: "Attention", hint: "The point every component reacts to, and which input is driving it" },
  { id: "springs", label: "Springs", hint: "Live traces of everything a spring is moving, with overshoot and settle time" },
  { id: "targets", label: "Hit targets", hint: "Every interactive element and its size; under 24px is flagged" },
  { id: "focus", label: "Focus order", hint: "The keyboard tab sequence, numbered and joined up" },
  { id: "roles", label: "Roles", hint: "The role and accessible name a screen reader announces" },
  { id: "contrast", label: "Contrast", hint: "Text contrast under the attention point, against WCAG AA and AAA" },
];

export type XrayState = {
  on: boolean;
  layers: Record<XrayLayer, boolean>;
  reducedMotion: boolean;
};

const DEFAULT_LAYERS: Record<XrayLayer, boolean> = {
  attention: true,
  springs: true,
  targets: true,
  focus: false,
  roles: false,
  contrast: true,
};

const STORAGE_KEY = "prism:xray";

let state: XrayState = { on: false, layers: DEFAULT_LAYERS, reducedMotion: false };
const listeners = new Set<() => void>();
let hydrated = false;

const save = () => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage can be unavailable (private mode, blocked site data); the mode still works.
  }
};

const set = (next: XrayState) => {
  state = next;
  // Reduced motion is only simulated while X-ray is on, so leaving X-ray
  // never leaves the site stuck in a state the visitor did not choose.
  simulateReducedMotion(state.on && state.reducedMotion ? true : null);
  save();
  listeners.forEach((notify) => notify());
};

const hydrate = () => {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  let restored: Partial<XrayState> = {};
  try {
    restored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    restored = {};
  }
  const param = new URLSearchParams(window.location.search).get("xray");
  state = {
    on: param === "1" ? true : param === "0" ? false : Boolean(restored.on),
    layers: { ...DEFAULT_LAYERS, ...(restored.layers ?? {}) },
    reducedMotion: Boolean(restored.reducedMotion),
  };
  simulateReducedMotion(state.on && state.reducedMotion ? true : null);

  // ⌥X / Alt+X toggles from anywhere. A modifier keeps it clear of typing
  // and of WCAG 2.1.4 (single-character shortcuts).
  window.addEventListener("keydown", (e) => {
    if (!e.altKey || e.metaKey || e.ctrlKey || e.code !== "KeyX") return;
    e.preventDefault();
    toggleXray();
  });
};

const subscribe = (notify: () => void) => {
  hydrate();
  listeners.add(notify);
  return () => {
    listeners.delete(notify);
  };
};

const SERVER_STATE: XrayState = { on: false, layers: DEFAULT_LAYERS, reducedMotion: false };

/** The X-ray state as a React value. Off on the server, so first paint matches. */
export const useXray = (): XrayState =>
  useSyncExternalStore(subscribe, () => state, () => SERVER_STATE);

/** The current state, for rAF loops. */
export const getXray = (): XrayState => state;

export const toggleXray = (on = !state.on) => set({ ...state, on });

export const toggleLayer = (layer: XrayLayer) =>
  set({ ...state, layers: { ...state.layers, [layer]: !state.layers[layer] } });

export const toggleSimulatedReducedMotion = () => set({ ...state, reducedMotion: !state.reducedMotion });
