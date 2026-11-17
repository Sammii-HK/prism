import { pastelColour } from "../../lib/primitives/gradient";

/**
 * The darkroom's grading pipeline. Pure functions, no React.
 *
 * Every tonal step (exposure, contrast, curves, split-tone) depends only on a
 * pixel's luminance, so they collapse into one 256-entry RGB lookup table.
 * Grading a frame is then a single pass: look up the colour, add grain,
 * apply the vignette, and (for t-shirt output) knock out the darks.
 */

export type CurvePoint = { x: number; y: number };

/** A point in Prism's pastel colour space, 0–100 on each axis. */
export type TintPoint = { x: number; y: number };

export type Grade = {
  /** Stops, −2 to +2. */
  exposure: number;
  /** −100 to 100. */
  contrast: number;
  /** Tone curve control points, 0–255 on both axes. */
  curve: CurvePoint[];
  shadowTint: TintPoint;
  highlightTint: TintPoint;
  /** Split-tone strength, 0–100. */
  toneStrength: number;
  /** Shifts where shadows end and highlights begin, −100 to 100. */
  toneBalance: number;
  /** 0–100. */
  grain: number;
  /** 0–100. */
  vignette: number;
  /** T-shirt knockout: luminance below this becomes transparent, 0–255. */
  threshold: number;
  /** Width of the soft edge on the knockout, 0–64. */
  feather: number;
};

export const NEUTRAL_CURVE: CurvePoint[] = [
  { x: 0, y: 0 },
  { x: 255, y: 255 },
];

export const DEFAULT_GRADE: Grade = {
  exposure: 0,
  contrast: 0,
  curve: NEUTRAL_CURVE,
  shadowTint: { x: 18, y: 70 },
  highlightTint: { x: 82, y: 30 },
  toneStrength: 0,
  toneBalance: 0,
  grain: 0,
  vignette: 0,
  threshold: 25,
  feather: 12,
};

const clamp255 = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/**
 * Curve lookup table by monotone cubic Hermite interpolation (Fritsch–Carlson):
 * passes through every point, never overshoots between them.
 * Ported from ScapeStudio's curves engine.
 */
export function curveLUT(points: CurvePoint[]): Float32Array {
  const lut = new Float32Array(256);
  const sorted = [...points].sort((a, b) => a.x - b.x);
  const n = sorted.length;
  if (n < 2) {
    for (let i = 0; i < 256; i++) lut[i] = i;
    return lut;
  }

  const dx: number[] = [];
  const slopes: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(sorted[i + 1].x - sorted[i].x);
    slopes.push(dx[i] === 0 ? 0 : (sorted[i + 1].y - sorted[i].y) / dx[i]);
  }

  const tangents: number[] = new Array(n);
  tangents[0] = slopes[0];
  tangents[n - 1] = slopes[n - 2];
  for (let i = 1; i < n - 1; i++) {
    tangents[i] =
      slopes[i - 1] * slopes[i] <= 0
        ? 0
        : (3 * (dx[i - 1] + dx[i])) / ((2 * dx[i] + dx[i - 1]) / slopes[i - 1] + (dx[i] + 2 * dx[i - 1]) / slopes[i]);
  }
  for (let i = 0; i < n - 1; i++) {
    if (Math.abs(slopes[i]) < 1e-10) {
      tangents[i] = 0;
      tangents[i + 1] = 0;
    } else {
      const a = tangents[i] / slopes[i];
      const b = tangents[i + 1] / slopes[i];
      const mag = a * a + b * b;
      if (mag > 9) {
        const tau = 3 / Math.sqrt(mag);
        tangents[i] = tau * a * slopes[i];
        tangents[i + 1] = tau * b * slopes[i];
      }
    }
  }

  let seg = 0;
  for (let x = 0; x < 256; x++) {
    if (x <= sorted[0].x) {
      lut[x] = clamp255(sorted[0].y);
      continue;
    }
    if (x >= sorted[n - 1].x) {
      lut[x] = clamp255(sorted[n - 1].y);
      continue;
    }
    while (seg < n - 2 && x > sorted[seg + 1].x) seg++;
    const p0 = sorted[seg];
    const p1 = sorted[seg + 1];
    const h = p1.x - p0.x;
    if (h === 0) {
      lut[x] = clamp255(p0.y);
      continue;
    }
    const t = (x - p0.x) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    lut[x] = clamp255(
      (2 * t3 - 3 * t2 + 1) * p0.y +
        (t3 - 2 * t2 + t) * h * tangents[seg] +
        (-2 * t3 + 3 * t2) * p1.y +
        (t3 - t2) * h * tangents[seg + 1]
    );
  }
  return lut;
}

