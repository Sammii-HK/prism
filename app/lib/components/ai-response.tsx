"use client";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Check, ChevronRight, Copy, RotateCcw, Square, X } from "lucide-react";
import { reducedMotionNow } from "../hooks/reduced-motion";
import type { AssistantPhase, Source, ToolStep } from "../hooks/assistant";

export interface AIResponseProps {
  /** Where the response is, from `useAssistant`. */
  phase: AssistantPhase;
  /** Everything that has arrived so far. */
  text: string;
  /** Tool calls in the order they were made. */
  steps: ToolStep[];
  /** Sources the tools returned. Only the ones the text cites are listed. */
  sources: Source[];
  /** Seconds since anything arrived, once that is past the slow threshold; 0 otherwise. */
  stalledS?: number;
  /** Shown when the response fails. */
  error?: string;
  onStop?: () => void;
  onRetry?: () => void;
  /** Who is answering. Default: "Assistant" */
  name?: string;
  className?: string;
}

const STEP_LABEL: Record<string, (args: Record<string, unknown>) => string> = {
  search_components: (a) => `Searched components for “${String(a.query ?? "")}”`,
  get_component: (a) => `Opened ${String(a.slug ?? "a component")}`,
};
const stepLabel = (s: ToolStep) => STEP_LABEL[s.name]?.(s.args) ?? s.name.replace(/_/g, " ");

const STATUS: Partial<Record<AssistantPhase, string>> = {
  thinking: "Thinking",
  tool: "Using a tool",
  stopped: "Stopped",
  done: "Done",
};

