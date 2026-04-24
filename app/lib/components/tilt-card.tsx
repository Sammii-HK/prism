"use client";
import { useRef, useEffect, type ReactNode } from "react";
import { pastelColour } from "../primitives/gradient";

type TiltCardProps = {
  children: ReactNode;
  /** Additional class names */
  className?: string;
  /** Maximum tilt in degrees. Default: 3 */
  tiltMax?: number;
  /** CSS perspective value in pixels. Default: 800 */
  perspective?: number;
  /** Border/shadow glow intensity (0-1). Default: 0.4 */
  glowIntensity?: number;
};

/**
 * A card that tilts toward the cursor with spring physics.
 * Perspective transform with rotateX/rotateY mapped to pointer
 * position within the card. Pastel border glow shifts with cursor.
 * Subtle inner highlight follows the pointer like a light source.
 *
 * @example
 * <TiltCard>
 *   <h2>Title</h2>
 *   <p>Content tilts toward you</p>
 * </TiltCard>
 * <TiltCard tiltMax={2} glowIntensity={0.6}>Subtle variant</TiltCard>
 */
export const TiltCard = ({
  children,
  className = "",
  tiltMax = 3,
  perspective = 800,
  glowIntensity = 0.4,
}: TiltCardProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const stateRef = useRef({
    // Current tilt angles
    rotX: 0,
    rotY: 0,
    // Spring velocities
    velX: 0,
    velY: 0,
    // Target tilt (set by pointer)
    targetX: 0,
    targetY: 0,
    // Cursor position within card (0-1)
    cursorLocalX: 0.5,
    cursorLocalY: 0.5,
    // Smoothed cursor for glow
    smoothLocalX: 0.5,
    smoothLocalY: 0.5,
    // Hover intensity
    glow: 0,
    hovered: false,
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const K = 120;
    const D = 18;

    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const s = stateRef.current;

      const inside =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;

      s.hovered = inside;

      if (inside) {
        // Normalised position within card (-1 to 1)
        const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;

        // rotateY follows X axis, rotateX follows inverted Y axis
        s.targetY = nx * tiltMax;
        s.targetX = -ny * tiltMax;

        // Local cursor position (0-1) for highlight
        s.cursorLocalX = (e.clientX - rect.left) / rect.width;
        s.cursorLocalY = (e.clientY - rect.top) / rect.height;
      } else {
        s.targetX = 0;
        s.targetY = 0;
      }
    };

    window.addEventListener("pointermove", onMove, { passive: true });

    let raf: number;
    const tick = () => {
      const s = stateRef.current;
      const dt = 1 / 60; // fixed timestep for spring stability

      // Spring physics: F = -k*x - d*v
      const forceX = -K * (s.rotX - s.targetX) - D * s.velX;
      const forceY = -K * (s.rotY - s.targetY) - D * s.velY;

      s.velX += forceX * dt;
      s.velY += forceY * dt;
      s.rotX += s.velX * dt;
      s.rotY += s.velY * dt;

      // Lerp cursor position for smooth glow movement
      s.smoothLocalX += (s.cursorLocalX - s.smoothLocalX) * 0.08;
      s.smoothLocalY += (s.cursorLocalY - s.smoothLocalY) * 0.08;

      // Glow eases in/out
      const targetGlow = s.hovered ? 1 : 0;
      s.glow += (targetGlow - s.glow) * 0.1;

      // Pastel colour from cursor position on screen
      const t = performance.now() / 1000;
      const xPc = s.smoothLocalX * 100;
      const yPc = s.smoothLocalY * 100;
      const { r, g, b } = pastelColour(xPc, yPc, t);

      // Apply transform
      el.style.transform = `perspective(${perspective}px) rotateX(${s.rotX.toFixed(3)}deg) rotateY(${s.rotY.toFixed(3)}deg)`;

      // Border glow
      const borderAlpha = 0.08 + s.glow * 0.35;
      el.style.borderColor = `rgb(${r} ${g} ${b} / ${borderAlpha.toFixed(3)})`;

      // Outer shadow glow
      el.style.boxShadow =
        s.glow > 0.01
          ? `0 0 ${24 * s.glow}px rgb(${r} ${g} ${b} / ${(s.glow * glowIntensity * 0.35).toFixed(3)}), 0 0 ${60 * s.glow}px rgb(${r} ${g} ${b} / ${(s.glow * glowIntensity * 0.1).toFixed(3)})`
          : "none";

      // Inner highlight that follows cursor (like a light source)
      const hlX = (s.smoothLocalX * 100).toFixed(1);
      const hlY = (s.smoothLocalY * 100).toFixed(1);
      const hlAlpha = (s.glow * glowIntensity * 0.12).toFixed(3);
      el.style.backgroundImage =
        s.glow > 0.01
          ? `radial-gradient(ellipse at ${hlX}% ${hlY}%, rgb(${r} ${g} ${b} / ${hlAlpha}), transparent 65%)`
          : "none";

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, [tiltMax, perspective, glowIntensity]);

  return (
    <div
      ref={ref}
      className={`relative rounded-2xl bg-[#050505] border border-white/[0.08] ${className}`}
      style={{
        willChange: "transform",
        transformStyle: "preserve-3d",
        backfaceVisibility: "hidden",
      }}
    >
      {children}
    </div>
  );
};
