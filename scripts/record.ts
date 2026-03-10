/**
 * Record a component demo as a scroll-stopping video for social media.
 *
 * Usage:
 *   npx tsx scripts/record.ts <slug> [duration_seconds] [--tiktok]
 *
 * Uses screenshot-based recording (not recordVideo) to guarantee cursor capture.
 * Starts a production server, takes screenshots at 30fps, stitches into mp4.
 */

import { chromium } from "playwright";
import { execFileSync, spawn, type ChildProcess } from "child_process";
import { existsSync, mkdirSync, readdirSync, unlinkSync, rmdirSync } from "fs";
import path from "path";

const slug = process.argv[2];
const duration = parseInt(process.argv[3] || "8", 10) * 1000;
const isTikTok = process.argv.includes("--tiktok");

if (!slug) {
  console.error("Usage: npx tsx scripts/record.ts <slug> [duration_seconds] [--tiktok]");
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

function rand(min: number, max: number) { return min + Math.random() * (max - min); }
function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)); }

interface ComponentBounds { cx: number; cy: number; w: number; h: number; left: number; top: number; }

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
    // Find the main visual component — prefer the smallest non-trivial element
    // that's not a full-screen wrapper
    const candidates: { el: Element; area: number }[] = [];
    // Search for the demo component — look for elements with visible borders or interactivity
    const demo = document.querySelector(".fixed.inset-0");
    const searchRoot = demo || document.body;
    searchRoot.querySelectorAll("*").forEach((el) => {
      const hasRoundedClass = el.className && typeof el.className === "string" && el.className.includes("rounded");
      const hasInlineBorderRadius = (el as HTMLElement).style?.borderRadius !== "";
      const isInteractive = el.tagName === "BUTTON" || el.tagName === "A";
      if (!hasRoundedClass && !hasInlineBorderRadius && !isInteractive) return;
      const rect = el.getBoundingClientRect();
      // Skip full-width or full-height elements
      if (rect.width > window.innerWidth * 0.7) return;
      if (rect.width < 40 || rect.height < 40) return;
      candidates.push({ el, area: rect.width * rect.height });
    });

    // Sort by area — pick the largest that isn't a full-screen wrapper
    candidates.sort((a, b) => b.area - a.area);

    // Pick the first reasonable candidate
    let bestEl = candidates.length > 0 ? candidates[0].el : null;

    // Return debug info too
    (window as any).__debugCandidates = candidates.length;

    if (!bestEl) {
      // Fallback: look in the demo container for the biggest non-fullscreen child
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

// --- Choreography ---

type Action =
  | { type: "move"; x: number; y: number; speed: "fast" | "normal" | "slow" }
  | { type: "click"; x: number; y: number }
  | { type: "sweep"; x1: number; y1: number; x2: number; y2: number }
  | { type: "pause"; ms: number };

function generateChoreography(compBounds: ComponentBounds): Action[] {
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

// --- Screenshot-based recording ---

let frameNum = 0;
let framesDir = "";

async function captureFrame(page: Page) {
  const fname = String(frameNum).padStart(6, "0");
  await page.screenshot({ path: path.join(framesDir, `${fname}.png`) });
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
        // Slow breathing drift — 1.5s period, max ±1.5px
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
    default:
      return [cx, cy];
  }
}

// --- Server ---

async function startProductionServer(): Promise<ChildProcess> {
  console.log("Building production bundle...");
  execFileSync("pnpm", ["build"], { stdio: "inherit", cwd: process.cwd() });

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
  console.log(`Recording ${slug} (${duration / 1000}s) ${isTikTok ? "9:16" : "1:1"} @ ${FPS}fps...`);

  const server = await startProductionServer();

  try {
    const browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext({ viewport: { width: VP_W, height: VP_H } });

    framesDir = path.join(RECORDINGS_DIR, `_frames_${slug}`);
    if (!existsSync(framesDir)) mkdirSync(framesDir, { recursive: true });
    frameNum = 0;

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
    const debugCount = await page.evaluate(() => (window as any).__debugCandidates || 0);
    console.log(`Component at (${Math.round(compBounds.cx)}, ${Math.round(compBounds.cy)}) ${Math.round(compBounds.w)}x${Math.round(compBounds.h)} (${debugCount} candidates)`);

    await injectCursor(page);
    await page.addStyleTag({ content: "html, body, * { cursor: none !important; }" });
    await page.waitForTimeout(200);

    const choreography = generateChoreography(compBounds);

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
    let cropW = Math.min(Math.max(maxDim + PAD * 2, minCrop), VP_W);
    let cropH = isTikTok ? Math.min(cropW * (1920 / 1080), VP_H) : Math.min(cropW, VP_H);
    cropW = Math.min(cropW, VP_W);
    let cropX = Math.max(0, Math.min(Math.round(compBounds.cx - cropW / 2), VP_W - cropW));
    let cropY = Math.max(0, Math.min(Math.round(compBounds.cy - cropH / 2), VP_H - cropH));

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

    // Clean up frames
    for (const f of readdirSync(framesDir)) unlinkSync(path.join(framesDir, f));
    try { rmdirSync(framesDir); } catch {}

    console.log(`Saved: ${mp4} (${OUT_W}x${OUT_H}, ${frameNum} frames @ ${FPS}fps)`);

  } finally {
    server.kill();
  }
}

record().catch((err) => {
  console.error(err);
  process.exit(1);
});
