"use client";
import { playground } from "../lib/registry";
import { ComponentCard } from "../lib/component-card";
import { SiteNav } from "../lib/site-nav";
import { usePointer } from "../lib/hooks/use-pointer";
import { colourField } from "../lib/primitives/gradient";
import { CursorGlow } from "../lib/primitives";
import { SiteFooter } from "../lib/shell/site-footer";
import { Container, Eyebrow } from "../lib/shell/ui";

export const PlaygroundGrid = () => {
  const { xPc, yPc, time, mounted } = usePointer({ lerp: 0.08 });
  // The lab has its own page and nav entry; the playground is the canvas work.
  const items = playground.filter((p) => p.slug !== "lab").sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <div className="relative min-h-screen" style={mounted ? colourField(xPc, yPc, time, 6) : undefined}>
      {mounted && <CursorGlow size={400} blur={40} opacity={0.04} />}
      <SiteNav />

      <main id="main">
        <Container as="header" className="pb-12 pt-16 sm:pt-20">
          <Eyebrow>Experiments</Eyebrow>
          <h1 className="mt-5 text-[44px] font-light leading-none tracking-[-0.035em] text-white/90 sm:text-6xl">Playground</h1>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-white/60">
            Canvas, WebGL and particle studies where the colour system and the physics get room to play. Not for
            production, made for the feel.
          </p>
        </Container>

        <Container>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item, i) => (
              <div key={item.slug} className={i === 0 ? "sm:col-span-2 lg:row-span-1" : ""}>
                <ComponentCard item={item} featured={i === 0} />
              </div>
            ))}
          </div>
        </Container>
      </main>

      <SiteFooter />
    </div>
  );
};
