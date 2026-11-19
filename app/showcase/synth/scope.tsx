"use client";
import { useEffect, useRef } from "react";
import { useReducedMotion } from "../../lib/hooks/reduced-motion";
import type { SynthEngine, Wave } from "./engine";
import { rgb, type RGB } from "./music";

type ScopeProps = {
  engine: SynthEngine;
  wave: Wave;
  /** The filter colour: the scope is drawn in the sound's brightness. */
  tint: RGB;
  /** Plain-language summary for the reduced-motion readout and screen readers. */
  summary: string;
};

/** One cycle of the ideal waveform, -1 to 1, for the ghost trace. */
const ideal = (wave: Wave, phase: number) => {
  const p = phase - Math.floor(phase);
  switch (wave) {
    case "sine":
      return Math.sin(p * Math.PI * 2);
    case "triangle":
      return p < 0.25 ? p * 4 : p < 0.75 ? 2 - p * 4 : p * 4 - 4;
    case "sawtooth":
      return p < 0.5 ? p * 2 : p * 2 - 2;
    case "square":
      return p < 0.5 ? 1 : -1;
  }
};

/**
 * An oscilloscope on the master output, triggered on a rising zero crossing
 * so a held note stands still instead of crawling. Behind it, a faint ghost
 * of the selected waveform shows what the oscillator is shaped like before
 * the filter softens it.
 *
 * Reduced motion: no moving trace. The ghost is drawn once and a text
 * readout describes the sound instead.
 */
export const Scope = ({ engine, wave, tint, summary }: ScopeProps) => {
  const reduced = useReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const live = useRef({ wave, tint });
  const redraw = useRef<(() => void) | null>(null);

  useEffect(() => {
    live.current = { wave, tint };
  }, [wave, tint]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let w = 0;
    let h = 0;
    let buf = new Float32Array(engine.bufferSize);

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = () => {
      const { wave: wv, tint: col } = live.current;
      ctx.clearRect(0, 0, w, h);
      const mid = h / 2;
      const amp = h * 0.36;

      // Centre line
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, mid + 0.5);
      ctx.lineTo(w, mid + 0.5);
      ctx.stroke();

      // Ghost of the oscillator shape: three cycles across the width
      ctx.strokeStyle = rgb(col, 0.16);
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      for (let i = 0; i <= w; i += 2) {
        const yv = mid - ideal(wv, (i / w) * 3) * amp * 0.8;
        if (i === 0) ctx.moveTo(i, yv);
        else ctx.lineTo(i, yv);
      }
      ctx.stroke();

      if (reduced) return;

      if (buf.length !== engine.bufferSize) buf = new Float32Array(engine.bufferSize);
      if (!engine.readWaveform(buf)) return;

      // Find a rising zero crossing in the first half to hold the trace still.
      let start = 0;
      for (let i = 1; i < buf.length / 2; i++) {
        if (buf[i - 1] < 0 && buf[i] >= 0) {
          start = i;
          break;
        }
      }
      const span = Math.min(buf.length - start, 900);
      let peak = 0;
      for (let i = start; i < start + span; i++) peak = Math.max(peak, Math.abs(buf[i]));
      // Gentle auto-gain so quiet patches still read, without clipping loud ones.
      const gain = peak > 0.0005 ? Math.min(6, 0.9 / peak) : 1;

      ctx.strokeStyle = rgb(col, 0.95);
      ctx.lineWidth = 1.75;
      ctx.shadowColor = rgb(col, 0.6);
      ctx.shadowBlur = 10;
      ctx.beginPath();
      for (let i = 0; i < span; i++) {
        const x = (i / (span - 1)) * w;
        const yv = mid - buf[start + i] * gain * amp;
        if (i === 0) ctx.moveTo(x, yv);
        else ctx.lineTo(x, yv);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    };

    redraw.current = draw;
    resize();
    const ro = new ResizeObserver(() => {
      resize();
      if (reduced) draw();
    });
    ro.observe(canvas);

    if (reduced) {
      draw();
    } else {
      const loop = () => {
        draw();
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }

    return () => {
      redraw.current = null;
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [engine, reduced]);

  // Under reduced motion nothing loops, so repaint the still ghost when the shape or colour changes.
  useEffect(() => {
    if (reduced) redraw.current?.();
  }, [reduced, wave, tint]);

  return (
    <div className="relative h-full min-h-[140px] w-full">
      <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 h-full w-full" />
      <p className={reduced ? "absolute inset-x-4 bottom-3 font-mono text-xs tabular-nums text-white/70" : "sr-only"}>{summary}</p>
    </div>
  );
};
