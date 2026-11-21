"use client";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { EXPRESSIONS } from "../expressions/store";
import { Button, ExpressionScope, Slider, Switch } from "../ui";
import { LAYERS, toggleXray, useXray } from "../xray/store";
import { Eyebrow, SectionHeading } from "./ui";

/**
 * The home page's look under the surface: one piece of state drawn three
 * times, once per expression, so moving any control moves all three and the
 * difference between the techniques is something you feel rather than read.
 */
export const ExpressionsTeaser = () => {
  const [volume, setVolume] = useState(64);
  const [digest, setDigest] = useState(true);

  return (
    <>
      <SectionHeading
        eyebrow="Expressions"
        title="One API, three ways to build it"
        aside={
          <Link href="/expressions" className="transition-colors hover:text-white">
            See it in depth <ArrowRight size={14} aria-hidden="true" className="inline-block align-middle" />
          </Link>
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        {EXPRESSIONS.map((e) => (
          <section key={e.id} aria-label={`${e.label}: ${e.technique}`} className="flex flex-col rounded-2xl border border-white/[0.08] bg-[#080808] p-6">
            <div className="mb-7 flex items-baseline justify-between gap-3">
              <h3 className="text-[15px] text-white/90">{e.label}</h3>
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/45">{e.technique}</span>
            </div>
            <ExpressionScope expression={e.id}>
              <div className="grid gap-6">
                <Switch label="Daily digest" checked={digest} onChange={setDigest} />
                <Slider label="Volume" value={volume} onChange={setVolume} />
                <div>
                  <Button>Save changes</Button>
                </div>
              </div>
            </ExpressionScope>
          </section>
        ))}
      </div>
      <p className="mt-5 max-w-2xl text-[13px] leading-relaxed text-white/50">
        One state drives all three. Drag any slider and watch each technique arrive: a spring integrated every frame, the
        same spring compiled to CSS, and no easing at all.
      </p>
    </>
  );
};

/** An invitation to turn X-ray on, with the layers it draws. */
export const XrayInvite = () => {
  const { on } = useXray();
  return (
    <div className="grid gap-8 rounded-3xl border border-white/[0.08] bg-white/[0.02] p-8 sm:p-12 lg:grid-cols-[1.2fr_1fr] lg:items-end">
      <div>
        <Eyebrow>X-ray</Eyebrow>
        <p className="mt-6 max-w-2xl text-[28px] font-light leading-[1.12] tracking-[-0.02em] text-white/90 sm:text-[40px]">
          See the engineering under every component.
        </p>
        <p className="mt-6 max-w-xl text-sm leading-relaxed text-white/55">
          Turn it on anywhere on the site, or press <kbd className="font-mono text-white/75">⌥X</kbd>. Everything stays
          usable while it draws over the page.
        </p>
        <div className="mt-8">
          <button
            type="button"
            aria-pressed={on}
            onClick={() => toggleXray()}
            className="inline-flex items-center gap-2 rounded-xl border border-white/[0.14] bg-white/[0.06] px-5 py-3 text-sm text-white/90 transition-colors hover:border-white/[0.22] hover:bg-white/[0.09] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${on ? "bg-[#86efac] shadow-[0_0_8px_#86efac]" : "bg-white/30"}`} />
            {on ? "Turn X-ray off" : "Turn on X-ray"}
          </button>
        </div>
      </div>
      <ul className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
        {LAYERS.map((l) => (
          <li key={l.id} className="border-t border-white/[0.08] pt-3">
            <p className="text-[13px] text-white/80">{l.label}</p>
            <p className="mt-1 text-[12px] leading-relaxed text-white/45">{l.hint}</p>
          </li>
        ))}
      </ul>
    </div>
  );
};
