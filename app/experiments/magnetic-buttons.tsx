"use client";
import { useRef, useEffect, useState } from "react";
import { usePointer } from "../lib/hooks/use-pointer";
import { cursorColour, pastelColour } from "../lib/primitives/gradient";

/**
 * Magnetic Buttons — Experiment 002
 *
 * A grid of buttons that stretch and warp toward your cursor with spring physics.
 * Each button's surface glows with the colour gradient on proximity.
 * Click triggers a ripple that pushes neighbouring buttons outward.
 */

type ButtonState = {
  x: number;
  y: number;
  offsetX: number;
  offsetY: number;
  velX: number;
  velY: number;
  scale: number;
  scaleVel: number;
  glow: number;
};

const COLS = 5;
const ROWS = 4;
const SPRING = 0.08;
const DAMPING = 0.75;
const MAGNETIC_RADIUS = 200;
const MAGNETIC_STRENGTH = 35;
const LABELS = [
  "Submit", "Cancel", "Save", "Delete", "Edit",
  "Share", "Copy", "Paste", "Undo", "Redo",
  "Export", "Import", "Search", "Filter", "Sort",
  "Reset", "Apply", "Close", "Open", "Send",
];

export default function MagneticButtons() {
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonsRef = useRef<ButtonState[]>([]);
  const rectsRef = useRef<DOMRect[]>([]);
  const pointer = usePointer({ lerp: 0.15 });
  const pointerRef = useRef(pointer);
  pointerRef.current = pointer;
  const [, forceRender] = useState(0);

  useEffect(() => {
    // Initialise button states
    buttonsRef.current = Array.from({ length: COLS * ROWS }, () => ({
      x: 0, y: 0,
      offsetX: 0, offsetY: 0,
      velX: 0, velY: 0,
      scale: 1, scaleVel: 0,
      glow: 0,
    }));

    let raf: number;

    const tick = () => {
      const container = containerRef.current;
      if (!container) { raf = requestAnimationFrame(tick); return; }

      const buttons = container.querySelectorAll<HTMLElement>("[data-magnetic]");
      const { clientX, clientY } = pointerRef.current;

      buttons.forEach((el, i) => {
        const state = buttonsRef.current[i];
        if (!state) return;

        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;

        const dx = clientX - cx;
        const dy = clientY - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Magnetic pull
        let targetX = 0;
        let targetY = 0;
        let targetScale = 1;
        let targetGlow = 0;

        if (dist < MAGNETIC_RADIUS) {
          const strength = (1 - dist / MAGNETIC_RADIUS) * MAGNETIC_STRENGTH;
          const angle = Math.atan2(dy, dx);
          targetX = Math.cos(angle) * strength;
          targetY = Math.sin(angle) * strength;
          targetScale = 1 + (1 - dist / MAGNETIC_RADIUS) * 0.15;
          targetGlow = 1 - dist / MAGNETIC_RADIUS;
        }

        // Spring physics
        state.velX += (targetX - state.offsetX) * SPRING;
        state.velY += (targetY - state.offsetY) * SPRING;
        state.scaleVel += (targetScale - state.scale) * SPRING;

        state.velX *= DAMPING;
        state.velY *= DAMPING;
        state.scaleVel *= DAMPING;

        state.offsetX += state.velX;
        state.offsetY += state.velY;
        state.scale += state.scaleVel;
        state.glow += (targetGlow - state.glow) * 0.12;

        // Apply transform
        const { xPc, yPc, time } = pointerRef.current;
        const localXPc = ((cx + state.offsetX) / window.innerWidth) * 100;
        const localYPc = ((cy + state.offsetY) / window.innerHeight) * 100;
        const { r, g, b } = pastelColour(localXPc, localYPc, time);

        el.style.transform = `translate(${state.offsetX}px, ${state.offsetY}px) scale(${state.scale})`;
        el.style.boxShadow = state.glow > 0.01
          ? `0 0 ${20 * state.glow}px rgb(${r} ${g} ${b} / ${state.glow * 0.6}), inset 0 0 ${10 * state.glow}px rgb(${r} ${g} ${b} / ${state.glow * 0.15})`
          : "none";
        el.style.borderColor = state.glow > 0.01
          ? `rgb(${r} ${g} ${b} / ${state.glow * 0.5})`
          : "rgba(255,255,255,0.08)";
      });

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const handleClick = (index: number) => {
    // Ripple: push neighbours outward
    const col = index % COLS;
    const row = Math.floor(index / COLS);

    buttonsRef.current.forEach((state, i) => {
      const c = i % COLS;
      const r = Math.floor(i / COLS);
      const dx = c - col;
      const dy = r - row;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 0 && dist < 3) {
        const force = (1 - dist / 3) * 8;
        const angle = Math.atan2(dy, dx);
        state.velX += Math.cos(angle) * force;
        state.velY += Math.sin(angle) * force;
        state.scaleVel += 0.05 * (1 - dist / 3);
      }
    });

    // Clicked button bounces
    const state = buttonsRef.current[index];
    if (state) {
      state.scaleVel = -0.15;
    }
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 flex items-center justify-center"
      style={{ top: "41px" }}
    >
      <div
        className="grid gap-4 sm:gap-6 p-8"
        style={{
          gridTemplateColumns: `repeat(${COLS}, 1fr)`,
          maxWidth: "700px",
          width: "100%",
        }}
      >
        {LABELS.slice(0, COLS * ROWS).map((label, i) => (
          <button
            key={i}
            data-magnetic
            onClick={() => handleClick(i)}
            className="relative px-4 py-3 sm:px-6 sm:py-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/60 text-sm font-light tracking-wide cursor-pointer transition-colors hover:text-white/90 select-none"
            style={{ willChange: "transform", backfaceVisibility: "hidden" }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
