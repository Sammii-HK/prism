"use client";
import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

let query: MediaQueryList | null = null;
const getQuery = () => {
  if (!query && typeof window !== "undefined") query = window.matchMedia(QUERY);
  return query;
};

/**
 * A simulated setting, used by X-ray mode so anyone can see what every
 * component does with reduced motion without changing their OS setting.
 * null means "follow the system".
 */
let simulated: boolean | null = null;
const simulationListeners = new Set<() => void>();

/** Override the system setting (true or false), or pass null to follow it again. */
export const simulateReducedMotion = (value: boolean | null) => {
  if (simulated === value) return;
  simulated = value;
  simulationListeners.forEach((notify) => notify());
};

/** Whether the reduced-motion setting is currently simulated rather than read from the system. */
export const reducedMotionSimulated = (): boolean => simulated !== null;

/**
 * Whether the user has asked for reduced motion, read live. Cheap enough to
 * call every frame inside a rAF loop, so the setting takes effect mid-animation.
 */
export const reducedMotionNow = (): boolean => simulated ?? getQuery()?.matches ?? false;

/**
 * Seconds to feed into time-based colour drift (`pastelColour`, `colourField`).
 * With reduced motion the clock stops, so colour still follows the user but no
 * longer drifts on its own.
 */
export const motionTime = (): number => (reducedMotionNow() ? 0 : performance.now() / 1000);

const subscribe = (notify: () => void) => {
  const q = getQuery();
  q?.addEventListener("change", notify);
  simulationListeners.add(notify);
  return () => {
    q?.removeEventListener("change", notify);
    simulationListeners.delete(notify);
  };
};

/** React hook for the same setting. The server snapshot is false, so first paint matches. */
export const useReducedMotion = (): boolean =>
  useSyncExternalStore(subscribe, reducedMotionNow, () => false);
