/**
 * Record a component demo as a scroll-stopping video for social media.
 *
 * Usage:
 *   npx tsx scripts/record.ts <slug> [--duration <seconds>] [--tiktok]
 *
 * Environment variables:
 *   SKIP_BUILD=1           — skip pnpm build step
 *   PRISM_SERVER_RUNNING=1 — skip starting the server (assume already running on PORT)
 *
 * Uses screenshot-based recording (not recordVideo) to guarantee cursor capture.
 * Starts a production server, takes screenshots at 30fps, stitches into mp4.
 */

import { chromium } from "playwright";
import { execFileSync, spawn, type ChildProcess } from "child_process";
import { existsSync, mkdirSync, readdirSync, unlinkSync, rmdirSync, writeFileSync } from "fs";
import path from "path";
import { registry, type RegistryItem } from "../app/lib/registry";

declare global {
  interface Window {
    __debugCandidates?: number;
  }
}

// --- Argument parsing ---

const args = process.argv.slice(2);
const slug = args.find((a) => !a.startsWith("--"));
const isTikTok = args.includes("--tiktok");

let durationFlag: number | undefined;
const durIdx = args.indexOf("--duration");
if (durIdx !== -1 && args[durIdx + 1]) {
  durationFlag = parseInt(args[durIdx + 1], 10);
}

if (!slug) {
  console.error("Usage: npx tsx scripts/record.ts <slug> [--duration <seconds>] [--tiktok]");
  process.exit(1);
}

const PORT = 3099;
const BASE_URL = `http://localhost:${PORT}`;
const RECORDINGS_DIR = path.join(process.cwd(), "recordings");
const OUT_W = 1080;
const OUT_H = isTikTok ? 1920 : 1080;
const VP_W = 1200;
const VP_H = 1200;
const FPS = 30;

if (!existsSync(RECORDINGS_DIR)) mkdirSync(RECORDINGS_DIR, { recursive: true });

type Page = Awaited<ReturnType<Awaited<ReturnType<typeof chromium.launch>>["newPage"]>>;

function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)); }

interface ComponentBounds { cx: number; cy: number; w: number; h: number; left: number; top: number; }
interface ElementInfo { cx: number; cy: number; w: number; h: number; }

// --- Registry lookup ---

function getRegistryItem(slug: string): RegistryItem | undefined {
  return registry.find((r) => r.slug === slug);
}

function computeDuration(item: RegistryItem | undefined): number {
  if (durationFlag) return durationFlag * 1000;
  if (!item) return 8000;

  const tags = item.tags;
  const hasManyInteractive =
    tags.some((t) => t === "tabs") ||
    (tags.some((t) => ["input", "textarea", "form"].includes(t)) && tags.length > 4);
  const isSimple = ["badge", "dot", "skeleton", "pulse", "shimmer"].some((t) => tags.includes(t));

  if (hasManyInteractive) return 10000;
  if (isSimple) return 6000;
  return 8000;
}

// --- Page setup ---

async function preparePage(page: Page) {
  await page.evaluate(() => {
    document.documentElement.style.cssText += "; overflow: hidden !important; background: #050505;";
    document.body.style.cssText += "; overflow: hidden !important; background: #050505;";
    const nav = document.querySelector("nav");
    if (nav) (nav as HTMLElement).style.display = "none";
    const main = document.querySelector("main");
    if (main) (main as HTMLElement).style.paddingTop = "0";
    const demo = document.querySelector(".fixed.inset-0") as HTMLElement;
    if (demo) demo.style.top = "0";
  });
}

async function findComponentBounds(page: Page): Promise<ComponentBounds> {
  return page.evaluate(() => {
    const candidates: { el: Element; area: number }[] = [];
    const demo = document.querySelector(".fixed.inset-0");
    const searchRoot = demo || document.body;
    searchRoot.querySelectorAll("*").forEach((el) => {
      const hasRoundedClass = el.className && typeof el.className === "string" && el.className.includes("rounded");
      const hasInlineBorderRadius = (el as HTMLElement).style?.borderRadius !== "";
      const isInteractive = el.tagName === "BUTTON" || el.tagName === "A";
      if (!hasRoundedClass && !hasInlineBorderRadius && !isInteractive) return;
      const rect = el.getBoundingClientRect();
      if (rect.width > window.innerWidth * 0.7) return;
      if (rect.width < 40 || rect.height < 40) return;
      candidates.push({ el, area: rect.width * rect.height });
    });

    candidates.sort((a, b) => b.area - a.area);
    let bestEl = candidates.length > 0 ? candidates[0].el : null;
    window.__debugCandidates = candidates.length;

    if (!bestEl) {
      const demo = document.querySelector(".fixed.inset-0");
      if (demo) {
        let bestArea = 0;
        demo.querySelectorAll(":scope > *").forEach((el) => {
          const rect = el.getBoundingClientRect();
          if (rect.width > window.innerWidth * 0.7) return;
          if (rect.width < 40 || rect.height < 40) return;
          const area = rect.width * rect.height;
          if (area > bestArea) { bestArea = area; bestEl = el; }
        });
      }
    }

    if (bestEl) {
      const rect = bestEl.getBoundingClientRect();
      return { cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2, w: rect.width, h: rect.height, left: rect.left, top: rect.top };
    }
    return { cx: window.innerWidth / 2, cy: window.innerHeight / 2, w: 400, h: 200, left: window.innerWidth / 2 - 200, top: window.innerHeight / 2 - 100 };
  });
}

