/**
 * Record a visual experiment as a video.
 *
 * Usage:
 *   npx tsx scripts/record.ts <slug> [duration_seconds]
 *
 * Outputs:
 *   recordings/<slug>.webm  — raw video
 *   recordings/<slug>.mp4   — converted (if ffmpeg available)
 *
 * The script:
 * 1. Launches headless Chromium at 1080x1080 (square, good for X/IG)
 * 2. Navigates to the experiment
 * 3. Simulates smooth cursor movement (bezier curves)
 * 4. Clicks a few times to trigger interactions
 * 5. Records for the specified duration (default: 12s)
 * 6. Saves the video and converts to mp4
 */

import { chromium } from "playwright";
import { execFileSync } from "child_process";
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from "fs";
import path from "path";

const slug = process.argv[2];
const duration = parseInt(process.argv[3] || "12", 10) * 1000;

if (!slug) {
  console.error("Usage: npx tsx scripts/record.ts <slug> [duration_seconds]");
  process.exit(1);
}

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const RECORDINGS_DIR = path.join(process.cwd(), "recordings");
const SIZE = 1080;

if (!existsSync(RECORDINGS_DIR)) {
  mkdirSync(RECORDINGS_DIR, { recursive: true });
}

async function smoothMove(
  page: Awaited<ReturnType<typeof chromium.launch>>["contexts"][0]["pages"][0],
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  steps: number = 40,
) {
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    // Ease in-out cubic
    const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const x = fromX + (toX - fromX) * ease;
    const y = fromY + (toY - fromY) * ease;
    await page.mouse.move(x, y);
    await page.waitForTimeout(16); // ~60fps
  }
}

async function record() {
  console.log(`Recording ${slug} (${duration / 1000}s)...`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: SIZE, height: SIZE },
    recordVideo: {
      dir: RECORDINGS_DIR,
      size: { width: SIZE, height: SIZE },
    },
  });

  const page = await context.newPage();
  await page.goto(`${BASE_URL}/${slug}`, { waitUntil: "networkidle" });

  // Wait for canvas/content to initialise
  await page.waitForTimeout(1000);

  const startTime = Date.now();
  let curX = SIZE / 2;
  let curY = SIZE / 2;

  // Move cursor in organic patterns across the canvas
  while (Date.now() - startTime < duration) {
    // Random target within the viewport, biased toward center
    const targetX = SIZE * 0.15 + Math.random() * SIZE * 0.7;
    const targetY = SIZE * 0.15 + Math.random() * SIZE * 0.7;

    await smoothMove(page, curX, curY, targetX, targetY, 50);

    // Occasionally click to trigger particle bursts
    if (Math.random() > 0.6) {
      await page.mouse.click(targetX, targetY);
      await page.waitForTimeout(300);
    }

    curX = targetX;
    curY = targetY;

    // Brief pause between movements
    await page.waitForTimeout(200 + Math.random() * 400);
  }

  // Hold final frame
  await page.waitForTimeout(1000);

  await context.close();
  await browser.close();

  // Find the recorded video (Playwright names it with a hash)
  const files = readdirSync(RECORDINGS_DIR)
    .filter((f: string) => f.endsWith(".webm"))
    .map((f: string) => ({
      name: f,
      time: statSync(path.join(RECORDINGS_DIR, f)).mtimeMs,
    }))
    .sort((a: { time: number }, b: { time: number }) => b.time - a.time);

  if (files.length === 0) {
    console.error("No recording found");
    process.exit(1);
  }

  const webmPath = path.join(RECORDINGS_DIR, files[0].name);
  const mp4Path = path.join(RECORDINGS_DIR, `${slug}.mp4`);

  // Convert to mp4 with ffmpeg if available
  try {
    execFileSync("ffmpeg", [
      "-y",
      "-i", webmPath,
      "-c:v", "libx264",
      "-pix_fmt", "yuv420p",
      "-movflags", "+faststart",
      "-crf", "18",
      mp4Path,
    ], { stdio: "pipe" });
    console.log(`Saved: ${mp4Path}`);
    unlinkSync(webmPath);
  } catch {
    console.log(`Saved: ${webmPath} (install ffmpeg for mp4 conversion)`);
  }
}

record().catch((err) => {
  console.error(err);
  process.exit(1);
});
