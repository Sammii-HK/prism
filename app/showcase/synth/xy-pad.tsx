"use client";
import { ArrowRight, ArrowUp } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { reducedMotionNow } from "../../lib/hooks/reduced-motion";
import type { SynthEngine } from "./engine";
import { filterColour, rgb } from "./music";

type XYPadProps = {
  engine: SynthEngine;
  /** Cutoff, normalised 0 to 1 (left to right). */
  x: number;
  /** Resonance, normalised 0 to 1 (bottom to top). */
  y: number;
  onChange: (x: number, y: number) => void;
  cutoffText: string;
  resonanceText: string;
};

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/**
 * A two-dimensional filter control. The glow is the pastel colour of the
 * point under your finger, and it brightens with the output level, so the
 * sound and the light move together.
 *
 * Pointer: press anywhere to jump there, drag to sweep (pointer capture keeps
 * the drag even outside the pad). Keyboard: left and right for cutoff, up and
 * down for resonance, Shift for bigger steps, Home/End for the cutoff extremes.
 */
export const XYPad = ({ engine, x, y, onChange, cutoffText, resonanceText }: XYPadProps) => {
  const titleId = useId();
  const hintId = useId();
  const padRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const puckRef = useRef<HTMLDivElement>(null);
  const hRef = useRef<HTMLDivElement>(null);
  const vRef = useRef<HTMLDivElement>(null);
  const target = useRef({ x, y });
  const dragging = useRef<number | null>(null);

  useEffect(() => {
    target.current = { x, y };
  }, [x, y]);

  // One loop: spring the puck, paint the glow from the point and the level.
  useEffect(() => {
    const s = { x: target.current.x, y: target.current.y, vx: 0, vy: 0, level: 0 };
    let raf = 0;
    const tick = () => {
      const t = target.current;
      const reduced = reducedMotionNow();
      if (reduced) {
        s.x = t.x;
        s.y = t.y;
        s.vx = 0;
        s.vy = 0;
      } else {
        // Stiffer while dragging so the puck stays under the finger.
        const k = dragging.current !== null ? 0.4 : 0.12;
        const d = dragging.current !== null ? 0.5 : 0.72;
        s.vx = (s.vx + (t.x - s.x) * k) * d;
        s.vy = (s.vy + (t.y - s.y) * k) * d;
        s.x += s.vx;
        s.y += s.vy;
      }

      // Under reduced motion the glow holds steady instead of pulsing with sound.
      const level = reduced ? 0 : Math.min(1, engine.level() * 5);
      s.level += (level - s.level) * 0.25;

      const col = filterColour(clamp01(s.x), clamp01(s.y));
      const px = `${(s.x * 100).toFixed(2)}%`;
      const py = `${((1 - s.y) * 100).toFixed(2)}%`;
      const strength = 0.16 + s.y * 0.14 + s.level * 0.35;

      if (glowRef.current) {
        glowRef.current.style.background = `radial-gradient(circle at ${px} ${py}, ${rgb(col, strength)} 0%, ${rgb(col, strength * 0.35)} 22%, transparent 58%)`;
      }
      if (puckRef.current) {
        puckRef.current.style.left = px;
        puckRef.current.style.top = py;
        puckRef.current.style.borderColor = rgb(col, 0.95);
        puckRef.current.style.boxShadow = `0 0 ${14 + s.level * 30}px ${rgb(col, 0.55 + s.level * 0.3)}, inset 0 0 8px ${rgb(col, 0.35)}`;
      }
      if (hRef.current) {
        hRef.current.style.top = py;
        hRef.current.style.background = `linear-gradient(90deg, transparent, ${rgb(col, 0.28)}, transparent)`;
      }
      if (vRef.current) {
        vRef.current.style.left = px;
        vRef.current.style.background = `linear-gradient(180deg, transparent, ${rgb(col, 0.28)}, transparent)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [engine]);

  const fromPointer = (e: React.PointerEvent) => {
    const pad = padRef.current;
    if (!pad) return;
    const rect = pad.getBoundingClientRect();
    onChange(clamp01((e.clientX - rect.left) / rect.width), clamp01(1 - (e.clientY - rect.top) / rect.height));
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.focus({ preventScroll: true });
    dragging.current = e.pointerId;
    fromPointer(e);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragging.current === e.pointerId) fromPointer(e);
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragging.current === e.pointerId) dragging.current = null;
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 0.1 : 0.02;
    let nx = x;
    let ny = y;
    if (e.key === "ArrowRight") nx += step;
    else if (e.key === "ArrowLeft") nx -= step;
    else if (e.key === "ArrowUp") ny += step;
    else if (e.key === "ArrowDown") ny -= step;
    else if (e.key === "Home") nx = 0;
    else if (e.key === "End") nx = 1;
    else return;
    e.preventDefault();
    onChange(clamp01(nx), clamp01(ny));
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <p id={titleId} className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/50">
          Filter
        </p>
        <p className="font-mono text-xs tabular-nums text-white/70" aria-hidden="true">
          {cutoffText} <span className="text-white/50">·</span> Q {resonanceText}
        </p>
      </div>
      <div
        ref={padRef}
        role="slider"
        tabIndex={0}
        aria-labelledby={titleId}
        aria-describedby={hintId}
        aria-roledescription="2D pad"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(x * 100)}
        aria-valuetext={`Cutoff ${cutoffText}, resonance ${resonanceText}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        className="relative aspect-[4/3] w-full cursor-crosshair touch-none select-none overflow-hidden rounded-2xl border border-white/[0.08] bg-[#060606] outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#080808] lg:aspect-auto lg:min-h-[240px] lg:flex-1"
      >
        {/* Grid */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)",
            backgroundSize: "12.5% 16.666%",
            backgroundPosition: "-1px -1px",
          }}
        />
        <div ref={glowRef} aria-hidden="true" className="pointer-events-none absolute inset-0" />
        <div ref={hRef} aria-hidden="true" className="pointer-events-none absolute inset-x-0 h-px" />
        <div ref={vRef} aria-hidden="true" className="pointer-events-none absolute inset-y-0 w-px" />
        <div
          ref={puckRef}
          aria-hidden="true"
          className="pointer-events-none absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-[#080808]"
        />
        <span aria-hidden="true" className="pointer-events-none absolute bottom-2.5 right-3 font-mono text-[11px] uppercase tracking-[0.22em] text-white/50">
          Cutoff <ArrowRight size={14} aria-hidden="true" className="inline-block align-middle" />
        </span>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-2.5 font-mono text-[11px] uppercase tracking-[0.22em] text-white/50"
        >
          <ArrowUp size={14} aria-hidden="true" className="inline-block align-middle" /> Resonance
        </span>
      </div>
      <p id={hintId} className="sr-only">
        Left and right change cutoff, up and down change resonance. Hold Shift for bigger steps.
      </p>
    </div>
  );
};
