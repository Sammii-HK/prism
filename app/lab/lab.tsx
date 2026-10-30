"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ASYNC_BUTTON_TRANSITIONS, useSystemReducedMotion, type AsyncButtonState } from "../lib/components/async-button";
import { LATENCY_TRANSITIONS, type LatencyLogEntry } from "../lib/components/latency-adapt";
import { MOTION_APPROACHES, type MotionApproach, type MotionMeasurement } from "../lib/components/motion-compare";
import { AsyncButtonPanel, type AsyncButtonObservation } from "../demos/async-button";
import { RadialMenuPanel, RADIAL_DEMO_ITEMS, type RadialObservation } from "../demos/radial-menu";
import { MotionComparePanel } from "../demos/motion-compare";
import { LatencyAdaptPanel } from "../demos/latency-adapt";
import { LabSection, SERIF, type EvidenceRow } from "./parts";

const NOT_YET = "not measured yet";

const SECTIONS = [
  { id: "async-button", label: "Async button" },
  { id: "radial-menu", label: "Radial menu" },
  { id: "motion-compare", label: "Motion compare" },
  { id: "latency-adapt", label: "Latency adapt" },
] as const;
type SectionId = (typeof SECTIONS)[number]["id"];

const countTransitions = (t: Record<string, object>) => Object.values(t).reduce((n, row) => n + Object.keys(row).length, 0);

type Mode = { forced: boolean; system: boolean };
const modeText = ({ forced, system }: Mode) =>
  forced ? "on (forced by this page)" : system ? "on (your system setting)" : "off";

/* ------------------------------------------------------------------ */
/* Section: async button                                                */
/* ------------------------------------------------------------------ */
function AsyncSection({ mode }: { mode: Mode }) {
  const [obs, setObs] = useState<{
    events: number;
    state: AsyncButtonState | null;
    last: string | null;
    slowAt: number | null;
    succeeded: number;
    failed: number;
  }>({ events: 0, state: null, last: null, slowAt: null, succeeded: 0, failed: 0 });

  const onObserve = useCallback((o: AsyncButtonObservation) => {
    setObs((p) => ({
      events: p.events + 1,
      state: o.state,
      last: `+${o.atMs} ms ${o.event} → ${o.state}`,
      slowAt: o.event === "PRESS" ? null : o.event === "SLOW" ? o.atMs : p.slowAt,
      succeeded: p.succeeded + (o.event === "RESOLVE" ? 1 : 0),
      failed: p.failed + (o.event === "REJECT" ? 1 : 0),
    }));
  }, []);

  const evidence: EvidenceRow[] = [
    { key: "states", label: "States defined", value: `${Object.keys(ASYNC_BUTTON_TRANSITIONS).length}: ${Object.keys(ASYNC_BUTTON_TRANSITIONS).join(", ")}` },
    { key: "transitions", label: "Legal transitions", value: String(countTransitions(ASYNC_BUTTON_TRANSITIONS)) },
    { key: "state", label: "State right now", value: obs.state ?? "idle (no press yet)" },
    { key: "events", label: "State changes seen this visit", value: String(obs.events) },
    { key: "last", label: "Last change", value: obs.last ?? NOT_YET },
    { key: "slow", label: "Time until the SLOW state (last request)", value: obs.slowAt === null ? NOT_YET : `+${obs.slowAt} ms` },
    { key: "outcomes", label: "Outcomes", value: `${obs.succeeded} succeeded, ${obs.failed} failed` },
    { key: "mode", label: "Reduced-motion mode", value: modeText(mode) },
  ];

  return (
    <LabSection
      slug="async-button"
      index="01"
      kicker="Waiting"
      question="Can a button be honest about waiting without turning into noise?"
      name="Async button"
      demo={<AsyncButtonPanel embedded forceReduced={mode.forced} onObserve={onObserve} />}
      why={
        <>
          <p>
            A spinner says that something is happening and nothing else. This button commits to five states, and each has its own words, colour and announcement, so the delay is explained rather than decorated.
          </p>
          <p className="mt-3">
            It stays focusable while it works and ignores presses it cannot honour, so an impatient second press cannot start a second request.
          </p>
        </>
      }
      keys={[
        { keys: ["Tab"], does: "moves focus to the button; it stays focusable while it works." },
        { keys: ["Enter", "Space"], does: "presses it. Presses while it is pending or slow are ignored." },
        { keys: ["Enter", "Space"], does: "after a failure, the same keys retry." },
      ]}
      reducedNote="the moving progress bar becomes a still bar (partly filled), and the colour change is instant. The words carry the same information. A polite live region announces each state."
      evidence={evidence}
      evidenceNote="Read from the button's own state changes while you use it. The slow threshold in this demo is 1.2 s."
    />
  );
}

