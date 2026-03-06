"use client";
import { useRef, useEffect, useCallback } from "react";
import { usePointer } from "../lib/hooks/use-pointer";
import { cursorColour } from "../lib/primitives/gradient";

/**
 * Text Dissolve — Experiment 004
 *
 * Large text rendered on canvas. Hover over it and it shatters into particles
 * that drift outward. Particles inherit colour from the gradient system.
 * Move away and they reassemble. Click to explode everything at once.
 */

type Particle = {
  originX: number;
  originY: number;
  x: number;
  y: number;
  velX: number;
  velY: number;
  size: number;
  r: number;
  g: number;
  b: number;
  dissolved: boolean;
};

const TEXT = "PRISM";
const SAMPLE_GAP = 3;
const DISSOLVE_RADIUS = 120;
const REASSEMBLE_SPEED = 0.06;
const FRICTION = 0.95;

export default function TextDissolve() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const pointer = usePointer({ lerp: 0.15 });
  const pointerRef = useRef(pointer);
  pointerRef.current = pointer;
  const initialisedRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf: number;
    let w = 0;
    let h = 0;

    const init = () => {
      const dpr = Math.min(window.devicePixelRatio, 2);
      w = window.innerWidth;
      h = window.innerHeight - 41;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Render text offscreen to sample pixels
      const fontSize = Math.min(w * 0.18, 200);
      ctx.fillStyle = "white";
      ctx.font = `900 ${fontSize}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(TEXT, w / 2, h / 2);

      // Sample pixels
      const imageData = ctx.getImageData(0, 0, w * dpr, h * dpr);
      const particles: Particle[] = [];

      for (let y = 0; y < h; y += SAMPLE_GAP) {
        for (let x = 0; x < w; x += SAMPLE_GAP) {
          const px = Math.floor(x * dpr);
          const py = Math.floor(y * dpr);
          const i = (py * imageData.width + px) * 4;
          if (imageData.data[i + 3] > 128) {
            const xPc = (x / w) * 100;
            const yPc = (y / h) * 100;
            const { r, g, b } = cursorColour(xPc, yPc);
            particles.push({
              originX: x,
              originY: y,
              x,
              y,
              velX: 0,
              velY: 0,
              size: 1.5 + Math.random() * 1,
              r, g, b,
              dissolved: false,
            });
          }
        }
      }

      particlesRef.current = particles;
      initialisedRef.current = true;
      ctx.clearRect(0, 0, w, h);
    };

    init();
    window.addEventListener("resize", init);

    const draw = () => {
      if (!initialisedRef.current) { raf = requestAnimationFrame(draw); return; }

      ctx.clearRect(0, 0, w, h);

      const { clientX, clientY, xPc, yPc, time } = pointerRef.current;
      const mx = clientX;
      const my = clientY - 41;

      for (const p of particlesRef.current) {
        const dx = mx - p.x;
        const dy = my - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < DISSOLVE_RADIUS) {
          // Push away from cursor
          const force = (1 - dist / DISSOLVE_RADIUS) * 6;
          const angle = Math.atan2(dy, dx);
          p.velX -= Math.cos(angle) * force;
          p.velY -= Math.sin(angle) * force;
          p.dissolved = true;

          // Update colour based on current position
          const pxPc = (p.x / w) * 100;
          const pyPc = (p.y / h) * 100;
          const col = cursorColour(pxPc, pyPc);
          p.r = col.r;
          p.g = col.g;
          p.b = col.b;
        } else {
          // Spring back to origin
          p.velX += (p.originX - p.x) * REASSEMBLE_SPEED;
          p.velY += (p.originY - p.y) * REASSEMBLE_SPEED;

          const backDist = Math.sqrt((p.x - p.originX) ** 2 + (p.y - p.originY) ** 2);
          if (backDist < 1) p.dissolved = false;
        }

        p.velX *= FRICTION;
        p.velY *= FRICTION;
        p.x += p.velX;
        p.y += p.velY;

        // Draw
        const displacement = Math.sqrt((p.x - p.originX) ** 2 + (p.y - p.originY) ** 2);
        const alpha = p.dissolved ? 0.4 + Math.min(displacement / 100, 0.6) : 0.85;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.dissolved ? p.size * 0.8 : p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.dissolved
          ? `rgba(${p.r}, ${p.g}, ${p.b}, ${alpha})`
          : `rgba(255, 255, 255, ${alpha})`;
        ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", init);
    };
  }, []);

  const handleClick = () => {
    // Explode all particles outward from their origin
    for (const p of particlesRef.current) {
      const angle = Math.random() * Math.PI * 2;
      const force = 4 + Math.random() * 8;
      p.velX += Math.cos(angle) * force;
      p.velY += Math.sin(angle) * force;
      p.dissolved = true;
    }
  };

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 cursor-crosshair"
      style={{ top: "41px", height: "calc(100vh - 41px)" }}
      onClick={handleClick}
    />
  );
}
