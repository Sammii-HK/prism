"use client";
import Link from "next/link";
import { featured, registry } from "./lib/registry";
import { usePointer } from "./lib/hooks/use-pointer";
import { colourField } from "./lib/primitives/gradient";
import { CursorGlow } from "./lib/primitives";
import { ComponentCard } from "./lib/component-card";
import { SiteNav } from "./lib/site-nav";
import { SiteFooter } from "./lib/shell/site-footer";
import { Container, Eyebrow, Rule, SectionHeading } from "./lib/shell/ui";
import { AttentionReadout } from "./lib/shell/attention-readout";
import { HeroStage } from "./lib/shell/hero-stage";
import { ShowcaseCards } from "./showcase/showcase-cards";
import { ExpressionsTeaser, XrayInvite } from "./lib/shell/expressions-teaser";

const principles = [
  {
    title: "Springs, wherever they run",
    body: "Every motion is a spring with hand-tuned stiffness and damping. Integrated every frame in JavaScript, or compiled to the same curve in CSS.",
  },
  {
    title: "Cursor-reactive colour",
    body: "A single pastel function maps pointer position to RGB. Borders, glows, fills — one palette, always in sync with you.",
  },
  {
    title: "Hand-built, zero deps",
    body: "No animation libraries, no UI kits. Just React refs, rAF, and physics primitives. One file per component.",
  },
  {
    title: "Any input, same feel",
    body: "The colour follows a cursor, a finger or keyboard focus. With reduced motion on, nothing moves but everything still answers.",
  },
];

export default function LandingPage() {
  const { xPc, yPc, time, mounted } = usePointer({ lerp: 0.08 });
  const componentCount = registry.filter((r) => r.type === "component").length;

  return (
    <div className="relative min-h-screen overflow-x-clip" style={mounted ? colourField(xPc, yPc, time, 10) : undefined}>
      {mounted && <CursorGlow size={500} blur={60} opacity={0.06} />}
      <SiteNav />

      <main id="main">
        {/* Hero ------------------------------------------------------------ */}
        <Container as="section" className="grid items-center gap-16 pb-24 pt-16 sm:pt-24 lg:grid-cols-[1.1fr_1fr] lg:gap-12 lg:pb-32">
          <div>
            <Eyebrow>Prism — hand-built React components</Eyebrow>
            <h1 className="mt-6 text-[44px] font-light leading-[0.98] tracking-[-0.035em] text-white/90 sm:text-6xl lg:text-[72px]">
              Design engineering by Sammii.
            </h1>
            <p className="mt-7 max-w-md text-base leading-relaxed text-white/60">
              Every component answers to you. Spring physics, cursor-reactive colour and zero dependencies,
              with every value tuned by hand.
            </p>

            <div className="mt-10 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
              <Link
                href="/components"
                className="group inline-flex items-center gap-2 rounded-xl border border-white/[0.14] bg-white/[0.06] px-5 py-3 text-sm text-white/90 transition-colors hover:border-white/[0.22] hover:bg-white/[0.09] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              >
                Browse {componentCount} components
                <span aria-hidden="true" className="text-white/50 transition-transform group-hover:translate-x-0.5">
                  →
                </span>
              </Link>
              <Link
                href="/lab"
                className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm text-white/60 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              >
                Read the Interaction Lab
              </Link>
            </div>

            <div className="mt-12">
              <p className="mb-3 text-xs text-white/50">Everything here is reading this:</p>
              <AttentionReadout />
            </div>
          </div>

          <HeroStage />
        </Container>

        <Rule />

        {/* Showcase -------------------------------------------------------- */}
        <Container as="section" className="py-20 sm:py-24">
          <SectionHeading
            eyebrow="Showcase"
            title="Built into real products"
            aside={
              <Link href="/showcase" className="transition-colors hover:text-white">
                All showcase →
              </Link>
            }
          />
          <ShowcaseCards />
        </Container>

        <Rule />

        {/* Expressions ----------------------------------------------------- */}
        <Container as="section" className="py-20 sm:py-24">
          <ExpressionsTeaser />
        </Container>

        <Rule />

        {/* Principles ------------------------------------------------------ */}
        <Container as="section" className="py-20 sm:py-24">
          <SectionHeading eyebrow="Principles" title="How it's made" />
          <ol className="grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
            {principles.map((p, i) => (
              <li key={p.title} className="border-t border-white/[0.08] pt-6">
                <span className="font-mono text-[11px] tabular-nums text-white/50">0{i + 1}</span>
                <h3 className="mt-4 text-lg font-light leading-snug text-white/90">{p.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-white/55">{p.body}</p>
              </li>
            ))}
          </ol>
        </Container>

        <Rule />

        {/* Featured -------------------------------------------------------- */}
        <Container as="section" className="py-20 sm:py-24">
          <SectionHeading
            eyebrow="Featured work"
            title="Signature interactions"
            aside={
              <Link href="/components" className="transition-colors hover:text-white">
                All components →
              </Link>
            }
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured.slice(0, 6).map((item) => (
              <ComponentCard key={item.slug} item={item} featured />
            ))}
          </div>
        </Container>

        {/* X-ray ----------------------------------------------------------- */}
        <Container as="section" className="pt-4">
          <XrayInvite />
        </Container>

        {/* Lab ------------------------------------------------------------- */}
        <Container as="section" className="pt-4">
          <Link
            href="/lab"
            className="group block rounded-3xl border border-white/[0.08] bg-white/[0.02] p-8 transition-colors hover:border-white/[0.16] hover:bg-white/[0.035] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 sm:p-12"
          >
            <Eyebrow>Interaction Lab</Eyebrow>
            <p className="mt-6 max-w-3xl text-[28px] font-light leading-[1.12] tracking-[-0.02em] text-white/90 sm:text-[40px]">
              Can interfaces become expressive without sacrificing usability?
            </p>
            <p className="mt-6 max-w-xl text-sm leading-relaxed text-white/55">
              Six small experiments, each built so the expressive layer can be taken away and the interface still works.
            </p>
            <span className="mt-8 inline-flex items-center gap-2 text-sm text-white/75 transition-colors group-hover:text-white">
              Open the lab
              <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">
                →
              </span>
            </span>
          </Link>
        </Container>
      </main>

      <SiteFooter />
    </div>
  );
}