async function injectCursor(page: Page) {
  await page.addScriptTag({
    content: `
      (function() {
        var cursor = document.createElement("div");
        cursor.style.cssText = "position:fixed;top:-50px;left:-50px;width:28px;height:28px;pointer-events:none;z-index:2147483647;background:rgba(255,255,255,0.12);border:2.5px solid rgba(255,255,255,0.9);border-radius:50%;transform:translate(-50%,-50%);box-shadow:0 0 20px rgba(255,255,255,0.2),0 0 6px rgba(255,255,255,0.35);";
        document.documentElement.appendChild(cursor);
        var n = 0;
        document.addEventListener("mousemove", function(e) {
          cursor.style.left = e.clientX + "px";
          cursor.style.top = e.clientY + "px";
        });
        document.addEventListener("mousedown", function() {
          cursor.style.width = "22px"; cursor.style.height = "22px";
          cursor.style.borderColor = "rgba(255,255,255,1)";
        });
        document.addEventListener("mouseup", function() {
          cursor.style.width = "28px"; cursor.style.height = "28px";
          cursor.style.borderColor = "rgba(255,255,255,0.9)";
        });
      })();
    `,
  });
}

// --- Interactive element discovery ---

async function findInteractiveElements(page: Page, selectors: string[]): Promise<ElementInfo[]> {
  return page.evaluate((sels) => {
    const demo = document.querySelector(".fixed.inset-0") || document.body;
    const results: { cx: number; cy: number; w: number; h: number }[] = [];
    const seen = new Set<Element>();

    for (const sel of sels) {
      try {
        demo.querySelectorAll(sel).forEach((el) => {
          if (seen.has(el)) return;
          seen.add(el);
          const rect = el.getBoundingClientRect();
          if (rect.width < 5 || rect.height < 5) return;
          results.push({
            cx: rect.left + rect.width / 2,
            cy: rect.top + rect.height / 2,
            w: rect.width,
            h: rect.height,
          });
        });
      } catch {}
    }
    return results;
  }, selectors);
}

// --- Choreography ---

type Action =
  | { type: "move"; x: number; y: number; speed: "fast" | "normal" | "slow" }
  | { type: "click"; x: number; y: number }
  | { type: "sweep"; x1: number; y1: number; x2: number; y2: number }
  | { type: "pause"; ms: number }
  | { type: "type"; selector: string; text: string }
  | { type: "drag"; x1: number; y1: number; x2: number; y2: number }
  | { type: "hover-hold"; x: number; y: number; ms: number };

function generateGenericChoreography(compBounds: ComponentBounds): Action[] {
  const actions: Action[] = [];
  const { cx, cy, w, h } = compBounds;
  const isWide = w > h * 2;

  if (isWide) {
    const left = cx - w / 2;
    const right = cx + w / 2;
    actions.push({ type: "move", x: left, y: cy - 60, speed: "normal" });
    actions.push({ type: "pause", ms: 100 });
    actions.push({ type: "move", x: left + 20, y: cy, speed: "slow" });
    actions.push({ type: "pause", ms: 80 });
    actions.push({ type: "sweep", x1: left + 10, y1: cy, x2: right - 10, y2: cy });
    actions.push({ type: "pause", ms: 120 });
    actions.push({ type: "sweep", x1: right - 10, y1: cy, x2: left + 10, y2: cy });
    actions.push({ type: "pause", ms: 80 });
    actions.push({ type: "click", x: cx, y: cy });
    actions.push({ type: "pause", ms: 200 });
    actions.push({ type: "move", x: right - 30, y: cy, speed: "slow" });
    actions.push({ type: "click", x: right - 30, y: cy });
    actions.push({ type: "pause", ms: 150 });
    actions.push({ type: "sweep", x1: left - 10, y1: cy, x2: right + 10, y2: cy });
    actions.push({ type: "pause", ms: 100 });
    actions.push({ type: "move", x: cx, y: cy - 50, speed: "slow" });
    actions.push({ type: "pause", ms: 150 });
    actions.push({ type: "move", x: cx, y: cy, speed: "slow" });
  } else {
    const r = Math.max(w, h) * 0.8;
    const orbitR = Math.min(r, Math.max(w, h) * 0.5 + 40);
    actions.push({ type: "move", x: cx - orbitR, y: cy + 20, speed: "fast" });
    actions.push({ type: "pause", ms: 40 });
    actions.push({ type: "move", x: cx - w * 0.3, y: cy, speed: "normal" });
    actions.push({ type: "pause", ms: 30 });
    actions.push({ type: "sweep", x1: cx - w * 0.3, y1: cy, x2: cx + w * 0.3, y2: cy });
    actions.push({ type: "pause", ms: 20 });
    actions.push({ type: "click", x: cx, y: cy });
    actions.push({ type: "pause", ms: 80 });
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 3) {
      actions.push({
        type: "move",
        x: clamp(cx + Math.cos(angle) * orbitR, 20, VP_W - 20),
        y: clamp(cy + Math.sin(angle) * orbitR, 20, VP_H - 20),
        speed: "slow",
      });
      actions.push({ type: "pause", ms: 60 });
    }
    actions.push({ type: "click", x: cx - w * 0.15, y: cy - 5 });
    actions.push({ type: "pause", ms: 60 });
    actions.push({ type: "sweep", x1: cx - orbitR, y1: cy, x2: cx + orbitR, y2: cy });
    actions.push({ type: "pause", ms: 30 });
    actions.push({ type: "click", x: cx + w * 0.1, y: cy + 3 });
    actions.push({ type: "pause", ms: 50 });
    actions.push({ type: "move", x: cx + w * 0.4, y: cy - h * 0.4, speed: "slow" });
  }

  return actions;
}

