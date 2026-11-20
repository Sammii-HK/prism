// Pure logic for the reading-rail experiment. No React, no DOM, so node's
// built-in test runner can load it (see scripts/reading-pace.test.ts).
//
// The model: a "reading line" sits at a fixed height in the scrolling article.
// Samples are (time, reading-line position). Words between the top of the
// article and the reading line count as "passed". Pace is words passed per
// minute of active time. What that cannot know is whether anyone read them.

export interface Block {
  /** Top of the block in the scroller's content coordinates, px. */
  top: number;
  height: number;
  words: number;
}

export interface Sample {
  /** Milliseconds, any monotonic clock. */
  t: number;
  /** Reading-line position in content coordinates, px. */
  y: number;
}

export const countWords = (text: string): number => (text.trim() ? text.trim().split(/\s+/).length : 0);

/** Parameters of the model. These are choices made in this demo, not findings about readers. */
export interface PaceParams {
  /** Samples are grouped into buckets this long. Pace is measured per bucket, not per scroll event. */
  bucketMs: number;
  /** A run of this many ms with no movement is treated as being away, and excluded. */
  idleMs: number;
  /** A bucket that passes words faster than this is counted as skimming or jumping, not reading. */
  skimWpm: number;
  /** "Recent" pace looks back this far. */
  windowMs: number;
  /** Below this much active time no pace is reported. */
  minActiveMs: number;
}

export const DEFAULT_PARAMS: PaceParams = {
  bucketMs: 3000,
  idleMs: 15000,
  skimWpm: 1200,
  windowMs: 30000,
  minActiveMs: 4000,
};

/** Words above position `y` (cumulative), interpolating linearly inside a block. */
export const wordsAt = (y: number, blocks: Block[]): number => {
  let words = 0;
  for (const b of blocks) {
    if (y >= b.top + b.height) words += b.words;
    else if (y > b.top) return words + (b.words * (y - b.top)) / b.height;
    else return words;
  }
  return words;
};

export const totalWords = (blocks: Block[]): number => blocks.reduce((n, b) => n + b.words, 0);

/** Index of the block containing `y`, clamped to the first or last block. -1 when there are no blocks. */
export const blockIndexAt = (y: number, blocks: Block[]): number => {
  if (blocks.length === 0) return -1;
  for (let i = 0; i < blocks.length; i++) if (y < blocks[i].top + blocks[i].height) return i;
  return blocks.length - 1;
};

export interface Pace {
  /** Words passed at reading pace. */
  readWords: number;
  /** Words passed in buckets faster than skimWpm. */
  skimmedWords: number;
  /** Words passed going backwards. */
  rereadWords: number;
  /** Time counted as reading (not idle, not skimming). */
  activeMs: number;
  /** Time excluded because there was no movement for at least idleMs. */
  idleMs: number;
  /** Words per minute of active time, or null until there is enough to say. */
  wpm: number | null;
  /** Time spent at the reading line, by block index, in ms. Includes time in skimmed buckets, which `activeMs` does not. */
  dwellMs: number[];
  /** How many words of each block the reading line actually travelled through. A reader who starts mid-paragraph covers only part of it. */
  coveredWords: number[];
}

interface Bucket {
  ms: number;
  y0: number;
  y1: number;
}

/** Reduce samples to one (start, end, duration) per bucket. The reading line carries over between buckets. */
const bucketize = (samples: Sample[], bucketMs: number): Bucket[] => {
  if (samples.length < 2) return [];
  const t0 = samples[0].t;
  const tEnd = samples[samples.length - 1].t;
  const out: Bucket[] = [];
  let i = 0;
  let y = samples[0].y;
  for (let start = t0; start < tEnd; start += bucketMs) {
    const end = Math.min(start + bucketMs, tEnd);
    const y0 = y;
    while (i < samples.length && samples[i].t <= end) {
      y = samples[i].y;
      i++;
    }
    out.push({ ms: end - start, y0, y1: y });
  }
  return out;
};

/** Split `ms` across the blocks a bucket passed through, in proportion to the words in each. */
const spread = (dwell: number[], blocks: Block[], y0: number, y1: number, ms: number) => {
  const w0 = wordsAt(y0, blocks);
  const w1 = wordsAt(y1, blocks);
  const span = Math.abs(w1 - w0);
  if (span < 1e-9) {
    const k = blockIndexAt(y1, blocks);
    if (k >= 0) dwell[k] += ms;
    return;
  }
  const lo = Math.min(w0, w1);
  const hi = Math.max(w0, w1);
  let cursor = 0;
  blocks.forEach((b, k) => {
    const a = Math.max(lo, cursor);
    const z = Math.min(hi, cursor + b.words);
    if (z > a) dwell[k] += (ms * (z - a)) / span;
    cursor += b.words;
  });
};