/** Paragraphs, `code`, **bold** and [n] citations, the only formatting an answer here needs. */
const renderText = (text: string, sources: Source[], caret: ReactNode) =>
  text
    .split(/\n{2,}/)
    .filter((p) => p.trim())
    .map((para, i, all) => (
      <p key={i} className="mt-3 first:mt-0">
        {para.split(/(\[\d+\]|`[^`]+`|\*\*[^*]+\*\*)/g).map((part, j): ReactNode => {
          const cite = part.match(/^\[(\d+)\]$/);
          if (cite) {
            const source = sources.find((s) => s.n === Number(cite[1]));
            // A number with no source behind it is shown as plain text, never as a link.
            if (!source) return part;
            return (
              <sup key={j} className="mx-0.5">
                <a
                  href={source.href}
                  aria-label={`Source ${source.n}: ${source.title}`}
                  className="rounded px-1 font-mono text-[10px] text-white/70 ring-1 ring-white/20 hover:text-white hover:ring-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                >
                  {source.n}
                </a>
              </sup>
            );
          }
          if (part.startsWith("`") && part.endsWith("`") && part.length > 2)
            return (
              <code key={j} className="rounded bg-white/[0.07] px-1 py-0.5 font-mono text-[12px] text-white/85">
                {part.slice(1, -1)}
              </code>
            );
          if (part.startsWith("**") && part.endsWith("**") && part.length > 4) return <strong key={j} className="font-medium text-white">{part.slice(2, -2)}</strong>;
          return part;
        })}
        {i === all.length - 1 && caret}
      </p>
    ));

const StepRow = ({ step }: { step: ToolStep }) => {
  const [open, setOpen] = useState(false);
  return (
    <li className="text-[12px]">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-white/60 hover:bg-white/[0.04] hover:text-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
      >
        <span aria-hidden="true" className="flex h-4 w-4 shrink-0 items-center justify-center">
          {step.status === "running" ? (
            <span className="h-1.5 w-1.5 rounded-full bg-white/70 motion-safe:animate-pulse" />
          ) : step.status === "done" ? (
            <Check size={13} className="text-[#86efac]" />
          ) : (
            <X size={13} className="text-[#fca5a5]" />
          )}
        </span>
        <span className="min-w-0 flex-1 truncate">
          {stepLabel(step)}
          {step.summary && <span className={step.status === "failed" ? "text-[#fca5a5]/90" : "text-white/40"}> · {step.summary}</span>}
        </span>
        <span className="sr-only">{step.status === "running" ? "running" : step.status === "done" ? "done" : "failed"}</span>
        <ChevronRight aria-hidden="true" size={12} className={`shrink-0 text-white/30 ${open ? "rotate-90" : ""}`} />
      </button>
      {open && (
        <pre className="mx-2 mb-1 mt-0.5 overflow-x-auto rounded-lg bg-white/[0.03] px-3 py-2 font-mono text-[11px] leading-relaxed text-white/55">
          {JSON.stringify({ tool: step.name, arguments: step.args }, null, 2)}
        </pre>
      )}
    </li>
  );
};

/**
 * An AI response that is honest about where it is. Each state reads
 * differently, and none of them pretends:
 *
 * - Nothing is drawn for a response that starts quickly; past the quiet
 *   window it says it is thinking.
 * - Each tool call appears as a step as it runs, with its arguments one
 *   click away, and a failed step says what failed.
 * - Text arrives in bursts and is revealed at an even, spring-smoothed pace,
 *   so it reads instead of jumping.
 * - Citations link to their sources, and a number with no source behind it
 *   is never turned into a link.
 * - When nothing has arrived for a while it says so, with the time and a Stop.
 *   Stopping keeps what arrived. A failure keeps it too, and offers Retry.
 *
 * Screen readers hear the finished answer once, not every token.
 *
 * @example
 * const a = useAssistant();
 * <AIResponse {...a} onStop={a.stop} onRetry={() => a.start(source)} />
 */
export const AIResponse = ({ phase, text, steps, sources, stalledS = 0, error, onStop, onRetry, name = "Assistant", className = "" }: AIResponseProps) => {
  const [shown, setShown] = useState(0);
  const [copied, setCopied] = useState(false);
  const target = useRef(text.length);
  // Stopped or failed: show what arrived at once, so the halt is visible rather than the text typing on.
  const halted = useRef(false);
  useLayoutEffect(() => {
    target.current = text.length;
    halted.current = phase === "stopped" || phase === "error";
  });

  // Reveal at an even pace: the backlog drains a fixed share per frame, so bursts are smoothed and a long backlog still catches up fast.
  useEffect(() => {
    let raf = 0;
    let current = 0;
    let last = -1;
    const tick = () => {
      const goal = target.current;
      if (goal < current || halted.current || reducedMotionNow()) current = goal;
      else if (goal > current) current = Math.min(goal, current + Math.max(0.6, (goal - current) * 0.14));
      const n = Math.floor(current);
      if (n !== last) {
        last = n;
        setShown(n);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const busy = phase === "waiting" || phase === "thinking" || phase === "tool" || phase === "streaming";
  const revealing = shown < text.length;
  const visible = text.slice(0, shown);
  const cited = sources.filter((s) => new RegExp(`\\[${s.n}\\]`).test(text));
  const settled = phase === "done" || phase === "stopped" || phase === "error";
  const status = stalledS > 0 && busy ? `Still working · ${stalledS}s` : phase === "error" ? (error ?? "Something went wrong") : STATUS[phase];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked; nothing else to do.
    }
  };

  // What a screen reader hears: the whole answer once it is finished, or why it stopped.
  const announcement =
    phase === "done" && !revealing ? `${name} answered: ${text}` : phase === "stopped" ? `${name} stopped.` : phase === "error" ? `${name} failed: ${error ?? ""}` : "";

  if (phase === "idle") return null;

  return (
    <article aria-label={`${name} response`} aria-busy={busy || revealing} className={`min-w-0 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 ${className}`}>
      <header className="flex items-center gap-2.5">
        <span aria-hidden="true" className={`h-2 w-2 rounded-full ${busy ? "bg-white/80 motion-safe:animate-pulse" : phase === "error" ? "bg-[#fca5a5]" : "bg-white/40"}`} />
        <span className="text-[13px] text-white/80">{name}</span>
        {status && phase !== "waiting" && (
          <span className={`font-mono text-[11px] ${phase === "error" ? "text-[#fca5a5]" : "text-white/40"}`}>{status}</span>
        )}
      </header>

      {steps.length > 0 && (
        <ol aria-label="Steps" className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-0.5 border-l border-white/[0.08] pl-2">
          {steps.map((s) => (
            <StepRow key={s.id} step={s} />
          ))}
        </ol>
      )}

      {visible && (
        <div className="mt-4 text-[14px] leading-relaxed text-white/80">
          {renderText(
            visible,
            sources,
            (busy || revealing) && <span aria-hidden="true" className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[3px] bg-white/60" />
          )}
        </div>
      )}

      {settled && !revealing && cited.length > 0 && (
        <div className="mt-4 border-t border-white/[0.06] pt-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">Sources</p>
          <ol className="mt-2 grid gap-1">
            {cited.map((s) => (
              <li key={s.n} className="flex items-center gap-2 text-[12px]">
                <span className="font-mono text-white/40">{s.n}</span>
                <a href={s.href} className="text-white/70 underline decoration-white/20 underline-offset-2 hover:text-white hover:decoration-white/50">
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {busy && onStop && (
          <button
            type="button"
            onClick={onStop}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.12] bg-white/[0.04] px-3 py-1.5 text-[12px] text-white/80 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            <Square size={11} aria-hidden="true" />
            Stop
          </button>
        )}
        {settled && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.12] bg-white/[0.04] px-3 py-1.5 text-[12px] text-white/80 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            <RotateCcw size={11} aria-hidden="true" />
            {phase === "done" ? "Regenerate" : "Retry"}
          </button>
        )}
        {settled && text && (
          <button
            type="button"
            onClick={copy}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] text-white/55 hover:bg-white/[0.05] hover:text-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            {copied ? <Check size={11} aria-hidden="true" /> : <Copy size={11} aria-hidden="true" />}
            {copied ? "Copied" : "Copy"}
          </button>
        )}
      </div>

      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
    </article>
  );
};
