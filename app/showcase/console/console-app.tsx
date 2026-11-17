"use client";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  Command as CommandIcon,
  FlaskConical,
  Globe,
  Package,
  RotateCcw,
  ScrollText,
  ShieldCheck,
  ToggleRight,
  Layers,
  Rocket,
  Save,
} from "lucide-react";
import {
  AsyncButton,
  Avatar,
  CommandPalette,
  FluidTooltip,
  GlowBadge,
  GlowSelect,
  HoverReveal,
  IconButton,
  MorphTabs,
  ProgressBar,
  PulseDot,
  SpotlightCard,
  type Command,
} from "../../lib/components";
import { AppSurface, ShowcaseFrame } from "../showcase-frame";
import { FlagsPanel, INITIAL_FLAGS, flagChanged, type Flag } from "./flags";
import { HistoricLog, LiveLog, LOG_FILTERS, filterLines } from "./logs";
import {
  ENVS,
  ONLINE,
  PROJECT,
  QUEUE,
  SEED_HISTORY,
  STEPS,
  envHost,
  envLabel,
  fmtAgo,
  fmtDuration,
  fmtSeconds,
  planRun,
  sleep,
  type Commit,
  type Deployment,
  type EnvId,
  type Failure,
  type LogLine,
  type StepId,
} from "./sim";

// ---------------------------------------------------------------------------
// Run state

type StepStatus = "queued" | "running" | "passed" | "failed" | "skipped";
type StepState = { status: StepStatus; startedAt?: number; endedAt?: number };

type Run = {
  n: number;
  env: EnvId;
  commit: Commit;
  attempt: number;
  startedAt: number;
  endedAt?: number;
  steps: Record<StepId, StepState>;
  logs: LogLine[];
  outcome: "running" | "passed" | "failed";
  failure?: Failure;
};

type RunAction =
  | { type: "start"; run: Run }
  | { type: "step"; step: StepId; status: StepStatus; at: number }
  | { type: "log"; line: LogLine }
  | { type: "finish"; outcome: "passed" | "failed"; at: number; failure?: Failure };

const runReducer = (run: Run | null, a: RunAction): Run | null => {
  if (a.type === "start") return a.run;
  if (!run) return run;
  switch (a.type) {
    case "step": {
      const prev = run.steps[a.step];
      const next: StepState =
        a.status === "running" ? { status: "running", startedAt: a.at } : { ...prev, status: a.status, endedAt: a.at };
      return { ...run, steps: { ...run.steps, [a.step]: next } };
    }
    case "log":
      return { ...run, logs: [...run.logs, a.line] };
    case "finish": {
      const steps = { ...run.steps };
      for (const s of STEPS) if (steps[s.id].status === "queued") steps[s.id] = { status: "skipped" };
      return { ...run, steps, outcome: a.outcome, endedAt: a.at, failure: a.failure };
    }
  }
};

const freshSteps = (): Record<StepId, StepState> => ({
  build: { status: "queued" },
  test: { status: "queued" },
  deploy: { status: "queued" },
  verify: { status: "queued" },
});

/** A clock for durations and relative times. Starts at 0 so server and client agree. */
const useClock = (fast: boolean) => {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const tick = () => setNow(performance.now());
    const id = window.setInterval(tick, fast ? 100 : 15_000);
    const first = window.setTimeout(tick, 0);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(first);
    };
  }, [fast]);
  return now;
};

const isTyping = (t: EventTarget | null) => {
  if (!(t instanceof HTMLElement)) return false;
  if (t.isContentEditable) return true;
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return true;
  return !!t.closest('[role="combobox"], [role="listbox"], [role="dialog"]');
};

const STEP_ICON: Record<StepId, typeof Package> = {
  build: Package,
  test: FlaskConical,
  deploy: Globe,
  verify: ShieldCheck,
};

/** GlowBadge's fixed accents, reused for the parts Prism draws by hand here. */
const ACCENT = { success: "rgb(140,220,170)", warning: "rgb(230,195,140)", error: "rgb(255,155,145)" };

/** AsyncButton calls a run slow once it passes the slowest normal run (about 9.6 s). */
const SLOW_RUN_MS = 11_000;
const SLOW_STEP_FACTOR = 1.6;

// ---------------------------------------------------------------------------

