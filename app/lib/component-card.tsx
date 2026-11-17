"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { RegistryItem } from "./registry";
import { SpotlightCard } from "./primitives";
import { previewMap } from "./previews";
import { labPreviewMap } from "./previews-lab";

type ComponentCardProps = {
  item: RegistryItem;
  /** Larger card variant for featured sections. */
  featured?: boolean;
};

/**
 * Card for gallery listings: a live preview above the title, tagline and tags.
 *
 * The title is the only link, stretched over the whole card, so the card is
 * one tab stop with a clear name. The preview is visual only (`inert`): its
 * components still answer to the shared attention point, but their controls
 * don't sit inside a link or fill the tab order. Off-screen previews unmount
 * so their rAF loops stop.
 */
export const ComponentCard = ({ item, featured = false }: ComponentCardProps) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  // Default to true so SSR renders a placeholder AND environments without
  // IntersectionObserver still show content. The observer pauses off-screen
  // cards after mount.
  const [visible, setVisible] = useState(true);
  const Preview = previewMap[item.slug] ?? labPreviewMap[item.slug];

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

  const previewHeight = featured ? "h-56" : "h-48";

  return (
    <SpotlightCard className="group relative flex h-full flex-col rounded-2xl bg-white/[0.025] p-3 backdrop-blur-sm transition-colors has-[a:focus-visible]:bg-white/[0.05]">
      <div
        ref={wrapRef}
        inert
        aria-hidden="true"
        className={`relative ${previewHeight} w-full overflow-hidden rounded-xl border border-white/[0.05] bg-[#050505]`}
      >
        {visible && Preview && <Preview />}
      </div>

      <div className="flex flex-1 flex-col px-2 pb-2 pt-4">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-[15px] font-light text-white/90">
            <Link
              href={`/${item.slug}`}
              className="rounded-sm outline-none after:absolute after:inset-0 after:rounded-2xl after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-white/60"
            >
              {item.title}
            </Link>
          </h3>
          {item.type === "component" && (
            <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.18em] text-white/50">{item.category}</span>
          )}
        </div>
        <p className="mt-1.5 flex-1 text-[13px] leading-relaxed text-white/55">{item.tagline ?? item.description}</p>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {item.tech.slice(0, 3).map((t) => (
            <span key={t} className="rounded-full bg-white/[0.05] px-2 py-0.5 font-mono text-[10px] text-white/55">
              {t}
            </span>
          ))}
        </div>
      </div>
    </SpotlightCard>
  );
};