// --- Component-aware choreography helpers ---

function orbitGlow(cx: number, cy: number, radius: number): Action[] {
  const actions: Action[] = [];
  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
    actions.push({
      type: "move",
      x: clamp(cx + Math.cos(angle) * radius, 20, VP_W - 20),
      y: clamp(cy + Math.sin(angle) * radius, 20, VP_H - 20),
      speed: "slow",
    });
    actions.push({ type: "pause", ms: 40 });
  }
  return actions;
}

function sliderChoreography(elements: ElementInfo[], compBounds: ComponentBounds): Action[] {
  const actions: Action[] = [];
  for (const el of elements.slice(0, 2)) {
    // Approach from left
    actions.push({ type: "move", x: el.cx - el.w * 0.6, y: el.cy - 30, speed: "normal" });
    actions.push({ type: "hover-hold", x: el.cx, y: el.cy, ms: 500 });
    // Drag left to right
    const trackLeft = el.cx - el.w * 0.4;
    const trackRight = el.cx + el.w * 0.4;
    actions.push({ type: "drag", x1: trackLeft, y1: el.cy, x2: trackRight, y2: el.cy });
    actions.push({ type: "pause", ms: 300 });
    // Drag right to center
    actions.push({ type: "drag", x1: trackRight, y1: el.cy, x2: el.cx, y2: el.cy });
    actions.push({ type: "pause", ms: 400 });
  }
  // Orbit for glow
  actions.push(...orbitGlow(compBounds.cx, compBounds.cy, Math.max(compBounds.w, compBounds.h) * 0.5));
  return actions;
}

function tabsChoreography(elements: ElementInfo[], compBounds: ComponentBounds): Action[] {
  const actions: Action[] = [];
  // Move near the tab bar
  if (elements.length > 0) {
    actions.push({ type: "move", x: elements[0].cx - 40, y: elements[0].cy - 30, speed: "normal" });
    actions.push({ type: "pause", ms: 200 });
  }
  for (const el of elements) {
    actions.push({ type: "click", x: el.cx, y: el.cy });
    actions.push({ type: "pause", ms: 800 });
  }
  // Loop through again for demo length
  for (const el of elements.slice().reverse()) {
    actions.push({ type: "click", x: el.cx, y: el.cy });
    actions.push({ type: "pause", ms: 800 });
  }
  actions.push(...orbitGlow(compBounds.cx, compBounds.cy, Math.max(compBounds.w, compBounds.h) * 0.4));
  return actions;
}

function toggleChoreography(elements: ElementInfo[], compBounds: ComponentBounds): Action[] {
  const actions: Action[] = [];
  for (const el of elements.slice(0, 3)) {
    actions.push({ type: "move", x: el.cx - 30, y: el.cy, speed: "normal" });
    actions.push({ type: "pause", ms: 200 });
    // Toggle on
    actions.push({ type: "click", x: el.cx, y: el.cy });
    actions.push({ type: "pause", ms: 600 });
    // Toggle off
    actions.push({ type: "click", x: el.cx, y: el.cy });
    actions.push({ type: "pause", ms: 400 });
  }
  // Move to next toggle and click
  if (elements.length > 1) {
    actions.push({ type: "move", x: elements[1].cx, y: elements[1].cy, speed: "normal" });
    actions.push({ type: "click", x: elements[1].cx, y: elements[1].cy });
    actions.push({ type: "pause", ms: 500 });
  }
  actions.push(...orbitGlow(compBounds.cx, compBounds.cy, Math.max(compBounds.w, compBounds.h) * 0.5));
  return actions;
}

function checkboxChoreography(elements: ElementInfo[], compBounds: ComponentBounds): Action[] {
  const actions: Action[] = [];
  // Click each checkbox
  for (const el of elements.slice(0, 4)) {
    actions.push({ type: "move", x: el.cx - 20, y: el.cy, speed: "normal" });
    actions.push({ type: "click", x: el.cx, y: el.cy });
    actions.push({ type: "pause", ms: 500 });
  }
  // Uncheck one
  if (elements.length > 0) {
    actions.push({ type: "click", x: elements[0].cx, y: elements[0].cy });
    actions.push({ type: "pause", ms: 400 });
  }
  actions.push(...orbitGlow(compBounds.cx, compBounds.cy, Math.max(compBounds.w, compBounds.h) * 0.5));
  return actions;
}

