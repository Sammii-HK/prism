"use client";
import { useRef, useEffect } from "react";
import { usePointer } from "../lib/hooks/use-pointer";
import { cursorColour } from "../lib/primitives/gradient";

/**
 * Gravity Wells — Experiment 005
 *
 * Click to place gravity attractors. Particles spawn from the edges
 * and get pulled into orbits. Trails are coloured by velocity.
 * Double-click a well to remove it. Scroll to adjust particle spawn rate.
 */

type Well = {
  x: number;
  y: number;
  mass: number;
  hue: number;
};

type Particle = {
  x: number;
  y: number;
  velX: number;
  velY: number;
  life: number;
  maxLife: number;
};

const MAX_PARTICLES = 800;
const GRAVITY_CONSTANT = 400;
const SPAWN_RATE = 3; // per frame

export default function GravityWells() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wellsRef = useRef<Well[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const pointer = usePointer({ lerp: 0.2 });
  const pointerRef = useRef(pointer);
  pointerRef.current = pointer;

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
      h = window.innerHeight - 41;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener("resize", resize);

    const spawnParticle = (): Particle => {
      // Spawn from random edge
      const edge = Math.floor(Math.random() * 4);
      let x: number, y: number;
      switch (edge) {
        case 0: x = Math.random() * w; y = -5; break;
        case 1: x = w + 5; y = Math.random() * h; break;
        case 2: x = Math.random() * w; y = h + 5; break;
        default: x = -5; y = Math.random() * h; break;
      }

      // Gentle initial velocity toward center
      const angle = Math.atan2(h / 2 - y, w / 2 - x) + (Math.random() - 0.5) * 1.5;
      const speed = 0.5 + Math.random() * 1.5;

      return {
        x, y,
        velX: Math.cos(angle) * speed,
        velY: Math.sin(angle) * speed,
        life: 1,
        maxLife: 200 + Math.floor(Math.random() * 300),
      };
    };

    const draw = () => {
      // Fade trail
      ctx.fillStyle = "rgba(5, 5, 5, 0.12)";
      ctx.fillRect(0, 0, w, h);

      const wells = wellsRef.current;
      const particles = particlesRef.current;

      // Spawn new particles
      if (wells.length > 0 && particles.length < MAX_PARTICLES) {
        for (let i = 0; i < SPAWN_RATE; i++) {
          particles.push(spawnParticle());
        }
      }

      // Update + draw particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];

        // Apply gravity from all wells
        for (const well of wells) {
          const dx = well.x - p.x;
          const dy = well.y - p.y;
          const distSq = dx * dx + dy * dy;
          const dist = Math.sqrt(distSq);

          if (dist > 5) {
            const force = (GRAVITY_CONSTANT * well.mass) / distSq;
            p.velX += (dx / dist) * force;
            p.velY += (dy / dist) * force;
          }
        }

        p.x += p.velX;
        p.y += p.velY;
        p.life -= 1 / p.maxLife;

        // Remove if dead or way offscreen
        if (p.life <= 0 || p.x < -100 || p.x > w + 100 || p.y < -100 || p.y > h + 100) {
          particles.splice(i, 1);
          continue;
        }

        // Colour by velocity
        const speed = Math.sqrt(p.velX * p.velX + p.velY * p.velY);
        const speedPc = Math.min(100, speed * 15);
        const { r, g, b } = cursorColour(speedPc, (p.y / h) * 100);
        const alpha = p.life * 0.7;

        ctx.beginPath();
        ctx.arc(p.x, p.y, 1 + speed * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        ctx.fill();
      }

      // Draw wells
      const { time } = pointerRef.current;
      for (const well of wells) {
        const pulse = 1 + Math.sin(time * 3) * 0.15;
        const radius = 6 * pulse * well.mass;
        const xPc = (well.x / w) * 100;
        const yPc = (well.y / h) * 100;
        const { r, g, b } = cursorColour(xPc, yPc);

        // Glow
        const gradient = ctx.createRadialGradient(well.x, well.y, 0, well.x, well.y, radius * 4);
        gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.3)`);
        gradient.addColorStop(1, "transparent");
        ctx.fillStyle = gradient;
        ctx.fillRect(well.x - radius * 4, well.y - radius * 4, radius * 8, radius * 8);

        // Core
        ctx.beginPath();
        ctx.arc(well.x, well.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.9)`;
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

  const handleClick = (e: React.MouseEvent) => {
    const x = e.clientX;
    const y = e.clientY - 41;

    // Check if clicking near existing well (remove it)
    const wells = wellsRef.current;
    for (let i = wells.length - 1; i >= 0; i--) {
      const dx = wells[i].x - x;
      const dy = wells[i].y - y;
      if (Math.sqrt(dx * dx + dy * dy) < 25) {
        wells.splice(i, 1);
        return;
      }
    }

    // Add new well
    wells.push({
      x,
      y,
      mass: 0.8 + Math.random() * 0.4,
      hue: Math.random() * 360,
    });
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
