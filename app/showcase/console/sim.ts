/**
 * The fake backend for the release console. Everything is seeded, so the same
 * commit and attempt always produce the same run: the demo behaves like a real
 * system (variable latency, the odd cache miss, a flaky test) without ever
 * being random in a way that is hard to talk about.
 */

export type EnvId = "production" | "preview" | "staging";
export type StepId = "build" | "test" | "deploy" | "verify";
export type LogLevel = "info" | "ok" | "warn" | "error";

export type Person = { name: string; initials: string };

export type Commit = { sha: string; message: string; author: Person; branch: string };

export type LogLine = { id: number; atMs: number; step: StepId; level: LogLevel; text: string };

export type Deployment = {
  id: string;
  env: EnvId;
  commit: Commit;
  /** performance.now() time it went live; seeded ones are negative (before the page loaded). */
  at: number;
  durationMs: number;
  /** The run's logs if it happened in this session; older ones are fetched on demand. */
  logs?: LogLine[];
};

export type Failure = { title: string; file: string; detail: string[] };

export type StepPlan = {
  id: StepId;
  durationMs: number;
  /** Lines to emit, each at a fraction (0-1) of the step's duration. */
  lines: Array<{ at: number; level: LogLevel; text: string }>;
  fails: boolean;
};

export type RunPlan = { steps: StepPlan[]; slow: boolean; failure?: Failure };

// ---------------------------------------------------------------------------
// Seeded randomness

/** mulberry32: tiny, fast, good enough for a demo. */
export const rng = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

const between = (r: () => number, lo: number, hi: number) => lo + r() * (hi - lo);
const pick = <T,>(r: () => number, xs: T[]) => xs[Math.floor(r() * xs.length)];

// ---------------------------------------------------------------------------
// The fictional team and project

export const PROJECT = { name: "fieldnote-web", repo: "fieldnote/web" };

export const PEOPLE = {
  priya: { name: "Priya Raman", initials: "PR" },
  jonah: { name: "Jonah Okafor", initials: "JO" },
  mei: { name: "Mei Lin", initials: "ML" },
  tomas: { name: "Tomás Ferreira", initials: "TF" },
  ada: { name: "Ada Brennan", initials: "AB" },
} satisfies Record<string, Person>;

export const ONLINE: Array<Person & { doing: string }> = [
  { ...PEOPLE.priya, doing: "Watching Production" },
  { ...PEOPLE.jonah, doing: "Editing flags" },
  { ...PEOPLE.mei, doing: "Reading logs" },
];

export const ENVS: Array<{ id: EnvId; label: string; host: string }> = [
  { id: "production", label: "Production", host: "fieldnote.app" },
  { id: "preview", label: "Preview", host: "preview.fieldnote.app" },
  { id: "staging", label: "Staging", host: "staging.fieldnote.app" },
];

export const envLabel = (id: EnvId) => ENVS.find((e) => e.id === id)!.label;
export const envHost = (id: EnvId) => ENVS.find((e) => e.id === id)!.host;

/** Commits waiting on main, oldest first. Each deploy ships the next one. */
export const QUEUE: Commit[] = [
  { sha: "a3f9c21", message: "Fix double submit on the billing form", author: PEOPLE.priya, branch: "main" },
  { sha: "e81b0d4", message: "Debounce note autosave to 600ms", author: PEOPLE.jonah, branch: "main" },
  { sha: "5c27fa9", message: "Move image resizing to the edge runtime", author: PEOPLE.mei, branch: "main" },
  { sha: "b04e6c3", message: "Add keyboard shortcut for new notebook", author: PEOPLE.tomas, branch: "main" },
  { sha: "91d3e7a", message: "Stop sync retrying on 401s", author: PEOPLE.ada, branch: "main" },
  { sha: "2fe8a10", message: "Bump next to 16.2.4", author: PEOPLE.jonah, branch: "main" },
  { sha: "d6a4b59", message: "Paginate the shared-with-me list", author: PEOPLE.priya, branch: "main" },
  { sha: "7e0c3f2", message: "Respect reduced motion in the onboarding tour", author: PEOPLE.mei, branch: "main" },
  { sha: "c58d1b7", message: "Index notes by updated_at for search", author: PEOPLE.tomas, branch: "main" },
  { sha: "f1a9e46", message: "Copy edits on the export dialog", author: PEOPLE.ada, branch: "main" },
];

const MIN = 60_000;

