"use client";
import { useRef, useEffect, useCallback } from "react";
import { pastelColour } from "../primitives/gradient";
import { subscribeAttention } from "../hooks/attention";
import { motionTime, reducedMotionNow } from "../hooks/reduced-motion";

type MorphTabsProps = {
  tabs: string[];
  activeIndex: number;
  onChange: (index: number) => void;
  className?: string;
  /** Accessible name for the tab list. */
  ariaLabel?: string;
  /**
   * When set, tabs get ids `${idPrefix}-tab-${i}` and point at panels with ids
   * `${idPrefix}-panel-${i}`, so the page can wire up role="tabpanel".
   */
  idPrefix?: string;
};

/**
 * A tab bar where the active indicator springs between tabs.
 * Indicator colour shifts with cursor position via pastelColour.
 * Spring physics for position (x) and width — k=180, d=22.
 *
 * @example
 * <MorphTabs
 *   tabs={["Overview", "Analytics", "Settings"]}
 *   activeIndex={active}
 *   onChange={setActive}
 * />
 */
export const MorphTabs = ({
  tabs,
  activeIndex,
  onChange,
  className = "",
  ariaLabel,
  idPrefix,
}: MorphTabsProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const stateRef = useRef({
    // Spring state for indicator x and width
    x: 0,
    xVel: 0,
    w: 0,
    wVel: 0,
    // Cursor tracking
    mouseX: 0,
    mouseY: 0,
    // Target values
    targetX: 0,
    targetW: 0,
    // Colour
    glowR: 200,
    glowG: 200,
    glowB: 255,
    // Initialised flag
    initialised: false,
  });

  const measureTarget = useCallback(() => {
    const container = containerRef.current;
    const tab = tabRefs.current[activeIndex];
    if (!container || !tab) return;

    const containerRect = container.getBoundingClientRect();
    const tabRect = tab.getBoundingClientRect();

    const s = stateRef.current;
    // Relative to the padding box, which is where an absolute child's left: 0 sits.
    s.targetX = tabRect.left - containerRect.left - container.clientLeft;
    s.targetW = tabRect.width;

    // Snap on first measure
    if (!s.initialised) {
      s.x = s.targetX;
      s.w = s.targetW;
      s.initialised = true;
    }
  }, [activeIndex]);

  useEffect(() => {
    const container = containerRef.current;
    const indicator = indicatorRef.current;
    if (!container || !indicator) return;

    let raf: number;
    const s = stateRef.current;

    // Spring constants
    const k = 180;
    const d = 22;
    const dt = 1 / 60;

    // Mouse, touch and keyboard focus all move the attention point.
    // When it is released, keep the last colour rather than jump off-screen.
    const unsubscribe = subscribeAttention(({ x, y, kind }) => {
      if (kind === "none") return;
      s.mouseX = x;
      s.mouseY = y;
    });

    // Initial measurement
    measureTarget();

    const tick = () => {
      // Re-measure target each frame (handles resizes)
      const tab = tabRefs.current[activeIndex];
      if (tab && container) {
        const cr = container.getBoundingClientRect();
        const tr = tab.getBoundingClientRect();
        s.targetX = tr.left - cr.left - container.clientLeft;
        s.targetW = tr.width;
      }

      // Reduced motion: the indicator jumps straight to the active tab.
      if (reducedMotionNow()) {
        s.x = s.targetX; s.xVel = 0;
        s.w = s.targetW; s.wVel = 0;
      }

      // Spring physics for x
      const forceX = -k * (s.x - s.targetX) - d * s.xVel;
      s.xVel += forceX * dt;
      s.x += s.xVel * dt;

      // Spring physics for width
      const forceW = -k * (s.w - s.targetW) - d * s.wVel;
      s.wVel += forceW * dt;
      s.w += s.wVel * dt;

      // Cursor-mapped colour
      const t = motionTime();
      const xPc = (s.mouseX / window.innerWidth) * 100;
      const yPc = (s.mouseY / window.innerHeight) * 100;
      const target = pastelColour(xPc, yPc, t);

      // Lerp colour for smoothness
      s.glowR += (target.r - s.glowR) * 0.08;
      s.glowG += (target.g - s.glowG) * 0.08;
      s.glowB += (target.b - s.glowB) * 0.08;

      const r = Math.round(s.glowR);
      const g = Math.round(s.glowG);
      const b = Math.round(s.glowB);

      // Apply to indicator
      indicator.style.transform = `translateX(${s.x}px)`;
      indicator.style.width = `${s.w}px`;
      indicator.style.background = `rgb(${r} ${g} ${b} / 0.15)`;
      indicator.style.borderColor = `rgb(${r} ${g} ${b} / 0.4)`;
      indicator.style.boxShadow = `0 0 12px rgb(${r} ${g} ${b} / 0.12), inset 0 0 8px rgb(${r} ${g} ${b} / 0.06)`;

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    return () => {
      unsubscribe();
      cancelAnimationFrame(raf);
    };
  }, [activeIndex, measureTarget]);

  return (
    <div
      ref={containerRef}
      role="tablist"
      aria-label={ariaLabel}
      className={`relative inline-flex items-center gap-0 rounded-xl bg-white/[0.04] border border-white/[0.08] p-1 ${className}`}
    >
      {/* Spring indicator */}
      <div
        ref={indicatorRef}
        aria-hidden="true"
        className="absolute left-0 top-1 h-[calc(100%-8px)] rounded-lg border pointer-events-none"
        style={{
          willChange: "transform, width",
          backfaceVisibility: "hidden",
        }}
      />

      {/* Tab buttons */}
      {tabs.map((label, i) => (
        <button
          key={label}
          ref={(el) => { tabRefs.current[i] = el; }}
          onClick={() => onChange(i)}
          // Tab pattern: one tab stop for the whole list, arrows move between tabs.
          role="tab"
          id={idPrefix ? `${idPrefix}-tab-${i}` : undefined}
          aria-controls={idPrefix ? `${idPrefix}-panel-${i}` : undefined}
          aria-selected={i === activeIndex}
          tabIndex={i === activeIndex ? 0 : -1}
          onKeyDown={(e) => {
            const last = tabs.length - 1;
            const next =
              e.key === "ArrowRight" ? (i === last ? 0 : i + 1)
              : e.key === "ArrowLeft" ? (i === 0 ? last : i - 1)
              : e.key === "Home" ? 0
              : e.key === "End" ? last
              : null;
            if (next === null) return;
            e.preventDefault();
            onChange(next);
            tabRefs.current[next]?.focus();
          }}
          className={`relative z-10 px-5 py-2.5 text-sm font-medium tracking-tight rounded-lg cursor-pointer select-none transition-colors duration-150 ${
            i === activeIndex
              ? "text-white/90"
              : "text-white/50 hover:text-white/70"
          }`}
          style={{ background: "transparent", border: "none" }}
        >
          {label}
        </button>
      ))}
    </div>
  );
};
