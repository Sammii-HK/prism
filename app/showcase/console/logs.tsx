"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/** Hands the focusable log element up, so "L" and the command bar can focus it. */
type RegionRef = (el: HTMLDivElement | null) => void;
import { ArrowDown } from "lucide-react";
import { Tooltip, IconButton, LatencyAdapt, Skeleton } from "../../lib/components";
import { useReducedMotion } from "../../lib/hooks/reduced-motion";
import { fmtStamp, historicLatency, historicLogs, type Deployment, type LogLevel, type LogLine } from "./sim";

export const LOG_FILTERS = ["All", "Warnings", "Errors"] as const;

export const filterLines = (lines: LogLine[], filter: number) =>
  filter === 0
    ? lines
    : lines.filter((l) => l.level === "error" || (filter === 1 && l.level === "warn"));

/** Same accents as GlowBadge's fixed variants, so status reads as one system. */
const LEVEL: Record<LogLevel, { tag: string | null; colour: string }> = {
  info: { tag: null, colour: "rgba(255,255,255,0.72)" },
  ok: { tag: "ok", colour: "rgb(140,220,170)" },
  warn: { tag: "warn", colour: "rgb(230,195,140)" },
  error: { tag: "error", colour: "rgb(255,155,145)" },
};

const Lines = ({ lines }: { lines: LogLine[] }) => (
  <ol className="flex flex-col gap-1 font-mono text-[12px] leading-[1.6]">
    {lines.map((l) => {
      const lv = LEVEL[l.level];
      return (
        <li key={l.id} className="grid grid-cols-[52px_44px_minmax(0,1fr)] gap-x-3">
          <span className="tabular-nums text-white/50">{fmtStamp(l.atMs)}</span>
          {/* The tag says the level in words, so colour is never the only signal */}
          <span className="uppercase tracking-[0.08em]" style={{ color: lv.tag ? lv.colour : "rgba(255,255,255,0.5)" }}>
            {lv.tag ?? l.step}
          </span>
          <span className="whitespace-pre-wrap break-words" style={{ color: lv.colour }}>
            {l.text}
          </span>
        </li>
      );
    })}
  </ol>
);

type LiveProps = {
  lines: LogLine[];
  label: string;
  empty: string;
  regionRef: RegionRef;
};

/**
 * A log that follows new lines while you are at the bottom, and stops the
 * moment you scroll up to read. A button says how many lines arrived since and
 * takes you back. The region is focusable so it can be scrolled from the
 * keyboard, and its live announcements are off: a separate polite region says
 * what matters (step changes), so screen readers are not read every line.
 */
export const LiveLog = ({ lines, label, empty, regionRef }: LiveProps) => {
  const reduced = useReducedMotion();
  const scroller = useRef<HTMLDivElement | null>(null);
  const [pinned, setPinned] = useState(true);
  const [seen, setSeen] = useState(lines.length);

  const setRefs = useCallback(
    (el: HTMLDivElement | null) => {
      scroller.current = el;
      regionRef(el);
    },
    [regionRef]
  );

  // Follow the tail only while pinned. Layout effect, so there is no frame of the old position.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && pinned) el.scrollTop = el.scrollHeight;
  }, [lines.length, pinned]);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
    if (atBottom !== pinned) {
      setPinned(atBottom);
      setSeen(lines.length);
    }
  };

  const jump = () => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: reduced ? "auto" : "smooth" });
    setPinned(true);
    // The button is about to disappear; keep focus somewhere useful.
    el.focus({ preventScroll: true });
  };

  const unseen = pinned ? 0 : Math.max(0, lines.length - seen);

  return (
    <div className="relative">
      <div
        ref={setRefs}
        role="log"
        aria-live="off"
        aria-label={label}
        tabIndex={0}
        onScroll={onScroll}
        className="h-[340px] overflow-y-auto overscroll-contain rounded-2xl border border-white/[0.06] bg-black/40 px-4 py-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 sm:h-[380px]"
      >
        {lines.length === 0 ? <p className="py-2 text-[13px] text-white/50">{empty}</p> : <Lines lines={lines} />}
      </div>
      {!pinned && (
        <div className="absolute bottom-3 right-3">
          <Tooltip content={unseen > 0 ? `${unseen} new ${unseen === 1 ? "line" : "lines"}` : "Back to the newest line"}>
            <IconButton size="sm" aria-label={unseen > 0 ? `Jump to latest, ${unseen} new lines` : "Jump to latest"} onClick={jump}>
              <ArrowDown size={14} strokeWidth={1.5} aria-hidden />
            </IconButton>
          </Tooltip>
        </div>
      )}
    </div>
  );
};

/** Skeleton shaped like log lines, so the region doesn't jump when they arrive. */
const LogSkeleton = () => (
  <div className="flex flex-col gap-2.5 py-1">
    {[72, 88, 64, 92, 56, 80].map((w, i) => (
      <div key={i} className="grid grid-cols-[52px_44px_minmax(0,1fr)] gap-x-3">
        <Skeleton height={10} rounded="rounded" />
        <Skeleton height={10} rounded="rounded" />
        <Skeleton height={10} width={`${w}%`} rounded="rounded" />
      </div>
    ))}
  </div>
);

type HistoricProps = {
  deployment: Deployment;
  filter: number;
  regionRef: RegionRef;
};

/**
 * An older deployment's logs, fetched on demand. LatencyAdapt decides what to
 * show while waiting: nothing for a fast answer, a skeleton after 150 ms, and a
 * "still waiting" message with Cancel after 2 s. Cancel really aborts.
 */
export const HistoricLog = ({ deployment, filter, regionRef }: HistoricProps) => {
  const wrap = useRef<HTMLDivElement>(null);
  const attempt = useRef(0);

  const load = useCallback(
    (signal: AbortSignal) =>
      new Promise<LogLine[]>((resolve, reject) => {
        // Logs from this session are already in memory; still go through the
        // same path so the experience is identical.
        const ms = deployment.logs ? 60 : historicLatency(deployment, attempt.current++);
        const id = window.setTimeout(() => resolve(deployment.logs ?? historicLogs(deployment)), ms);
        signal.addEventListener("abort", () => {
          window.clearTimeout(id);
          reject(new DOMException("aborted", "AbortError"));
        });
      }),
    [deployment]
  );

  // LatencyAdapt starts on its own button. Opening logs should fetch straight
  // away, so press it once the component has mounted. The timeout lets
  // LatencyAdapt's own mount effects settle first (and makes Strict Mode's
  // double effect a no-op instead of an aborted request).
  useEffect(() => {
    const id = window.setTimeout(() => wrap.current?.querySelector<HTMLButtonElement>("button")?.click(), 0);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <div
      ref={(el) => {
        wrap.current = el;
        regionRef(el);
      }}
      role="region"
      aria-label={`Logs for deployment ${deployment.commit.sha}`}
      tabIndex={-1}
      className="rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 [&>div>div[aria-busy]]:h-[300px] [&>div>div[aria-busy]]:overflow-y-auto [&>div>div[aria-busy]]:bg-black/40 sm:[&>div>div[aria-busy]]:h-[332px]"
    >
      <LatencyAdapt<LogLine[]>
        load={load}
        startLabel="Fetch logs"
        skeleton={<LogSkeleton />}
        render={(lines) => {
          const shown = filterLines(lines, filter);
          return shown.length ? <Lines lines={shown} /> : <p className="text-[13px] text-white/50">No lines match this filter.</p>;
        }}
      />
    </div>
  );
};