/** What each environment was serving before the page loaded, newest first. */
export const SEED_HISTORY: Record<EnvId, Deployment[]> = {
  production: [
    { sha: "7c1e0a2", message: "Cache the notebook tree per workspace", author: PEOPLE.mei, ago: 42 * MIN, d: 8925 },
    { sha: "4b9d2e8", message: "Fix caret jump when pasting rich text", author: PEOPLE.priya, ago: 3 * 60 * MIN, d: 8612 },
    { sha: "e3f6017", message: "Add billing portal link to settings", author: PEOPLE.ada, ago: 26 * 60 * MIN, d: 9275 },
    { sha: "0a8c5d3", message: "Lazy-load the PDF exporter", author: PEOPLE.jonah, ago: 2 * 24 * 60 * MIN, d: 8350 },
  ].map((s) => seed("production", s)),
  preview: [
    { sha: "8d2f4c1", message: "Try a denser note list on tablets", author: PEOPLE.tomas, ago: 18 * MIN, d: 6537 },
    { sha: "63ae9b0", message: "Offline sync: queue edits in IndexedDB", author: PEOPLE.ada, ago: 95 * MIN, d: 6887 },
  ].map((s) => seed("preview", s, "feat/offline-sync")),
  staging: [
    { sha: "7c1e0a2", message: "Cache the notebook tree per workspace", author: PEOPLE.mei, ago: 64 * MIN, d: 8725 },
    { sha: "4b9d2e8", message: "Fix caret jump when pasting rich text", author: PEOPLE.priya, ago: 4 * 60 * MIN, d: 8762 },
  ].map((s) => seed("staging", s)),
};

function seed(
  env: EnvId,
  s: { sha: string; message: string; author: Person; ago: number; d: number },
  branch = "main"
): Deployment {
  return {
    id: `${env}-${s.sha}`,
    env,
    commit: { sha: s.sha, message: s.message, author: s.author, branch },
    at: -s.ago,
    durationMs: s.d,
  };
}

// ---------------------------------------------------------------------------
// Pipeline

export const STEPS: Array<{ id: StepId; label: string; detail: string; typicalMs: number }> = [
  { id: "build", label: "Build", detail: "next build, remote cache", typicalMs: 3000 },
  { id: "test", label: "Test", detail: "214 unit, 38 integration", typicalMs: 2100 },
  { id: "deploy", label: "Deploy", detail: "iad1, fra1, sin1", typicalMs: 1600 },
  { id: "verify", label: "Verify", detail: "health checks, smoke tests", typicalMs: 1100 },
];

const FAILURES: Failure[] = [
  {
    title: "1 test failed in apply-discount.test.ts",
    file: "src/billing/__tests__/apply-discount.test.ts:48",
    detail: [
      "● applyDiscount › rejects a code that has already been redeemed",
      "  expect(received).rejects.toThrow()",
      "  Received promise resolved instead of rejected",
    ],
  },
  {
    title: "1 test timed out in sync-queue.test.ts",
    file: "src/sync/__tests__/sync-queue.test.ts:112",
    detail: [
      "● SyncQueue › flushes pending edits after reconnect",
      "  Exceeded timeout of 5000 ms for a test.",
      "  Likely flaky: passed on 9 of the last 10 runs.",
    ],
  },
  {
    title: "2 tests failed in note-search.test.ts",
    file: "src/search/__tests__/note-search.test.ts:27",
    detail: [
      "● search › ranks exact title matches first",
      "  Expected: \"Quarterly planning\"  Received: \"Planning notes (old)\"",
      "● search › ignores archived notebooks",
    ],
  },
];

/**
 * Plan a run. After the scripted opening, roughly one run in five fails at
 * Test (one in ten on a retry) and one in four misses the build cache and
 * runs slow. Seeded by commit, environment and attempt, so it is repeatable.
 */