/* ------------------------------------------------------------------ */
/* Section: radial menu                                                 */
/* ------------------------------------------------------------------ */
function RadialSection({ mode }: { mode: Mode }) {
  const [obs, setObs] = useState<{
    open: boolean;
    focus: string | null;
    moves: number;
    chosen: string | null;
    announcement: string | null;
    focusBack: boolean | null;
  }>({ open: false, focus: null, moves: 0, chosen: null, announcement: null, focusBack: null });

  const onObserve = useCallback((o: RadialObservation) => {
    if (o.kind === "open") setObs((p) => ({ ...p, open: o.open, focus: o.open ? p.focus : null }));
    else if (o.kind === "focus") setObs((p) => ({ ...p, focus: o.label, moves: p.moves + 1 }));
    else {
      setObs((p) => ({ ...p, chosen: o.label }));
      // Read what the browser actually has once the menu has had time to close.
      window.setTimeout(() => {
        const wrap = document.querySelector('[data-lab-demo="radial-menu"]');
        const status = wrap?.querySelector('[role="status"]')?.textContent ?? "";
        const active = document.activeElement;
        const back = !!wrap && !!active && wrap.contains(active) && active.getAttribute("aria-haspopup") === "menu";
        setObs((p) => ({ ...p, announcement: status || "(empty)", focusBack: back }));
      }, 80);
    }
  }, []);

  const evidence: EvidenceRow[] = [
    { key: "items", label: "Items on the ring", value: `${RADIAL_DEMO_ITEMS.length}: ${RADIAL_DEMO_ITEMS.map((i) => i.label).join(", ")}` },
    { key: "open", label: "Menu right now", value: obs.open ? "open" : "closed" },
    { key: "focus", label: "Focused item", value: obs.focus ?? (obs.open ? "none" : "menu closed") },
    { key: "moves", label: "Focus moves seen this visit", value: String(obs.moves) },
    { key: "chosen", label: "Last chosen", value: obs.chosen ?? NOT_YET },
    { key: "announcement", label: "Live-region text after choosing", value: obs.announcement ?? NOT_YET },
    { key: "focusback", label: "Focus back on the trigger after choosing", value: obs.focusBack === null ? NOT_YET : obs.focusBack ? "yes" : "no" },
    { key: "mode", label: "Reduced-motion mode", value: modeText(mode) },
  ];

  return (
    <LabSection
      slug="radial-menu"
      index="02"
      kicker="Choosing"
      question="Can a menu spring out of its trigger and still behave like a menu?"
      name="Radial menu"
      demo={<RadialMenuPanel embedded forceReduced={mode.forced} onObserve={onObserve} />}
      why={
        <>
          <p>
            Items that travel out of the trigger help the eye connect a control to what it opened. That is all the spring is for.
          </p>
          <p className="mt-3">
            Underneath it is an ordinary menu button: one tab stop, arrow keys, type-ahead, and Escape returns focus. If the motion were removed, nothing would stop working.
          </p>
        </>
      }
      keys={[
        { keys: ["Enter", "Space"], does: "on the plus opens the ring and focuses the first item." },
        { keys: ["↓", "→"], does: "opens at the first item, or moves to the next; wraps." },
        { keys: ["↑", "←"], does: "opens at the last item, or moves to the previous; wraps." },
        { keys: ["Home", "End"], does: "jump to the first or last item." },
        { keys: ["A–Z"], does: "type a label's first letters to jump to it." },
        { keys: ["Enter", "Space"], does: "on an item chooses it and announces it." },
        { keys: ["Esc"], does: "closes and returns focus to the plus. Tab does the same." },
      ]}
      reducedNote="the items appear instantly in place, with no spring, fade or rotation. Choosing is announced through a polite live region either way."
      evidence={evidence}
      evidenceNote="Read from focus events, and (after you choose) from the live region and document.activeElement in this browser."
    />
  );
}

