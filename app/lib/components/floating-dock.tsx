"use client";
import { useRef, useEffect, type ReactNode } from "react";
import { pastelColour } from "../primitives/gradient";

type DockItem = {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
};

type FloatingDockProps = {
  items: DockItem[];
  /** Gap between icons in pixels. Default: 8 */
  gap?: number;
  /** Base icon size in pixels. Default: 48 */
  iconSize?: number;
  /** Maximum scale factor on proximity. Default: 1.8 */
  maxScale?: number;
};

type IconState = {
  scale: number;
  scaleVel: number;
  liftY: number;
  liftVel: number;
  glow: number;
};

/**
 * A macOS-style dock where icons scale up on proximity and glow
 * with cursor-position-mapped pastel colour.
 *
 * @example
 * <FloatingDock items={[
 *   { icon: <HomeIcon />, label: "Home", onClick: () => {} },
 *   { icon: <SearchIcon />, label: "Search" },
 * ]} />
 */
export const FloatingDock = ({
  items,
  gap = 8,
  iconSize = 48,
  maxScale = 1.8,
}: FloatingDockProps) => {
  const dockRef = useRef<HTMLDivElement>(null);
  const iconsRef = useRef<(HTMLDivElement | null)[]>([]);
  const statesRef = useRef<IconState[]>([]);
  const mouseRef = useRef({ x: Infinity, y: Infinity });

  useEffect(() => {
    statesRef.current = items.map((_, index) => ({
      scale: statesRef.current[index]?.scale ?? 1,
      scaleVel: statesRef.current[index]?.scaleVel ?? 0,
      liftY: statesRef.current[index]?.liftY ?? 0,
      liftVel: statesRef.current[index]?.liftVel ?? 0,
      glow: statesRef.current[index]?.glow ?? 0,
    }));
  }, [items]);

  useEffect(() => {
    const dock = dockRef.current;
    if (!dock) return;

    const RADIUS = iconSize * 2.2;
    const STIFFNESS = 0.1;
    const DAMPING = 0.75;
    const MAX_LIFT = -18;

    const onMove = (e: PointerEvent) => {
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
    };

    const onLeave = () => {
      mouseRef.current.x = Infinity;
      mouseRef.current.y = Infinity;
    };

    dock.addEventListener("pointermove", onMove);
    dock.addEventListener("pointerleave", onLeave);

    let raf: number;

    const tick = () => {
      const t = performance.now() / 1000;
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      for (let i = 0; i < items.length; i++) {
        const el = iconsRef.current[i];
        if (!el) continue;

        const s = statesRef.current[i];
        if (!s) continue;
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const distX = Math.abs(mx - cx);
        const distY = Math.abs(my - cy);
        const dist = distY > iconSize * 2 ? Infinity : distX;

        // Target values based on proximity
        let targetScale = 1;
        let targetLift = 0;
        let targetGlow = 0;

        if (dist < RADIUS) {
          const proximity = 1 - dist / RADIUS;
          // Smooth cosine falloff for more natural scaling
          const cosProximity = (1 + Math.cos(Math.PI * (1 - proximity))) / 2;
          targetScale = 1 + (maxScale - 1) * cosProximity;
          targetLift = MAX_LIFT * cosProximity;
          targetGlow = cosProximity;
        }

        // Spring physics
        s.scaleVel += (targetScale - s.scale) * STIFFNESS;
        s.scaleVel *= DAMPING;
        s.scale += s.scaleVel;

        s.liftVel += (targetLift - s.liftY) * STIFFNESS;
        s.liftVel *= DAMPING;
        s.liftY += s.liftVel;

        s.glow += (targetGlow - s.glow) * 0.12;

        // Position-mapped pastel colour
        const xPc = (cx / window.innerWidth) * 100;
        const yPc = ((rect.top + rect.height / 2) / window.innerHeight) * 100;
        const { r, g, b } = pastelColour(xPc, yPc, t);

        // Adjust wrapper width so neighbours move apart
        const wrapper = el.parentElement;
        if (wrapper) {
          wrapper.style.width = `${iconSize * s.scale}px`;
        }

        // Apply transforms
        el.style.transform = `translateY(${s.liftY}px) scale(${s.scale})`;
        el.style.boxShadow =
          s.glow > 0.01
            ? `0 0 ${24 * s.glow}px rgb(${r} ${g} ${b} / ${s.glow * 0.5}), 0 0 ${60 * s.glow}px rgb(${r} ${g} ${b} / ${s.glow * 0.2})`
            : "none";
        el.style.borderColor =
          s.glow > 0.01
            ? `rgb(${r} ${g} ${b} / ${s.glow * 0.6})`
            : "rgba(255,255,255,0.08)";
        el.style.backgroundColor =
          s.glow > 0.01
            ? `rgb(${r} ${g} ${b} / ${s.glow * 0.12})`
            : "rgba(255,255,255,0.04)";
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    return () => {
      dock.removeEventListener("pointermove", onMove);
      dock.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(raf);
    };
  }, [items.length, iconSize, maxScale]);

  const handleClick = (index: number) => {
    const s = statesRef.current[index];
    if (s) {
      s.scaleVel = -0.15;
    }
    items[index]?.onClick?.();
  };

  return (
    <div
      ref={dockRef}
      className="inline-flex items-end rounded-2xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-sm"
      style={{
        padding: `8px 12px 10px`,
        gap: `${gap}px`,
      }}
    >
      {items.map((item, i) => (
        <div
          key={item.label}
          className="flex flex-col items-center"
          style={{ gap: 4, width: iconSize }}
        >
          <div
            ref={(el) => {
              iconsRef.current[i] = el;
            }}
            onClick={() => handleClick(i)}
            className="rounded-xl border border-white/[0.08] bg-white/[0.04] flex items-center justify-center cursor-pointer select-none"
            style={{
              width: iconSize,
              height: iconSize,
              willChange: "transform",
              backfaceVisibility: "hidden",
              transformOrigin: "center bottom",
            }}
            title={item.label}
          >
            {item.icon}
          </div>
        </div>
      ))}
    </div>
  );
};
