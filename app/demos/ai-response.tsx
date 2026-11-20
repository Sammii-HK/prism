"use client";
import { useEffect, useState } from "react";
import { AIResponse } from "../lib/components";
import { replay, useAssistant, type Recording } from "../lib/hooks/assistant";
import confirmDelete from "../lib/recordings/confirm-delete.json";
import slowSave from "../lib/recordings/slow-save.json";
import toolFails from "../lib/recordings/tool-fails.json";
import toolFailsRetry from "../lib/recordings/tool-fails-retry.json";
import wrongSource from "../lib/recordings/wrong-source.json";

type Scenario = {
  id: string;
  label: string;
  recording: Recording;
  /** What Retry plays. Defaults to the same recording. */
  retry?: Recording;
  /** End the stream early here (recorded ms) to show a dropped connection. */
  cutAt?: number;
  /** Extra provenance for anything simulated in the replay itself. */
  replayNote?: string;
};

const asRecording = (r: unknown) => r as Recording;

const SCENARIOS: Scenario[] = [
  { id: "confirm-delete", label: "Picks a component, with sources", recording: asRecording(confirmDelete) },
  { id: "slow-save", label: "A slow answer", recording: asRecording(slowSave) },
  { id: "tool-fails", label: "A tool times out", recording: asRecording(toolFails), retry: asRecording(toolFailsRetry) },
  { id: "wrong-source", label: "The model reads the wrong component", recording: asRecording(wrongSource) },
  {
    id: "dropped",
    label: "The connection drops",
    recording: asRecording(confirmDelete),
    cutAt: 24000,
    replayNote: "The drop is simulated in the replay: the recording is cut 24s in. Retry plays the full recording.",
  },
];

export default function AIResponseDemo() {
  const [scenario, setScenario] = useState(SCENARIOS[0]);
  const [speed, setSpeed] = useState(3);
  const [ran, setRan] = useState<Recording | null>(null);
  const [cut, setCut] = useState(false);
  const assistant = useAssistant();

  const play = (rec: Recording, cutAt?: number) => {
    setRan(rec);
    setCut(cutAt !== undefined);
    // Tests and screen recordings can ask for a faster replay with ?speed=.
    const override = Number(new URLSearchParams(window.location.search).get("speed"));
    assistant.start(replay(rec, { speed: override > 0 ? override : speed, cutAt }));
  };

  const ask = (s: Scenario) => {
    setScenario(s);
    play(s.recording, s.cutAt);
  };

  // Escape stops a response that is still coming in.
  const { busy, stop } = assistant;
  useEffect(() => {
    if (!busy) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") stop();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, stop]);

  const shown = ran ?? scenario.recording;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050505] px-6 py-16">
      <div className="grid w-full max-w-4xl gap-8 md:grid-cols-[240px_minmax(0,1fr)]">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">Ask</p>
          <div role="group" aria-label="Questions" className="mt-3 grid gap-1.5">
            {SCENARIOS.map((s) => (
              <button
                key={s.id}
                type="button"
                aria-pressed={scenario.id === s.id && assistant.phase !== "idle"}
                onClick={() => ask(s)}
                className={`rounded-xl border px-3.5 py-2.5 text-left text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${
                  scenario.id === s.id && assistant.phase !== "idle"
                    ? "border-white/[0.22] bg-white/[0.07] text-white/95"
                    : "border-white/[0.08] text-white/65 hover:border-white/[0.16] hover:text-white/85"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div role="group" aria-label="Playback speed" className="mt-6 flex rounded-xl border border-white/[0.1] p-1">
            {[1, 3].map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={speed === s}
                onClick={() => setSpeed(s)}
                className={`flex-1 rounded-lg px-3 py-1.5 font-mono text-[11px] ${speed === s ? "bg-white/[0.08] text-white/90" : "text-white/50 hover:text-white/75"}`}
              >
                {s === 1 ? "Real pace" : `${s}× faster`}
              </button>
            ))}
          </div>
        </div>

        <div className="min-w-0">
          {assistant.phase === "idle" ? (
            <div className="flex h-full min-h-[280px] items-center justify-center rounded-2xl border border-dashed border-white/[0.08] p-8 text-center text-sm leading-relaxed text-white/45">
              Pick a question. Each answer is a real run, recorded and replayed at its recorded pace.
            </div>
          ) : (
            <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
              <p className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-white/[0.07] px-4 py-2.5 text-[14px] text-white/90">{shown.prompt}</p>
              <AIResponse
                name="Prism assistant"
                phase={assistant.phase}
                text={assistant.text}
                steps={assistant.steps}
                sources={assistant.sources}
                stalledS={assistant.stalledS}
                error={assistant.error}
                onStop={assistant.stop}
                onRetry={() => play(scenario.retry && ran === scenario.recording ? scenario.retry : scenario.recording)}
              />
              <p className="text-[11px] leading-relaxed text-white/40">
                Recorded {shown.recordedAt} from {shown.model} on a MacBook Air, and replayed
                {speed === 1 ? " at the pace it ran" : ` ${speed}× faster than it ran`}. {shown.note}
                {scenario.replayNote && cut ? ` ${scenario.replayNote}` : ""}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
