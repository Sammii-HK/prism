"use client";
import { useRef, useEffect, useCallback } from "react";
import { usePointer } from "../lib/hooks/use-pointer";

/**
 * Colour Field — Experiment 001
 *
 * Full-screen canvas where overlapping radial colour blobs drift on sine waves
 * and respond to cursor position. Each blob's RGB channels are driven by
 * pointer coordinates, creating an infinite palette that shifts as you move.
 *
 * Click to spawn a burst of particles that inherit the local colour.
 * Particles drift outward and fade, leaving trails.
 */

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  g: number;
  b: number;
  life: number;
  maxLife: number;
  size: number;
};

export default function ColourField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const pointer = usePointer({ lerp: 0.06 });
  const pointerRef = useRef(pointer);
  useEffect(() => {
    pointerRef.current = pointer;
  }, [pointer]);

  const spawnParticles = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left) * (canvas.width / rect.width);
    const y = (clientY - rect.top) * (canvas.height / rect.height);

    const { xPc, yPc } = pointerRef.current;
    const c = (n: number) => Math.min(255, Math.floor((255 / 100) * Math.max(0, Math.min(100, n))));

    const count = 12 + Math.floor(Math.random() * 8);
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const speed = 1 + Math.random() * 3;
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: c(xPc + (Math.random() - 0.5) * 30),
        g: c(yPc + (Math.random() - 0.5) * 30),
        b: 255 - c(xPc + (Math.random() - 0.5) * 30),
        life: 1,
        maxLife: 60 + Math.floor(Math.random() * 90),
        size: 2 + Math.random() * 4,
      });
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    let raf: number;
    let w = 0;
    let h = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener("resize", resize);

    const c = (n: number) => Math.min(255, Math.floor((255 / 100) * Math.max(0, Math.min(100, n))));

    const draw = () => {
      const { xPc, yPc, time: t } = pointerRef.current;

      // Fade previous frame — creates motion trails
      ctx.fillStyle = "rgba(5, 5, 5, 0.08)";
      ctx.fillRect(0, 0, w, h);

      // Draw colour blobs
      const blobs = [
        {
          x: w * (0.5 + Math.sin(t * 0.31) * 0.16),
          y: h * (0.0 + Math.abs(Math.sin(t * 0.23)) * 0.22),
          r: c(xPc + Math.sin(t * 0.41) * 20),
          g: c(yPc + Math.cos(t * 0.33) * 18),
          b: 255 - c(xPc),
        },
        {
          x: w * (0.08 + Math.cos(t * 0.41) * 0.12),
          y: h * (0.75 + Math.sin(t * 0.29) * 0.1),
          r: 255 - c(xPc + Math.cos(t * 0.37) * 18),
          g: c(yPc + Math.sin(t * 0.29) * 15),
          b: c(xPc),
        },
        {
          x: w * (0.92 + Math.sin(t * 0.37) * 0.12),
          y: h * (0.75 + Math.cos(t * 0.43) * 0.1),
          r: c(yPc + Math.sin(t * 0.43) * 20),
          g: c(xPc + Math.cos(t * 0.31) * 16),
          b: 255 - c(yPc),
        },
        {
          x: w * (0.5 + Math.cos(t * 0.19) * 0.32),
          y: h * (0.5 + Math.sin(t * 0.27) * 0.28),
          r: c(100 - xPc + Math.sin(t * 0.22) * 25),
          g: c(100 - yPc + Math.cos(t * 0.18) * 20),
          b: c(xPc + Math.sin(t * 0.27) * 20),
        },
        // Extra blob that follows cursor more directly
        {
          x: (pointerRef.current.clientX || w / 2),
          y: (pointerRef.current.clientY || h / 2),
          r: c(xPc),
          g: c(yPc),
          b: 255 - c(xPc),
        },
      ];

      for (const blob of blobs) {
        const radius = Math.min(w, h) * 0.4;
        const gradient = ctx.createRadialGradient(
          blob.x, blob.y, 0,
          blob.x, blob.y, radius,
        );
        gradient.addColorStop(0, `rgba(${blob.r}, ${blob.g}, ${blob.b}, 0.15)`);
        gradient.addColorStop(0.5, `rgba(${blob.r}, ${blob.g}, ${blob.b}, 0.05)`);
        gradient.addColorStop(1, "transparent");

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, w, h);
      }

      // Draw + update particles
      const particles = particlesRef.current;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.98;
        p.vy *= 0.98;
        p.life -= 1 / p.maxLife;

        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }

        const alpha = p.life * 0.6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.r}, ${p.g}, ${p.b}, ${alpha})`;
        ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full cursor-crosshair"
      style={{ height: "calc(100vh - 41px)", top: "41px" }}
      onClick={(e) => spawnParticles(e.clientX, e.clientY)}
    />
  );
}