/* ------------------------------------------------------------------ */
/* Section: motion compare                                              */
/* ------------------------------------------------------------------ */
type MotionCell = MotionMeasurement | "snapped" | "failed";

function MotionSection({ mode }: { mode: Mode }) {
  const [results, setResults] = useState<Partial<Record<MotionApproach, MotionCell>>>({});
  const [runs, setRuns] = useState(0);
  const reduced = mode.forced || mode.system;

  const onObserve = useCallback(
    (approach: MotionApproach, m: MotionMeasurement | null) => {
      setResults((r) => ({ ...r, [approach]: m ?? (reduced ? "snapped" : "failed") }));
      setRuns((n) => n + 1);
    },
    [reduced]
  );

  const describe = (c: MotionCell | undefined) => {
    if (!c) return NOT_YET;
    if (c === "snapped") return "snapped to the end, nothing measured (reduced motion)";
    if (c === "failed") return "could not be measured";
    const over = c.overshoots === 0 ? "0 overshoots" : `${c.overshoots} overshoot${c.overshoots === 1 ? "" : "s"} (peak ${c.peakOvershootPx.toFixed(1)} px)`;
    return `${c.frames} frames, avg ${c.avgFrameMs.toFixed(1)} ms, worst ${c.worstFrameMs.toFixed(1)} ms, ${over}, settled at ${Math.round(c.settleMs)} ms`;
  };

  const evidence: EvidenceRow[] = [
    ...MOTION_APPROACHES.map((a) => ({ key: a.id, label: a.title, value: describe(results[a.id]) })),
    { key: "runs", label: "Runs completed this visit", value: String(runs) },
    { key: "mode", label: "Reduced-motion mode", value: modeText(mode) },
  ];

  return (
    <LabSection
      slug="motion-compare"
      index="03"
      kicker="Moving"
      question="What does a more expressive curve actually do on your screen?"
      name="Motion compare"
      demo={<MotionComparePanel embedded forceReduced={mode.forced} onObserve={onObserve} />}
      why={
        <>
          <p>
            Overshoot and settle make movement feel physical, but they also add travel and time. Instead of arguing about it, the same dot moves the same distance three ways.
          </p>
          <p className="mt-3">
            Each run reads the dot&apos;s rendered position every animation frame, so the difference shows up as numbers from your own browser.
          </p>
        </>
      }
      keys={[
        { keys: ["Tab"], does: "reaches “Run all three” and each row's own Run button." },
        { keys: ["Enter", "Space"], does: "starts a run. A press while one is running is ignored." },
      ]}
      reducedNote="all three dots snap to the end with no animation, and the table says “snapped” rather than showing numbers. Each finished run is announced through a polite live region."
      evidence={evidence}
      evidenceNote="Last completed run for each approach. Frame gaps come from requestAnimationFrame timestamps, so they reflect your display and how busy this page is, not the isolated cost of each approach. Run it a few times; the numbers move."
    />
  );
}

/* ------------------------------------------------------------------ */
/* Section: latency adapt                                               */
/* ------------------------------------------------------------------ */
const TERMINAL = new Set(["success", "error", "cancelled"]);