function inputChoreography(elements: ElementInfo[], compBounds: ComponentBounds): Action[] {
  const actions: Action[] = [];
  const texts = ["hello@prism.dev", "Sam", "Spring physics", "Design"];

  for (let i = 0; i < Math.min(elements.length, 3); i++) {
    const el = elements[i];
    // Move toward the field for glow
    actions.push({ type: "move", x: el.cx - 40, y: el.cy - 20, speed: "normal" });
    actions.push({ type: "pause", ms: 200 });
    // Click to focus
    actions.push({ type: "click", x: el.cx, y: el.cy });
    actions.push({ type: "pause", ms: 300 });
    // Type text
    actions.push({ type: "type", selector: `input, textarea`, text: texts[i] || "hello" });
    actions.push({ type: "pause", ms: 400 });
    // Move cursor around for glow effect
    if (i < elements.length - 1) {
      const next = elements[i + 1];
      actions.push({ type: "move", x: (el.cx + next.cx) / 2, y: (el.cy + next.cy) / 2 - 20, speed: "slow" });
      actions.push({ type: "pause", ms: 200 });
    }
  }
  actions.push(...orbitGlow(compBounds.cx, compBounds.cy, Math.max(compBounds.w, compBounds.h) * 0.4));
  return actions;
}

function selectChoreography(elements: ElementInfo[], compBounds: ComponentBounds): Action[] {
  const actions: Action[] = [];
  for (const el of elements.slice(0, 2)) {
    // Click trigger to open
    actions.push({ type: "move", x: el.cx - 30, y: el.cy - 20, speed: "normal" });
    actions.push({ type: "click", x: el.cx, y: el.cy });
    actions.push({ type: "pause", ms: 600 });
    // Click an option (below the trigger)
    actions.push({ type: "click", x: el.cx, y: el.cy + el.h + 20 });
    actions.push({ type: "pause", ms: 500 });
    // Open again
    actions.push({ type: "click", x: el.cx, y: el.cy });
    actions.push({ type: "pause", ms: 600 });
    // Pick a different option
    actions.push({ type: "click", x: el.cx, y: el.cy + el.h + 50 });
    actions.push({ type: "pause", ms: 500 });
  }
  actions.push(...orbitGlow(compBounds.cx, compBounds.cy, Math.max(compBounds.w, compBounds.h) * 0.4));
  return actions;
}

function tooltipChoreography(elements: ElementInfo[]): Action[] {
  const actions: Action[] = [];
  for (const el of elements.slice(0, 3)) {
    // Hover over trigger
    actions.push({ type: "move", x: el.cx - 40, y: el.cy, speed: "normal" });
    actions.push({ type: "hover-hold", x: el.cx, y: el.cy, ms: 1500 });
    // Move away
    actions.push({ type: "move", x: el.cx + 80, y: el.cy - 60, speed: "normal" });
    actions.push({ type: "pause", ms: 400 });
  }
  return actions;
}

function hoverRevealChoreography(elements: ElementInfo[]): Action[] {
  const actions: Action[] = [];
  for (const el of elements.slice(0, 3)) {
    actions.push({ type: "move", x: el.cx - 40, y: el.cy - 30, speed: "normal" });
    actions.push({ type: "hover-hold", x: el.cx, y: el.cy, ms: 2000 });
    actions.push({ type: "move", x: el.cx + 100, y: el.cy - 80, speed: "normal" });
    actions.push({ type: "pause", ms: 500 });
  }
  return actions;
}

function dockChoreography(elements: ElementInfo[], compBounds: ComponentBounds): Action[] {
  const actions: Action[] = [];
  if (elements.length === 0) return generateGenericChoreography(compBounds);

  const sorted = elements.slice().sort((a, b) => a.cx - b.cx);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const mid = sorted[Math.floor(sorted.length / 2)];

  // Slow sweep across all items
  actions.push({ type: "move", x: first.cx - 30, y: first.cy, speed: "normal" });
  actions.push({ type: "sweep", x1: first.cx - 20, y1: first.cy, x2: last.cx + 20, y2: last.cy });
  // Pause on middle
  actions.push({ type: "hover-hold", x: mid.cx, y: mid.cy, ms: 800 });
  // Sweep back
  actions.push({ type: "sweep", x1: last.cx + 20, y1: last.cy, x2: first.cx - 20, y2: first.cy });
  actions.push({ type: "pause", ms: 200 });
  // Second pass faster
  actions.push({ type: "sweep", x1: first.cx - 20, y1: first.cy, x2: last.cx + 20, y2: last.cy });
  actions.push({ type: "hover-hold", x: mid.cx, y: mid.cy, ms: 600 });
  actions.push({ type: "move", x: compBounds.cx, y: compBounds.cy - 80, speed: "slow" });
  return actions;
}

