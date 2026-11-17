"use client";
import Link from "next/link";
import { SpotlightCard } from "../lib/primitives";
import { SHOWCASES, type ShowcaseSlug } from "./showcase-frame";

/** Quiet static art for each showcase card: a hint of the product, not a screenshot. */
const Art = ({ slug }: { slug: ShowcaseSlug }) => {
  if (slug === "darkroom") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src="/showcase/flowerscape-1.jpg"
        alt=""
        className="h-full w-full object-cover opacity-90 [filter:sepia(0.28)_saturate(0.9)]"
        loading="lazy"
      />
    );
  }
  if (slug === "console") {
    const steps = ["Build", "Test", "Deploy", "Verify"];
    return (
      <div className="flex h-full w-full flex-col justify-center gap-3 px-8">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-3">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: i < 3 ? "rgb(170 230 196)" : "rgb(255 214 170)", boxShadow: i < 3 ? "0 0 10px rgb(170 230 196)" : "0 0 10px rgb(255 214 170)" }}
            />
            <span className="w-16 font-mono text-[11px] text-white/60">{s}</span>
            <span className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
              <span className="block h-full rounded-full bg-white/30" style={{ width: i < 3 ? "100%" : "46%" }} />
            </span>
          </div>
        ))}
      </div>
    );
  }
  return (
    <svg viewBox="0 0 320 180" className="h-full w-full" aria-hidden="true">
      <defs>
        <linearGradient id="synth-wave" x1="0" x2="1">
          <stop offset="0" stopColor="rgb(196 210 255)" />
          <stop offset="0.5" stopColor="rgb(240 200 225)" />
          <stop offset="1" stopColor="rgb(255 214 170)" />
        </linearGradient>
      </defs>
      <path
        d={Array.from({ length: 161 }, (_, i) => {
          const x = i * 2;
          const y = 90 + Math.sin(i / 7) * 34 * Math.exp(-((i - 80) ** 2) / 3200) + Math.sin(i / 2.3) * 6;
          return `${i ? "L" : "M"}${x} ${y.toFixed(1)}`;
        }).join("")}
        fill="none"
        stroke="url(#synth-wave)"
        strokeWidth="2"
      />
    </svg>
  );
};

export const ShowcaseCards = ({ headingLevel = 3 }: { headingLevel?: 2 | 3 }) => {
  const H = headingLevel === 2 ? "h2" : "h3";
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {SHOWCASES.map((s) => (
        <SpotlightCard key={s.slug} className="group relative flex flex-col rounded-2xl bg-white/[0.025] p-3">
          <div aria-hidden="true" className="relative h-48 overflow-hidden rounded-xl border border-white/[0.05] bg-[#060606]">
            <Art slug={s.slug} />
          </div>
          <div className="px-2 pb-2 pt-4">
            <H className="text-lg font-light text-white/90">
              <Link
                href={`/showcase/${s.slug}`}
                className="outline-none after:absolute after:inset-0 after:rounded-2xl after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-white/60"
              >
                {s.title}
              </Link>
            </H>
            <p className="mt-1.5 text-[13px] leading-relaxed text-white/55">{s.pitch}</p>
          </div>
        </SpotlightCard>
      ))}
    </div>
  );
};
