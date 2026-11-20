"use client";

/**
 * The measurements X-ray mode draws. Everything here observes the page; it
 * never changes a component. Springs are read from the style writes the
 * components already make each frame, so the tuning is untouched.
 */

/** Anything inside this attribute is X-ray's own UI and is never measured. */
export const XRAY_ROOT_ATTR = "data-xray-root";

const insideXray = (el: Element) => el.closest(`[${XRAY_ROOT_ATTR}]`) !== null;

// ---------------------------------------------------------------------------
// Interactive elements, roles and names

const INTERACTIVE = [
  "a[href]",
  "button",
  "input:not([type=hidden])",
  "select",
  "textarea",
  "summary",
  "[role=button]",
  "[role=link]",
  "[role=checkbox]",
  "[role=switch]",
  "[role=slider]",
  "[role=tab]",
  "[role=option]",
  "[role=menuitem]",
  "[role=combobox]",
  "[tabindex]",
].join(",");

const isRendered = (el: Element) => {
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return false;
  const style = getComputedStyle(el);
  return style.visibility !== "hidden" && style.display !== "none";
};

const isDisabled = (el: Element) =>
  (el as HTMLButtonElement).disabled === true || el.getAttribute("aria-disabled") === "true" || el.closest("[inert]") !== null;

/** Every rendered interactive element on the page, in DOM order. */
export const interactiveElements = (): HTMLElement[] =>
  Array.from(document.querySelectorAll<HTMLElement>(INTERACTIVE)).filter(
    (el) => !insideXray(el) && el.getAttribute("tabindex") !== "-1" && !el.closest("[aria-hidden=true]") && isRendered(el),
  );

/**
 * The keyboard tab sequence: positive tabindex first (ascending), then
 * everything else in DOM order, skipping disabled controls.
 */
export const tabSequence = (elements: HTMLElement[]): HTMLElement[] => {
  const focusable = elements.filter((el) => !isDisabled(el) && el.tabIndex >= 0);
  const positive = focusable.filter((el) => el.tabIndex > 0).sort((a, b) => a.tabIndex - b.tabIndex);
  return [...positive, ...focusable.filter((el) => el.tabIndex === 0)];
};

const IMPLICIT_ROLE: Record<string, (el: Element) => string> = {
  a: () => "link",
  button: () => "button",
  select: (el) => ((el as HTMLSelectElement).multiple ? "listbox" : "combobox"),
  textarea: () => "textbox",
  summary: () => "button",
  input: (el) => {
    const type = (el as HTMLInputElement).type;
    if (type === "checkbox") return "checkbox";
    if (type === "radio") return "radio";
    if (type === "range") return "slider";
    if (type === "button" || type === "submit" || type === "reset") return "button";
    if (type === "search") return "searchbox";
    return "textbox";
  },
};

export const roleOf = (el: Element): string =>
  el.getAttribute("role") ?? IMPLICIT_ROLE[el.tagName.toLowerCase()]?.(el) ?? el.tagName.toLowerCase();

const squash = (text: string | null | undefined) => (text ?? "").replace(/\s+/g, " ").trim();

/**
 * A close approximation of the accessible name (accname): aria-labelledby,
 * aria-label, an associated <label>, then text content, alt, title and
 * placeholder. Good enough to spot a control with no name at all.
 */
export const accessibleName = (el: Element): string => {
  const labelledBy = el.getAttribute("aria-labelledby");
  if (labelledBy) {
    const text = labelledBy
      .split(/\s+/)
      .map((id) => squash(document.getElementById(id)?.textContent))
      .join(" ")
      .trim();
    if (text) return text;
  }
  const label = squash(el.getAttribute("aria-label"));
  if (label) return label;
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
    const forLabel = el.labels?.[0];
    if (forLabel) return squash(forLabel.textContent);
  }
  const text = squash(el.textContent);
  if (text) return text;
  const img = el.querySelector("img[alt]");
  if (img) return squash(img.getAttribute("alt"));
  return squash(el.getAttribute("title")) || squash(el.getAttribute("placeholder"));
};

// ---------------------------------------------------------------------------
// Contrast (WCAG 2.x)

type RGBA = [number, number, number, number];

const PAGE_BACKGROUND: RGBA = [5, 5, 5, 1];

const parseColour = (value: string): RGBA | null => {
  const m = value.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const parts = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
  if (parts.length < 3 || parts.some(Number.isNaN)) return null;
  return [parts[0], parts[1], parts[2], parts[3] ?? 1];
};

const over = (top: RGBA, bottom: RGBA): RGBA => {
  const a = top[3] + bottom[3] * (1 - top[3]);
  if (a === 0) return [0, 0, 0, 0];
  const mix = (i: number) => (top[i] * top[3] + bottom[i] * bottom[3] * (1 - top[3])) / a;
  return [mix(0), mix(1), mix(2), a];
};

