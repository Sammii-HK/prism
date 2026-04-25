"use client";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { colourField, pastelColour } from "../primitives/gradient";
import { PulseDot } from "./pulse-dot";
import { Skeleton } from "./skeleton";

export type Command = {
  id: string;
  label: string;
  hint?: string;
  keywords?: string[];
  icon?: ReactNode;
  group?: string;
  action?: () => void | Promise<void>;
  children?: Command[];
};

export type CommandPaletteProps = {
  /** Controlled open state */
  open: boolean;
  /** Open state setter — called on esc, outside click, and after invocation */
  onOpenChange: (open: boolean) => void;
  /** Commands to show. Each can have `children` to push a nested palette */
  commands: Command[];
  /** Placeholder for the search input */
  placeholder?: string;
  /** IDs of recently-used commands — shown at top when query is empty */
  recents?: string[];
  /** Label for the empty state */
  emptyLabel?: string;
  /** Show 3 skeleton rows instead of results */
  loading?: boolean;
  /** Trigger key combo for window-level open. Default: ⌘K / Ctrl+K */
  triggerKey?: { key: string; meta?: boolean };
};

type ScoredCommand = {
  cmd: Command;
  score: number;
  matches: number[];
  originalIndex: number;
};

type Frame = {
  commands: Command[];
  title: string;
};

/**
 * Fuzzy subsequence match with position + consecutive bonus.
 * Returns null if query is not a subsequence of target.
 * Returns score (higher is better) and matched indices for highlight.
 */
const fuzzyMatch = (
  query: string,
  target: string,
  keywords: string[] = []
): { score: number; matches: number[] } | null => {
  const q = query.toLowerCase();
  const t = target.toLowerCase();

  if (q.length === 0) return { score: 0, matches: [] };

  const matches: number[] = [];
  let ti = 0;
  let qi = 0;
  let score = 0;
  let consecutive = 0;
  let firstMatch = -1;
  let lastMatchIndex = -2;

  while (ti < t.length && qi < q.length) {
    if (t[ti] === q[qi]) {
      matches.push(ti);
      if (firstMatch < 0) firstMatch = ti;
      // Consecutive bonus
      if (ti === lastMatchIndex + 1) {
        consecutive++;
        score += 3 + consecutive;
      } else {
        consecutive = 0;
        score += 1;
      }
      // Word-boundary bonus
      if (ti === 0 || t[ti - 1] === " " || t[ti - 1] === "-") {
        score += 2;
      }
      lastMatchIndex = ti;
      qi++;
    }
    ti++;
  }

  if (qi < q.length) {
    // Didn't match whole query — try keywords as a fallback
    for (const kw of keywords) {
      if (kw.toLowerCase().includes(q)) {
        return { score: 5, matches: [] };
      }
    }
    return null;
  }

  // Position penalty — earlier matches score higher
  score -= firstMatch * 0.1;

  return { score, matches };
};

