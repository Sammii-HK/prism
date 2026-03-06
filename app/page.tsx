"use client";
import Link from "next/link";
import { experiments } from "./lib/registry";
import { usePointer } from "./lib/hooks/use-pointer";
import { colourField } from "./lib/primitives/gradient";
import { SpotlightCard, CursorGlow } from "./lib/primitives";

export default function Gallery() {
  const { xPc, yPc, time, mounted } = usePointer({ lerp: 0.08 });

  return (
    <div
      className="min-h-screen relative"
      style={mounted ? colourField(xPc, yPc, time, 8) : undefined}
    >
      {mounted && <CursorGlow size={400} blur={40} opacity={0.05} />}

      <header className="pt-16 pb-12 px-6 text-center">
        <h1 className="text-4xl sm:text-5xl font-light tracking-tight text-white/90">
          Prism
        </h1>
        <p className="mt-3 text-sm text-white/40 font-mono tracking-wide">
          Visual experiments by Sammii
        </p>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 pb-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {experiments.map((exp) => (
            <Link key={exp.slug} href={`/${exp.slug}`}>
              <SpotlightCard className="bg-white/[0.03] backdrop-blur-sm p-5 cursor-pointer group h-full flex flex-col">
                <div className="flex items-baseline justify-between mb-3">
                  <h2 className="text-lg font-light text-white/80 group-hover:text-white transition-colors">
                    {exp.title}
                  </h2>
                  <span className="text-[10px] font-mono text-white/25">
                    {exp.date}
                  </span>
                </div>
                <p className="text-xs text-white/35 leading-relaxed flex-1">
                  {exp.description}
                </p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {exp.tech.map((t) => (
                    <span
                      key={t}
                      className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-white/5 text-white/30"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </SpotlightCard>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
