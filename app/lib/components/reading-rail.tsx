"use client";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useSystemReducedMotion } from "./async-button";
import {
  DEFAULT_DWELL, DEFAULT_PARAMS, analyse, capSamples, classifyBlock, countWords, etaSeconds, formatEta, recentPace, totalWords, wordsAt,
  type Block, type Dwell, type Sample,
} from "../reading-pace-core";

export * from "../reading-pace-core";

/** The text being read. Written for this demo; word counts are computed from it, not typed in. */
export const ARTICLE: { id: string; text: string }[] = [
  { id: "p1", text: "A list that reorders itself the instant you drop an item feels broken, even when the new order is correct. Nothing connects where the row was to where it went, so you have to find it again." },
  { id: "p2", text: "Motion fixes that, but only if it carries information. A row that glides to its new place tells you which row moved and where it landed. A row that bounces for its own sake tells you nothing." },
  { id: "p3", text: "The same test applies to text. A page can animate a progress bar as you scroll, but a bar that only fills is a thermometer. It says how far you are, and nothing about how you are going." },
  { id: "p4", text: "Reading is slower than scrolling. A person can move a page far faster than they can take in its words, so scroll speed alone says very little about reading, and a single fast flick would swamp any average." },
  { id: "p5", text: "So this rail does not measure each scroll event. It groups the position of a reading line into buckets of a few seconds and asks how many words passed through the line in each bucket." },
  { id: "p6", text: "A bucket that passes words faster than a skimming limit is set aside as skimming. A long run with no movement is set aside as being away. Neither is allowed to drag the estimate around." },
  { id: "p7", text: "What is left is time spent with the reading line moving at a plausible pace, plus short pauses, which count as reading because people stop to think. Words divided by that time is the pace." },
  { id: "p8", text: "Scrolling backwards is counted separately, as re-reading. It adds to the time spent but not to the words passed, so going back over a hard paragraph lowers the pace instead of inflating it." },
  { id: "p9", text: "With a pace, the remaining words give a time left. That figure moves as you speed up or slow down, and it is only as good as the last stretch it was measured on, which is why it says so." },
  { id: "p10", text: "The rail itself is the second readout. Each paragraph is a segment as tall as its word count. Once you have a pace, each segment is coloured by how long you spent there compared with how long it takes at that pace." },
  { id: "p11", text: "Under a set fraction of that time counts as skimmed, about that long as read, and much more as lingered on. The fractions are settings in this demo, listed in the evidence column, not facts about how people read." },
  { id: "p12", text: "Colour alone is a poor way to say anything, so the legend under the rail repeats each colour in words, with a count of paragraphs of each kind. The rail is a summary of those counts, not a replacement for them." },
  { id: "p13", text: "Nothing here can see your eyes. A page left scrolled to the middle while you make tea looks the same as a page being read slowly, until the idle rule notices, and a fast reader who barely moves the page looks slow." },
  { id: "p14", text: "It also cannot tell whether anything was understood. Scrolling at an even pace past text you did not take in produces a healthy-looking number. The measure is of the page moving, and a proxy at best." },
  { id: "p15", text: "That limit is the reason the measurement stays on this page. It is not sent anywhere, it is not stored, and the reset button clears every sample. Reloading does the same." },
  { id: "p16", text: "If you turn on reduced motion, the rail still updates but nothing eases: the marker jumps, colours change at once, and the page never scrolls itself. The skip button moves the page instantly either way." },
  { id: "p17", text: "Try it three ways. Scroll steadily and watch the pace settle. Stop on a paragraph and watch it turn into a linger. Then use the skip button and watch those words be counted as skimmed instead of read." },
  { id: "p18", text: "The keyboard works the same as the wheel. Focus the article, then use the arrow keys, Page Down or Space. Whatever moves the reading line is measured, because the measure only ever sees the line." },
  { id: "p19", text: "Everything in the evidence column comes from the samples taken while you used the page, through the same functions the unit tests run. Until you have scrolled, it says so, and shows no number at all." },
  { id: "p20", text: "That is the end of the article. If the rail is full, the last stretch is the one the estimate leans on, because the time left is measured over the most recent half minute of your reading." },
];

