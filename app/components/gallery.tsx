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
    <div
      className="min-h-screen relative"
      style={mounted ? colourField(xPc, yPc, time, 5) : undefined}
    >
      {mounted && <CursorGlow size={400} blur={40} opacity={0.04} />}
      <SiteNav />

      <header className="px-6 pt-16 pb-8 text-center">
        <h1 className="text-3xl sm:text-4xl font-light tracking-tight text-white/90">
          Components
        </h1>
        <p className="mt-3 text-sm text-white/45 font-mono tracking-wide">
          Production-ready, cursor-reactive, hand-built.
        </p>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col gap-6 pb-6">
        {/* Filter row */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="overflow-x-auto -mx-1 px-1">
            <MorphTabs
              tabs={TAB_CATEGORIES.map(tabLabel)}
              activeIndex={activeTabIdx}
              onChange={setActiveTabIdx}
            />
          </div>
          <div ref={searchRef} className="w-full md:w-72">
            <GlowInput
              label="Search"
              value={query}
              onChange={setQuery}
              placeholder="Press / to search"
            />
          </div>
        </div>

        <p className="text-[11px] font-mono text-white/30 tracking-wide">
          {filtered.length} {filtered.length === 1 ? "component" : "components"}
        </p>
      </div>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pb-24">
        {filtered.length === 0 ? (
          <p className="text-center text-white/40 text-sm py-16">
            No components match {query ? `"${query}"` : "that filter"}.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((item) => (
              <ComponentCard key={item.slug} item={item} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};