export const planRun = (commit: Commit, env: EnvId, attempt: number, runIndex: number): RunPlan => {
  const r = rng(hash(`${commit.sha}:${env}:${attempt}`));
  const failRoll = r();
  const slowRoll = r();
  // The first three runs of a visit are scripted so every visitor sees each
  // honest state early: a clean ship, a cold-cache slow run, then a failure.
  const scripted = [
    { fails: false, slow: false },
    { fails: false, slow: true },
    { fails: true, slow: false },
  ][runIndex];
  const fails = scripted ? scripted.fails : failRoll < (attempt > 1 ? 0.1 : 0.22);
  const slow = scripted ? scripted.slow : slowRoll < 0.28;
  const failure = fails ? pick(r, FAILURES) : undefined;

  const routes = 200 + Math.floor(r() * 30);
  const buildMs = slow ? between(r, 7600, 9400) : between(r, 2400, 3600);
  const cached = slow ? 0 : Math.floor(between(r, 86, 99));
  const bundleKb = Math.floor(between(r, 182, 196));

  const build: StepPlan = {
    id: "build",
    durationMs: buildMs,
    fails: false,
    lines: [
      { at: 0, level: "info", text: `Cloning ${PROJECT.repo} (branch: ${commit.branch}, commit: ${commit.sha})` },
      { at: 0.05, level: "info", text: "Installing dependencies with pnpm 9.12.3" },
      { at: 0.14, level: "info", text: "Lockfile is up to date, 412 packages resolved" },
      slow
        ? { at: 0.22, level: "warn", text: "Remote cache miss (key 3f2a91c), building from scratch" }
        : { at: 0.22, level: "info", text: `Remote cache hit: restored ${cached}% of build outputs` },
      { at: 0.3, level: "info", text: "▲ Next.js 16.2.4, creating an optimized production build" },
      ...(slow
        ? [
            { at: 0.45, level: "info" as const, text: "Compiling app/(editor)/[noteId]/page.tsx" },
            { at: 0.6, level: "warn" as const, text: "Build is taking longer than usual (cold cache)" },
            { at: 0.74, level: "info" as const, text: "Compiling app/(workspace)/settings/billing/page.tsx" },
          ]
        : []),
      { at: 0.82, level: "info", text: `Generating static pages (${routes}/${routes})` },
      { at: 0.9, level: "info", text: `First load JS shared by all: ${bundleKb} kB` },
      { at: 0.98, level: "ok", text: `Build completed in ${(buildMs / 1000).toFixed(1)}s` },
    ],
  };

  const testMs = between(r, 1700, 2600);
  const test: StepPlan = {
    id: "test",
    durationMs: testMs,
    fails,
    lines: failure
      ? [
          { at: 0, level: "info", text: "vitest run --reporter=dot (8 workers)" },
          { at: 0.3, level: "info", text: "✓ src/editor (61 tests)" },
          { at: 0.55, level: "info", text: "✓ src/notebooks (48 tests)" },
          { at: 0.85, level: "error", text: `FAIL ${failure.file}` },
          ...failure.detail.map((d, i) => ({ at: 0.88 + i * 0.03, level: "error" as const, text: d })),
          { at: 0.99, level: "error", text: "Tests: 1 failed, 251 passed, 252 total. Pipeline stopped." },
        ]
      : [
          { at: 0, level: "info", text: "vitest run --reporter=dot (8 workers)" },
          { at: 0.3, level: "info", text: "✓ src/editor (61 tests)" },
          { at: 0.55, level: "info", text: "✓ src/notebooks (48 tests)" },
          { at: 0.75, level: "info", text: "✓ src/billing (39 tests)" },
          { at: 0.98, level: "ok", text: `Tests: 252 passed in ${(testMs / 1000).toFixed(1)}s` },
        ],
  };

  const deployMs = between(r, 1200, 2000);
  const deploy: StepPlan = {
    id: "deploy",
    durationMs: deployMs,
    fails: false,
    lines: [
      { at: 0, level: "info", text: `Uploading 1,284 files (${(between(r, 9.2, 11.8)).toFixed(1)} MB)` },
      { at: 0.35, level: "info", text: "Deploying functions to iad1, fra1, sin1" },
      { at: 0.7, level: "info", text: `Assigning ${envHost(env)}` },
      { at: 0.97, level: "ok", text: "Edge config propagated in 412ms" },
    ],
  };

  const verifyMs = between(r, 800, 1400);
  const p95 = Math.floor(between(r, 140, 230));
  const verify: StepPlan = {
    id: "verify",
    durationMs: verifyMs,
    fails: false,
    lines: [
      { at: 0, level: "info", text: `GET https://${envHost(env)}/api/health → 200 in ${Math.floor(between(r, 38, 70))}ms` },
      { at: 0.35, level: "info", text: "Smoke: sign in, open notebook, create note, search" },
      { at: 0.7, level: "info", text: `p95 TTFB ${p95}ms across 3 regions (budget 300ms)` },
      { at: 0.97, level: "ok", text: `Ready. ${envHost(env)} now serves ${commit.sha}` },
    ],
  };

  return { steps: [build, test, deploy, verify], slow, failure };
};

/** Logs for a deployment that happened before this session, fetched on demand. */
export const historicLogs = (d: Deployment): LogLine[] => {
  const plan = planRun(d.commit, d.env, 1, 0);
  let offset = 0;
  let id = 0;
  const out: LogLine[] = [];
  for (const step of plan.steps) {
    for (const l of step.lines) {
      out.push({ id: id++, atMs: offset + l.at * step.durationMs, step: step.id, level: l.level, text: l.text });
    }
    offset += step.durationMs;
  }
  return out;
};

/** How long fetching an old deployment's logs takes. Mostly quick, sometimes not. */
export const historicLatency = (d: Deployment, attempt: number) => {
  const r = rng(hash(`logs:${d.id}:${attempt}`));
  const roll = r();
  if (roll < 0.15) return between(r, 2600, 4200); // slow: shows the "still waiting" message and Cancel
  if (roll < 0.3) return between(r, 40, 120); // fast: no skeleton at all
  return between(r, 350, 1300);
};

export const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException("aborted", "AbortError"));
    const id = window.setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        window.clearTimeout(id);
        reject(new DOMException("aborted", "AbortError"));
      },
      { once: true }
    );
  });

// ---------------------------------------------------------------------------
// Formatting

export const fmtSeconds = (ms: number) => `${(Math.max(0, ms) / 1000).toFixed(1)}s`;

export const fmtDuration = (ms: number) => {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
};

export const fmtAgo = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
};

export const fmtStamp = (ms: number) => {
  const total = Math.max(0, ms) / 1000;
  const m = Math.floor(total / 60);
  const s = total - m * 60;
  return `${String(m).padStart(2, "0")}:${s.toFixed(1).padStart(4, "0")}`;
};
