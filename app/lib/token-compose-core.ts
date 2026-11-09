// Pure logic for the token-compose experiment. No React, no DOM, so it can be
// run by node's built-in test runner (see scripts/token-compose.test.ts).
// The explicit .ts extension is what lets node load this file directly.
import { pastelColour } from "./primitives/gradient.ts";

/* ------------------------------------------------------------------ */
/* The closed vocabulary                                                */
/* ------------------------------------------------------------------ */

/** Spacing steps in px, used for padding and gaps. */
export const SPACING_STEPS = [4, 8, 12, 16, 24, 32] as const;
/** Corner radii in px. */
export const RADII = [0, 6, 12, 16, 24] as const;
/** Type sizes in px. Titles use the top three, body text the bottom three. */
export const TYPE_SIZES = [12, 14, 16, 20, 24, 32] as const;
export const TITLE_SIZES = [20, 24, 32] as const;
export const BODY_SIZES = [12, 14, 16] as const;
export const LAYOUTS = ["stack", "split", "grid"] as const;
export const BLOCK_COUNTS = [1, 2, 3, 4] as const;

/**
 * Palette: pastelColour() from the gradient primitives, sampled at fixed
 * cursor positions with t = 0. Whatever the primitive returns at those
 * positions is the colour; nothing is typed in by hand. The one neutral,
 * ink, is Prism's page background (#050505, from CLAUDE.md) and does NOT come
 * from the primitives.
 */
export const PALETTE_ANCHORS = [
  { name: "lilac", x: 0, y: 0 },
  { name: "rose", x: 100, y: 0 },
  { name: "mint", x: 0, y: 100 },
  { name: "sky", x: 100, y: 100 },
  { name: "peach", x: 60, y: 30 },
  { name: "sage", x: 30, y: 70 },
] as const;

export const rgbString = (c: { r: number; g: number; b: number }) => `rgb(${c.r} ${c.g} ${c.b})`;

export const INK = "rgb(5 5 5)";
export const PASTELS: readonly string[] = PALETTE_ANCHORS.map((a) => rgbString(pastelColour(a.x, a.y, 0)));
export const PALETTE: readonly string[] = [...PASTELS, INK];

/* ------------------------------------------------------------------ */
/* Compositions                                                         */
/* ------------------------------------------------------------------ */

export type Layout = (typeof LAYOUTS)[number];

export interface Composition {
  seed: number;
  layout: Layout;
  blocks: number;
  card: { padding: number; gap: number; radius: number; background: string };
  title: { size: number; colour: string };
  body: { size: number; colour: string };
  chip: { padding: number; radius: number; background: string };
}

/** mulberry32: small, seedable, deterministic. */
export const makeRng = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/**
 * Builds a card layout from the vocabulary only. Ink text is always placed on
 * a pastel surface, so legibility comes from construction, not from checking.
 */
export const compose = (seed: number): Composition => {
  const rng = makeRng(seed);
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)];
  const surface = pick(PASTELS);
  const chipSurface = pick(PASTELS.filter((p) => p !== surface));
  return {
    seed,
    layout: pick(LAYOUTS),
    blocks: pick(BLOCK_COUNTS),
    card: { padding: pick(SPACING_STEPS), gap: pick(SPACING_STEPS), radius: pick(RADII), background: surface },
    title: { size: pick(TITLE_SIZES), colour: INK },
    body: { size: pick(BODY_SIZES), colour: INK },
    chip: { padding: pick(SPACING_STEPS), radius: pick(RADII), background: chipSurface },
  };
};

/* ------------------------------------------------------------------ */
/* The validator                                                        */
/* ------------------------------------------------------------------ */

export type RuleId = "spacing-scale" | "radius-scale" | "type-scale" | "palette" | "layout" | "block-count" | "unknown-property" | "missing-value";

export interface Violation {
  path: string;
  value: unknown;
  rule: RuleId;
  /** Human-readable statement of the rule that was broken. */
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  /** How many values were looked at. */
  checked: number;
  violations: Violation[];
}

const list = (xs: readonly (string | number)[]) => xs.join(", ");

const RULES: Record<Exclude<RuleId, "unknown-property" | "missing-value">, { allowed: readonly (string | number)[]; message: string }> = {
  "spacing-scale": { allowed: SPACING_STEPS, message: `spacing must be one of ${list(SPACING_STEPS)} (px)` },
  "radius-scale": { allowed: RADII, message: `radius must be one of ${list(RADII)} (px)` },
  "type-scale": { allowed: TYPE_SIZES, message: `type size must be one of ${list(TYPE_SIZES)} (px)` },
  palette: { allowed: PALETTE, message: `colour must be one of the ${PALETTE.length} palette colours (${PALETTE.length - 1} from pastelColour, plus ink)` },
  layout: { allowed: LAYOUTS, message: `layout must be one of ${list(LAYOUTS)}` },
  "block-count": { allowed: BLOCK_COUNTS, message: `block count must be one of ${list(BLOCK_COUNTS)}` },
};