/** The pastel a tint point maps to: Prism's own colour function, frozen in time. */
export const tintColour = (p: TintPoint) => pastelColour(p.x, p.y, 0);

const luminance = (c: { r: number; g: number; b: number }) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;

export type GradeTables = {
  /** Graded luminance for each source luminance, before toning. */
  tone: Uint8Array;
  /** Final RGB for each source luminance, interleaved r,g,b. */
  rgb: Uint8Array;
};

/** Build the per-luminance tables for a grade. 256 iterations, cheap to rebuild on every change. */
export function buildTables(grade: Grade): GradeTables {
  const curve = curveLUT(grade.curve);
  const gain = Math.pow(2, grade.exposure);
  // Contrast as a slope around mid-grey; ±100 maps to roughly ×0.35 … ×2.6.
  const slope = Math.pow(2.6, grade.contrast / 100);

  const sh = tintColour(grade.shadowTint);
  const hi = tintColour(grade.highlightTint);
  const shL = luminance(sh) || 1;
  const hiL = luminance(hi) || 1;
  const strength = (grade.toneStrength / 100) * 0.85;
  const balance = (grade.toneBalance / 100) * 0.35;

  const tone = new Uint8Array(256);
  const rgb = new Uint8Array(256 * 3);
  for (let v = 0; v < 256; v++) {
    let l = v * gain;
    l = (l - 128) * slope + 128;
    l = curve[Math.round(clamp255(l))];
    tone[v] = Math.round(l);

    const n = l / 255;
    const w = smoothstep(0.08, 0.92, n + balance);
    // Tint normalised to unit luminance, so toning shifts hue without changing brightness.
    const tr = ((1 - w) * sh.r) / shL + (w * hi.r) / hiL;
    const tg = ((1 - w) * sh.g) / shL + (w * hi.g) / hiL;
    const tb = ((1 - w) * sh.b) / shL + (w * hi.b) / hiL;
    // Toning reads strongest in the mid-tones; pure black and white stay neutral.
    const k = strength * (1 - Math.pow(Math.abs(2 * n - 1), 3));
    rgb[v * 3] = Math.round(clamp255(l * (1 + (tr - 1) * k)));
    rgb[v * 3 + 1] = Math.round(clamp255(l * (1 + (tg - 1) * k)));
    rgb[v * 3 + 2] = Math.round(clamp255(l * (1 + (tb - 1) * k)));
  }
  return { tone, rgb };
}

/** Per-image data that doesn't change while grading. */
export type Plate = {
  width: number;
  height: number;
  /** Source luminance per pixel. */
  lum: Uint8Array;
  /** Fixed grain field, roughly normal, ±1. */
  noise: Float32Array;
  /** Vignette falloff per pixel, 0 centre → 1 corners. */
  falloff: Float32Array;
};

/** Seeded so the grain doesn't shimmer between renders or differ between preview and export. */
const rng = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export function makePlate(source: ImageData): Plate {
  const { width, height, data } = source;
  const count = width * height;
  const lum = new Uint8Array(count);
  const noise = new Float32Array(count);
  const falloff = new Float32Array(count);
  const random = rng(1907);
  const cx = width / 2;
  const cy = height / 2;
  const reach = Math.hypot(cx, cy);
  for (let i = 0; i < count; i++) {
    const o = i * 4;
    lum[i] = Math.round(0.2126 * data[o] + 0.7152 * data[o + 1] + 0.0722 * data[o + 2]);
    noise[i] = random() + random() + random() - 1.5;
    const x = i % width;
    const y = (i / width) | 0;
    falloff[i] = smoothstep(0.38, 1.05, Math.hypot(x - cx, y - cy) / reach);
  }
  return { width, height, lum, noise, falloff };
}

export type RenderMode = "print" | "tshirt" | "original";

/**
 * Grade a plate into `out`. Returns the histogram of graded luminance, which
 * the curves editor draws behind the curve.
 */
