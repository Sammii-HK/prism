"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, X } from "lucide-react";
import { discoverComponents, type Availability } from "../lib/discovery";
import installable from "../../registry.config.json";
import { useRouter, useSearchParams } from "next/navigation";
import { components, studies, componentCategories, type Category } from "../lib/registry";
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

const INSTALLABLE = new Set(installable.items.map(item => item.name));
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
  const [availability, setAvailability] = useState<Availability>(() => searchParams.get("show") === "installable" ? "installable" : searchParams.get("show") === "study" ? "study" : "all");
  const searchRef = useRef<HTMLDivElement>(null);

  // Sync state -> URL (shallow, no navigation).
  useEffect(() => {
    const cat = TAB_CATEGORIES[activeTabIdx];
    const next = new URLSearchParams();
    if (cat !== "all") next.set("category", cat);
    if (query.trim()) next.set("q", query.trim());
    if (availability !== "all") next.set("show", availability);
    const qs = next.toString();
    const target = qs ? `/components?${qs}` : "/components";
    router.replace(target, { scroll: false });
  }, [activeTabIdx, query, availability, router]);

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

  const filtered = useMemo(() => discoverComponents(availability === "study" ? studies : components, TAB_CATEGORIES[activeTabIdx], query, availability, INSTALLABLE), [activeTabIdx, query, availability]);
  const reset = () => { setQuery(""); setActiveTabIdx(0); setAvailability("all"); };

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
                Explore the interaction, inspect the behaviour and take the source into your project. Choose a registry install, browse the component source or follow an interaction study.
              </p>
            </div>
            <div ref={searchRef} className="w-full lg:w-80">
              <GlowInput label="Search" value={query} onChange={setQuery} placeholder="Press / to search" />
            </div>
          </div>
        </Container>

        <Container className="pb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div role="group" aria-label="Availability" className="flex flex-wrap gap-2">
              {([['all','All components'],['installable',`Installable (${INSTALLABLE.size})`],['study','Interaction studies']] as const).map(([value,label])=><button key={value} type="button" aria-pressed={availability===value} onClick={()=>setAvailability(value)} className={`min-h-11 rounded-full border px-4 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 ${availability===value?'border-white/60 bg-white text-black':'border-white/15 text-white/65 hover:border-white/40'}`}>{label}</button>)}
            </div>
            <Link href="/docs/installation" className="inline-flex min-h-11 items-center gap-2 text-sm text-white/65 hover:text-white">Installation guide<ArrowUpRight size={14} aria-hidden="true" /></Link>
          </div>
          {(query || activeTabIdx>0 || availability!=='all') && <button type="button" onClick={reset} className="mt-3 inline-flex min-h-11 items-center gap-2 text-xs text-white/60 hover:text-white"><X size={14} aria-hidden="true" />Clear filters</button>}
        </Container>

        <Container className="sticky top-14 z-30 -mt-px border-y border-white/[0.06] bg-[#050505]/75 py-3 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-4">
            <div className="-mx-1 overflow-x-auto px-1 no-scrollbar">
              <MorphTabs tabs={TAB_CATEGORIES.map(tabLabel)} activeIndex={activeTabIdx} onChange={setActiveTabIdx} />
            </div>
            <p className="shrink-0 font-mono text-[11px] tabular-nums text-white/50 sm:block" aria-live="polite">
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
