"use client";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  AsyncButton,
  ASYNC_BUTTON_TRANSITIONS,
  useSystemReducedMotion,
  type AsyncButtonEvent,
  type AsyncButtonState,
} from "../lib/components/async-button";

const STATES: AsyncButtonState[] = ["idle", "pending", "slow", "success", "error"];

type LogRow = { at: number; event: AsyncButtonEvent; to: AsyncButtonState };

export interface DemoPanelProps {
  /** Inline use: drop the slug label and the local reduced-motion checkbox (the host page owns that control). */
  embedded?: boolean;
  /** Host-forced reduced motion. Combined with the local checkbox. */
  forceReduced?: boolean;
}

export interface AsyncButtonObservation {
  state: AsyncButtonState;
  event: AsyncButtonEvent;
  /** ms since the press that started the request (0 for PRESS). */
  atMs: number;
}

export function AsyncButtonPanel({
  embedded = false,
  forceReduced: hostReduced = false,
  onObserve,
}: DemoPanelProps & { onObserve?: (o: AsyncButtonObservation) => void }) {
  const [latency, setLatency] = useState(2500);
  const outcomeName = useId();
  const [outcome, setOutcome] = useState<"succeed" | "fail">("succeed");
  const [localReduced, setLocalReduced] = useState(false);
  const forceReduced = hostReduced || localReduced;
  const [state, setState] = useState<AsyncButtonState>("idle");
  const [log, setLog] = useState<LogRow[]>([]);
  const systemReduced = useSystemReducedMotion();

  // The button reads these when pressed, so the sliders change the next request, not the one in flight.
  const settings = useRef({ latency, outcome });
  useEffect(() => {
    settings.current = { latency, outcome };
  }, [latency, outcome]);
  const startedAt = useRef(0);

  const work = useCallback(
    () =>
      new Promise<void>((resolve, reject) => {
        window.setTimeout(
          () => (settings.current.outcome === "succeed" ? resolve() : reject(new Error("failed"))),
          settings.current.latency
        );
      }),
    []
  );

  const onStateChange = useCallback((next: AsyncButtonState, event: AsyncButtonEvent) => {
    if (event === "PRESS") startedAt.current = performance.now();
    const at = Math.round(performance.now() - startedAt.current);
    setState(next);
    setLog((rows) => [{ at, event, to: next }, ...rows].slice(0, 8));
    onObserve?.({ state: next, event, atMs: at });
  }, [onObserve]);

  const legal = Object.keys(ASYNC_BUTTON_TRANSITIONS[state]) as AsyncButtonEvent[];

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-12 md:grid-cols-2">
        <section className="flex min-w-0 flex-col gap-8">
          {!embedded && (
            <p className="text-xs tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.25)" }}>
              async-button
            </p>
          )}

          <AsyncButton
            onPress={work}
            slowAfterMs={1200}
            reducedMotion={forceReduced ? true : undefined}
            onStateChange={onStateChange}
            className="w-full max-w-sm"
          />

          <fieldset className="flex flex-col gap-3 border-0 p-0">
            <legend className="mb-2 text-xs uppercase tracking-widest text-white/40">The next request</legend>
            <label className="flex flex-col gap-1 text-sm text-white/70">
              Takes {(latency / 1000).toFixed(1)} s
              <input
                type="range"
                min={300}
                max={6000}
                step={100}
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

          <p className="max-w-sm text-xs italic leading-relaxed" style={{ color: "rgba(255,255,255,0.3)" }}>
            Press it with the keyboard: Tab to focus, Enter or Space to press. Press it twice while it works: the
            second press is ignored. Past 1.2 s it says so instead of spinning forever.
          </p>
        </section>

        <section className="flex min-w-0 flex-col gap-6" aria-label="State machine">
          <div>
            <h3 className="mb-3 text-xs uppercase tracking-widest text-white/40">State</h3>
            <ol className="flex flex-wrap gap-2">
              {STATES.map((s) => (
                <li
                  key={s}
                  aria-current={s === state ? "step" : undefined}
                  className="rounded-lg px-3 py-1.5 text-sm"
                  style={{
                    color: s === state ? "#050505" : "rgba(255,255,255,0.5)",
                    background: s === state ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.06)",
                  }}
                >
                  {s}
                </li>
              ))}
            </ol>
            <p className="mt-3 text-sm text-white/50">
              Legal from here: {legal.length ? legal.join(", ") : "nothing"}
            </p>
          </div>

          <div>
            <h3 className="mb-3 text-xs uppercase tracking-widest text-white/40">Transitions</h3>
            <table className="w-full text-left text-sm text-white/60">
              <thead>
                <tr className="text-white/30">
                  <th className="py-1 font-normal">from</th>
                  <th className="py-1 font-normal">event</th>
                  <th className="py-1 font-normal">to</th>
                </tr>
              </thead>
              <tbody>
                {STATES.flatMap((from) =>
                  (Object.entries(ASYNC_BUTTON_TRANSITIONS[from]) as [AsyncButtonEvent, AsyncButtonState][]).map(
                    ([event, to]) => (
                      <tr
                        key={`${from}-${event}`}
                        style={{ color: from === state ? "rgba(255,255,255,0.95)" : undefined }}
                      >
                        <td className="py-0.5">{from}</td>
                        <td className="py-0.5">{event}</td>
                        <td className="py-0.5">{to}</td>
                      </tr>
                    )
                  )
                )}
              </tbody>
            </table>
          </div>

          <div>
            <h3 className="mb-3 text-xs uppercase tracking-widest text-white/40">What just happened</h3>
            {log.length === 0 ? (
              <p className="text-sm text-white/30">Nothing yet. Press the button.</p>
            ) : (
              <ul className="font-mono text-xs text-white/60">
                {log.map((row, i) => (
                  <li key={`${row.at}-${i}`}>
                    +{row.at} ms {row.event} → {row.to}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
  );
}

export default function AsyncButtonDemo() {
  return (
    <div className="min-h-screen px-6 py-16" style={{ background: "#050505" }}>
      <AsyncButtonPanel />
    </div>
  );
}
