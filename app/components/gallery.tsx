"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { components, componentCategories, type Category } from "../lib/registry";
import { ComponentCard } from "../lib/component-card";
import { MorphTabs } from "../lib/components/morph-tabs";
import { GlowInput } from "../lib/components/glow-input";
import { SiteNav } from "../lib/site-nav";
import { usePointer } from "../lib/hooks/use-pointer";
import { colourField } from "../lib/primitives/gradient";
import { CursorGlow } from "../lib/primitives";
import { SiteFooter } from "../lib/shell/site-footer";
import { Container, Eyebrow } from "../lib/shell/ui";

type CategoryTab = "all" | Category;

const TAB_CATEGORIES: CategoryTab[] = ["all", ...componentCategories];

const tabLabel = (c: CategoryTab) => (c === "all" ? "All" : c[0].toUpperCase() + c.slice(1));

export const ComponentsGallery = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { xPc, yPc, time, mounted } = usePointer({ lerp: 0.08 });

  const initialCategory = (searchParams.get("category") as CategoryTab | null) ?? "all";
  const initialQuery = searchParams.get("q") ?? "";

  const [activeTabIdx, setActiveTabIdx] = useState<number>(() => {
    const idx = TAB_CATEGORIES.indexOf(initialCategory);
    return idx >= 0 ? idx : 0;
  });
  const [query, setQuery] = useState(initialQuery);
  const searchRef = useRef<HTMLDivElement>(null);

  // Sync state -> URL (shallow, no navigation).
  useEffect(() => {
    const cat = TAB_CATEGORIES[activeTabIdx];
    const next = new URLSearchParams();
    if (cat !== "all") next.set("category", cat);
    if (query.trim()) next.set("q", query.trim());
    const qs = next.toString();
    const target = qs ? `/components?${qs}` : "/components";
    router.replace(target, { scroll: false });
  }, [activeTabIdx, query, router]);

  // Keyboard: `/` focuses search, Esc clears.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || (target as HTMLElement).isContentEditable);
      if (e.key === "/" && !typing) {
        e.preventDefault();
        const input = searchRef.current?.querySelector("input");
        input?.focus();
      } else if (e.key === "Escape") {
        if (query) {
          setQuery("");
        }
        const input = searchRef.current?.querySelector("input");
        input?.blur();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [query]);

  const filtered = useMemo(() => {
    const activeCat = TAB_CATEGORIES[activeTabIdx];
    const q = query.trim().toLowerCase();
    return components
      .filter((c) => (activeCat === "all" ? true : c.category === activeCat))
      .filter((c) => {
        if (!q) return true;
        const hay = [c.title, c.tagline ?? "", ...c.tags].join(" ").toLowerCase();
        // Simple contains match — cheap fuzzy (spaces act as AND).
        return q.split(/\s+/).every((term) => hay.includes(term));
      })
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [activeTabIdx, query]);

  return (
    <div className="relative min-h-screen" style={mounted ? colourField(xPc, yPc, time, 5) : undefined}>
      {mounted && <CursorGlow size={400} blur={40} opacity={0.04} />}
      <SiteNav />

      <main id="main">
        <Container as="header" className="pb-10 pt-16 sm:pt-20">
          <Eyebrow>Library</Eyebrow>
          <div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-[44px] font-light leading-none tracking-[-0.035em] text-white/90 sm:text-6xl">Components</h1>
              <p className="mt-5 max-w-md text-base leading-relaxed text-white/60">
                Production-ready, cursor-reactive, hand-built. Each one works with a mouse, a finger or the
                keyboard, and holds still when you ask for reduced motion.
              </p>
            </div>
            <div ref={searchRef} className="w-full lg:w-80">
              <GlowInput label="Search" value={query} onChange={setQuery} placeholder="Press / to search" />
            </div>
          </div>
        </Container>

        <Container className="sticky top-14 z-30 -mt-px border-y border-white/[0.06] bg-[#050505]/75 py-3 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-4">
            <div className="-mx-1 overflow-x-auto px-1 no-scrollbar">
              <MorphTabs tabs={TAB_CATEGORIES.map(tabLabel)} activeIndex={activeTabIdx} onChange={setActiveTabIdx} />
            </div>
            <p className="hidden shrink-0 font-mono text-[11px] tabular-nums text-white/50 sm:block" aria-live="polite">
              {filtered.length} {filtered.length === 1 ? "component" : "components"}
            </p>
          </div>
        </Container>

        <Container className="pt-8">
          {filtered.length === 0 ? (
            <p className="py-24 text-center text-sm text-white/55">
              No components match {query ? `"${query}"` : "that filter"}.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((item) => (
                <ComponentCard key={item.slug} item={item} />
              ))}
            </div>
          )}
        </Container>
      </main>

      <SiteFooter />
    </div>
  );
};
