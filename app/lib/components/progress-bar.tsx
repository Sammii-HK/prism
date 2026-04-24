"use client";
import { useRef, useEffect } from "react";
import { pastelColour } from "../primitives/gradient";

export interface ProgressBarProps {
  /** Progress value 0-100 */
  value: number;
  /** Show percentage label */
  showLabel?: boolean;
  /** Additional class names */
  className?: string;
}

/**
 * Progress bar with spring-animated fill, travelling shimmer highlight, and
 * cursor-proximity pastel glow on the track border. Fill colour shifts with
 * cursor position via pastelColour.
 *
 * @example
 * <ProgressBar value={65} showLabel />
 * <ProgressBar value={100} />
 */
export const ProgressBar = ({
  value,
  showLabel = false,
  className = "",
}: ProgressBarProps) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const track = trackRef.current;
    const fill = fillRef.current;
    if (!track || !fill) return;

    let mouseX = 0;
    let mouseY = 0;
    let proximity = 0;
    let smoothProximity = 0;

    // Spring state for fill width
    let currentWidth = 0;
    let velocity = 0;
    const k = 120;
    const d = 18;

    const onMove = (e: PointerEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;

      const rect = track.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = Math.max(0, Math.abs(mouseX - cx) - rect.width / 2);
      const dy = Math.max(0, Math.abs(mouseY - cy) - rect.height / 2);
      const dist = Math.sqrt(dx * dx + dy * dy);
      proximity = Math.max(0, 1 - dist / 150);
    };

    window.addEventListener("pointermove", onMove, { passive: true });

    let raf: number;
    let lastTime = performance.now();

    const tick = () => {
      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.033); // cap at ~30fps delta
      lastTime = now;

      // Spring physics for fill width
      const target = Math.max(0, Math.min(100, value));
      const force = -k * (currentWidth - target);
      const damping = -d * velocity;
      velocity += (force + damping) * dt;
      currentWidth += velocity * dt;

      smoothProximity += (proximity - smoothProximity) * 0.1;

      const t = now / 1000;
      const rect = track.getBoundingClientRect();
      const xPc = ((rect.left + rect.width / 2) / window.innerWidth) * 100;
      const yPc = ((rect.top + rect.height / 2) / window.innerHeight) * 100;
      const { r, g, b } = pastelColour(xPc, yPc, t);

      // Fill bar
      fill.style.width = `${Math.max(0, currentWidth)}%`;
      fill.style.backgroundColor = `rgba(${r},${g},${b},0.5)`;

      // Travelling shimmer on fill (~3s loop)
      const shimmerPos = ((t % 3) / 3) * 100;
      const sw = 20;
      fill.style.backgroundImage = `linear-gradient(
        90deg,
        transparent ${shimmerPos - sw}%,
        rgba(255,255,255,0.12) ${shimmerPos}%,
        transparent ${shimmerPos + sw}%
      )`;

      // Track border glow
      const glow = smoothProximity * 0.4;
      track.style.boxShadow = glow > 0.01
        ? `0 0 ${8 * glow}px rgba(${r},${g},${b},${(glow * 0.4).toFixed(3)})`
        : "none";
      track.style.borderColor = glow > 0.01
        ? `rgba(${r},${g},${b},${(glow * 0.5).toFixed(3)})`
        : "rgba(255,255,255,0.06)";

      // Label
      if (labelRef.current) {
        labelRef.current.textContent = `${Math.round(currentWidth)}%`;
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, [value]);

  return (
    <div className={`w-full ${className}`}>
      {showLabel && (
        <div className="flex justify-end mb-1.5">
          <span
            ref={labelRef}
            className="text-xs font-mono"
            style={{ color: "rgba(255,255,255,0.4)" }}
          >
            0%
          </span>
        </div>
      )}
      <div
        ref={trackRef}
        className="w-full rounded-full overflow-hidden"
        style={{
          height: 6,
          backgroundColor: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.06)",
          willChange: "box-shadow, border-color",
        }}
      >
        <div
          ref={fillRef}
          className="h-full rounded-full"
          style={{
            width: "0%",
            willChange: "width, background-color, background-image",
          }}
        />
      </div>
    </div>
  );
};
