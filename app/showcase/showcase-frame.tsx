"use client";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { SiteNav } from "../lib/site-nav";
import { SiteFooter } from "../lib/shell/site-footer";
import { Container, Eyebrow } from "../lib/shell/ui";

export type ShowcaseSlug = "darkroom" | "console" | "synth";

export const SHOWCASES: Array<{ slug: ShowcaseSlug; title: string; pitch: string }> = [
  { slug: "darkroom", title: "Darkroom", pitch: "Grade a black and white photograph: curves, tone and a print-ready export." },
  { slug: "console", title: "Release console", pitch: "Ship a build: honest waiting, live logs, flags and a keyboard-first command bar." },
  { slug: "synth", title: "Synth", pitch: "Play a small synthesiser with a mouse, a finger or the keyboard." },
];

type Props = {
  slug: ShowcaseSlug;
  title: string;
  /** One sentence under the title: what the product is for. */
  lede: string;
  /** Prism components this app is built from, by registry slug and display name. */
  uses: Array<{ slug: string; title: string }>;
  /** Short notes on the craft decisions, shown under the app. */
  notes: Array<{ title: string; body: ReactNode }>;
  /** Keyboard shortcuts worth knowing, shown beside the app. */
  keys?: Array<{ keys: string; does: string }>;
  children: ReactNode;
};

/**
 * Shared page frame for the applied demos: a working product built only
 * from Prism, with the components it uses and the decisions behind it.
 */
export const ShowcaseFrame = ({ slug, title, lede, uses, notes, keys, children }: Props) => {
  const others = SHOWCASES.filter((s) => s.slug !== slug);

  return (
    <div className="relative min-h-screen">
      <SiteNav />
      <main id="main">
        <Container as="header" className="pb-8 pt-12 sm:pt-16">
          <nav aria-label="Breadcrumb" className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/50">
            <Link href="/showcase" className="transition-colors hover:text-white">
              Showcase
            </Link>
          </nav>
          <div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-[40px] font-light leading-none tracking-[-0.035em] text-white/95 sm:text-[56px]">{title}</h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-white/60">{lede}</p>
            </div>
            {keys && keys.length > 0 && (
              <dl className="hidden shrink-0 grid-cols-[auto_1fr] sm:grid gap-x-4 gap-y-1.5 text-[13px]">
                {keys.map((k) => (
                  <div key={k.keys} className="contents">
                    <dt>
                      <kbd className="rounded-md border border-white/[0.14] bg-white/[0.04] px-1.5 py-0.5 font-mono text-[11px] text-white/80">
                        {k.keys}
                      </kbd>
                    </dt>
                    <dd className="text-white/55">{k.does}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </Container>

        {/* The app itself. Wider than the reading measure: it's a tool. */}
        <div className="mx-auto w-full max-w-[1400px] px-3 sm:px-6">{children}</div>

        <Container className="mt-20 grid gap-16 lg:grid-cols-[1fr_280px] lg:gap-16">
          <section aria-labelledby="notes">
            <Eyebrow className="mb-3">Decisions</Eyebrow>
            <h2 id="notes" className="mb-8 text-2xl font-light text-white/90">
              How it&apos;s built
            </h2>
            <ol className="grid gap-x-10 gap-y-10 sm:grid-cols-2">
              {notes.map((n, i) => (
                <li key={n.title} className="border-t border-white/[0.08] pt-5">
                  <span className="font-mono text-[11px] tabular-nums text-white/50">0{i + 1}</span>
                  <h3 className="mt-3 text-base font-light text-white/90">{n.title}</h3>
                  <div className="mt-2 text-sm leading-relaxed text-white/55">{n.body}</div>
                </li>
              ))}
            </ol>
          </section>
          <aside aria-labelledby="uses">
            <Eyebrow className="mb-3">Built from</Eyebrow>
            <h2 id="uses" className="sr-only">
              Prism components used
            </h2>
            <ul className="flex flex-wrap gap-1.5">
              {uses.map((u) => (
                <li key={u.slug}>
                  <Link
                    href={`/${u.slug}`}
                    className="block rounded-full border border-white/[0.08] px-2.5 py-1 font-mono text-[11px] text-white/60 transition-colors hover:border-white/20 hover:text-white"
                  >
                    {u.title}
                  </Link>
                </li>
              ))}
            </ul>
          </aside>
        </Container>

        <Container as="nav" className="mt-24">
          <Eyebrow className="mb-4">More showcase</Eyebrow>
          <div className="grid gap-px overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.06] sm:grid-cols-2">
            {others.map((o) => (
              <Link
                key={o.slug}
                href={`/showcase/${o.slug}`}
                className="group bg-[#050505] p-6 transition-colors hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/60"
              >
                <span className="text-lg font-light text-white/85 transition-colors group-hover:text-white">
                  {o.title} <span aria-hidden="true"><ArrowRight size={14} aria-hidden="true" className="inline-block align-middle" /></span>
                </span>
                <span className="mt-1.5 block text-[13px] leading-relaxed text-white/55">{o.pitch}</span>
              </Link>
            ))}
          </div>
        </Container>
      </main>
      <SiteFooter />
    </div>
  );
};

/** The app surface: a dark rounded panel every showcase sits in. */
export const AppSurface = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <div className={`relative overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#080808] shadow-[0_40px_120px_-40px_rgba(0,0,0,0.9)] ${className}`}>
    {children}
  </div>
);