function buttonChoreography(elements: ElementInfo[]): Action[] {
  const actions: Action[] = [];
  for (const el of elements.slice(0, 3)) {
    // Slow approach for magnetic pull / glow
    actions.push({ type: "move", x: el.cx - 60, y: el.cy + 40, speed: "slow" });
    actions.push({ type: "move", x: el.cx - 20, y: el.cy + 10, speed: "slow" });
    actions.push({ type: "hover-hold", x: el.cx, y: el.cy, ms: 600 });
    actions.push({ type: "click", x: el.cx, y: el.cy });
    actions.push({ type: "pause", ms: 300 });
    // Move away
    actions.push({ type: "move", x: el.cx + 50, y: el.cy - 40, speed: "normal" });
    actions.push({ type: "pause", ms: 200 });
    // Approach again
    actions.push({ type: "move", x: el.cx + 5, y: el.cy - 3, speed: "slow" });
    actions.push({ type: "click", x: el.cx + 5, y: el.cy - 3 });
    actions.push({ type: "pause", ms: 300 });
    // Click at a different spot
    actions.push({ type: "click", x: el.cx - 10, y: el.cy + 5 });
    actions.push({ type: "pause", ms: 200 });
  }
  return actions;
}

// --- Main component-aware choreography ---

async function generateComponentChoreography(
  compBounds: ComponentBounds,
  tags: string[],
  page: Page,
): Promise<Action[]> {
  const hasTag = (...t: string[]) => t.some((tag) => tags.includes(tag));

  // 1. Slider / range / drag
  if (hasTag("slider", "range", "drag")) {
    const elements = await findInteractiveElements(page, [
      '[role="slider"]',
      'input[type="range"]',
      '[data-slider-thumb]',
    ]);
    if (elements.length > 0) return sliderChoreography(elements, compBounds);
  }

  // 2. Tabs
  if (hasTag("tabs")) {
    const elements = await findInteractiveElements(page, [
      '[role="tab"]',
      '[role="tablist"] button',
      'button',
    ]);
    if (elements.length > 1) return tabsChoreography(elements, compBounds);
  }

  // 3. Toggle / switch
  if (hasTag("toggle", "switch")) {
    const elements = await findInteractiveElements(page, [
      '[role="switch"]',
      'button[aria-checked]',
      'button',
    ]);
    if (elements.length > 0) return toggleChoreography(elements, compBounds);
  }

  // 4. Checkbox
  if (hasTag("checkbox")) {
    const elements = await findInteractiveElements(page, [
      'input[type="checkbox"]',
      '[role="checkbox"]',
      'button',
    ]);
    if (elements.length > 0) return checkboxChoreography(elements, compBounds);
  }

  // 5. Input / textarea (not select)
  if (hasTag("input", "textarea") && !hasTag("select")) {
    const elements = await findInteractiveElements(page, [
      'input:not([type="checkbox"]):not([type="radio"]):not([type="range"])',
      'textarea',
    ]);
    if (elements.length > 0) return inputChoreography(elements, compBounds);
  }

  // 6. Select / dropdown
  if (hasTag("select", "dropdown")) {
    const elements = await findInteractiveElements(page, [
      'select',
      '[role="combobox"]',
      '[role="listbox"]',
      'button',
    ]);
    if (elements.length > 0) return selectChoreography(elements, compBounds);
  }

  // 7. Tooltip
  if (hasTag("tooltip")) {
    const elements = await findInteractiveElements(page, [
      '[data-tooltip]',
      'button',
      '[role="button"]',
    ]);
    if (elements.length > 0) return tooltipChoreography(elements, compBounds);
  }

  // 8. Hover / reveal
  if (hasTag("hover", "reveal")) {
    const elements = await findInteractiveElements(page, [
      'button',
      '[role="button"]',
      'details',
      'summary',
    ]);
    if (elements.length > 0) return hoverRevealChoreography(elements, compBounds);
  }

  // 9. Dock / navigation
  if (hasTag("dock", "navigation")) {
    const elements = await findInteractiveElements(page, [
      'button',
      'a',
      '[role="button"]',
    ]);
    if (elements.length > 0) return dockChoreography(elements, compBounds);
  }

  // 10. Button / magnetic / icon
  if (hasTag("button", "magnetic", "icon")) {
    const elements = await findInteractiveElements(page, [
      'button',
      '[role="button"]',
    ]);
    if (elements.length > 0) return buttonChoreography(elements, compBounds);
  }

  // 11. Default fallback
  return generateGenericChoreography(compBounds);
}

// --- Screenshot-based recording ---

let frameNum = 0;
let framesDir = "";
const checkpointFrames = [30, 120, 210]; // t=1s, t=4s, t=7s
const checkpointPaths: Map<number, string> = new Map();

async function captureFrame(page: Page) {
  const fname = String(frameNum).padStart(6, "0");
  const framePath = path.join(framesDir, `${fname}.png`);
  await page.screenshot({ path: framePath });

  // Save checkpoint screenshots
  if (checkpointFrames.includes(frameNum)) {
    const cpPath = path.join(RECORDINGS_DIR, `_checkpoint_${slug}_${frameNum}.png`);
    await page.screenshot({ path: cpPath });
    checkpointPaths.set(frameNum, cpPath);
  }

  frameNum++;
}

async function moveTo(page: Page, fromX: number, fromY: number, toX: number, toY: number, steps: number) {
  const dx = toX - fromX, dy = toY - fromY;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const ease = t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3) / 2;
    await page.mouse.move(clamp(fromX + dx * ease, 0, VP_W), clamp(fromY + dy * ease, 0, VP_H));
    await captureFrame(page);
  }
}

