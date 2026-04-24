"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { RegistryItem } from "./registry";
import { SpotlightCard } from "./primitives";
import { previewMap } from "./previews";

type ComponentCardProps = {
  item: RegistryItem;
  /** Larger card variant for featured sections. */
  featured?: boolean;
};

/**
 * Card for gallery listings. Renders a live preview of the component above
 * title / tagline / tags. Off-screen cards unmount their preview so rAF
 * loops don't run in the background.
 */
export const ComponentCard = ({ item, featured = false }: ComponentCardProps) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  // Default to true so SSR renders a placeholder AND environments without
  // IntersectionObserver still show content. The observer pauses off-screen
  // cards after mount.
  const [visible, setVisible] = useState(true);
  const Preview = previewMap[item.slug];

  useEffect(() => {
    if (!wrapRef.current) return;
    if (typeof IntersectionObserver === "undefined") return;
    const el = wrapRef.current;

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
          } else if (entry.intersectionRatio === 0) {
            // Only unmount if fully out of viewport to avoid thrash on scroll.
            setVisible(false);
          }
        }
      },
      { rootMargin: "200px 0px", threshold: [0, 0.01] }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const previewHeight = featured ? "h-52 sm:h-56" : "h-40";

  return (
    <Link href={`/${item.slug}`} className="block">
      <SpotlightCard className="bg-white/[0.03] backdrop-blur-sm p-4 cursor-pointer group h-full flex flex-col">
        {/* Live preview window */}
        <div
          ref={wrapRef}
          className={`relative ${previewHeight} w-full rounded-lg bg-[#050505] border border-white/5 overflow-hidden mb-4`}
        >
          {visible && Preview && <Preview />}
          {/* Subtle top-left slug badge */}
          <span className="absolute top-2 left-2 text-[9px] font-mono text-white/20 uppercase tracking-wider pointer-events-none z-10">
            {item.category}
          </span>
        </div>

        {/* Meta */}
        <div className="flex items-baseline justify-between mb-1.5 gap-2">
          <h2 className="text-sm font-light text-white/85 group-hover:text-white transition-colors">
            {item.title}
          </h2>
          <span className="text-[10px] font-mono text-white/25 shrink-0">{item.date}</span>
        </div>
        <p className="text-xs text-white/40 leading-relaxed mb-3 flex-1">
          {item.tagline ?? item.description}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {item.tech.slice(0, 2).map((t) => (
            <span
              key={t}
              className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-white/5 text-white/35"
            >
              {t}
            </span>
          ))}
        </div>
      </SpotlightCard>
    </Link>
  );
};
