"use client";
import { useRef, useEffect, type ReactNode, type ButtonHTMLAttributes } from "react";
import { pastelColour } from "../primitives/gradient";

type MagneticButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  /** Magnetic pull radius in pixels. Default: 200 */
  radius?: number;
  /** Magnetic pull strength. Default: 35 */
  strength?: number;
  /** Spring stiffness (0-1). Default: 0.08 */
  spring?: number;
  /** Damping factor (0-1). Default: 0.75 */
  damping?: number;
  /** Glow colour intensity (0-1). Default: 0.6 */
  glowIntensity?: number;
};

/**
 * A button that stretches toward your cursor with spring physics.
 * Glows with position-mapped pastel colour on proximity.
 * Click triggers a satisfying bounce.
 *
 * @example
 * <MagneticButton onClick={handleSave}>Save changes</MagneticButton>
 * <MagneticButton radius={150} strength={50}>Strong pull</MagneticButton>
 */
export const MagneticButton = ({
  children,
  radius = 200,
  strength = 35,
  spring = 0.08,
  damping = 0.75,
  glowIntensity = 0.6,
  className = "",
  onClick,
  ...rest
}: MagneticButtonProps) => {
  const ref = useRef<HTMLButtonElement>(null);
  const stateRef = useRef({
    offsetX: 0, offsetY: 0,
    velX: 0, velY: 0,
    scale: 1, scaleVel: 0,
    glow: 0,
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let raf: number;
    let mouseX = 0;
    let mouseY = 0;

    const onMove = (e: PointerEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };

    window.addEventListener("pointermove", onMove, { passive: true });

    const tick = () => {
      const s = stateRef.current;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;

      const dx = mouseX - cx;
      const dy = mouseY - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      let targetX = 0;
      let targetY = 0;
      let targetScale = 1;
      let targetGlow = 0;

      if (dist < radius) {
        const pull = (1 - dist / radius) * strength;
        const angle = Math.atan2(dy, dx);
        targetX = Math.cos(angle) * pull;
        targetY = Math.sin(angle) * pull;
        targetScale = 1 + (1 - dist / radius) * 0.15;
        targetGlow = 1 - dist / radius;
      }

      s.velX += (targetX - s.offsetX) * spring;
      s.velY += (targetY - s.offsetY) * spring;
      s.scaleVel += (targetScale - s.scale) * spring;

      s.velX *= damping;
      s.velY *= damping;
      s.scaleVel *= damping;

      s.offsetX += s.velX;
      s.offsetY += s.velY;
      s.scale += s.scaleVel;
      s.glow += (targetGlow - s.glow) * 0.12;

      const t = performance.now() / 1000;
      const localXPc = ((cx + s.offsetX) / window.innerWidth) * 100;
      const localYPc = ((cy + s.offsetY) / window.innerHeight) * 100;
      const { r, g, b } = pastelColour(localXPc, localYPc, t);

      el.style.transform = `translate(${s.offsetX}px, ${s.offsetY}px) scale(${s.scale})`;
      el.style.boxShadow = s.glow > 0.01
        ? `0 0 ${20 * s.glow}px rgb(${r} ${g} ${b} / ${s.glow * glowIntensity}), inset 0 0 ${10 * s.glow}px rgb(${r} ${g} ${b} / ${s.glow * 0.15})`
        : "none";
      el.style.borderColor = s.glow > 0.01
        ? `rgb(${r} ${g} ${b} / ${s.glow * 0.5})`
        : "";

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, [radius, strength, spring, damping, glowIntensity]);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const s = stateRef.current;
    s.scaleVel = -0.15;
    onClick?.(e);
  };

  return (
    <button
      ref={ref}
      onClick={handleClick}
      className={`relative rounded-2xl bg-white/[0.06] border border-white/[0.12] text-white/80 font-medium tracking-tight cursor-pointer transition-colors hover:text-white select-none px-8 py-4 ${className}`}
      style={{ willChange: "transform", backfaceVisibility: "hidden" }}
      {...rest}
    >
      {children}
    </button>
  );
};