export function render(plate: Plate, grade: Grade, out: ImageData, mode: RenderMode): Uint32Array {
  const { tone, rgb } = buildTables(grade);
  const histogram = new Uint32Array(256);
  const data = out.data;
  const { lum, noise, falloff } = plate;
  const grain = (grade.grain / 100) * 26;
  const vignette = (grade.vignette / 100) * 0.7;
  const knockout = mode === "tshirt";
  const feather = Math.max(1, grade.feather);

  for (let i = 0; i < lum.length; i++) {
    const o = i * 4;
    const src = lum[i];
    if (mode === "original") {
      data[o] = data[o + 1] = data[o + 2] = src;
      data[o + 3] = 255;
      histogram[src]++;
      continue;
    }
    const t = tone[src];
    histogram[t]++;
    const n = t / 255;
    const g = grain * noise[i] * (0.35 + 0.65 * (1 - Math.abs(2 * n - 1)));
    const v = 1 - vignette * falloff[i];
    data[o] = clamp255((rgb[src * 3] + g) * v);
    data[o + 1] = clamp255((rgb[src * 3 + 1] + g) * v);
    data[o + 2] = clamp255((rgb[src * 3 + 2] + g) * v);
    data[o + 3] = knockout ? Math.round(255 * clamp01((t - grade.threshold) / feather)) : 255;
  }
  return histogram;
}

export type Preset = { id: string; name: string; grade: Partial<Grade> };

/** Tonal presets from ScapeStudio's defaults, plus classic print tones. */
export const PRESETS: Preset[] = [
  { id: "neutral", name: "Neutral", grade: {} },
  {
    id: "standard",
    name: "Standard B&W",
    grade: { curve: [{ x: 0, y: 10 }, { x: 80, y: 70 }, { x: 180, y: 200 }, { x: 255, y: 255 }] },
  },
  {
    id: "high-contrast",
    name: "High contrast",
    grade: { curve: [{ x: 0, y: 0 }, { x: 60, y: 20 }, { x: 190, y: 235 }, { x: 255, y: 255 }], threshold: 40 },
  },
  {
    id: "soft-airy",
    name: "Soft & airy",
    grade: { curve: [{ x: 0, y: 30 }, { x: 128, y: 145 }, { x: 255, y: 250 }], exposure: 0.2, threshold: 15 },
  },
  {
    id: "noir",
    name: "Noir",
    grade: {
      curve: [{ x: 0, y: 0 }, { x: 40, y: 5 }, { x: 90, y: 55 }, { x: 200, y: 240 }, { x: 255, y: 255 }],
      vignette: 45,
      grain: 22,
      threshold: 35,
    },
  },
  {
    id: "selenium",
    name: "Selenium",
    grade: {
      curve: [{ x: 0, y: 6 }, { x: 70, y: 58 }, { x: 190, y: 205 }, { x: 255, y: 250 }],
      shadowTint: { x: 62, y: 82 },
      highlightTint: { x: 55, y: 40 },
      toneStrength: 38,
      toneBalance: -10,
    },
  },
  {
    id: "platinum",
    name: "Platinum",
    grade: {
      curve: [{ x: 0, y: 18 }, { x: 128, y: 136 }, { x: 255, y: 246 }],
      shadowTint: { x: 70, y: 70 },
      highlightTint: { x: 88, y: 18 },
      toneStrength: 46,
      toneBalance: 12,
      grain: 10,
    },
  },
  {
    id: "cyanotype",
    name: "Cyanotype",
    grade: {
      contrast: 12,
      shadowTint: { x: 8, y: 20 },
      highlightTint: { x: 20, y: 6 },
      toneStrength: 80,
      toneBalance: -20,
      vignette: 20,
    },
  },
];

/** Short human description of a grade, for the image's accessible name. */
export function describeGrade(g: Grade): string {
  const parts: string[] = [];
  if (g.exposure) parts.push(`exposure ${g.exposure > 0 ? "+" : ""}${g.exposure.toFixed(2)} stops`);
  if (g.contrast) parts.push(`contrast ${g.contrast > 0 ? "+" : ""}${g.contrast}`);
  if (g.curve.length > 2) parts.push(`${g.curve.length - 2}-point tone curve`);
  if (g.toneStrength) parts.push(`split-toned at ${g.toneStrength}%`);
  if (g.grain) parts.push(`grain ${g.grain}`);
  if (g.vignette) parts.push(`vignette ${g.vignette}`);
  return parts.length ? parts.join(", ") : "ungraded";
}