type Checked = Exclude<RuleId, "unknown-property" | "missing-value">;

/** Every value a composition is allowed to carry, and the rule that governs it. */
export const SCHEMA: ReadonlyArray<readonly [path: string, rule: Checked]> = [
  ["layout", "layout"],
  ["blocks", "block-count"],
  ["card.padding", "spacing-scale"],
  ["card.gap", "spacing-scale"],
  ["card.radius", "radius-scale"],
  ["card.background", "palette"],
  ["title.size", "type-scale"],
  ["title.colour", "palette"],
  ["body.size", "type-scale"],
  ["body.colour", "palette"],
  ["chip.padding", "spacing-scale"],
  ["chip.radius", "radius-scale"],
  ["chip.background", "palette"],
];

const ALLOWED_KEYS: Record<string, readonly string[]> = {
  "": ["seed", "layout", "blocks", "card", "title", "body", "chip"],
  card: ["padding", "gap", "radius", "background"],
  title: ["size", "colour"],
  body: ["size", "colour"],
  chip: ["padding", "radius", "background"],
};

const read = (obj: unknown, path: string): unknown => {
  let cur: unknown = obj;
  for (const k of path.split(".")) {
    if (cur === null || typeof cur !== "object" || !(k in (cur as object))) return undefined;
    cur = (cur as Record<string, unknown>)[k];
  }
  return cur;
};

/**
 * Accepts anything and rejects every value that is not exactly in the token
 * set. Strict equality: "16" is not 16, 16.0001 is not 16, NaN is nothing.
 * It checks membership only. It does not judge taste, contrast or hierarchy.
 */
export const validateComposition = (input: unknown): ValidationResult => {
  const violations: Violation[] = [];
  let checked = 0;

  for (const [path, rule] of SCHEMA) {
    const value = read(input, path);
    checked++;
    if (value === undefined) {
      violations.push({ path, value, rule: "missing-value", message: `${path} is required` });
    } else if (!RULES[rule].allowed.includes(value as string | number)) {
      violations.push({ path, value, rule, message: RULES[rule].message });
    }
  }

  for (const [scope, keys] of Object.entries(ALLOWED_KEYS)) {
    const node = scope === "" ? input : read(input, scope);
    if (node === null || typeof node !== "object") continue;
    for (const k of Object.keys(node)) {
      if (!keys.includes(k)) {
        const path = scope ? `${scope}.${k}` : k;
        checked++;
        violations.push({ path, value: (node as Record<string, unknown>)[k], rule: "unknown-property", message: `${path} is not a property the system defines` });
      }
    }
  }

  return { ok: violations.length === 0, checked, violations };
};

/* ------------------------------------------------------------------ */
/* Batches and injection                                                */
/* ------------------------------------------------------------------ */

export interface Batch {
  startSeed: number;
  count: number;
  compositions: Composition[];
  /** Total values the validator looked at across the whole batch. */
  valuesChecked: number;
  /** Total violations found across the whole batch. */
  outside: number;
  firstViolation: Violation | null;
}

/** Generates `count` compositions from consecutive seeds and runs the validator over every one. */
export const runBatch = (startSeed: number, count: number): Batch => {
  const compositions: Composition[] = [];
  let valuesChecked = 0;
  let outside = 0;
  let firstViolation: Violation | null = null;
  for (let i = 0; i < count; i++) {
    const c = compose(startSeed + i);
    const r = validateComposition(c);
    compositions.push(c);
    valuesChecked += r.checked;
    outside += r.violations.length;
    if (!firstViolation && r.violations[0]) firstViolation = r.violations[0];
  }
  return { startSeed, count, compositions, valuesChecked, outside, firstViolation };
};

export type InjectKind = "spacing" | "radius" | "type" | "colour" | "layout";
export const INJECT_KINDS: readonly InjectKind[] = ["spacing", "radius", "type", "colour", "layout"];

/** Off-token values, each chosen to sit outside its set. */
export const OFF_TOKEN: Record<InjectKind, { path: string; value: string | number }> = {
  spacing: { path: "card.padding", value: 13 },
  radius: { path: "card.radius", value: 10 },
  type: { path: "title.size", value: 17 },
  colour: { path: "card.background", value: "rgb(255 0 128)" },
  layout: { path: "layout", value: "masonry" },
};

/** A copy of `c` with one value swapped for an off-token one. */
export const injectOffToken = (c: Composition, kind: InjectKind): Composition => {
  const { path, value } = OFF_TOKEN[kind];
  const copy = structuredClone(c) as unknown as Record<string, unknown>;
  const keys = path.split(".");
  let node = copy;
  for (const k of keys.slice(0, -1)) node = node[k] as Record<string, unknown>;
  node[keys[keys.length - 1]] = value;
  return copy as unknown as Composition;
};

export const formatValue = (v: unknown): string => (typeof v === "string" ? JSON.stringify(v) : v === undefined ? "undefined" : String(v));