export const ConsoleShowcase = () => (
  <ShowcaseFrame
    slug="console"
    title="Release console"
    lede="Ship a build of a notes app to three environments: watch it build, read the logs as they stream, roll back, and stage flag changes, all from the keyboard if you like."
    uses={[
      { slug: "async-button", title: "Async button" },
      { slug: "latency-adapt", title: "Latency adapt" },
      { slug: "command-palette", title: "Command palette" },
      { slug: "glow-select", title: "Glow select" },
      { slug: "glow-badge", title: "Glow badge" },
      { slug: "progress-bar", title: "Progress bar" },
      { slug: "pulse-dot", title: "Pulse dot" },
      { slug: "spring-toggle", title: "Spring toggle" },
      { slug: "glow-slider", title: "Glow slider" },
      { slug: "morph-tabs", title: "Morph tabs" },
      { slug: "fluid-tooltip", title: "Fluid tooltip" },
      { slug: "icon-button", title: "Icon button" },
      { slug: "hover-reveal", title: "Hover reveal" },
      { slug: "spotlight-card", title: "Spotlight card" },
      { slug: "skeleton", title: "Skeleton" },
      { slug: "avatar", title: "Avatar" },
    ]}
    keys={[
      { keys: "⌘K", does: "Command bar" },
      { keys: "D", does: "Deploy the selected environment" },
      { keys: "L", does: "Focus the logs" },
      { keys: "Esc", does: "Close the bar or a confirm" },
    ]}
    notes={[
      {
        title: "Waiting is described, not decorated",
        body: (
          <>
            The deploy button only says a run is slow once it passes the slowest normal run, and each step compares itself with its
            own typical time, so &ldquo;slow&rdquo; appears on the step that is actually slow (a cold build cache), with the reason in
            the logs. A failed test stops the pipeline, names the file and line, and the same button becomes Retry.
          </>
        ),
      },
      {
        title: "Logs follow you until you leave",
        body: (
          <>
            The log pins to the newest line only while you are at the bottom. Scroll up to read and it stays put, counting what
            arrived; one button takes you back. It is a focusable log with live announcements off; a separate polite region says
            only the step changes, so a screen reader is not read two hundred lines.
          </>
        ),
      },
      {
        title: "Old logs load without a flash",
        body: (
          <>
            Opening an older deployment&rsquo;s logs goes through Latency adapt: a fast answer shows no placeholder at all, a
            skeleton shaped like log lines appears after 150 ms, and past two seconds the region says it is still waiting and offers
            a Cancel that really aborts the request.
          </>
        ),
      },
      {
        title: "Keyboard first, never trapped",
        body: (
          <>
            Everything is in the command bar, and D and L work as single keys except while you are typing or inside a select.
            Rolling back asks inline, moves focus to the confirm, and Escape puts focus back where it was. Flag edits are staged and
            counted until you save, because a toggle that ships to production on click is a trap of its own.
          </>
        ),
      },
    ]}
  >
    <AppSurface>
      <ConsoleApp />
    </AppSurface>
  </ShowcaseFrame>
);

// ---------------------------------------------------------------------------

type LogView = { kind: "live" } | { kind: "deployment"; id: string };

