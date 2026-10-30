"use client";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  LatencyAdapt,
  LATENCY_TRANSITIONS,
  type LatencyEvent,
  type LatencyLogEntry,
  type LatencyPhase,
} from "../lib/components/latency-adapt";
import { useSystemReducedMotion } from "../lib/components/async-button";
import type { DemoPanelProps } from "./async-button";

const PHASES: LatencyPhase[] = ["idle", "waiting", "skeleton", "slow", "success", "error", "cancelled"];

type Article = { title: string; lines: string[] };

export function LatencyAdaptPanel({
  embedded = false,
  forceReduced: hostReduced = false,
  onObserve,
}: DemoPanelProps & { onObserve?: (e: LatencyLogEntry) => void }) {
  const [latency, setLatency] = useState(80);
  const outcomeName = useId();
  const [outcome, setOutcome] = useState<"succeed" | "fail">("succeed");
  const [localReduced, setLocalReduced] = useState(false);
  const forceReduced = hostReduced || localReduced;
  const [phase, setPhase] = useState<LatencyPhase>("idle");
  const [log, setLog] = useState<(LatencyLogEntry & { n: number })[]>([]);
  const counter = useRef(0);
  const systemReduced = useSystemReducedMotion();

  // Read when a request starts: the controls change the next request, not the one in flight.
  const settings = useRef({ latency, outcome });
  useEffect(() => {
    settings.current = { latency, outcome };
  }, [latency, outcome]);

  const load = useCallback(
    (signal: AbortSignal) =>
      new Promise<Article>((resolve, reject) => {
        const { latency: ms, outcome: o } = settings.current;
        const id = window.setTimeout(
          () =>
            o === "succeed"
              ? resolve({
                  title: "Weekly summary",
                  lines: ["12 messages handled", "3 still waiting on a reply", "Next review on Friday"],
                })
              : reject(new Error("the server returned 503")),
          ms
        );
        signal.addEventListener("abort", () => {
          window.clearTimeout(id);
          reject(new DOMException("aborted", "AbortError"));
        });
      }),
    []
  );

  const onEvent = useCallback((entry: LatencyLogEntry) => {
    setPhase(entry.to);
    setLog((rows) => [{ ...entry, n: ++counter.current }, ...rows].slice(0, 10));
    onObserve?.(entry);
  }, [onObserve]);

  const legal = Object.keys(LATENCY_TRANSITIONS[phase]) as LatencyEvent[];
  const bucket = latency < 150 ? "under 150 ms: no skeleton" : latency <= 2000 ? "150 ms to 2 s: skeleton" : "over 2 s: slow message and cancel";

  return (
      <div className="mx-auto grid w-full max-w-4xl gap-12 md:grid-cols-2">
        <section className="flex min-w-0 flex-col gap-8">
          {!embedded && (
            <p className="text-xs uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.25)" }}>
              latency-adapt
            </p>
          )}

          <LatencyAdapt<Article>
            load={load}
            onEvent={onEvent}
            reducedMotion={forceReduced ? true : undefined}
            render={(a) => (
              <div>
                <h3 className="mb-2 text-sm font-medium text-white/90">{a.title}</h3>
                <ul className="flex flex-col gap-1 text-sm text-white/60">
                  {a.lines.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              </div>
            )}
          />

          <fieldset className="flex flex-col gap-3 border-0 p-0">
            <legend className="mb-2 text-xs uppercase tracking-widest text-white/40">The next request</legend>
            <label className="flex flex-col gap-1 text-sm text-white/70">
              Takes {latency < 1000 ? `${latency} ms` : `${(latency / 1000).toFixed(1)} s`}{" "}
              <span className="text-white/35">({bucket})</span>
              <input
                type="range"
                min={0}
                max={6000}
                step={50}
                value={latency}
                onChange={(e) => setLatency(Number(e.target.value))}
                className="w-full max-w-sm"
              />
            </label>
            <div role="radiogroup" aria-label="Outcome" className="flex gap-4 text-sm text-white/70">
              {(["succeed", "fail"] as const).map((o) => (
                <label key={o} className="flex items-center gap-2">
                  <input type="radio" name={outcomeName} checked={outcome === o} onChange={() => setOutcome(o)} />
                  {o === "succeed" ? "Succeeds" : "Fails"}
                </label>
              ))}
            </div>
            {!embedded && (
              <label className="flex items-center gap-2 text-sm text-white/70">
                <input type="checkbox" checked={localReduced} onChange={(e) => setLocalReduced(e.target.checked)} />
                Preview reduced motion
                <span className="text-white/30">(system setting: {systemReduced ? "on" : "off"})</span>
              </label>
            )}
          </fieldset>
        </section>

        <section className="flex min-w-0 flex-col gap-6" aria-label="State machine">
          <div>
            <h3 className="mb-3 text-xs uppercase tracking-widest text-white/40">State</h3>
            <ol className="flex flex-wrap gap-2">
              {PHASES.map((s) => (
                <li
                  key={s}
                  aria-current={s === phase ? "step" : undefined}
                  className="rounded-lg px-3 py-1.5 text-sm"
                  style={{
                    color: s === phase ? "#050505" : "rgba(255,255,255,0.5)",
                    background: s === phase ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.06)",
                  }}
                >
                  {s}
                </li>
              ))}
            </ol>
            <p className="mt-3 text-sm text-white/50">Legal from here: {legal.length ? legal.join(", ") : "nothing"}</p>
          </div>

          <div>
            <h3 className="mb-3 text-xs uppercase tracking-widest text-white/40">Event log</h3>
            {log.length === 0 ? (
              <p className="text-sm text-white/30">Nothing yet. Press Load.</p>
            ) : (
              <ul data-testid="log" className="font-mono text-xs text-white/60">
                {log.map((row) => (
                  <li key={row.n}>
                    +{row.atMs} ms {row.event}: {row.from} → {row.to}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="max-w-sm text-xs italic leading-relaxed" style={{ color: "rgba(255,255,255,0.3)" }}>
            Timestamps are measured with performance.now() from the moment you press Load. Timer callbacks can run a
            little late if the page is busy.
          </p>
        </section>
      </div>
  );
}

export default function LatencyAdaptDemo() {
  return (
    <div className="min-h-screen px-6 py-16" style={{ background: "#050505" }}>
      <LatencyAdaptPanel />
    </div>
  );
}