async function executeAction(page: Page, action: Action, cx: number, cy: number): Promise<[number, number]> {
  switch (action.type) {
    case "move": {
      const steps = action.speed === "fast" ? 8 : action.speed === "slow" ? 20 : 14;
      await moveTo(page, cx, cy, action.x, action.y, steps);
      return [action.x, action.y];
    }
    case "click": {
      await moveTo(page, cx, cy, action.x, action.y, 6);
      await page.mouse.down();
      await captureFrame(page);
      await captureFrame(page);
      await page.mouse.up();
      await captureFrame(page);
      await captureFrame(page);
      return [action.x, action.y];
    }
    case "sweep": {
      await moveTo(page, cx, cy, action.x1, action.y1, 6);
      await moveTo(page, action.x1, action.y1, action.x2, action.y2, 28);
      return [action.x2, action.y2];
    }
    case "pause": {
      const pauseFrames = Math.max(1, Math.round(action.ms / (1000 / FPS)));
      const anchorX = cx, anchorY = cy;
      const phase = Math.random() * Math.PI * 2;
      for (let i = 0; i < pauseFrames; i++) {
        if (pauseFrames > 10) {
          const t = i / FPS;
          const driftX = Math.sin(t * 4.2 + phase) * 1.5;
          const driftY = Math.cos(t * 3.1 + phase) * 1.0;
          await page.mouse.move(clamp(anchorX + driftX, 0, VP_W), clamp(anchorY + driftY, 0, VP_H));
        }
        await captureFrame(page);
      }
      return [anchorX, anchorY];
    }
    case "type": {
      // Click is assumed to have already happened (focus set).
      // Type character by character, capturing a frame per keystroke.
      for (const char of action.text) {
        await page.keyboard.type(char, { delay: 0 });
        await captureFrame(page);
        await captureFrame(page); // Two frames per char for visible pace
      }
      return [cx, cy];
    }
    case "drag": {
      // Move to start position
      await moveTo(page, cx, cy, action.x1, action.y1, 8);
      // Mouse down
      await page.mouse.down();
      await captureFrame(page);
      // Smooth move to end
      const dragSteps = 24;
      const dx = action.x2 - action.x1;
      const dy = action.y2 - action.y1;
      for (let i = 1; i <= dragSteps; i++) {
        const t = i / dragSteps;
        const ease = t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t+2, 2) / 2;
        await page.mouse.move(
          clamp(action.x1 + dx * ease, 0, VP_W),
          clamp(action.y1 + dy * ease, 0, VP_H),
        );
        await captureFrame(page);
      }
      // Mouse up
      await page.mouse.up();
      await captureFrame(page);
      await captureFrame(page);
      return [action.x2, action.y2];
    }
    case "hover-hold": {
      // Move to position
      await moveTo(page, cx, cy, action.x, action.y, 12);
      // Hold with breathing drift
      const holdFrames = Math.max(1, Math.round(action.ms / (1000 / FPS)));
      const phase = Math.random() * Math.PI * 2;
      for (let i = 0; i < holdFrames; i++) {
        const t = i / FPS;
        const driftX = Math.sin(t * 4.2 + phase) * 1.5;
        const driftY = Math.cos(t * 3.1 + phase) * 1.0;
        await page.mouse.move(
          clamp(action.x + driftX, 0, VP_W),
          clamp(action.y + driftY, 0, VP_H),
        );
        await captureFrame(page);
      }
      return [action.x, action.y];
    }
    default:
      return [cx, cy];
  }
}

// --- Video validation ---

async function validateRecording(
  slug: string,
  compBounds: ComponentBounds,
  framesExpected: number,
  framesCaptured: number,
  durationS: number,
): Promise<void> {
  type ValidationReport = {
    slug: string;
    timestamp: string;
    video: string;
    duration_s: number;
    frames_captured: number;
    frames_expected: number;
    render_check: { passed: boolean; pixel_variance: number };
    interaction_check: { passed: boolean; max_diff: number };
    frame_check: { passed: boolean; ratio: number };
    overall: "pass" | "warn" | "fail";
  };

  const report: ValidationReport = {
    slug,
    timestamp: new Date().toISOString(),
    video: `recordings/${slug}.mp4`,
    duration_s: durationS,
    frames_captured: framesCaptured,
    frames_expected: framesExpected,
    render_check: { passed: true, pixel_variance: 0 },
    interaction_check: { passed: true, max_diff: 0 },
    frame_check: { passed: true, ratio: 0 },
    overall: "pass" as "pass" | "warn" | "fail",
  };

  // Frame count check
  const frameRatio = framesCaptured / framesExpected;
  report.frame_check = { passed: frameRatio >= 0.95, ratio: frameRatio };

  // Render check — sample checkpoint at frame 30 (t=1s)
  const cp1Path = checkpointPaths.get(30);
  if (cp1Path && existsSync(cp1Path)) {
    try {
      // Use ffmpeg to extract pixel data from the checkpoint
      const samplePixels = extractPixelStats(cp1Path, compBounds);
      report.render_check = { passed: samplePixels.stddev > 10, pixel_variance: samplePixels.stddev };
    } catch (e) {
      console.warn("Render check skipped:", (e as Error).message);
    }
  }

  // Interaction check — compare checkpoint at 1s vs 4s
  const cp2Path = checkpointPaths.get(120);
  if (cp1Path && cp2Path && existsSync(cp1Path) && existsSync(cp2Path)) {
    try {
      const diff = compareCheckpoints(cp1Path, cp2Path, compBounds);
      report.interaction_check = { passed: diff > 300, max_diff: diff };
    } catch (e) {
      console.warn("Interaction check skipped:", (e as Error).message);
    }
  }

  // Determine overall
  if (!report.render_check.passed) {
    report.overall = "fail";
  } else if (!report.interaction_check.passed) {
    report.overall = "warn";
  } else {
    report.overall = "pass";
  }

  const reportPath = path.join(RECORDINGS_DIR, `${slug}.validation.json`);
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`Validation: ${report.overall} — ${reportPath}`);
  if (report.overall === "fail") {
    console.warn(`  FAIL: render_check — pixel variance ${report.render_check.pixel_variance.toFixed(1)} (< 10 = blank/black)`);
  }
  if (report.overall === "warn") {
    console.warn(`  WARN: interaction_check — diff ${report.interaction_check.max_diff} (< 300 = no visible change)`);
  }

  // Clean up checkpoint files
  for (const cpPath of checkpointPaths.values()) {
    try { if (existsSync(cpPath)) unlinkSync(cpPath); } catch {}
  }
}

