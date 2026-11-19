// Pure logic for the spring-field experiment. No React, no DOM, so node's
// built-in test runner can load it (see scripts/spring-field.test.ts).

export interface SpringParams {
  /** k, in 1/s^2 per unit mass when mass is 1. */
  stiffness: number;
  /** c, the damping coefficient. */
  damping: number;
  mass: number;
}

export interface SpringState {
  x: number;
  v: number;
}

/** Damping ratio: c / (2 * sqrt(k * m)). Below 1 the spring overshoots, at 1 it does not, above 1 it creeps. */
export const dampingRatio = ({ stiffness, damping, mass }: SpringParams): number =>
  damping / (2 * Math.sqrt(stiffness * mass));

/** The damping coefficient that gives a damping ratio of exactly `zeta` for this stiffness and mass. */
export const dampingForRatio = (zeta: number, stiffness: number, mass: number): number =>
  zeta * 2 * Math.sqrt(stiffness * mass);

export type Regime = "underdamped" | "critically damped" | "overdamped";

export const regimeOf = (zeta: number, tolerance = 0.005): Regime =>
  zeta < 1 - tolerance ? "underdamped" : zeta > 1 + tolerance ? "overdamped" : "critically damped";

/** Undamped natural frequency, radians per second. */
export const naturalFrequency = ({ stiffness, mass }: SpringParams): number => Math.sqrt(stiffness / mass);

/**
 * The textbook fraction of the initial displacement by which a damped spring
 * overshoots its rest point on the first swing: exp(-pi * zeta / sqrt(1 - zeta^2)).
 * Zero when zeta >= 1, because those springs do not cross the rest point.
 */
export const predictedOvershoot = (zeta: number): number =>
  zeta >= 1 || zeta < 0 ? 0 : Math.exp((-Math.PI * zeta) / Math.sqrt(1 - zeta * zeta));

/** Fixed internal step, in seconds. A frame is cut into steps of at most this size so stiff springs stay stable. */
export const SUBSTEP = 1 / 240;

/**
 * Advance one spring toward `target` by `dt` seconds, using semi-implicit
 * Euler in fixed substeps. Deterministic for a given dt.
 */
export const stepSpring = (s: SpringState, target: number, p: SpringParams, dt: number): SpringState => {
  let { x, v } = s;
  let left = dt;
  while (left > 1e-9) {
    const h = Math.min(SUBSTEP, left);
    const a = (-p.stiffness * (x - target) - p.damping * v) / p.mass;
    v += a * h;
    x += v * h;
    left -= h;
  }
  return { x, v };
};

/** True when a spring is close enough to rest that stepping it further changes nothing a person can see. */
export const isAtRest = (s: SpringState, target: number, posEps = 0.05, velEps = 0.05): boolean =>
  Math.abs(s.x - target) < posEps && Math.abs(s.v) < velEps;

export interface Release {
  /** Seconds from release until the spring is at rest (position and velocity both under their thresholds), or null if it did not settle in `maxSeconds`. */
  settleSeconds: number | null;
  /** Peak excursion on the far side of rest, as a fraction of the starting displacement. 0 means no overshoot. */
  overshoot: number;
}

/**
 * Release a spring from `x0` (rest is 0) at zero velocity and measure what it
 * does. This is the function the UI's "measured" numbers use, and the one the
 * tests compare against the closed-form prediction.
 */
export const simulateRelease = (p: SpringParams, x0 = 100, dt = 1 / 60, maxSeconds = 20): Release => {
  let s: SpringState = { x: x0, v: 0 };
  let t = 0;
  let worst = 0;
  while (t < maxSeconds) {
    s = stepSpring(s, 0, p, dt);
    t += dt;
    worst = Math.min(worst, (s.x * Math.sign(x0)) / Math.abs(x0));
    if (isAtRest(s, 0)) return { settleSeconds: t, overshoot: -worst };
  }
  return { settleSeconds: null, overshoot: -worst };
};

/* ------------------------------------------------------------------ */
/* The field                                                            */
/* ------------------------------------------------------------------ */

export interface Vec {
  x: number;
  y: number;
}

/** Smooth falloff: 1 at the pointer, 0 at and beyond `radius`, eased so there is no visible edge. */
export const falloff = (distance: number, radius: number): number => {
  if (radius <= 0 || distance >= radius) return 0;
  const k = 1 - distance / radius;
  return k * k;
};

/**
 * Where a grid element's spring should aim, relative to its rest position.
 * `repel` pushes it away from the pointer, `attract` pulls it toward the
 * pointer. The pull is capped so an element never jumps past the pointer.
 */
export const fieldTarget = (
  rest: Vec,
  pointer: Vec | null,
  radius: number,
  strength: number,
  mode: "repel" | "attract"
): Vec => {
  if (!pointer) return { x: 0, y: 0 };
  const dx = rest.x - pointer.x;
  const dy = rest.y - pointer.y;
  const d = Math.hypot(dx, dy);
  const f = falloff(d, radius);
  if (f === 0) return { x: 0, y: 0 };
  if (d < 1e-6) return { x: 0, y: 0 };
  const push = strength * f;
  if (mode === "repel") return { x: (dx / d) * push, y: (dy / d) * push };
  const pull = Math.min(push, d);
  return { x: (-dx / d) * pull, y: (-dy / d) * pull };
};

export interface GridSpec {
  cols: number;
  rows: number;
  gap: number;
}

export const gridPoints = ({ cols, rows, gap }: GridSpec): Vec[] => {
  const out: Vec[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push({ x: gap / 2 + c * gap, y: gap / 2 + r * gap });
  return out;
};

/** How many columns and rows of `gap` fit in a box. At least 1 each. */
export const gridFor = (width: number, height: number, gap: number): GridSpec => ({
  cols: Math.max(1, Math.floor(width / gap)),
  rows: Math.max(1, Math.floor(height / gap)),
  gap,
});

export interface FieldStats {
  /** Elements further than `threshold` px from rest. */
  displaced: number;
  maxOffset: number;
  meanOffset: number;
}

export const fieldStats = (offsets: Vec[], threshold = 0.5): FieldStats => {
  let displaced = 0;
  let max = 0;
  let sum = 0;
  for (const o of offsets) {
    const m = Math.hypot(o.x, o.y);
    sum += m;
    if (m > max) max = m;
    if (m > threshold) displaced++;
  }
  return { displaced, maxOffset: max, meanOffset: offsets.length ? sum / offsets.length : 0 };
};

/** Pointer for keyboard use: arrow keys move a probe by `step` px, clamped to the box. Null for any other key. */
export const probeMove = (p: Vec, key: string, step: number, w: number, h: number): Vec | null => {
  const clamp = (n: number, hi: number) => Math.max(0, Math.min(hi, n));
  switch (key) {
    case "ArrowLeft": return { x: clamp(p.x - step, w), y: p.y };
    case "ArrowRight": return { x: clamp(p.x + step, w), y: p.y };
    case "ArrowUp": return { x: p.x, y: clamp(p.y - step, h) };
    case "ArrowDown": return { x: p.x, y: clamp(p.y + step, h) };
    default: return null;
  }
};
