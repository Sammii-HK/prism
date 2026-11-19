"use client";
import { useRef, useEffect, type ReactNode } from "react";
import { pastelColour } from "../primitives/gradient";
import { subscribeAttention } from "../hooks/attention";
import { motionTime, reducedMotionNow } from "../hooks/reduced-motion";

export interface HoverRevealProps {
  /** Always-visible content */
  children: ReactNode;
  /** Content revealed on hover */
  revealContent: ReactNode;
  /** Direction the reveal opens toward. Default: "down" */
  direction?: "up" | "down";
  /** Additional class names on the outer wrapper */
  className?: string;
}

/**
 * Content that smoothly reveals on hover with spring physics.
 * The revealed section springs into view with opacity, translateY, and
 * height all driven by a damped spring. A pastel border line shifts
 * colour with cursor position.
 *
 * @example
 * <HoverReveal revealContent={<p>Hidden detail</p>}>
 *   <span>Hover me</span>
 * </HoverReveal>
 * <HoverReveal direction="up" revealContent="Above">Below</HoverReveal>
 */
export const HoverReveal = ({
  children,
  revealContent,
  direction = "down",
  className = "",
}: HoverRevealProps) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const revealRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const borderRef = useRef<HTMLDivElement>(null);

  // Spring state — mutable, never triggers re-render
  const sp = useRef({
    // progress: 0 = closed, 1 = open
    progress: 0,
    progressVel: 0,
    // cursor tracking
    rawX: 50,
    rawY: 50,
    smoothX: 50,
    smoothY: 50,
    hovered: false,
    // measured height of reveal content
    contentHeight: 0,
  });

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const reveal = revealRef.current;
    const inner = innerRef.current;
    const border = borderRef.current;
    if (!wrapper || !reveal || !inner || !border) return;

    // Measure content height
    const measure = () => {
      sp.current.contentHeight = inner.scrollHeight;
    };
    measure();

    // Re-measure on resize
    const ro = new ResizeObserver(measure);
    ro.observe(inner);

    // Mouse, touch and keyboard focus all move the attention point.
    // When it is released, keep the last colour rather than jump off-screen.
    const unsubscribe = subscribeAttention(({ x, y, kind }) => {
      if (kind === "none") return;
      sp.current.rawX = (x / window.innerWidth) * 100;
      sp.current.rawY = (y / window.innerHeight) * 100;
    });

    const onEnter = () => {
      sp.current.hovered = true;
    };
    const onLeave = () => {
      sp.current.hovered = false;
    };
    // Keyboard users open it by focusing something inside, and close it by
    // moving focus out. Focus moving between children keeps it open.
    const onFocusIn = (e: FocusEvent) => {
      if (e.target instanceof Element && e.target.matches(":focus-visible")) onEnter();
    };
    const onFocusOut = (e: FocusEvent) => {
      if (!(e.relatedTarget instanceof Node && wrapper.contains(e.relatedTarget))) onLeave();
    };
    wrapper.addEventListener("pointerenter", onEnter);
    wrapper.addEventListener("pointerleave", onLeave);
    wrapper.addEventListener("focusin", onFocusIn);
    wrapper.addEventListener("focusout", onFocusOut);

    // Spring step: F = k * (target - pos) - d * vel
    const step = (
      pos: number,
      vel: number,
      target: number,
      k: number,
      d: number
    ): [number, number] => {
      const acc = k * (target - pos) - d * vel;
      const newVel = vel + acc / 60;
      return [pos + newVel / 60, newVel];
    };

    let raf: number;

    const tick = () => {
      const s = sp.current;

      // Smooth cursor
      s.smoothX += (s.rawX - s.smoothX) * 0.08;
      s.smoothY += (s.rawY - s.smoothY) * 0.08;

      // Spring progress toward target — k=160, d=20
      const target = s.hovered ? 1 : 0;
      // Reduced motion: open/close straight to the end state.
      if (reducedMotionNow()) {
        s.progress = target;
        s.progressVel = 0;
      }
      const [p, pv] = step(s.progress, s.progressVel, target, 160, 20);
      s.progress = p;
      s.progressVel = pv;

      // Clamp for rendering
      const progress = Math.max(0, Math.min(1, p));

      // Height animation
      const h = progress * s.contentHeight;
      reveal.style.height = `${h}px`;

      // Opacity
      reveal.style.opacity = progress.toFixed(3);

      // TranslateY: 8px offset that springs to 0
      const offsetSign = direction === "up" ? -1 : 1;
      const ty = (1 - progress) * 8 * offsetSign;
      inner.style.transform = `translateY(${ty.toFixed(2)}px)`;

      // Pastel border colour
      const t = motionTime();
      const { r, g, b } = pastelColour(s.smoothX, s.smoothY, t);
      const borderAlpha = (0.35 * progress).toFixed(3);
      border.style.backgroundColor = `rgba(${r},${g},${b},${borderAlpha})`;

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    return () => {
      unsubscribe();
      wrapper.removeEventListener("pointerenter", onEnter);
      wrapper.removeEventListener("pointerleave", onLeave);
      wrapper.removeEventListener("focusin", onFocusIn);
      wrapper.removeEventListener("focusout", onFocusOut);
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [direction]);

  // Border position: top for "up", bottom for "down"
  const borderStyle: React.CSSProperties =
    direction === "up"
      ? { position: "absolute", left: 0, right: 0, bottom: 0, height: 1 }
      : { position: "absolute", left: 0, right: 0, top: 0, height: 1 };

  const revealBlock = (
    <div
      ref={revealRef}
      style={{
        height: 0,
        overflow: "hidden",
        opacity: 0,
        willChange: "height, opacity",
        position: "relative",
      }}
    >
      <div ref={borderRef} style={borderStyle} />
      <div ref={innerRef} style={{ willChange: "transform" }}>
        {revealContent}
      </div>
    </div>
  );

  return (
    <div ref={wrapperRef} className={className}>
      {direction === "up" && revealBlock}
      {children}
      {direction === "down" && revealBlock}
    </div>
  );
};