/** Measure pace over every sample given. */
export const analyse = (samples: Sample[], blocks: Block[], params: PaceParams = DEFAULT_PARAMS): Pace => {
  const dwellMs = blocks.map(() => 0);
  const lo = blocks.map(() => Infinity);
  const hi = blocks.map(() => -Infinity);
  const starts: number[] = [];
  blocks.reduce((acc, b) => (starts.push(acc), acc + b.words), 0);
  const cover = (y0: number, y1: number) => {
    const a = Math.min(wordsAt(y0, blocks), wordsAt(y1, blocks));
    const z = Math.max(wordsAt(y0, blocks), wordsAt(y1, blocks));
    blocks.forEach((b, k) => {
      const s0 = starts[k];
      const e0 = s0 + b.words;
      if (z < s0 || a > e0) return;
      lo[k] = Math.min(lo[k], Math.max(a, s0));
      hi[k] = Math.max(hi[k], Math.min(z, e0));
    });
  };
  const coveredWords: number[] = blocks.map(() => 0);
  const out: Pace = { readWords: 0, skimmedWords: 0, rereadWords: 0, activeMs: 0, idleMs: 0, wpm: null, dwellMs, coveredWords };
  const buckets = bucketize(samples, params.bucketMs).filter((b) => b.ms >= 1000 || b.ms >= params.bucketMs);
  const idleRun = Math.max(1, Math.ceil(params.idleMs / params.bucketMs));

  // Mark runs of stationary buckets that are long enough to count as being away.
  const moving = buckets.map((b) => Math.abs(wordsAt(b.y1, blocks) - wordsAt(b.y0, blocks)) > 0.5);
  const idle = buckets.map(() => false);
  for (let s = 0; s < buckets.length; ) {
    if (moving[s]) { s++; continue; }
    let e = s;
    while (e < buckets.length && !moving[e]) e++;
    if (e - s >= idleRun) for (let k = s; k < e; k++) idle[k] = true;
    s = e;
  }

  buckets.forEach((b, k) => {
    if (idle[k]) {
      out.idleMs += b.ms;
      return;
    }
    cover(b.y0, b.y1);
    const dw = wordsAt(b.y1, blocks) - wordsAt(b.y0, blocks);
    if (dw < 0) {
      out.rereadWords += -dw;
      out.activeMs += b.ms;
      spread(dwellMs, blocks, b.y0, b.y1, b.ms);
      return;
    }
    const wpm = dw / (b.ms / 60000);
    if (dw > 0 && wpm > params.skimWpm) {
      out.skimmedWords += dw;
      // The time still happened at those paragraphs, so it counts as dwell (a short one), but not as reading time.
      spread(dwellMs, blocks, b.y0, b.y1, b.ms);
      return;
    }
    out.readWords += dw;
    out.activeMs += b.ms;
    spread(dwellMs, blocks, b.y0, b.y1, b.ms);
  });

  blocks.forEach((_, k) => {
    coveredWords[k] = hi[k] > lo[k] ? hi[k] - lo[k] : 0;
  });
  if (out.activeMs >= params.minActiveMs && out.readWords > 0) out.wpm = out.readWords / (out.activeMs / 60000);
  return out;
};

/** Pace over only the last `params.windowMs`. The dwell figures are zeroed: use `analyse` on everything for those. */
export const recentPace = (samples: Sample[], blocks: Block[], params: PaceParams = DEFAULT_PARAMS): Pace => {
  if (samples.length === 0) return analyse([], blocks, params);
  const cutoff = samples[samples.length - 1].t - params.windowMs;
  return analyse(samples.filter((s) => s.t >= cutoff), blocks, params);
};

/** Seconds to read `remainingWords` at `wpm`, or null when there is no pace yet. */
export const etaSeconds = (remainingWords: number, wpm: number | null): number | null =>
  wpm === null || wpm <= 0 ? null : (Math.max(0, remainingWords) / wpm) * 60;

export const formatEta = (seconds: number | null): string => {
  if (seconds === null) return "not enough movement yet";
  if (seconds < 1) return "done";
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m === 0 ? `${s} s` : `${m} min ${String(s).padStart(2, "0")} s`;
};

export type Dwell = "unvisited" | "visited" | "skimmed" | "read" | "lingered";

export interface DwellParams {
  /** Under this fraction of the time the block would take at your pace: "skimmed". */
  skimBelow: number;
  /** Over this multiple of it: "lingered". */
  lingerAbove: number;
}

export const DEFAULT_DWELL: DwellParams = { skimBelow: 0.4, lingerAbove: 1.6 };

/**
 * How long you were at a block compared with how long it would take at your
 * own measured pace. With no pace yet, any time at all is just "visited".
 */
export const classifyDwell = (dwellMs: number, words: number, wpm: number | null, p: DwellParams = DEFAULT_DWELL): Dwell => {
  if (dwellMs < 50) return "unvisited";
  if (wpm === null || wpm <= 0 || words <= 0) return "visited";
  const ratio = dwellMs / ((words / wpm) * 60000);
  return ratio < p.skimBelow ? "skimmed" : ratio > p.lingerAbove ? "lingered" : "read";
};

/** A block the reading line has only just entered is "visited": too little of it is covered to judge. */
export const MIN_COVERAGE = 0.25;

/**
 * Like `classifyDwell`, but judged against the words the reading line actually
 * passed through, so starting mid-paragraph, or stopping halfway down one,
 * does not read as skimming.
 */
export const classifyBlock = (dwellMs: number, coveredWords: number, blockWords: number, wpm: number | null, p: DwellParams = DEFAULT_DWELL): Dwell => {
  if (dwellMs < 50) return "unvisited";
  if (blockWords <= 0 || coveredWords / blockWords < MIN_COVERAGE) return "visited";
  return classifyDwell(dwellMs, coveredWords, wpm, p);
};

/** Clamp a sample list so it cannot grow without bound. Keeps the most recent `max`. */
export const capSamples = (samples: Sample[], max = 6000): Sample[] => (samples.length <= max ? samples : samples.slice(samples.length - max));
