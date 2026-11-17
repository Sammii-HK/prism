"use client";
import { useRef, useEffect, type ReactNode } from "react";
import { pastelColour } from "./gradient";
import { subscribeAttention } from "../hooks/attention";
import { motionTime } from "../hooks/reduced-motion";

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
        const t = motionTime();
        const { r, g, b } = pastelColour(xPcRef.current, yPcRef.current, t);
        cardRef.current.style.borderColor = `rgb(${r} ${g} ${b} / 70%)`;
      }
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);

    // Mouse, touch and keyboard focus all light the border, via the shared attention point
    const unsubscribe = subscribeAttention(({ x, y }) => {
      const card = cardRef.current;
      if (!card) return;
      const rect = card.getBoundingClientRect();
      const inside = x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
      if (inside) {
        hoveredRef.current = true;
        xPcRef.current = ((x - rect.left) / rect.width) * 100;
        yPcRef.current = ((y - rect.top) / rect.height) * 100;
      } else if (hoveredRef.current) {
        hoveredRef.current = false;
        card.style.borderColor = "";
      }
    });

    return () => {
      unsubscribe();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div
      ref={cardRef}
      className={`rounded-lg border border-white/10 transition-shadow hover:shadow-lg hover:shadow-white/5 ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
};
