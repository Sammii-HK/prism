/**
 * Compile a spring into CSS.
 *
 * Luminous runs its springs in JavaScript every frame. Reserved uses the
 * same constants, but simulates them once, here, and hands the browser a
 * CSS `linear()` easing that traces the exact same curve, overshoot
 * included. The browser then animates on the compositor with no script.
 * The hand-tuned stiffness and damping stay the single source of truth.
 */

export type CompiledSpring = {
  /** A CSS `linear()` easing function. */
  easing: string;
  /** How long the spring takes to settle, in ms; use as the transition duration. */
  durationMs: number;
  /** Peak overshoot past the target, as a fraction of the travel. */
  overshoot: number;
};

const cache = new Map<string, CompiledSpring>();

/**
 * Simulate a unit spring from 0 to 1 with the same integrator the Luminous
 * components use (semi-implicit Euler, mass 1, 60 steps a second) and sample
 * it into a `linear()` easing.
 */
export const compileSpring = (stiffness: number, damping: number, points = 40): CompiledSpring => {
  const key = `${stiffness}:${damping}:${points}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const dt = 1 / 60;
  let pos = 0;
  let vel = 0;
  const trace: number[] = [0];
  let peak = 0;
  // Run until the spring is within 0.1% of rest and nearly still, capped at 3s.
  for (let i = 0; i < 180; i++) {
    const acc = stiffness * (1 - pos) - damping * vel;
    vel += acc * dt;
    pos += vel * dt;
    trace.push(pos);
    peak = Math.max(peak, pos);
    if (Math.abs(1 - pos) < 0.001 && Math.abs(vel) < 0.01) break;
  }
  trace[trace.length - 1] = 1;

  const step = (trace.length - 1) / (points - 1);
  const stops: string[] = [];
  for (let i = 0; i < points; i++) {
    const v = trace[Math.min(trace.length - 1, Math.round(i * step))];
    stops.push(String(Math.round(v * 10000) / 10000));
  }

  const compiled = {
    easing: `linear(${stops.join(", ")})`,
    durationMs: Math.round((trace.length - 1) * dt * 1000),
    overshoot: Math.max(0, peak - 1),
  };
  cache.set(key, compiled);
  return compiled;
};

/** Prism's two shared springs, by the constants the Luminous components use. */
export const SPRINGS = {
  /** Thumbs, indicators, panels: k 180, d 22. */
  settle: compileSpring(180, 22),
  /** Glows and fades: k 120, d 18. */
  soft: compileSpring(120, 18),
};

/** A CSS transition shorthand for a compiled spring, honouring reduced motion via the caller. */
export const springTransition = (properties: string[], spring: CompiledSpring = SPRINGS.settle) =>
  properties.map((p) => `${p} ${spring.durationMs}ms ${spring.easing}`).join(", ");
