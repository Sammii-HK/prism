// Run: node --test --experimental-strip-types scripts/reading-pace.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  analyse, recentPace, wordsAt, blockIndexAt, totalWords, countWords, etaSeconds, formatEta, classifyDwell,
  capSamples, DEFAULT_PARAMS, type Block, type Sample,
} from "../app/lib/reading-pace-core.ts";

// Ten blocks of 100 words, 200 px tall each: 2 px per word.
const blocks: Block[] = Array.from({ length: 10 }, (_, i) => ({ top: i * 200, height: 200, words: 100 }));
const PX_PER_WORD = 2;

/** A reader who moves at `wpm` for `seconds`, sampled every 250 ms, starting at word `from`. */
const steady = (wpm: number, seconds: number, from = 0, t0 = 0): Sample[] => {
  const out: Sample[] = [];
  for (let t = 0; t <= seconds * 1000; t += 250) out.push({ t: t0 + t, y: (from + (wpm / 60000) * t) * PX_PER_WORD });
  return out;
};

test("countWords", () => {
  assert.equal(countWords(""), 0);
  assert.equal(countWords("  one  two\nthree "), 3);
});

test("wordsAt interpolates inside a block and clamps at both ends", () => {
  assert.equal(wordsAt(-50, blocks), 0);
  assert.equal(wordsAt(100, blocks), 50);
  assert.equal(wordsAt(200, blocks), 100);
  assert.equal(wordsAt(5000, blocks), 1000);
  assert.equal(totalWords(blocks), 1000);
});

test("blockIndexAt", () => {
  assert.equal(blockIndexAt(0, blocks), 0);
  assert.equal(blockIndexAt(199, blocks), 0);
  assert.equal(blockIndexAt(200, blocks), 1);
  assert.equal(blockIndexAt(99999, blocks), 9);
  assert.equal(blockIndexAt(0, []), -1);
});

test("a steady 200 wpm reader is measured as about 200 wpm", () => {
  const p = analyse(steady(200, 60), blocks);
  assert.ok(p.wpm !== null && Math.abs(p.wpm - 200) < 6, `got ${p.wpm}`);
  assert.equal(p.skimmedWords, 0);
  assert.equal(p.rereadWords, 0);
});

test("a faster reader measures faster, and the order holds", () => {
  const slow = analyse(steady(150, 60), blocks).wpm!;
  const fast = analyse(steady(300, 60), blocks).wpm!;
  assert.ok(fast > slow * 1.8);
});

test("no pace is reported until there is enough active time", () => {
  assert.equal(analyse(steady(200, 2), blocks).wpm, null);
  assert.equal(analyse([], blocks).wpm, null);
  assert.equal(analyse([{ t: 0, y: 0 }], blocks).wpm, null);
});

test("a long pause is idle time, not slow reading", () => {
  const a = steady(200, 30);
  const pause: Sample[] = [];
  const lastY = a[a.length - 1].y;
  for (let t = 250; t <= 60000; t += 250) pause.push({ t: 30000 + t, y: lastY });
  const b = steady(200, 30, wordsAt(lastY, blocks), 90000);
  const p = analyse([...a, ...pause, ...b], blocks);
  assert.ok(p.idleMs >= 45000, `idle ${p.idleMs}`);
  assert.ok(p.wpm !== null && Math.abs(p.wpm - 200) < 10, `got ${p.wpm}`);
});

test("a short pause counts as reading time", () => {
  const a = steady(200, 20);
  const lastY = a[a.length - 1].y;
  const pause: Sample[] = [];
  for (let t = 250; t <= 6000; t += 250) pause.push({ t: 20000 + t, y: lastY });
  const withPause = analyse([...a, ...pause], blocks);
  assert.equal(withPause.idleMs, 0);
  assert.ok(withPause.wpm! < analyse(a, blocks).wpm!);
});

test("a jump is skimmed words, not a pace spike", () => {
  const a = steady(200, 30);
  const y = a[a.length - 1].y;
  const jumped: Sample[] = [...a, { t: 30250, y: y + 400 * PX_PER_WORD }];
  const b = steady(200, 30, wordsAt(y, blocks) + 400, 30250);
  const p = analyse([...jumped, ...b.slice(1)], blocks);
  assert.ok(p.skimmedWords >= 300, `skimmed ${p.skimmedWords}`);
  assert.ok(Math.abs(p.wpm! - 200) < 12, `got ${p.wpm}`);
});

test("scrolling back is counted as re-reading", () => {
  const a = steady(200, 30);
  const back: Sample[] = [];
  const y0 = a[a.length - 1].y;
  for (let k = 1; k <= 12; k++) back.push({ t: 30000 + k * 250, y: y0 - (k * 5 * PX_PER_WORD) });
  const p = analyse([...a, ...back], blocks);
  assert.ok(p.rereadWords > 20, `reread ${p.rereadWords}`);
});

test("dwell lands on the block being read, and sums to the active time", () => {
  const p = analyse(steady(200, 30), blocks);
  const sum = p.dwellMs.reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - p.activeMs) < 1);
  // 200 wpm for 30 s is 100 words: all in block 0.
  assert.ok(p.dwellMs[0] > p.activeMs * 0.95);
  assert.equal(p.dwellMs[5], 0);
});

test("recentPace follows a change of speed; analyse over everything lags", () => {
  const a = steady(150, 60);
  const yEnd = a[a.length - 1].y;
  const b = steady(400, 40, wordsAt(yEnd, blocks), 60000).slice(1);
  const all = [...a, ...b];
  const recent = recentPace(all, blocks, DEFAULT_PARAMS).wpm!;
  const overall = analyse(all, blocks).wpm!;
  assert.ok(Math.abs(recent - 400) < 25, `recent ${recent}`);
  assert.ok(overall < recent && overall > 150);
});

test("eta and its text", () => {
  assert.equal(etaSeconds(300, 200), 90);
  assert.equal(etaSeconds(300, null), null);
  assert.equal(etaSeconds(-5, 200), 0);
  assert.equal(formatEta(90), "1 min 30 s");
  assert.equal(formatEta(45), "45 s");
  assert.equal(formatEta(null), "not enough movement yet");
  assert.equal(formatEta(0), "done");
});

test("classifyDwell compares time spent with time at your own pace", () => {
  // 100 words at 200 wpm is 30 s.
  assert.equal(classifyDwell(0, 100, 200), "unvisited");
  assert.equal(classifyDwell(5000, 100, null), "visited");
  assert.equal(classifyDwell(5000, 100, 200), "skimmed");
  assert.equal(classifyDwell(30000, 100, 200), "read");
  assert.equal(classifyDwell(60000, 100, 200), "lingered");
});

test("capSamples keeps the newest", () => {
  const s = Array.from({ length: 10 }, (_, i) => ({ t: i, y: i }));
  assert.deepEqual(capSamples(s, 3).map((x) => x.t), [7, 8, 9]);
  assert.equal(capSamples(s, 50).length, 10);
});
