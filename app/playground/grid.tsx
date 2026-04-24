"use client";
import { playground } from "../lib/registry";
import { ComponentCard } from "../lib/component-card";
import { SiteNav } from "../lib/site-nav";
import { usePointer } from "../lib/hooks/use-pointer";
import { colourField } from "../lib/primitives/gradient";
import { CursorGlow } from "../lib/primitives";

export const PlaygroundGrid = () => {
  const { xPc, yPc, time, mounted } = usePointer({ lerp: 0.08 });
  const items = [...playground].sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <div
      className="min-h-screen relative"
      style={mounted ? colourField(xPc, yPc, time, 6) : undefined}
    >
      {mounted && <CursorGlow size={400} blur={40} opacity={0.04} />}
      <SiteNav />

      <header className="px-6 pt-16 pb-8 text-center">
        <h1 className="text-3xl sm:text-4xl font-light tracking-tight text-white/90">
          Playground
        </h1>
        <p className="mt-3 text-sm text-white/45 font-mono tracking-wide">
          Visual experiments — not for production.
        </p>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pb-24">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <ComponentCard key={item.slug} item={item} />
          ))}
        </div>
      </main>
    </div>
  );
};