export const CommandPalette = ({
  open,
  onOpenChange,
  commands,
  placeholder = "Type a command…",
  recents,
  emptyLabel = "No results",
  loading = false,
  triggerKey = { key: "k", meta: true },
}: CommandPaletteProps) => {
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [stack, setStack] = useState<Frame[]>([]);
  const [announce, setAnnounce] = useState("");

  const listId = useId();

  const scrimRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const debounceRef = useRef<number | null>(null);
  const swapTriggeredRef = useRef(false);

  // Live snapshot for rAF reads
  const live = useRef({ open: false, swapTarget: 0 });
  useEffect(() => {
    live.current.open = open;
  }, [open]);

  // Mount (for portal)
  useEffect(() => {
    setMounted(true);
  }, []);

  // Active commands (from current stack frame, or root)
  const activeCommands = useMemo(() => {
    if (stack.length > 0) return stack[stack.length - 1].commands;
    return commands;
  }, [stack, commands]);

  // Build breadcrumb trail
  const breadcrumbs = useMemo(() => stack.map((f) => f.title), [stack]);

  // Compute visible items — recents on top when query empty, else fuzzy-scored
  const items = useMemo(() => {
    if (loading) return [];

    const isRoot = stack.length === 0;
    const q = query.trim();

    if (q.length === 0) {
      // Recents block (root only)
      const out: ScoredCommand[] = [];
      if (isRoot && recents && recents.length > 0) {
        const recentSet = new Set(recents);
        const byId = new Map(commands.map((c) => [c.id, c]));
        recents.forEach((id, idx) => {
          const c = byId.get(id);
          if (c) {
            out.push({
              cmd: { ...c, group: "__recent__" },
              score: 1000 - idx,
              matches: [],
              originalIndex: idx,
            });
          }
        });
        activeCommands.forEach((c, i) => {
          if (!recentSet.has(c.id)) {
            out.push({ cmd: c, score: 0, matches: [], originalIndex: i });
          }
        });
        return out;
      }
      return activeCommands.map((c, i) => ({
        cmd: c,
        score: 0,
        matches: [],
        originalIndex: i,
      }));
    }

    const scored: ScoredCommand[] = [];
    activeCommands.forEach((c, i) => {
      const r = fuzzyMatch(q, c.label, c.keywords);
      if (r) {
        scored.push({ cmd: c, score: r.score, matches: r.matches, originalIndex: i });
      }
    });
    // Stable tiebreak via originalIndex
    scored.sort((a, b) => b.score - a.score || a.originalIndex - b.originalIndex);
    return scored;
  }, [query, activeCommands, recents, commands, stack.length, loading]);

  // Group items — preserve first-seen order of groups
  const grouped = useMemo(() => {
    const groups: { key: string; label: string; items: ScoredCommand[] }[] = [];
    const idx = new Map<string, number>();
    for (const s of items) {
      const raw = s.cmd.group ?? "__default__";
      const label =
        raw === "__recent__"
          ? "Recent"
          : raw === "__default__"
            ? ""
            : raw;
      if (!idx.has(raw)) {
        idx.set(raw, groups.length);
        groups.push({ key: raw, label, items: [] });
      }
      groups[idx.get(raw)!].items.push(s);
    }
    return groups;
  }, [items]);

  // Flat list of items in render order (for keyboard navigation + indicator)
  const flatItems = useMemo(() => grouped.flatMap((g) => g.items), [grouped]);

  // Reset highlight when result set changes
  useEffect(() => {
    setHighlight(0);
  }, [query, stack]);

  // Clamp highlight
  useEffect(() => {
    if (highlight >= flatItems.length) setHighlight(Math.max(0, flatItems.length - 1));
  }, [flatItems.length, highlight]);

  // Debounced announce
  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      if (loading) setAnnounce("Loading results");
      else if (flatItems.length === 0) setAnnounce(`${emptyLabel}`);
      else setAnnounce(`${flatItems.length} result${flatItems.length === 1 ? "" : "s"}`);
    }, 180);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [flatItems.length, loading, emptyLabel, open, query]);

  // Trigger key (window-level)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const wantMeta = triggerKey.meta !== false;
      const metaMatch = wantMeta ? e.metaKey || e.ctrlKey : true;
      if (metaMatch && e.key.toLowerCase() === triggerKey.key.toLowerCase()) {
        e.preventDefault();
        onOpenChange(!live.current.open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onOpenChange, triggerKey.key, triggerKey.meta]);

  // Focus management: save + restore
  useEffect(() => {
    if (open) {
      restoreFocusRef.current = document.activeElement as HTMLElement | null;
      // Focus input on next tick (after portal mounts)
      const id = window.setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
      return () => window.clearTimeout(id);
    } else {
      // Reset internal state when closing
      setQuery("");
      setStack([]);
      swapTriggeredRef.current = false;
      const el = restoreFocusRef.current;
      if (el && typeof el.focus === "function") {
        // Defer to end of close animation (approx 250ms)
        const id = window.setTimeout(() => el.focus(), 250);
        return () => window.clearTimeout(id);
      }
    }
  }, [open]);

  // Execute a command
  const runCommand = useCallback(
    (cmd: Command) => {
      if (cmd.children && cmd.children.length > 0) {
        // Push sub-palette — trigger content swap animation
        swapTriggeredRef.current = true;
        setStack((s) => [...s, { commands: cmd.children!, title: cmd.label }]);
        setQuery("");
        return;
      }
      try {
        cmd.action?.();
      } finally {
        onOpenChange(false);
      }
    },
    [onOpenChange]
  );

  const popStack = useCallback(() => {
    swapTriggeredRef.current = true;
    setStack((s) => s.slice(0, -1));
    setQuery("");
  }, []);

  // Keyboard handler on the input
  const onInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      // ⌘1–9 direct-action
      if ((e.metaKey || e.ctrlKey) && /^[1-9]$/.test(e.key)) {
        const idx = parseInt(e.key, 10) - 1;
        if (idx < flatItems.length) {
          e.preventDefault();
          runCommand(flatItems[idx].cmd);
          return;
        }
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlight((h) => Math.min(flatItems.length - 1, h + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlight((h) => Math.max(0, h - 1));
      } else if (e.key === "Home") {
        e.preventDefault();
        setHighlight(0);
      } else if (e.key === "End") {
        e.preventDefault();
        setHighlight(Math.max(0, flatItems.length - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (flatItems.length > 0 && highlight < flatItems.length) {
          runCommand(flatItems[highlight].cmd);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        if (stack.length > 0) popStack();
        else onOpenChange(false);
      } else if (e.key === "Backspace" && query.length === 0 && stack.length > 0) {
        e.preventDefault();
        popStack();
      }
    },
    [flatItems, highlight, query, stack.length, runCommand, popStack, onOpenChange]
  );

  // Motion: scrim, panel entrance + exit + content swap, indicator pill
  useEffect(() => {
    if (!mounted) return;

    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let raf: number;

    // Spring state
    const sp = {
      scrim: 0,
      scrimVel: 0,
      panelOpacity: 0,
      panelOpacityVel: 0,
      panelY: -12,
      panelYVel: 0,
      panelScale: 0.96,
      panelScaleVel: 0,
      contentX: 0,
      contentXVel: 0,
      // Indicator pill
      indY: 0,
      indYVel: 0,
      indH: 0,
      indHVel: 0,
      indOpacity: 0,
      indOpacityVel: 0,
      initialisedIndicator: false,
      // Scrim blobs
      scrimX: 50,
      scrimY: 50,
      // Cursor for accent
      mouseX: 50,
      mouseY: 50,
    };

    const onMove = (e: PointerEvent) => {
      sp.mouseX = (e.clientX / window.innerWidth) * 100;
      sp.mouseY = (e.clientY / window.innerHeight) * 100;
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    const step = (
      pos: number,
      vel: number,
      target: number,
      k: number,
      d: number
    ): [number, number] => {
      const acc = k * (target - pos) - d * vel;
      const newVel = vel + acc / 60;
      return [pos + newVel / 60, newVel];
    };

    let smoothX = 50;
    let smoothY = 50;

    // Swap state — handles mid-transition content replacement
    let contentTarget = 0; // resting
    let swapPhase: "idle" | "out" | "in" = "idle";

    const tick = () => {
      const t = performance.now() / 1000;
      const isOpen = live.current.open;

      smoothX += (sp.mouseX - smoothX) * 0.06;
      smoothY += (sp.mouseY - smoothY) * 0.06;

      // Scrim + panel targets
      const targetScrim = isOpen ? 1 : 0;
      const targetPanelOpacity = isOpen ? 1 : 0;
      const targetPanelY = isOpen ? 0 : -12;
      const targetPanelScale = isOpen ? 1 : 0.96;

      if (prefersReduced) {
        sp.scrim = targetScrim;
        sp.panelOpacity = targetPanelOpacity;
        sp.panelY = targetPanelY;
        sp.panelScale = targetPanelScale;
      } else {
        [sp.scrim, sp.scrimVel] = step(sp.scrim, sp.scrimVel, targetScrim, 180, 24);
        [sp.panelOpacity, sp.panelOpacityVel] = step(
          sp.panelOpacity,
          sp.panelOpacityVel,
          targetPanelOpacity,
          200,
          24
        );
        [sp.panelY, sp.panelYVel] = step(
          sp.panelY,
          sp.panelYVel,
          targetPanelY,
          200,
          24
        );
        [sp.panelScale, sp.panelScaleVel] = step(
          sp.panelScale,
          sp.panelScaleVel,
          targetPanelScale,
          200,
          24
        );
      }

      // Content-swap animation — translateX 0 → -8 → 0
      if (swapTriggeredRef.current && swapPhase === "idle") {
        swapTriggeredRef.current = false;
        swapPhase = "out";
        contentTarget = -8;
      }

      if (prefersReduced) {
        sp.contentX = contentTarget;
        if (swapPhase === "out") swapPhase = "in";
        if (swapPhase === "in") {
          contentTarget = 0;
          swapPhase = "idle";
        }
      } else {
        [sp.contentX, sp.contentXVel] = step(
          sp.contentX,
          sp.contentXVel,
          contentTarget,
          220,
          26
        );
        if (swapPhase === "out" && Math.abs(sp.contentX - -8) < 0.6) {
          // Midpoint reached — swap has already happened via React state,
          // now bounce back to 0
          swapPhase = "in";
          contentTarget = 0;
        }
      }

      // Indicator pill — measure current highlighted item
      const hEl = itemRefs.current[highlight];
      const listEl = listRef.current;
      const shouldShowIndicator =
        isOpen && !loading && flatItems.length > 0 && hEl && listEl;
      const targetIndOpacity = shouldShowIndicator ? 1 : 0;

      if (shouldShowIndicator) {
        const listRect = listEl!.getBoundingClientRect();
        const itemRect = hEl!.getBoundingClientRect();
        const targetY = itemRect.top - listRect.top + listEl!.scrollTop;
        const targetH = itemRect.height;

        if (!sp.initialisedIndicator) {
          sp.indY = targetY;
          sp.indH = targetH;
          sp.initialisedIndicator = true;
        }

        if (prefersReduced) {
          sp.indY = targetY;
          sp.indH = targetH;
        } else {
          [sp.indY, sp.indYVel] = step(sp.indY, sp.indYVel, targetY, 180, 22);
          [sp.indH, sp.indHVel] = step(sp.indH, sp.indHVel, targetH, 180, 22);
        }
      } else if (!isOpen) {
        sp.initialisedIndicator = false;
      }

      if (prefersReduced) {
        sp.indOpacity = targetIndOpacity;
      } else {
        [sp.indOpacity, sp.indOpacityVel] = step(
          sp.indOpacity,
          sp.indOpacityVel,
          targetIndOpacity,
          200,
          24
        );
      }

      // Colour — cursor-mapped pastel
      const { r, g, b } = pastelColour(smoothX, smoothY, t);

      // Apply to DOM
      if (scrimRef.current) {
        scrimRef.current.style.opacity = `${Math.max(0, Math.min(1, sp.scrim))}`;
        scrimRef.current.style.pointerEvents = isOpen ? "auto" : "none";
      }

      if (panelRef.current) {
        panelRef.current.style.opacity = `${Math.max(
          0,
          Math.min(1, sp.panelOpacity)
        )}`;
        panelRef.current.style.transform = `translate(-50%, calc(-50% + ${sp.panelY}px)) scale(${sp.panelScale})`;
        panelRef.current.style.pointerEvents = isOpen ? "auto" : "none";
      }

      if (contentRef.current) {
        contentRef.current.style.transform = `translateX(${sp.contentX}px)`;
      }

      if (fieldRef.current) {
        // Subtle cursor-mapped top border accent on the field
        fieldRef.current.style.borderBottomColor = `rgba(${r},${g},${b},0.18)`;
      }

      if (indicatorRef.current) {
        indicatorRef.current.style.opacity = `${Math.max(
          0,
          Math.min(1, sp.indOpacity)
        )}`;
        indicatorRef.current.style.transform = `translateY(${sp.indY}px)`;
        indicatorRef.current.style.height = `${sp.indH}px`;
        indicatorRef.current.style.background = `rgb(${r} ${g} ${b} / 0.15)`;
        indicatorRef.current.style.borderColor = `rgb(${r} ${g} ${b} / 0.4)`;
        indicatorRef.current.style.boxShadow = `0 0 14px rgb(${r} ${g} ${b} / 0.14), inset 0 0 8px rgb(${r} ${g} ${b} / 0.06)`;
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, [mounted, highlight, flatItems.length, loading]);

  // Scrim blobs — static CSS built once per open
  const scrimBackground = useMemo(() => {
    return colourField(50, 50, 0, 8).background;
  }, []);

  if (!mounted || typeof document === "undefined") return null;

  const currentTitle =
    stack.length > 0 ? stack[stack.length - 1].title : null;

  // Highlighted label renderer
  const renderLabel = (label: string, matches: number[]) => {
    if (matches.length === 0) {
      return <span style={{ color: "rgba(255,255,255,0.85)" }}>{label}</span>;
    }
    const set = new Set(matches);
    return (
      <>
        {Array.from(label).map((ch, i) => (
          <span
            key={i}
            style={{
              color: set.has(i)
                ? "rgba(255,255,255,0.95)"
                : "rgba(255,255,255,0.5)",
            }}
          >
            {ch}
          </span>
        ))}
      </>
    );
  };

  // Assemble flat-item index map (for ⌘N hints + aria-activedescendant)
  let flatCursor = 0;

  const activeItemId = flatItems[highlight]
    ? `${listId}-item-${highlight}`
    : undefined;

  return createPortal(
    <>
      {/* Scrim */}
      <div
        ref={scrimRef}
        aria-hidden="true"
        onClick={() => onOpenChange(false)}
        style={{
          position: "fixed",
          inset: 0,
          opacity: 0,
          pointerEvents: "none",
          zIndex: 80,
          // Layered: black veil + colourField blobs behind backdrop blur
          background: "rgba(5,5,5,0.55)",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          willChange: "opacity",
        }}
      >
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: "-10%",
            background: scrimBackground,
            filter: "blur(48px) saturate(1.2)",
            opacity: 0.75,
            pointerEvents: "none",
          }}
        />
      </div>

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        style={{
          position: "fixed",
          top: "38%",
          left: "50%",
          transform: "translate(-50%, calc(-50% - 12px)) scale(0.96)",
          width: "min(640px, calc(100vw - 32px))",
          maxHeight: "min(520px, calc(100vh - 80px))",
          display: "flex",
          flexDirection: "column",
          opacity: 0,
          pointerEvents: "none",
          zIndex: 81,
          borderRadius: 16,
          overflow: "hidden",
          background: "rgba(20,20,20,0.95)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow:
            "0 30px 80px -20px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04) inset",
          willChange: "opacity, transform",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input field */}
        <div
          ref={fieldRef}
          className="flex items-center gap-2 px-4"
          style={{
            height: 56,
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          {/* Search icon */}
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: "rgba(255,255,255,0.35)", flexShrink: 0 }}
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <line x1="16.5" y1="16.5" x2="21" y2="21" />
          </svg>

          {/* Breadcrumb chips inline */}
          {breadcrumbs.length > 0 && (
            <div className="flex items-center gap-1.5">
              {breadcrumbs.map((b, i) => (
                <span
                  key={i}
                  className="inline-flex items-center rounded-md px-2 py-0.5 text-xs"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "rgba(255,255,255,0.7)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {b}
                </span>
              ))}
            </div>
          )}

          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={activeItemId}
            aria-autocomplete="list"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder={currentTitle ? `Search ${currentTitle.toLowerCase()}…` : placeholder}
            className="flex-1 bg-transparent outline-none text-sm"
            style={{
              color: "rgba(255,255,255,0.9)",
              border: "none",
            }}
            spellCheck={false}
            autoComplete="off"
          />

          {/* Kbd hint for esc */}
          <kbd
            className="text-[10px] font-mono px-1.5 py-0.5 rounded-md select-none"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.45)",
            }}
          >
            esc
          </kbd>
        </div>

        {/* Content area with swap animation */}
        <div
          ref={contentRef}
          style={{
            flex: 1,
            overflow: "hidden",
            willChange: "transform",
          }}
        >
          <div
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={currentTitle ?? "Commands"}
            style={{
              position: "relative",
              maxHeight: 420,
              overflowY: "auto",
              padding: "8px 8px 10px",
            }}
          >
            {/* Morphing highlight pill */}
            <div
              ref={indicatorRef}
              aria-hidden="true"
              style={{
                position: "absolute",
                left: 8,
                right: 8,
                top: 0,
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.04)",
                opacity: 0,
                pointerEvents: "none",
                willChange: "transform, height, opacity",
              }}
            />

            {loading ? (
              <div className="flex flex-col gap-2 p-2">
                <Skeleton height={36} rounded="rounded-lg" />
                <Skeleton height={36} rounded="rounded-lg" />
                <Skeleton height={36} rounded="rounded-lg" />
              </div>
            ) : flatItems.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center gap-3 py-14"
                style={{ color: "rgba(255,255,255,0.35)" }}
              >
                <PulseDot size={8} />
                <p className="text-sm">{emptyLabel}</p>
                {query && (
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
                    for &ldquo;{query}&rdquo;
                  </p>
                )}
              </div>
            ) : (
              grouped.map((g) => (
                <div key={g.key} className="relative">
                  {g.label && (
                    <div
                      className="flex items-center gap-3 px-3 pt-3 pb-1.5"
                      style={{
                        borderTop:
                          grouped[0].key === g.key
                            ? "none"
                            : "1px solid rgba(255,255,255,0.05)",
                        marginTop: grouped[0].key === g.key ? 0 : 4,
                      }}
                    >
                      <span
                        className="text-[10px] tracking-widest uppercase font-medium"
                        style={{ color: "rgba(255,255,255,0.35)" }}
                      >
                        {g.label}
                      </span>
                    </div>
                  )}

                  {g.items.map((s) => {
                    const idx = flatCursor++;
                    const selected = idx === highlight;
                    const directKey = idx < 9 ? `⌘${idx + 1}` : null;
                    const hasChildren =
                      s.cmd.children && s.cmd.children.length > 0;

                    return (
                      <button
                        key={s.cmd.id}
                        ref={(el) => {
                          itemRefs.current[idx] = el;
                        }}
                        id={`${listId}-item-${idx}`}
                        role="option"
                        aria-selected={selected}
                        type="button"
                        onClick={() => runCommand(s.cmd)}
                        onMouseEnter={() => setHighlight(idx)}
                        className="relative w-full flex items-center gap-3 px-3 py-2.5 text-left rounded-lg outline-none cursor-pointer select-none"
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "rgba(255,255,255,0.85)",
                          zIndex: 1,
                        }}
                      >
                        {s.cmd.icon && (
                          <span
                            className="flex items-center justify-center flex-shrink-0"
                            style={{
                              width: 20,
                              height: 20,
                              color: selected
                                ? "rgba(255,255,255,0.85)"
                                : "rgba(255,255,255,0.55)",
                            }}
                          >
                            {s.cmd.icon}
                          </span>
                        )}

                        <span className="flex-1 text-sm truncate">
                          {renderLabel(s.cmd.label, s.matches)}
                        </span>

                        {hasChildren && (
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            style={{ color: "rgba(255,255,255,0.35)" }}
                            aria-hidden="true"
                          >
                            <polyline points="9 6 15 12 9 18" />
                          </svg>
                        )}

                        {s.cmd.hint && (
                          <span
                            className="text-[10px] font-mono px-1.5 py-0.5 rounded-md"
                            style={{
                              background: "rgba(255,255,255,0.04)",
                              border: "1px solid rgba(255,255,255,0.08)",
                              color: "rgba(255,255,255,0.5)",
                            }}
                          >
                            {s.cmd.hint}
                          </span>
                        )}

                        {!s.cmd.hint && directKey && selected && (
                          <span
                            className="text-[10px] font-mono px-1.5 py-0.5 rounded-md"
                            style={{
                              background: "rgba(255,255,255,0.04)",
                              border: "1px solid rgba(255,255,255,0.08)",
                              color: "rgba(255,255,255,0.4)",
                            }}
                          >
                            {directKey}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer with keyboard legend */}
        <div
          className="flex items-center justify-between gap-3 px-4"
          style={{
            height: 36,
            borderTop: "1px solid rgba(255,255,255,0.06)",
            background: "rgba(255,255,255,0.015)",
            flexShrink: 0,
          }}
        >
          <div className="flex items-center gap-3">
            <LegendChip label="↑↓" />
            <span
              className="text-[10px]"
              style={{ color: "rgba(255,255,255,0.35)" }}
            >
              navigate
            </span>
            <LegendChip label="↵" />
            <span
              className="text-[10px]"
              style={{ color: "rgba(255,255,255,0.35)" }}
            >
              select
            </span>
            {stack.length > 0 && (
              <>
                <LegendChip label="⌫" />
                <span
                  className="text-[10px]"
                  style={{ color: "rgba(255,255,255,0.35)" }}
                >
                  back
                </span>
              </>
            )}
          </div>
          <span
            className="text-[10px]"
            style={{ color: "rgba(255,255,255,0.3)" }}
          >
            {flatItems.length} {flatItems.length === 1 ? "result" : "results"}
          </span>
        </div>
      </div>

      {/* Screen reader announcements */}
      <div
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: "fixed",
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: "hidden",
          clip: "rect(0,0,0,0)",
          border: 0,
        }}
      >
        {open ? announce : ""}
      </div>
    </>,
    document.body
  );
};

const LegendChip = ({ label }: { label: string }) => (
  <kbd
    className="text-[10px] font-mono px-1.5 py-0.5 rounded-md select-none"
    style={{
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.08)",
      color: "rgba(255,255,255,0.5)",
      lineHeight: 1,
    }}
  >
    {label}
  </kbd>
);