const luminance = ([r, g, b]: RGBA) => {
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

export type ContrastReading = {
  ratio: number;
  /** "AAA", "AA", "AA large" or "fail" for this text's size and weight. */
  verdict: "AAA" | "AA" | "AA large" | "fail";
  large: boolean;
  /** True when a gradient or image sits behind the text, so the solid backdrop is an estimate. */
  approximate: boolean;
  text: string;
};

/**
 * Contrast of an element's own text against what is really behind it: every
 * translucent background up the tree is composited over the page colour, and
 * the text colour's own alpha is applied on top of that.
 */
export const contrastOf = (el: Element): ContrastReading | null => {
  const text = squash(Array.from(el.childNodes).filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent).join(" "));
  if (!text) return null;

  const layers: RGBA[] = [];
  let approximate = false;
  let opacity = 1;
  for (let node: Element | null = el; node; node = node.parentElement) {
    const style = getComputedStyle(node);
    opacity *= Number(style.opacity);
    if (style.backgroundImage !== "none") approximate = true;
    const bg = parseColour(style.backgroundColor);
    if (bg && bg[3] > 0) layers.push(bg);
    if (bg && bg[3] >= 1) break;
  }
  let backdrop = PAGE_BACKGROUND;
  for (let i = layers.length - 1; i >= 0; i--) backdrop = over(layers[i], backdrop);

  const style = getComputedStyle(el);
  const fg = parseColour(style.color);
  if (!fg) return null;
  const shown = over([fg[0], fg[1], fg[2], fg[3] * opacity], backdrop);

  const l1 = luminance(shown);
  const l2 = luminance(backdrop);
  const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);

  const size = parseFloat(style.fontSize);
  const weight = Number(style.fontWeight) || 400;
  // WCAG "large": 18pt (24px), or 14pt (18.66px) bold.
  const large = size >= 24 || (size >= 18.66 && weight >= 700);
  const verdict = ratio >= (large ? 4.5 : 7) ? "AAA" : ratio >= (large ? 3 : 4.5) ? (large ? "AA large" : "AA") : "fail";

  return { ratio, verdict, large, approximate, text };
};

const ownText = (el: Element) =>
  Array.from(el.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && squash(n.textContent));

/** The element itself if it holds text, else the first descendant that does. */
export const firstTextElement = (root: Element): Element | null => {
  if (ownText(root)) return root;
  for (const el of root.querySelectorAll("*")) if (ownText(el)) return el;
  return null;
};

/** The innermost element with its own text under a point, ignoring X-ray's own UI. */
export const textElementAt = (x: number, y: number): Element | null => {
  for (const el of document.elementsFromPoint(x, y)) {
    if (insideXray(el)) continue;
    const hasText = Array.from(el.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && squash(n.textContent));
    if (hasText) return el;
  }
  return null;
};

// ---------------------------------------------------------------------------
// Motion: springs observed from their style writes

type Sample = { t: number; v: number };

type Track = {
  el: HTMLElement;
  /** Samples per channel (e.g. "translateX", "scale", "opacity"). */
  channels: Map<string, Sample[]>;
  lastChange: number;
  runStart: number;
  /** Stats of the most recent finished movement. */
  settled: RunStats | null;
};

export type RunStats = {
  channel: string;
  unit: string;
  from: number;
  to: number;
  /** How far past its resting value the movement went, in the channel's unit. */
  overshoot: number;
  /** Milliseconds from the first frame of movement to rest. */
  settleMs: number;
};

const TRACE_MS = 1400;
const REST_MS = 140;

const UNITS: Record<string, string> = {
  translateX: "px",
  translateY: "px",
  scale: "×",
  rotate: "°",
  opacity: "",
  width: "px",
};

/** Pull the numbers a spring writes out of an inline style. */
const readChannels = (el: HTMLElement): Record<string, number> => {
  const out: Record<string, number> = {};
  const transform = el.style.transform;
  if (transform) {
    // The last translate wins; a leading translate(-50%, -50%) is centring, not motion.
    for (const m of transform.matchAll(/translate([XY])?\(([^)]+)\)/g)) {
      const args = m[2].split(",").map((s) => s.trim());
      const px = (s: string | undefined) => (s && s.endsWith("px") ? parseFloat(s) : undefined);
      if (m[1] === "X") out.translateX = px(args[0]) ?? out.translateX;
      else if (m[1] === "Y") out.translateY = px(args[0]) ?? out.translateY;
      else {
        const x = px(args[0]);
        const y = px(args[1]);
        if (x !== undefined) out.translateX = x;
        if (y !== undefined) out.translateY = y;
      }
    }
    const calcY = transform.match(/calc\([^)]*?([-\d.]+)px\)\)/);
    if (calcY) out.translateY = parseFloat(calcY[1]);
    const scale = transform.match(/scale\(([-\d.]+)/);
    if (scale) out.scale = parseFloat(scale[1]);
    const rotate = transform.match(/rotate\(([-\d.]+)deg/);
    if (rotate) out.rotate = parseFloat(rotate[1]);
  }
  if (el.style.opacity !== "") out.opacity = parseFloat(el.style.opacity);
  if (el.style.width.endsWith("px")) out.width = parseFloat(el.style.width);
  return out;
};