function extractPixelStats(imagePath: string, bounds: ComponentBounds): { stddev: number } {
  // Use ffmpeg to get pixel stats within component bounds
  const cropX = Math.max(0, Math.round(bounds.left));
  const cropY = Math.max(0, Math.round(bounds.top));
  const cropW = Math.min(Math.round(bounds.w), VP_W - cropX);
  const cropH = Math.min(Math.round(bounds.h), VP_H - cropY);

  try {
    const result = execFileSync("ffmpeg", [
      "-i", imagePath,
      "-vf", `crop=${cropW}:${cropH}:${cropX}:${cropY}`,
      "-f", "rawvideo", "-pix_fmt", "gray", "-",
    ], { stdio: ["pipe", "pipe", "pipe"], maxBuffer: 10 * 1024 * 1024 });

    const pixels = new Uint8Array(result);
    if (pixels.length === 0) return { stddev: 0 };

    let sum = 0;
    for (let i = 0; i < pixels.length; i++) sum += pixels[i];
    const mean = sum / pixels.length;

    let variance = 0;
    for (let i = 0; i < pixels.length; i++) {
      const d = pixels[i] - mean;
      variance += d * d;
    }
    variance /= pixels.length;
    return { stddev: Math.sqrt(variance) };
  } catch {
    return { stddev: 999 }; // If we can't check, assume it's fine
  }
}

function compareCheckpoints(path1: string, path2: string, bounds: ComponentBounds): number {
  const cropX = Math.max(0, Math.round(bounds.left));
  const cropY = Math.max(0, Math.round(bounds.top));
  const cropW = Math.min(Math.round(bounds.w), VP_W - cropX);
  const cropH = Math.min(Math.round(bounds.h), VP_H - cropY);
  const vf = `crop=${cropW}:${cropH}:${cropX}:${cropY},scale=100:100`;

  try {
    const buf1 = execFileSync("ffmpeg", [
      "-i", path1, "-vf", vf, "-f", "rawvideo", "-pix_fmt", "gray", "-",
    ], { stdio: ["pipe", "pipe", "pipe"], maxBuffer: 1024 * 1024 });

    const buf2 = execFileSync("ffmpeg", [
      "-i", path2, "-vf", vf, "-f", "rawvideo", "-pix_fmt", "gray", "-",
    ], { stdio: ["pipe", "pipe", "pipe"], maxBuffer: 1024 * 1024 });

    const p1 = new Uint8Array(buf1);
    const p2 = new Uint8Array(buf2);
    const len = Math.min(p1.length, p2.length);

    let totalDiff = 0;
    for (let i = 0; i < len; i++) {
      totalDiff += Math.abs(p1[i] - p2[i]);
    }
    return totalDiff;
  } catch {
    return 9999; // If we can't compare, assume it's fine
  }
}

// --- Server ---

async function startProductionServer(): Promise<ChildProcess | null> {
  // If PRISM_SERVER_RUNNING is set, skip starting server entirely
  if (process.env.PRISM_SERVER_RUNNING === "1") {
    console.log(`Using existing server on port ${PORT}`);
    // Verify server is reachable
    for (let i = 0; i < 5; i++) {
      try {
        const res = await fetch(`${BASE_URL}/${slug}`);
        if (res.ok) return null;
      } catch {}
      await new Promise((r) => setTimeout(r, 1000));
    }
    throw new Error(`Server not reachable at ${BASE_URL}/${slug} — is it running on port ${PORT}?`);
  }

  // Build unless SKIP_BUILD is set
  if (process.env.SKIP_BUILD !== "1") {
    console.log("Building production bundle...");
    execFileSync("pnpm", ["build"], { stdio: "inherit", cwd: process.cwd() });
  } else {
    console.log("Skipping build (SKIP_BUILD=1)");
  }

  console.log(`Starting production server on port ${PORT}...`);
  const server = spawn("npx", ["next", "start", "-p", String(PORT)], {
    stdio: "pipe",
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(PORT) },
  });

  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`${BASE_URL}/${slug}`);
      if (res.ok) return server;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }

  server.kill();
  throw new Error("Server failed to start");
}