const CLASS_STYLE: Record<Dwell, { bg: string; label: string }> = {
  unvisited: { bg: "rgba(255,255,255,0.09)", label: "not reached" },
  visited: { bg: "rgba(255,255,255,0.32)", label: "visited, no pace yet" },
  skimmed: { bg: "rgb(255,196,110)", label: "skimmed" },
  read: { bg: "rgb(130,220,170)", label: "read" },
  lingered: { bg: "rgb(190,170,255)", label: "lingered" },
};

export interface ReadingObservation {
  started: boolean;
  totalWords: number;
  blocks: number;
  passedWords: number;
  wpm: number | null;
  recentWpm: number | null;
  etaText: string;
  readWords: number;
  skimmedWords: number;
  rereadWords: number;
  activeSeconds: number;
  idleSeconds: number;
  counts: Record<Dwell, number>;
  samples: number;
}

const LINE = 0.4;

const btn =
  "rounded-lg border px-3 py-1.5 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black";
const btnStyle = { borderColor: "rgba(255,255,255,0.24)", background: "rgba(255,255,255,0.08)" } as const;

const emptyCounts = (): Record<Dwell, number> => ({ unvisited: 0, visited: 0, skimmed: 0, read: 0, lingered: 0 });

export function ReadingRailPanel({
  embedded = false,
  forceReduced = false,
  onObserve,
  height = 440,
}: {
  embedded?: boolean;
  forceReduced?: boolean;
  onObserve?: (o: ReadingObservation) => void;
  /** Height of the article and rail in px. */
  height?: number;
}) {
  const uid = useId();
  const systemReduced = useSystemReducedMotion();
  const reduced = forceReduced || systemReduced;

  const scrollerRef = useRef<HTMLDivElement>(null);
  const paraRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  const blocksRef = useRef<Block[]>([]);
  const samplesRef = useRef<Sample[]>([]);
  const startedRef = useRef(false);
  const resetAt = useRef(0);
  const onObserveRef = useRef(onObserve);
  const [focusMode, setFocusMode] = useState(true);
  const [obs, setObs] = useState<ReadingObservation | null>(null);
  const [dwell, setDwell] = useState<Dwell[]>(() => ARTICLE.map(() => "unvisited"));
  const [markerPct, setMarkerPct] = useState(0);
  const [current, setCurrent] = useState(0);
  const [thumb, setThumb] = useState({ top: 0, height: 100 });
  const words = ARTICLE.map((a) => countWords(a.text));

  useEffect(() => {
    onObserveRef.current = onObserve;
  }, [onObserve]);

  const measureBlocks = useCallback(() => {
    const els = paraRefs.current;
    const out: Block[] = [];
    ARTICLE.forEach((a, i) => {
      const el = els[i];
      if (!el) return;
      const next = els[i + 1];
      const top = el.offsetTop;
      const height = next ? next.offsetTop - top : el.offsetHeight;
      out.push({ top, height: Math.max(1, height), words: countWords(a.text) });
    });
    blocksRef.current = out;
  }, []);

  const lineY = useCallback(() => {
    const sc = scrollerRef.current;
    return sc ? sc.scrollTop + LINE * sc.clientHeight : 0;
  }, []);

  /** Recompute everything shown, from the samples taken so far. */
  const refresh = useCallback(() => {
    const blocks = blocksRef.current;
    if (blocks.length === 0) return;
    const y = lineY();
    const total = totalWords(blocks);
    const passed = wordsAt(y, blocks);
    const all = analyse(samplesRef.current, blocks, DEFAULT_PARAMS);
    const recent = recentPace(samplesRef.current, blocks, DEFAULT_PARAMS);
    const paceForEta = recent.wpm ?? all.wpm;
    const classes = blocks.map((b, i) => classifyBlock(all.dwellMs[i] ?? 0, all.coveredWords[i] ?? 0, b.words, all.wpm, DEFAULT_DWELL));
    const counts = emptyCounts();
    classes.forEach((c) => counts[c]++);
    const sc = scrollerRef.current;
    const lastBlock = blocks[blocks.length - 1];
    const span = Math.max(1, lastBlock.top + lastBlock.height);
    if (sc) setThumb({ top: (sc.scrollTop / span) * 100, height: (sc.clientHeight / span) * 100 });
    setDwell((prev) => (prev.length === classes.length && prev.every((c, i) => c === classes[i]) ? prev : classes));
    setMarkerPct((passed / Math.max(1, total)) * 100);
    const found = blocks.findIndex((b) => y < b.top + b.height);
    setCurrent(found === -1 ? blocks.length - 1 : found);
    const o: ReadingObservation = {
      started: startedRef.current,
      totalWords: total,
      blocks: blocks.length,
      passedWords: Math.round(passed),
      wpm: all.wpm,
      recentWpm: recent.wpm,
      etaText: startedRef.current ? formatEta(etaSeconds(total - passed, paceForEta)) : "scroll to begin",
      readWords: Math.round(all.readWords),
      skimmedWords: Math.round(all.skimmedWords),
      rereadWords: Math.round(all.rereadWords),
      activeSeconds: all.activeMs / 1000,
      idleSeconds: all.idleMs / 1000,
      counts,
      samples: samplesRef.current.length,
    };
    setObs(o);
    onObserveRef.current?.(o);
  }, [lineY]);

  useEffect(() => {
    const sc = scrollerRef.current;
    if (!sc) return;
    measureBlocks();
    refresh();
    const onScroll = () => {
      if (!startedRef.current && performance.now() - resetAt.current > 200) {
        startedRef.current = true;
        samplesRef.current = [{ t: performance.now(), y: lineY() }];
      }
    };
    sc.addEventListener("scroll", onScroll, { passive: true });
    const sample = window.setInterval(() => {
      if (!startedRef.current) return;
      samplesRef.current = capSamples([...samplesRef.current, { t: performance.now(), y: lineY() }]);
    }, 250);
    const show = window.setInterval(refresh, 500);
    const ro = new ResizeObserver(() => {
      measureBlocks();
      refresh();
    });
    ro.observe(sc);
    return () => {
      sc.removeEventListener("scroll", onScroll);
      window.clearInterval(sample);
      window.clearInterval(show);
      ro.disconnect();
    };
  }, [measureBlocks, refresh, lineY]);

  const reset = () => {
    resetAt.current = performance.now();
    startedRef.current = false;
    samplesRef.current = [];
    scrollerRef.current?.scrollTo({ top: 0, behavior: "instant" });
    refresh();
  };
  const skip = () => {
    const sc = scrollerRef.current;
    if (!sc) return;
    if (!startedRef.current) {
      // Start measuring before the jump, so the jump itself is seen.
      startedRef.current = true;
      samplesRef.current = [{ t: performance.now(), y: lineY() }];
    }
    const blocks = blocksRef.current;
    const last = blocks[blocks.length - 1];
    const target = last ? (last.top + last.height) * 0.7 - LINE * sc.clientHeight : 0;
    sc.scrollTo({ top: Math.max(0, target), behavior: "instant" });
  };

  const o = obs;
  const transition = reduced ? "none" : "background-color 200ms ease, color 200ms ease";

  return (
    <div className="mx-auto flex w-full max-w-4xl min-w-0 flex-col gap-5">
      {!embedded && <p className="text-xs uppercase tracking-widest text-white/25">reading-rail</p>}

      <div className="flex min-w-0 flex-wrap items-baseline gap-x-8 gap-y-1 font-mono text-[12.5px] text-white/80" data-testid="reading-readout">
        <span>
          pace{" "}
          <span className="text-white" data-testid="reading-wpm">
            {o?.recentWpm != null ? `${Math.round(o.recentWpm)} wpm` : o?.wpm != null ? `${Math.round(o.wpm)} wpm` : "not enough movement yet"}
          </span>
        </span>
        <span>
          time left{" "}
          <span className="text-white" data-testid="reading-eta">
            {o?.etaText ?? "scroll to begin"}
          </span>
        </span>
        <span>
          passed {o?.passedWords ?? 0} of {o?.totalWords ?? words.reduce((a, b) => a + b, 0)} words
        </span>
      </div>

      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_22px] gap-3 sm:grid-cols-[minmax(0,1fr)_28px] sm:gap-4">
        <div className="relative min-w-0">
          <div
            ref={scrollerRef}
            tabIndex={0}
            role="region"
            aria-label="Article, scrollable. Use the arrow keys, Page Down or Space to read."
            data-testid="reading-scroller"
            className="relative overflow-y-auto rounded-xl border px-5 py-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black sm:px-8"
            style={{ height, borderColor: "rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.3)", scrollBehavior: "auto", overscrollBehavior: "contain" }}
          >
            <h3 className="mb-5 text-[11px] font-medium uppercase tracking-[0.2em] text-white/60">A page that notices how you read</h3>
            {ARTICLE.map((a, i) => (
              <p
                key={a.id}
                ref={(el) => {
                  paraRefs.current[i] = el;
                }}
                data-block={i}
                className="mb-5 text-[16px] leading-[1.65]"
                style={{
                  fontFamily: 'ui-serif, "Iowan Old Style", "Palatino Linotype", Georgia, serif',
                  color: !focusMode || i === current ? "rgba(255,255,255,0.94)" : "rgba(255,255,255,0.6)",
                  transition,
                }}
              >
                {a.text}
              </p>
            ))}
            <div aria-hidden style={{ height: "60%" }} />
          </div>
          <div
            aria-hidden
            className="pointer-events-none absolute left-0 right-0"
            style={{ top: `${LINE * 100}%`, height: 0 }}
          >
            <span className="absolute left-0 h-px w-full" style={{ background: "rgba(190,170,255,0.22)" }} />
            <span className="absolute left-0 h-[2px] w-4 -translate-y-px rounded-r" style={{ background: "rgb(190,170,255)" }} />
          </div>
        </div>

        <div className="relative min-w-0" aria-hidden="true" data-testid="reading-rail">
          <div className="flex flex-col gap-[2px]" style={{ height }}>
            {ARTICLE.map((a, i) => (
              <div
                key={a.id}
                data-rail-block={i}
                data-class={dwell[i]}
                className="rounded-[2px]"
                style={{ flexGrow: words[i], flexBasis: 0, background: CLASS_STYLE[dwell[i]].bg, transition }}
              />
            ))}
          </div>
          <div
            className="pointer-events-none absolute -left-1 -right-1 h-[3px] rounded-full bg-white"
            data-testid="reading-marker"
            style={{ top: `${markerPct}%`, transition: reduced ? "none" : "top 120ms linear" }}
          />
          <div
            className="pointer-events-none absolute left-[-5px] w-px"
            style={{ top: `${thumb.top}%`, height: `${thumb.height}%`, background: "rgba(255,255,255,0.35)" }}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={btn} style={btnStyle} onClick={skip} data-testid="reading-skip">
          Skip to 70%
        </button>
        <button type="button" className={btn} style={btnStyle} onClick={reset} data-testid="reading-reset">
          Reset measurement
        </button>
        <label htmlFor={`${uid}-focus`} className="flex cursor-pointer items-center gap-2 text-sm text-white/75">
          <input
            id={`${uid}-focus`}
            type="checkbox"
            checked={focusMode}
            onChange={(e) => setFocusMode(e.target.checked)}
            className="h-4 w-4 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            style={{ accentColor: "rgb(190,170,255)" }}
          />
          Brighten the paragraph at the reading line
        </label>
      </div>

      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-white/70" aria-label="Rail colours">
        {(Object.keys(CLASS_STYLE) as Dwell[]).map((k) => (
          <li key={k} className="flex items-center gap-2">
            <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ background: CLASS_STYLE[k].bg }} />
            {CLASS_STYLE[k].label}
            <span className="text-white/50" style={{ fontFamily: "var(--font-geist-mono), monospace" }}>
              {o ? o.counts[k] : 0}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