const ConsoleApp = () => {
  const [env, setEnv] = useState<EnvId>("production");
  const [history, setHistory] = useState<Record<EnvId, Deployment[]>>(SEED_HISTORY);
  const [current, setCurrent] = useState<Record<EnvId, string>>({
    production: SEED_HISTORY.production[0].id,
    preview: SEED_HISTORY.preview[0].id,
    staging: SEED_HISTORY.staging[0].id,
  });
  const [queuePos, setQueuePos] = useState<Record<EnvId, number>>({ production: 0, preview: 3, staging: 0 });
  const [failed, setFailed] = useState<Partial<Record<EnvId, { commit: Commit; attempt: number }>>>({});
  const [run, dispatch] = useReducer(runReducer, null);
  const [runCount, setRunCount] = useState(0);

  const [savedFlags, setSavedFlags] = useState<Flag[]>(INITIAL_FLAGS);
  const [draftFlags, setDraftFlags] = useState<Flag[]>(INITIAL_FLAGS);

  const [logView, setLogView] = useState<LogView>({ kind: "live" });
  const [logFilter, setLogFilter] = useState(0);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [rollingBack, setRollingBack] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const running = run?.outcome === "running";
  const now = useClock(running || rollingBack !== null);

  const deployWrap = useRef<HTMLDivElement>(null);
  const logRegion = useRef<HTMLDivElement | null>(null);
  const setLogRegion = useCallback((el: HTMLDivElement | null) => {
    logRegion.current = el;
  }, []);
  const abort = useRef<AbortController | null>(null);
  const rollbackAbort = useRef<AbortController | null>(null);
  const rollbackDone = useRef<Promise<void>>(Promise.resolve());
  const busy = useRef(false);

  useEffect(
    () => () => {
      abort.current?.abort();
      rollbackAbort.current?.abort();
    },
    []
  );

  const say = useCallback((text: string) => {
    // Clear first so the same sentence twice in a row is still announced.
    setAnnouncement("");
    window.setTimeout(() => setAnnouncement(text), 30);
  }, []);

  const envHistory = history[env];
  const live = envHistory.find((d) => d.id === current[env]) ?? envHistory[0];
  const retry = failed[env];
  const nextCommit = retry ? retry.commit : QUEUE[queuePos[env] % QUEUE.length];
  const nextAttempt = retry ? retry.attempt + 1 : 1;

  // -------------------------------------------------------------------------
  // The pipeline

  const deploy = useCallback(async () => {
    await rollbackDone.current;
    if (busy.current) throw new Error("busy");
    busy.current = true;

    const ctl = new AbortController();
    abort.current = ctl;
    const target = env;
    const commit = nextCommit;
    const attempt = nextAttempt;
    const n = runCount + 1;
    setRunCount(n);
    const plan = planRun(commit, target, attempt, runCount);
    const startedAt = performance.now();
    const logs: LogLine[] = [];
    let lineId = 0;

    dispatch({
      type: "start",
      run: { n, env: target, commit, attempt, startedAt, steps: freshSteps(), logs: [], outcome: "running" },
    });
    setLogView({ kind: "live" });
    say(`Deploying ${commit.sha} to ${envLabel(target)}.`);

    try {
      for (const step of plan.steps) {
        const meta = STEPS.find((s) => s.id === step.id)!;
        dispatch({ type: "step", step: step.id, status: "running", at: performance.now() });
        say(`${meta.label} running.`);
        const stepStart = performance.now();
        let prev = 0;
        for (const line of step.lines) {
          await sleep((line.at - prev) * step.durationMs, ctl.signal);
          prev = line.at;
          const l: LogLine = { id: lineId++, atMs: performance.now() - startedAt, step: step.id, level: line.level, text: line.text };
          logs.push(l);
          dispatch({ type: "log", line: l });
        }
        await sleep((1 - prev) * step.durationMs, ctl.signal);
        const at = performance.now();
        if (step.fails) {
          dispatch({ type: "step", step: step.id, status: "failed", at });
          dispatch({ type: "finish", outcome: "failed", at, failure: plan.failure });
          setFailed((f) => ({ ...f, [target]: { commit, attempt } }));
          say(`${meta.label} failed: ${plan.failure?.title}. ${envLabel(target)} still serves the previous build.`);
          throw new Error(plan.failure?.title ?? "failed");
        }
        dispatch({ type: "step", step: step.id, status: "passed", at });
        say(`${meta.label} passed in ${((at - stepStart) / 1000).toFixed(1)} seconds.`);
      }

      const endedAt = performance.now();
      dispatch({ type: "finish", outcome: "passed", at: endedAt });
      const d: Deployment = { id: `${target}-${commit.sha}-${n}`, env: target, commit, at: endedAt, durationMs: endedAt - startedAt, logs };
      setHistory((h) => ({ ...h, [target]: [d, ...h[target]] }));
      setCurrent((c) => ({ ...c, [target]: d.id }));
      setFailed((f) => ({ ...f, [target]: undefined }));
      if (!retry) setQueuePos((q) => ({ ...q, [target]: q[target] + 1 }));
      say(`Live on ${envLabel(target)}: ${commit.sha}, in ${((endedAt - startedAt) / 1000).toFixed(1)} seconds.`);
    } finally {
      busy.current = false;
    }
  }, [env, nextCommit, nextAttempt, runCount, retry, say]);

  /** The deploy button is the one place a run starts, so shortcuts press it. */
  const pressDeploy = useCallback(() => {
    if (busy.current) {
      say("A deploy is already running.");
      return;
    }
    deployWrap.current?.querySelector("button")?.click();
  }, [say]);

  const focusLogs = useCallback((delay = 0) => {
    window.setTimeout(() => logRegion.current?.focus(), delay);
  }, []);

  // -------------------------------------------------------------------------
  // Rollback

  const askRollback = useCallback((id: string) => setConfirmId(id), []);

  const cancelRollback = useCallback(() => {
    const id = confirmId;
    setConfirmId(null);
    if (id) window.setTimeout(() => document.getElementById(`rollback-${id}`)?.focus(), 0);
  }, [confirmId]);

  const doRollback = useCallback(
    (d: Deployment) => {
      setConfirmId(null);
      setRollingBack(d.id);
      say(`Rolling ${envLabel(d.env)} back to ${d.commit.sha}.`);
      const ctl = new AbortController();
      rollbackAbort.current = ctl;
      rollbackDone.current = sleep(1300, ctl.signal)
        .then(() => {
          setCurrent((c) => ({ ...c, [d.env]: d.id }));
          setRollingBack(null);
          say(`${envLabel(d.env)} now serves ${d.commit.sha}.`);
        })
        .catch(() => setRollingBack(null));
      // Focus was on the confirm button, which is going away.
      window.setTimeout(() => document.getElementById(`logs-${d.id}`)?.focus(), 0);
    },
    [say]
  );

  // -------------------------------------------------------------------------
  // Flags

  const changeFlag = useCallback((key: string, patch: Partial<Flag>) => {
    setDraftFlags((fs) => fs.map((f) => (f.key === key ? { ...f, ...patch } : f)));
  }, []);

  const saveFlags = useCallback(async () => {
    const ctl = new AbortController();
    await sleep(draftFlags.some((f, i) => flagChanged(f, savedFlags[i])) ? 750 : 250, ctl.signal);
    setSavedFlags(draftFlags);
  }, [draftFlags, savedFlags]);

  // -------------------------------------------------------------------------
  // Keyboard

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (paletteOpen || e.metaKey || e.ctrlKey || e.altKey || e.repeat || isTyping(e.target)) return;
      const k = e.key.toLowerCase();
      if (k === "d") {
        e.preventDefault();
        pressDeploy();
      } else if (k === "l") {
        e.preventDefault();
        focusLogs();
      } else if (k === "escape" && confirmId) {
        cancelRollback();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paletteOpen, pressDeploy, focusLogs, confirmId, cancelRollback]);

  // The palette hands focus back ~250 ms after it closes; anything that moves
  // focus itself waits until after that.
  const AFTER_PALETTE = 320;

  // The deployment that was live before the current one, i.e. the rollback target.
  const previous = envHistory[envHistory.indexOf(live) + 1] as Deployment | undefined;

  const commands = useMemo<Command[]>(() => {
    const icon = (I: typeof Rocket) => <I size={16} strokeWidth={1.5} aria-hidden />;
    return [
      {
        id: "deploy",
        label: retry ? `Retry deploy of ${nextCommit.sha} to ${envLabel(env)}` : `Deploy ${nextCommit.sha} to ${envLabel(env)}`,
        hint: "D",
        group: "Pipeline",
        keywords: ["ship", "release", "build", "retry"],
        icon: icon(Rocket),
        action: pressDeploy,
      },
      ...(previous
        ? [
            {
              id: "rollback",
              label: `Roll back ${envLabel(env)} to ${previous.commit.sha}`,
              group: "Pipeline",
              keywords: ["revert", "undo", "previous"],
              icon: icon(RotateCcw),
              action: () => window.setTimeout(() => askRollback(previous.id), AFTER_PALETTE),
            },
          ]
        : []),
      {
        id: "logs",
        label: "Focus logs",
        hint: "L",
        group: "Logs",
        keywords: ["output", "console"],
        icon: icon(ScrollText),
        action: () => {
          setLogView({ kind: "live" });
          focusLogs(AFTER_PALETTE);
        },
      },
      {
        id: "logs-errors",
        label: "Show only errors in logs",
        group: "Logs",
        keywords: ["filter", "fail"],
        icon: icon(ScrollText),
        action: () => {
          setLogFilter(2);
          focusLogs(AFTER_PALETTE);
        },
      },
      ...(previous
        ? [
            {
              id: "logs-previous",
              label: `Open logs for ${previous.commit.sha}`,
              group: "Logs",
              keywords: ["history", "older"],
              icon: icon(ScrollText),
              action: () => {
                setLogView({ kind: "deployment", id: previous.id });
                focusLogs(AFTER_PALETTE);
              },
            },
          ]
        : []),
      {
        id: "env",
        label: "Switch environment",
        group: "Environment",
        keywords: ["production", "preview", "staging"],
        icon: icon(Layers),
        children: ENVS.map((e) => ({
          id: `env-${e.id}`,
          label: e.id === env ? `${e.label} (current)` : e.label,
          hint: e.host,
          action: () => {
            setEnv(e.id);
            setConfirmId(null);
            say(`Environment: ${e.label}.`);
          },
        })),
      },
      {
        id: "flags",
        label: "Toggle a flag",
        group: "Flags",
        keywords: ["feature", "rollout"],
        icon: icon(ToggleRight),
        children: draftFlags.map((f) => ({
          id: `flag-${f.key}`,
          label: `${f.on ? "Turn off" : "Turn on"} ${f.name}`,
          hint: f.key,
          action: () => {
            changeFlag(f.key, { on: !f.on });
            say(`${f.name} ${f.on ? "off" : "on"}, not saved yet.`);
          },
        })),
      },
      {
        id: "flags-discard",
        label: "Discard flag changes",
        group: "Flags",
        icon: icon(Save),
        action: () => {
          setDraftFlags(savedFlags);
          say("Flag changes discarded.");
        },
      },
    ];
  }, [retry, nextCommit, env, pressDeploy, previous, askRollback, focusLogs, draftFlags, changeFlag, say, savedFlags]);

  // -------------------------------------------------------------------------
  // Derived view state

  const progress = useMemo(() => {
    if (!run) return 0;
    if (run.outcome === "passed") return 100;
    const total = STEPS.reduce((s, x) => s + x.typicalMs, 0);
    let done = 0;
    for (const s of STEPS) {
      const st = run.steps[s.id];
      if (st.status === "passed" || st.status === "failed") done += s.typicalMs;
      else if (st.status === "running" && st.startedAt !== undefined) {
        // Honest estimate: never claim a step is finished before it is.
        done += Math.min(0.92, (now - st.startedAt) / s.typicalMs) * s.typicalMs;
      }
    }
    return Math.round((done / total) * 100);
  }, [run, now]);

  const runElapsed = run ? (run.endedAt ?? Math.max(now, run.startedAt)) - run.startedAt : 0;
  const activeStep = run ? STEPS.findIndex((s) => run.steps[s.id].status === "running") : -1;
  const slowStep = run
    ? STEPS.find((s) => {
        const st = run.steps[s.id];
        return st.status === "running" && st.startedAt !== undefined && now - st.startedAt > s.typicalMs * SLOW_STEP_FACTOR;
      })
    : undefined;

  const status: { variant: "success" | "warning" | "error" | "default"; text: string; dot?: string } = rollingBack
    ? { variant: "warning", text: "Rolling back", dot: ACCENT.warning }
    : running && run?.env === env
      ? { variant: "default", text: "Deploying" }
      : failed[env]
        ? { variant: "warning", text: "Last deploy failed", dot: ACCENT.warning }
        : { variant: "success", text: "Healthy", dot: ACCENT.success };

  const shown = run ? run.commit : nextCommit;
  const liveLines = run ? filterLines(run.logs, logFilter) : [];
  const viewing = logView.kind === "deployment" ? Object.values(history).flat().find((d) => d.id === logView.id) : undefined;

  return (
    <div className="flex flex-col">
      {/* Top bar ----------------------------------------------------------- */}
      <header className="flex flex-col gap-4 border-b border-white/[0.06] px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-3">
          <div className="flex min-w-0 items-center gap-3">
            <span
              aria-hidden
              className="grid size-9 shrink-0 place-items-center rounded-xl border border-white/[0.1] bg-white/[0.04] font-mono text-[12px] text-white/80"
            >
              fn
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm text-white/90">{PROJECT.name}</p>
              <p className="truncate font-mono text-[11px] text-white/50">{PROJECT.repo}</p>
            </div>
          </div>
          <GlowSelect
            className="w-[200px]"
            label="Environment"
            value={env}
            onChange={(v) => {
              setEnv(v as EnvId);
              setConfirmId(null);
              say(`Environment: ${envLabel(v as EnvId)}.`);
            }}
            options={ENVS.map((e) => ({ value: e.id, label: e.label }))}
          />
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <div className="flex items-center gap-1.5">
            <PulseDot size={7} colour={status.dot} />
            <GlowBadge variant={status.variant} pulse={status.variant === "default"}>
              {status.text}
            </GlowBadge>
            <span className="ml-1.5 hidden font-mono text-[11px] text-white/50 sm:inline">
              {envHost(env)} · {live.commit.sha}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <ul aria-label={`${ONLINE.length} people online`} className="flex -space-x-2">
              {ONLINE.map((p) => (
                <li key={p.initials} className="rounded-full ring-2 ring-[#080808]">
                  <Avatar fallback={p.initials} alt={`${p.name}, ${p.doing.toLowerCase()}`} size={28} />
                </li>
              ))}
            </ul>
            <FluidTooltip content="Command bar  ⌘K">
              <IconButton aria-label="Open command bar" aria-keyshortcuts="Meta+K" onClick={() => setPaletteOpen(true)}>
                <CommandIcon size={16} strokeWidth={1.5} aria-hidden />
              </IconButton>
            </FluidTooltip>
          </div>
        </div>
      </header>

      {/* Body -------------------------------------------------------------- */}
      <div className="grid gap-4 p-3 sm:gap-5 sm:p-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4 sm:gap-5">
          {/* Pipeline */}
          <SpotlightCard className="rounded-3xl border-white/[0.08] bg-white/[0.02] p-5 sm:p-6">
            <section aria-labelledby="pipeline-title">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/50">
                    {run
                      ? `Run ${run.n} · ${envLabel(run.env)}${run.attempt > 1 ? ` · attempt ${run.attempt}` : ""}`
                      : `Next up · ${envLabel(env)}`}
                  </p>
                  <h2 id="pipeline-title" className="mt-2 text-lg font-light leading-snug text-white/90">
                    {shown.message}
                  </h2>
                  <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] text-white/50">
                    <span className="text-white/70">{shown.sha}</span>
                    <span aria-hidden>·</span>
                    <span>{shown.author.name}</span>
                    <span aria-hidden>·</span>
                    <span>{shown.branch}</span>
                  </p>
                  {run && !running && (
                    <p className="mt-3 text-[13px] text-white/55">
                      {retry ? "Next: retry " : "Next: "}
                      <span className="font-mono text-[12px] text-white/70">{nextCommit.sha}</span>
                      {retry ? ` on ${envLabel(env)}` : ` ${nextCommit.message}`}
                    </p>
                  )}
                </div>
                <div ref={deployWrap} className="shrink-0">
                  <AsyncButton
                    className="w-full sm:w-auto"
                    onPress={deploy}
                    slowAfterMs={SLOW_RUN_MS}
                    successHoldMs={2400}
                    labels={{
                      idle: retry ? `Retry ${envLabel(env)} deploy` : `Deploy to ${envLabel(env)}`,
                      pending: "Deploying",
                      slow: "Still deploying, slower than usual",
                      success: `Live on ${envLabel(run?.env ?? env)}`,
                      error: "Test failed. Retry deploy",
                    }}
                  />
                </div>
              </div>

              <div className="mt-6">
                <div className="mb-2 flex items-baseline justify-between font-mono text-[11px] text-white/50">
                  <span>
                    {run
                      ? run.outcome === "running"
                        ? `Step ${activeStep + 1} of ${STEPS.length}`
                        : run.outcome === "passed"
                          ? "Finished"
                          : "Stopped at Test"
                      : "Not started"}
                  </span>
                  <span className="tabular-nums">{run ? fmtSeconds(runElapsed) : "0.0s"}</span>
                </div>
                <ProgressBar value={progress} ariaLabel="Deploy progress" />
              </div>

              <ol className="mt-5 flex flex-col">
                {STEPS.map((s) => {
                  const st = run?.steps[s.id] ?? { status: "queued" as const };
                  const Icon = STEP_ICON[s.id];
                  const elapsed =
                    st.startedAt === undefined ? undefined : (st.endedAt ?? Math.max(now, st.startedAt)) - st.startedAt;
                  const isSlow = slowStep?.id === s.id;
                  return (
                    <li
                      key={s.id}
                      className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-x-3 border-t border-white/[0.05] py-3 first:border-t-0"
                    >
                      <span
                        aria-hidden
                        className="grid size-7 place-items-center rounded-lg border border-white/[0.08]"
                        style={{
                          color:
                            st.status === "passed"
                              ? ACCENT.success
                              : st.status === "failed"
                                ? ACCENT.error
                                : st.status === "running"
                                  ? "rgba(255,255,255,0.85)"
                                  : "rgba(255,255,255,0.5)",
                        }}
                      >
                        <Icon size={14} strokeWidth={1.5} />
                      </span>
                      <div className="min-w-0">
                        <p className={`text-sm ${st.status === "queued" || st.status === "skipped" ? "text-white/60" : "text-white/90"}`}>
                          {s.label}
                        </p>
                        <p className="truncate font-mono text-[11px] text-white/50">
                          {isSlow ? "Slower than usual: see logs" : s.detail}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <StepBadge status={st.status} slow={isSlow} />
                        <span className="w-12 text-right font-mono text-[12px] tabular-nums text-white/70">
                          {elapsed === undefined ? (
                            <span className="text-white/50">~{fmtSeconds(s.typicalMs)}</span>
                          ) : (
                            fmtSeconds(elapsed)
                          )}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ol>

              {run?.outcome === "failed" && run.failure && (
                <div className="mt-4 rounded-2xl border p-4" style={{ borderColor: "rgba(255,155,145,0.25)", background: "rgba(255,155,145,0.05)" }}>
                  <p className="text-sm" style={{ color: ACCENT.error }}>
                    {run.failure.title}
                  </p>
                  <p className="mt-1 break-all font-mono text-[11px] text-white/60">{run.failure.file}</p>
                  <pre className="mt-3 whitespace-pre-wrap break-words font-mono text-[12px] leading-relaxed text-white/70">
                    {run.failure.detail.join("\n")}
                  </pre>
                  <p className="mt-3 text-[13px] text-white/60">
                    {envLabel(run.env)} still serves {live.commit.sha}. Nothing was promoted.{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setLogView({ kind: "live" });
                        setLogFilter(2);
                        focusLogs();
                      }}
                      className="rounded text-white/85 underline decoration-white/30 underline-offset-4 hover:decoration-white/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                    >
                      Show errors in logs
                    </button>
                  </p>
                </div>
              )}
            </section>
          </SpotlightCard>

          {/* Deployments */}
          <section aria-labelledby="history-title" className="rounded-3xl border border-white/[0.07] bg-white/[0.015] p-5 sm:p-6">
            <div className="flex items-baseline justify-between gap-3">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/50">Deployments</p>
                <h2 id="history-title" className="mt-1.5 text-base font-light text-white/90">
                  {envLabel(env)}
                </h2>
              </div>
              <span className="font-mono text-[11px] tabular-nums text-white/50">{envHistory.length} total</span>
            </div>

            <ul className="mt-4 flex flex-col">
              {envHistory.slice(0, 6).map((d) => {
                const isCurrent = d.id === live.id;
                const isRolling = rollingBack === d.id;
                return (
                  <li key={d.id} className="border-t border-white/[0.05] first:border-t-0">
                    <HoverReveal
                      revealContent={
                        <p className="pb-3 pl-[52px] font-mono text-[11px] text-white/50">
                          Built in {fmtDuration(d.durationMs)} · iad1 fra1 sin1 · {envHost(d.env)}
                        </p>
                      }
                    >
                      <div className="grid grid-cols-[40px_minmax(0,1fr)] gap-x-3 py-3 sm:grid-cols-[40px_minmax(0,1fr)_auto]">
                        <Avatar fallback={d.commit.author.initials} alt={d.commit.author.name} size={32} />
                        <div className="min-w-0">
                          <p className="truncate text-sm text-white/85">{d.commit.message}</p>
                          <p className="mt-0.5 flex flex-wrap gap-x-2 font-mono text-[11px] text-white/50">
                            <span className="text-white/70">{d.commit.sha}</span>
                            <span aria-hidden>·</span>
                            <span>{d.commit.author.name}</span>
                            <span aria-hidden>·</span>
                            <span className="tabular-nums">{fmtAgo(now - d.at)}</span>
                          </p>
                        </div>
                        <div className="col-start-2 mt-2 flex flex-wrap items-center gap-2 sm:col-start-3 sm:mt-0 sm:justify-end">
                          {isCurrent && (
                            <GlowBadge variant="success" pulse={false}>
                              Current
                            </GlowBadge>
                          )}
                          {isRolling && <span className="font-mono text-[11px]" style={{ color: ACCENT.warning }}>Promoting…</span>}
                          <RowButton
                            id={`logs-${d.id}`}
                            onClick={() => {
                              setLogView({ kind: "deployment", id: d.id });
                              focusLogs(30);
                            }}
                            label={`View logs for ${d.commit.sha}`}
                          >
                            Logs
                          </RowButton>
                          {!isCurrent && !isRolling && (
                            <RowButton id={`rollback-${d.id}`} onClick={() => askRollback(d.id)} label={`Roll back to ${d.commit.sha}`}>
                              Roll back
                            </RowButton>
                          )}
                        </div>
                      </div>
                    </HoverReveal>
                    {confirmId === d.id && (
                      <ConfirmRollback
                        deployment={d}
                        from={live}
                        blocked={running || rollingBack !== null}
                        onConfirm={() => doRollback(d)}
                        onCancel={cancelRollback}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        <div className="flex min-w-0 flex-col gap-4 sm:gap-5">
          {/* Logs */}
          <section aria-labelledby="logs-title" className="rounded-3xl border border-white/[0.07] bg-white/[0.015] p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/50">Logs</p>
                <h2 id="logs-title" className="mt-1.5 flex flex-wrap items-baseline gap-x-2 text-base font-light text-white/90">
                  {viewing ? (
                    <>
                      Deployment <span className="font-mono text-[13px] text-white/70">{viewing.commit.sha}</span>
                    </>
                  ) : run ? (
                    <>
                      Run {run.n} <span className="font-mono text-[12px] text-white/50">{running ? "streaming" : run.outcome}</span>
                    </>
                  ) : (
                    "Live"
                  )}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                {viewing && (
                  <RowButton
                    onClick={() => {
                      setLogView({ kind: "live" });
                      focusLogs(30);
                    }}
                    label="Back to the live run"
                  >
                    Back to live
                  </RowButton>
                )}
                <MorphTabs tabs={[...LOG_FILTERS]} activeIndex={logFilter} onChange={setLogFilter} ariaLabel="Filter log lines" className="[&>button]:px-3 [&>button]:py-1.5 [&>button]:text-[12px]" />
              </div>
            </div>
            {viewing ? (
              <HistoricLog key={viewing.id} deployment={viewing} filter={logFilter} regionRef={setLogRegion} />
            ) : (
              <LiveLog
                key={run?.n ?? 0}
                lines={liveLines}
                regionRef={setLogRegion}
                label={run ? `Logs for run ${run.n}` : "Logs"}
                empty={
                  run && logFilter > 0
                    ? `No ${logFilter === 1 ? "warnings" : "errors"} in this run.`
                    : "No run yet. Press Deploy, or D, and the build streams here."
                }
              />
            )}
          </section>

          <FlagsPanel
            saved={savedFlags}
            draft={draftFlags}
            onChange={changeFlag}
            onSave={saveFlags}
            onDiscard={() => {
              setDraftFlags(savedFlags);
              say("Flag changes discarded.");
            }}
          />
        </div>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] px-4 py-3 font-mono text-[11px] text-white/50 sm:px-6">
        <span>Simulated backend · runs in your browser · time runs about eight times fast</span>
        <span>
          Press <kbd className="text-white/70">⌘K</kbd> for everything
        </span>
      </footer>

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        commands={commands}
        placeholder="Deploy, roll back, switch environment…"
        recents={["deploy", "logs"]}
        emptyLabel="No matching command"
      />

      <p aria-live="polite" role="status" className="sr-only">
        {announcement}
      </p>
    </div>
  );
};

// ---------------------------------------------------------------------------

const StepBadge = ({ status, slow }: { status: StepStatus; slow: boolean }) => {
  if (status === "queued") return <span className="font-mono text-[11px] text-white/50">Queued</span>;
  if (status === "skipped") return <span className="font-mono text-[11px] text-white/50">Skipped</span>;
  if (status === "running")
    return slow ? (
      <GlowBadge variant="warning">Slow</GlowBadge>
    ) : (
      <GlowBadge variant="default">Running</GlowBadge>
    );
  if (status === "passed")
    return (
      <GlowBadge variant="success" pulse={false}>
        Passed
      </GlowBadge>
    );
  return (
    <GlowBadge variant="error" pulse={false}>
      Failed
    </GlowBadge>
  );
};

const RowButton = ({
  children,
  onClick,
  label,
  id,
}: {
  children: string;
  onClick: () => void;
  label: string;
  id?: string;
}) => (
  <button
    id={id}
    type="button"
    onClick={onClick}
    aria-label={label}
    className="rounded-lg border border-white/[0.1] px-2.5 py-1 font-mono text-[11px] text-white/70 transition-colors hover:border-white/25 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
  >
    {children}
  </button>
);

const ConfirmRollback = ({
  deployment,
  from,
  blocked,
  onConfirm,
  onCancel,
}: {
  deployment: Deployment;
  from: Deployment;
  blocked: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) => {
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    first.current?.focus();
  }, []);

  return (
    <div
      role="group"
      aria-label="Confirm rollback"
      className="mb-3 rounded-2xl border p-4"
      style={{ borderColor: "rgba(230,195,140,0.25)", background: "rgba(230,195,140,0.05)" }}
    >
      <p className="text-sm text-white/85">
        {blocked
          ? "A deploy is in progress. Roll back once it finishes."
          : `Roll ${envLabel(deployment.env)} back to ${deployment.commit.sha}?`}
      </p>
      {!blocked && (
        <p className="mt-1 text-[13px] leading-relaxed text-white/60">
          {envHost(deployment.env)} switches from {from.commit.sha} straight away. No rebuild; {from.commit.sha} stays in the list
          if you need it back.
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {!blocked && (
          <button
            ref={first}
            type="button"
            onClick={onConfirm}
            className="rounded-lg border px-3 py-1.5 text-[13px] text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            style={{ borderColor: "rgba(230,195,140,0.55)", background: "rgba(230,195,140,0.12)" }}
          >
            Roll back to {deployment.commit.sha}
          </button>
        )}
        <button
          ref={blocked ? first : undefined}
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-white/[0.14] px-3 py-1.5 text-[13px] text-white/70 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};
