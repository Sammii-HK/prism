"use client";
import { useRef, useEffect, type ReactNode } from "react";
import { pastelColour } from "./gradient";

type SpotlightCardProps = {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
};

/**
 * Card with a cursor-reactive pastel border glow.
 * Border colour shifts based on where the cursor sits within the card.
 */
export const SpotlightCard = ({ children, className = "", onClick }: SpotlightCardProps) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const xPcRef = useRef(50);
  const yPcRef = useRef(50);
  const hoveredRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const animate = () => {
      if (hoveredRef.current && cardRef.current) {
        const t = performance.now() / 1000;
        const { r, g, b } = pastelColour(xPcRef.current, yPcRef.current, t);
        cardRef.current.style.borderColor = `rgb(${r} ${g} ${b} / 70%)`;
      }
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div
      ref={cardRef}
      className={`rounded-lg border border-white/10 transition-shadow hover:shadow-lg hover:shadow-white/5 ${className}`}
      onClick={onClick}
      onMouseEnter={() => { hoveredRef.current = true; }}
      onMouseMove={(e) => {
        hoveredRef.current = true;
        const rect = e.currentTarget.getBoundingClientRect();
        xPcRef.current = ((e.clientX - rect.left) / rect.width) * 100;
        yPcRef.current = ((e.clientY - rect.top) / rect.height) * 100;
      }}
      onMouseLeave={() => {
        hoveredRef.current = false;
        if (cardRef.current) cardRef.current.style.borderColor = "";
      }}
    >
      {children}
    </div>
  );
};