/** The channel that moved the most during a run, measured against its typical size. */
const mainChannel = (track: Track, since: number) => {
  let best: { name: string; samples: Sample[]; travel: number } | null = null;
  for (const [name, samples] of track.channels) {
    const run = samples.filter((s) => s.t >= since);
    if (run.length < 3) continue;
    const values = run.map((s) => s.v);
    const range = Math.max(...values) - Math.min(...values);
    const scaleOfUnit = name === "scale" || name === "opacity" ? 0.05 : name === "rotate" ? 5 : 8;
    const travel = range / scaleOfUnit;
    if (!best || travel > best.travel) best = { name, samples: run, travel };
  }
  return best;
};

const statsFor = (track: Track): RunStats | null => {
  const main = mainChannel(track, track.runStart);
  if (!main || main.travel < 0.2) return null;
  const values = main.samples.map((s) => s.v);
  const from = values[0];
  const to = values[values.length - 1];
  const direction = Math.sign(to - from) || 1;
  const peak = direction > 0 ? Math.max(...values) : Math.min(...values);
  // Settled = within 1% of the travel from rest. Springs keep writing
  // sub-pixel values for a while after that; those tails are not "motion".
  const band = Math.max(Math.abs(to - from) * 0.01, main.name === "scale" || main.name === "opacity" ? 0.002 : 0.05);
  let settledAt = main.samples[0].t;
  for (const s of main.samples) if (Math.abs(s.v - to) > band) settledAt = s.t;
  return {
    channel: main.name,
    unit: UNITS[main.name] ?? "",
    from,
    to,
    overshoot: Math.max(0, (peak - to) * direction),
    settleMs: settledAt - main.samples[0].t,
  };
};

export type MotionTracker = {
  /** Elements that moved recently, with their traces and last finished run. */
  /** `looping` marks ambient motion that has been running for seconds without resting. */
  active: (now: number) => Array<{ el: HTMLElement; trace: Sample[]; channel: string; moving: boolean; looping: boolean; stats: RunStats | null }>;
  stop: () => void;
};

export const trackMotion = (): MotionTracker => {
  const tracks = new Map<HTMLElement, Track>();

  const observer = new MutationObserver((records) => {
    const now = performance.now();
    for (const record of records) {
      const el = record.target;
      if (!(el instanceof HTMLElement) || insideXray(el)) continue;
      const values = readChannels(el);
      const names = Object.keys(values);
      if (names.length === 0) continue;

      let track = tracks.get(el);
      if (!track) {
        track = { el, channels: new Map(), lastChange: now, runStart: now, settled: null };
        tracks.set(el, track);
      }
      // Many components rewrite their style every frame, even at rest. Only a
      // write that changes a value counts as movement.
      const changed = names.filter((name) => {
        const samples = track.channels.get(name);
        const last = samples?.[samples.length - 1];
        return !last || Math.abs(last.v - values[name]) > 1e-4;
      });
      if (changed.length === 0) continue;
      if (now - track.lastChange > REST_MS) {
        track.runStart = now;
        // Seed the run with where each channel was resting, so "from" is the true start.
        for (const name of changed) {
          const samples = track.channels.get(name);
          const last = samples?.[samples.length - 1];
          if (last) samples!.push({ t: now - 16, v: last.v });
        }
      }
      track.lastChange = now;
      for (const name of changed) {
        const samples = track.channels.get(name) ?? [];
        samples.push({ t: now, v: values[name] });
        while (samples.length && now - samples[0].t > TRACE_MS * 3) samples.shift();
        track.channels.set(name, samples);
      }
    }
  });
  observer.observe(document.body, { attributes: true, attributeFilter: ["style"], subtree: true });

  return {
    active: (now) => {
      const out = [];
      for (const [el, track] of tracks) {
        if (!el.isConnected || now - track.lastChange > 4000) {
          tracks.delete(el);
          continue;
        }
        const moving = now - track.lastChange < REST_MS;
        if (!moving && !track.settled) track.settled = statsFor(track);
        if (moving) track.settled = null;
        const main = mainChannel(track, now - TRACE_MS) ?? mainChannel(track, 0);
        if (!main) continue;
        const looping = moving && now - track.runStart > 2500;
        out.push({ el, trace: main.samples, channel: main.name, moving, looping, stats: moving ? (looping ? null : statsFor(track)) : track.settled });
      }
      return out;
    },
    stop: () => observer.disconnect(),
  };
};