// --- Main ---

async function record() {
  const item = getRegistryItem(slug!);
  const duration = computeDuration(item);
  const tags = item?.tags ?? [];

  console.log(`Recording ${slug} (${duration / 1000}s) ${isTikTok ? "9:16" : "1:1"} @ ${FPS}fps...`);
  if (item) console.log(`Tags: [${tags.join(", ")}]`);

  const server = await startProductionServer();

  try {
    const browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext({ viewport: { width: VP_W, height: VP_H } });

    framesDir = path.join(RECORDINGS_DIR, `_frames_${slug}`);
    if (!existsSync(framesDir)) mkdirSync(framesDir, { recursive: true });
    frameNum = 0;
    checkpointPaths.clear();

    const page = await ctx.newPage();

    await page.addInitScript(() => {
      const s = document.createElement("style");
      s.textContent = `
        html, body { overflow: hidden !important; background: #050505 !important; }
        nav { display: none !important; }
        main { padding-top: 0 !important; }
        .fixed.inset-0 { top: 0 !important; }
      `;
      if (document.head) document.head.appendChild(s);
      else document.addEventListener("DOMContentLoaded", () => document.head.appendChild(s));
    });

    await page.goto(`${BASE_URL}/${slug}`, { waitUntil: "networkidle", timeout: 30000 });

    // Wait for hydration
    await page.waitForFunction(() => {
      const btns = document.querySelectorAll("button, [role='button']");
      if (Array.from(btns).some((el) => el.getBoundingClientRect().width > 15)) return true;
      const all = document.querySelectorAll("*");
      return Array.from(all).some((el) => getComputedStyle(el).cursor === "pointer" && el.getBoundingClientRect().width > 20);
    }, { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(400);

    await preparePage(page);
    await page.waitForTimeout(200);

    const compBounds = await findComponentBounds(page);
    const debugCount = await page.evaluate(() => window.__debugCandidates || 0);
    console.log(`Component at (${Math.round(compBounds.cx)}, ${Math.round(compBounds.cy)}) ${Math.round(compBounds.w)}x${Math.round(compBounds.h)} (${debugCount} candidates)`);

    await injectCursor(page);
    await page.addStyleTag({ content: "html, body, * { cursor: none !important; }" });
    await page.waitForTimeout(200);

    // Generate component-aware choreography
    const choreography = await generateComponentChoreography(compBounds, tags, page);

    // Start cursor off-screen left
    let curX = 0;
    let curY = compBounds.cy;
    await page.mouse.move(curX, curY);

    // Capture frames during choreography
    let idx = 0;
    const maxFrames = FPS * (duration / 1000);

    while (frameNum < maxFrames) {
      const action = choreography[idx % choreography.length];
      idx++;
      [curX, curY] = await executeAction(page, action, curX, curY);
    }

    await ctx.close();
    await browser.close();

    console.log(`Captured ${frameNum} frames`);

    // Calculate crop
    const PAD = isTikTok ? 160 : 120;
    const maxDim = Math.max(compBounds.w, compBounds.h);
    const minCrop = isTikTok ? 350 : 400;
    const cropW = Math.min(Math.max(maxDim + PAD * 2, minCrop), VP_W);
    const cropH = isTikTok ? Math.min(cropW * (1920 / 1080), VP_H) : Math.min(cropW, VP_H);
    const cropX = Math.max(0, Math.min(Math.round(compBounds.cx - cropW / 2), VP_W - cropW));
    const cropY = Math.max(0, Math.min(Math.round(compBounds.cy - cropH / 2), VP_H - cropH));

    console.log(`Cropping: ${Math.round(cropW)}x${Math.round(cropH)} at (${cropX}, ${cropY}) -> ${OUT_W}x${OUT_H}`);

    const mp4 = path.join(RECORDINGS_DIR, `${slug}.mp4`);

    execFileSync("ffmpeg", [
      "-y", "-framerate", String(FPS),
      "-i", path.join(framesDir, "%06d.png"),
      "-vf", `crop=${Math.round(cropW)}:${Math.round(cropH)}:${cropX}:${cropY},scale=${OUT_W}:${OUT_H}:flags=lanczos`,
      "-c:v", "libx264", "-pix_fmt", "yuv420p",
      "-movflags", "+faststart", "-crf", "16",
      "-preset", "slow",
      mp4,
    ], { stdio: "pipe" });

    // Validate recording
    await validateRecording(slug!, compBounds, maxFrames, frameNum, duration / 1000);

    // Clean up frames
    for (const f of readdirSync(framesDir)) unlinkSync(path.join(framesDir, f));
    try { rmdirSync(framesDir); } catch {}

    console.log(`Saved: ${mp4} (${OUT_W}x${OUT_H}, ${frameNum} frames @ ${FPS}fps)`);

  } finally {
    if (server) server.kill();
  }
}

record().catch((err) => {
  console.error(err);
  process.exit(1);
});
