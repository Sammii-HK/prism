"use client";
import Link from "next/link";
import { featured, registry } from "./lib/registry";
import { usePointer } from "./lib/hooks/use-pointer";
import { colourField } from "./lib/primitives/gradient";
import { CursorGlow } from "./lib/primitives";
import { ComponentCard } from "./lib/component-card";
import { ShimmerText } from "./lib/components/shimmer-text";
import { SiteNav } from "./lib/site-nav";

export default function LandingPage() {
  const { xPc, yPc, time, mounted } = usePointer({ lerp: 0.08 });
  const componentCount = registry.filter((r) => r.type === "component").length;

  return (
    <div
      className="min-h-screen relative"
      style={mounted ? colourField(xPc, yPc, time, 10) : undefined}
    >
      {mounted && <CursorGlow size={500} blur={60} opacity={0.06} />}
      <SiteNav />

      {/* ------------------------------------------------------------------ */}
      {/* Hero                                                                */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative px-6 pt-24 sm:pt-32 pb-20 sm:pb-28 flex flex-col items-center text-center">
        <p className="text-[11px] font-mono text-white/35 uppercase tracking-[0.25em] mb-6">
          Sammii — Design engineering
        </p>
        <h1 className="text-4xl sm:text-6xl md:text-7xl font-light tracking-tight leading-[1.05] max-w-4xl">
          <ShimmerText className="text-white/90 block">
            Design engineering by Sammii.
          </ShimmerText>
        </h1>
        <p className="mt-6 text-sm sm:text-base text-white/55 max-w-xl leading-relaxed">
          Spring physics, cursor-reactive colour, production components.
          Hand-built, zero dependencies.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row gap-3 items-center">
          <Link
            href="/components"
            className="group inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white/[0.06] border border-white/[0.14] text-sm text-white/85 hover:bg-white/[0.09] hover:border-white/[0.22] transition-colors"
          >
            Browse {componentCount} components
            <span className="text-white/50 group-hover:translate-x-0.5 transition-transform">→</span>
          </Link>
          <Link
            href="/playground"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm text-white/55 hover:text-white/80 transition-colors"
          >
            See playground
          </Link>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Ethos strip                                                         */}
      {/* ------------------------------------------------------------------ */}
      <section className="max-w-5xl mx-auto px-6 py-16 grid grid-cols-1 md:grid-cols-3 gap-10 border-t border-white/[0.06]">
        <EthosItem
          index="01"
          title="Spring physics, not CSS transitions"
          body="Every motion integrates position and velocity every frame. Overshoot, damping, settle — motion that feels alive."
        />
        <EthosItem
          index="02"
          title="Cursor-reactive colour"
          body="A single pastel function maps pointer position to RGB. Borders, glows, fills — one palette, always in sync with you."
        />
        <EthosItem
          index="03"
          title="Hand-built, zero deps"
          body="No animation libraries, no UI kits. Just React refs, rAF, and physics primitives. One file per component."
        />
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Featured work                                                       */}
      {/* ------------------------------------------------------------------ */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 border-t border-white/[0.06]">
        <div className="flex items-end justify-between mb-8 px-1">
          <div>
            <p className="text-[10px] tracking-[0.2em] text-white/30 uppercase mb-2">
              Featured work
            </p>
            <h2 className="text-2xl sm:text-3xl font-light text-white/85">
              Signature interactions
            </h2>
          </div>
          <Link
            href="/components"
            className="hidden sm:inline-block text-sm text-white/50 hover:text-white/80 transition-colors"
          >
            Browse all →
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {featured.map((item) => (
            <ComponentCard key={item.slug} item={item} featured />
          ))}
        </div>

        <div className="mt-10 text-center sm:hidden">
          <Link
            href="/components"
            className="inline-block text-sm text-white/60 hover:text-white/90 transition-colors"
          >
            Browse all →
          </Link>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Footer                                                              */}
      {/* ------------------------------------------------------------------ */}
      <footer className="border-t border-white/[0.06] mt-8">
        <div className="max-w-5xl mx-auto px-6 py-14 grid grid-cols-1 sm:grid-cols-3 gap-10">
          <div>
            <p className="text-[10px] tracking-[0.2em] text-white/30 uppercase mb-3">About</p>
            <p className="text-sm text-white/55 leading-relaxed">
              Prism is a craft catalogue — cursor-reactive UI primitives by Sammii,
              a design engineer shipping every day.
            </p>
          </div>
          <div>
            <p className="text-[10px] tracking-[0.2em] text-white/30 uppercase mb-3">Soon</p>
            <p className="text-sm text-white/55 leading-relaxed">
              Coming to npm — drop these components into your app with one install.
            </p>
          </div>
          <div>
            <p className="text-[10px] tracking-[0.2em] text-white/30 uppercase mb-3">Contact</p>
            <ul className="text-sm space-y-2">
              <li>
                <a
                  href="#"
                  className="text-white/55 hover:text-white/85 transition-colors"
                >
                  GitHub →
                </a>
              </li>
              <li>
                <Link
                  href="/atoms"
                  className="text-white/55 hover:text-white/85 transition-colors"
                >
                  Atoms reference →
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-6 pb-10 pt-2">
          <p className="text-[10px] font-mono text-white/25 tracking-wide">
            © Sammii · Built on Next.js, Tailwind, spring physics.
          </p>
        </div>
      </footer>
    </div>
  );
}

const EthosItem = ({
  index,
  title,
  body,
}: {
  index: string;
  title: string;
  body: string;
}) => (
  <div className="flex flex-col gap-3">
    <span className="text-[10px] font-mono text-white/30 tracking-wider">{index}</span>
    <h3 className="text-lg font-light text-white/90 leading-snug">{title}</h3>
    <p className="text-sm text-white/50 leading-relaxed">{body}</p>
  </div>
);
