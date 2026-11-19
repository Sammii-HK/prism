import type { Metadata } from "next";
import { SiteNav } from "../lib/site-nav";
import { SiteFooter } from "../lib/shell/site-footer";
import { Container, Eyebrow } from "../lib/shell/ui";
import { ShowcaseCards } from "./showcase-cards";

export const metadata: Metadata = {
  title: "Showcase — Prism",
  description: "Three working products built only from Prism components: a photo darkroom, a release console and a synthesiser.",
};

export default function ShowcasePage() {
  return (
    <div className="relative min-h-screen">
      <SiteNav />
      <main id="main">
        <Container as="header" className="pb-12 pt-16 sm:pt-20">
          <Eyebrow>Applied</Eyebrow>
          <h1 className="mt-5 text-[44px] font-light leading-none tracking-[-0.035em] text-white/90 sm:text-6xl">Showcase</h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-white/60">
            Components are only proven in a product. Three real, working tools built from Prism, each one usable with a
            mouse, a finger or the keyboard.
          </p>
        </Container>
        <Container>
          <ShowcaseCards headingLevel={2} />
        </Container>
      </main>
      <SiteFooter />
    </div>
  );
}