function LatencySection({ mode }: { mode: Mode }) {
  const [run, setRun] = useState<LatencyLogEntry[]>([]);
  const [started, setStarted] = useState(0);

  const onObserve = useCallback((e: LatencyLogEntry) => {
    if (e.event === "START") {
      setRun([e]);
      setStarted((n) => n + 1);
    } else setRun((r) => [...r, e]);
  }, []);

  const last = run[run.length - 1];
  const finished = !!last && TERMINAL.has(last.to);
  const at = (event: LatencyLogEntry["event"]) => run.find((e) => e.event === event)?.atMs;
  const whenDone = (event: LatencyLogEntry["event"], yes: string, no: string) => {
    if (!last) return NOT_YET;
    const t = at(event);
    if (t !== undefined) return `${yes} at +${t} ms`;
    return finished ? no : "run in progress";
  };

  const evidence: EvidenceRow[] = [
    { key: "phases", label: "Phases defined", value: `${Object.keys(LATENCY_TRANSITIONS).length}, with ${countTransitions(LATENCY_TRANSITIONS)} legal transitions` },
    { key: "started", label: "Requests started this visit", value: String(started) },
    { key: "phase", label: "Phase right now", value: last ? last.to : "idle (no request yet)" },
    { key: "skeleton", label: "Skeleton (last request)", value: whenDone("SHOW_SKELETON", "shown", "never shown") },
    { key: "slow", label: "“Taking longer” message and Cancel", value: whenDone("SLOW", "shown", "never shown") },
    { key: "ended", label: "Ended", value: finished && last ? `${last.to} at +${last.atMs} ms` : last ? "run in progress" : NOT_YET },
    { key: "mode", label: "Reduced-motion mode", value: modeText(mode) },
  ];

  return (
    <LabSection
      slug="latency-adapt"
      index="04"
      kicker="Loading"
      question="Should an interface behave differently at 80 milliseconds than at 4 seconds?"
      name="Latency adapt"
      demo={<LatencyAdaptPanel embedded forceReduced={mode.forced} onObserve={onObserve} />}
      why={
        <>
          <p>
            A skeleton that flashes for 80 ms is noise, and a bare spinner at 4 s is a shrug. This region shows nothing new for the first 150 ms, then a skeleton, and past 2 s it says how long it has been and offers Cancel.
          </p>
          <p className="mt-3">
            The expressive part is that the interface changes with the wait, rather than treating every wait the same.
          </p>
        </>
      }
      keys={[
        { keys: ["Tab"], does: "reaches Load / Reload, and Cancel, Retry or Try again when they appear." },
        { keys: ["Enter", "Space"], does: "activates the focused button. Load is ignored while a request is out." },
        { keys: ["←", "→"], does: "on the latency slider changes the next request; radios use the arrows too." },
      ]}
      reducedNote="the skeleton is still (no shimmer) and the loaded content appears without a fade. A polite live region says Loading, Still loading, Loaded or Cancelled; failures use role=alert."
      evidence={evidence}
      evidenceNote="Read from the state machine's own events for the most recent request, timed with performance.now(). Timers can fire late if the page is busy. Set the latency under 150 ms, then over 2 s, to see both paths."
    />
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */
export function Lab() {
  const [forced, setForced] = useState(false);
  const system = useSystemReducedMotion();
  const mode: Mode = { forced, system };
  const [active, setActive] = useState<SectionId | null>(null);

  const mainRef = useRef<HTMLDivElement>(null);

  const focusHeading = useCallback((id: string) => {
    // After the browser has scrolled to the anchor.
    window.requestAnimationFrame(() => document.getElementById(`${id}-heading`)?.focus({ preventScroll: true }));
  }, []);

  /** Follow the section in view. */
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id as SectionId);
      },
      { rootMargin: "-35% 0px -55% 0px" }
    );
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, []);

  /** Typing a #hash into the address bar (or back/forward) also lands on the heading. */
  useEffect(() => {
    const onHash = () => {
      const id = window.location.hash.slice(1);
      if (SECTIONS.some((s) => s.id === id)) {
        setActive(id as SectionId);
        focusHeading(id);
      }
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [focusHeading]);

  const linkCls =
    "whitespace-nowrap rounded-md px-3 py-2 text-sm text-white/65 transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 aria-[current=location]:bg-white/10 aria-[current=location]:text-white";

  return (
    <div className="min-h-screen overflow-x-clip text-white" style={{ background: "#050505" }}>
      <a
        href="#lab-experiments"
        onClick={() => window.requestAnimationFrame(() => mainRef.current?.focus({ preventScroll: true }))}
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-black"
      >
        Skip to the experiments
      </a>

      <header className="mx-auto w-full max-w-5xl px-4 pb-14 pt-8 sm:px-6 sm:pb-24 sm:pt-12">
        <div className="flex items-center justify-between gap-4 text-[11px] uppercase tracking-[0.22em] text-white/55">
          <Link href="/" className="rounded-sm hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70">
            Prism
          </Link>
          <span>Interaction Lab</span>
        </div>
        <h1
          className="mt-14 max-w-4xl text-[38px] font-normal leading-[1.04] tracking-tight text-white sm:mt-24 sm:text-7xl"
          style={{ fontFamily: SERIF }}
        >
          Can interfaces become expressive without sacrificing usability?
        </h1>
        <p className="mt-8 max-w-2xl text-base leading-relaxed text-white/70 sm:text-lg" style={{ fontFamily: SERIF }}>
          Four small experiments, each built so the expressive layer can be taken away and the interface still works.
          They are live below. Use them with a mouse, then use them again with only the keyboard.
        </p>
        <p className="mt-5 max-w-2xl text-sm leading-relaxed text-white/60">
          Every number on this page is produced in your browser while you use it. Until something has run, it says “{NOT_YET}”.
        </p>
      </header>

      <div
        className="sticky top-0 z-40 border-y"
        style={{ borderColor: "rgba(255,255,255,0.1)", background: "rgba(5,5,5,0.96)" }}
      >
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-1 px-4 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-6">
          <div className="flex min-w-0 items-center justify-between gap-3 sm:order-2 sm:justify-end">
            <span id="rm-label" className="text-xs text-white/70">
              Reduced motion
              <span className="text-white/50" data-testid="system-setting">
                {" "}
                · system: {system ? "reduce" : "no preference"}
              </span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={forced}
              aria-labelledby="rm-label"
              data-testid="reduced-switch"
              onClick={() => setForced((f) => !f)}
              className="relative h-6 w-11 shrink-0 rounded-full border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
              style={{
                borderColor: forced ? "rgba(255,196,110,0.8)" : "rgba(255,255,255,0.3)",
                background: forced ? "rgba(255,196,110,0.3)" : "rgba(255,255,255,0.06)",
              }}
            >
              <span
                aria-hidden
                className="absolute top-0.5 h-4 w-4 rounded-full"
                style={{ left: forced ? 22 : 2, background: forced ? "rgb(255,196,110)" : "rgba(255,255,255,0.8)" }}
              />
              <span className="sr-only">{forced ? "On" : "Off"}</span>
            </button>
          </div>
          <nav aria-label="Experiments" className="-mx-3 min-w-0 overflow-x-auto sm:order-1">
            <ul className="flex w-max gap-1 px-3">
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    aria-current={active === s.id ? "location" : undefined}
                    onClick={() => {
                      setActive(s.id);
                      focusHeading(s.id);
                    }}
                    className={linkCls}
                  >
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>

      <main id="lab-experiments" ref={mainRef} tabIndex={-1} className="focus:outline-none">
        <p className="sr-only" role="status" aria-live="polite" data-testid="mode-status">
          Reduced motion forced by this page: {forced ? "on" : "off"}.
        </p>
        <AsyncSection mode={mode} />
        <RadialSection mode={mode} />
        <MotionSection mode={mode} />
        <LatencySection mode={mode} />

        <section
          aria-labelledby="limits-heading"
          className="border-t py-16 sm:py-20"
          style={{ borderColor: "rgba(255,255,255,0.1)" }}
        >
          <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
            <h2 id="limits-heading" className="text-2xl text-white/90 sm:text-3xl" style={{ fontFamily: SERIF }}>
              What this page does not claim
            </h2>
            <ul className="mt-6 flex max-w-2xl flex-col gap-3 text-[15px] leading-relaxed text-white/70">
              <li>It does not show these are more usable than the plain alternatives. There was no user study.</li>
              <li>Measured numbers come from your browser, display and current load. They vary between runs and machines.</li>
              <li>The live regions are present and update, but the announcements have not been tried with a screen reader.</li>
              <li>The reduced-motion switch changes what these four experiments do. It does not change anything else on the site.</li>
            </ul>
          </div>
        </section>
      </main>
    </div>
  );
}
