"use client";
import {
  useState,
  useRef,
  useEffect,
  type ReactNode,
  type ButtonHTMLAttributes,
} from "react";
import { pastelColour } from "../primitives/gradient";

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  /** Button size. Default: "md" */
  size?: "sm" | "md" | "lg";
  /** Disabled state */
  disabled?: boolean;
  /** Additional class names */
  className?: string;
}

const sizes = { sm: 28, md: 36, lg: 44 } as const;

type RippleData = { id: number; x: number; y: number; size: number; r: number; g: number; b: number };

/**
 * Compact square button with click-origin pastel ripple and cursor-mapped
 * glow on hover. Designed for icon content — pass an SVG or text as children.
 *
 * @example
 * <IconButton onClick={handleClose}><X size={16} /></IconButton>
 * <IconButton size="lg"><Heart size={20} /></IconButton>
 */
export const IconButton = ({
  children,
  size = "md",
  disabled = false,
  className = "",
  onClick,
  style: userStyle,
  ...rest
}: IconButtonProps) => {
  const ref = useRef<HTMLButtonElement>(null);
  const nextId = useRef(0);
  const [ripples, setRipples] = useState<RippleData[]>([]);
  const [isHovered, setIsHovered] = useState(false);

  // Smooth cursor position for hover glow colour
  const smoothRef = useRef({ x: 50, y: 50 });
  const rawRef = useRef({ x: 50, y: 50 });

  useEffect(() => {
    if (disabled) return;

    const onMove = (e: PointerEvent) => {
      rawRef.current.x = (e.clientX / window.innerWidth) * 100;
      rawRef.current.y = (e.clientY / window.innerHeight) * 100;
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    let raf: number;
    const tick = () => {
      smoothRef.current.x += (rawRef.current.x - smoothRef.current.x) * 0.08;
      smoothRef.current.y += (rawRef.current.y - smoothRef.current.y) * 0.08;

      if (ref.current && isHovered) {
        const t = performance.now() / 1000;
        const { r, g, b } = pastelColour(smoothRef.current.x, smoothRef.current.y, t);
        ref.current.style.boxShadow = `0 0 14px rgba(${r},${g},${b},0.25), 0 0 0 1px rgba(${r},${g},${b},0.1)`;
        ref.current.style.borderColor = `rgba(${r},${g},${b},0.3)`;
      } else if (ref.current) {
        ref.current.style.boxShadow = "none";
        ref.current.style.borderColor = "rgba(255,255,255,0.08)";
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, [disabled, isHovered]);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    const rect = ref.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const rippleSize = Math.max(rect.width, rect.height) * 2;
    const vxPc = (e.clientX / window.innerWidth) * 100;
    const vyPc = (e.clientY / window.innerHeight) * 100;
    const { r, g, b } = pastelColour(vxPc, vyPc, performance.now() / 1000);

    setRipples((prev) => [
      ...prev,
      { id: nextId.current++, x, y, size: rippleSize, r, g, b },
    ]);
    onClick?.(e);
  };

  const removeRipple = (id: number) => {
    setRipples((prev) => prev.filter((rp) => rp.id !== id));
  };

  const px = sizes[size];

  return (
    <button
      ref={ref}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      disabled={disabled}
      className={`relative inline-flex items-center justify-center rounded-lg border cursor-pointer select-none overflow-hidden disabled:opacity-35 disabled:pointer-events-none ${className}`}
      style={{
        width: px,
        height: px,
        backgroundColor: "rgba(255,255,255,0.04)",
        borderColor: "rgba(255,255,255,0.08)",
        color: "rgba(255,255,255,0.6)",
        willChange: "box-shadow, border-color",
        ...userStyle,
      }}
      {...rest}
    >
      <span style={{ position: "relative", zIndex: 1, pointerEvents: "none", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
        {children}
      </span>
      {ripples.map((rp) => (
        <RippleSpan key={rp.id} {...rp} onDone={() => removeRipple(rp.id)} />
      ))}
    </button>
  );
};

function RippleSpan({ x, y, size, r, g, b, onDone }: RippleData & { onDone: () => void }) {
  const spanRef = useRef<HTMLSpanElement>(null);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    const el = spanRef.current;
    if (!el) return;

    let raf: number;
    let springPos = 0;
    let springVel = 0;
    const startTime = performance.now();
    let lastTime = startTime;
    const scale = 2.8;
    const duration = 500;

    const tick = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      const elapsed = now - startTime;

      const force = (scale - springPos) * 140 - springVel * 14;
      springVel += force * dt;
      springPos += springVel * dt;

      const opacity = Math.max(0, 0.6 * (1 - elapsed / duration));
      el.style.transform = `translate(-50%, -50%) scale(${springPos})`;
      el.style.opacity = String(opacity);

      if (opacity <= 0.005) {
        cancelAnimationFrame(raf);
        onDoneRef.current();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <span
      ref={spanRef}
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: size,
        height: size,
        borderRadius: "50%",
        pointerEvents: "none",
        transformOrigin: "center",
        willChange: "transform, opacity",
        background: `radial-gradient(circle, rgba(${r},${g},${b},0.6) 0%, rgba(${r},${g},${b},0.25) 40%, transparent 70%)`,
        transform: "translate(-50%, -50%) scale(0)",
        opacity: "0.6",
      }}
    />
  );
}
