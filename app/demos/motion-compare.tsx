"use client";
import { useState } from "react";
import { MotionCompare } from "../lib/components/motion-compare";
import { useSystemReducedMotion } from "../lib/components/async-button";

export default function MotionCompareDemo() {
  const [forceReduced, setForceReduced] = useState(false);
  const systemReduced = useSystemReducedMotion();

  return (
    <div className="min-h-screen px-6 py-16" style={{ background: "#050505" }}>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <p className="text-xs uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.25)" }}>
          motion-compare
        </p>
        <MotionCompare reducedMotion={forceReduced ? true : undefined} />
        <label className="flex items-center gap-2 text-sm text-white/70">
          <input type="checkbox" checked={forceReduced} onChange={(e) => setForceReduced(e.target.checked)} />
          Preview reduced motion
          <span className="text-white/30">(system setting: {systemReduced ? "on" : "off"})</span>
        </label>
        <p className="max-w-xl text-xs italic leading-relaxed" style={{ color: "rgba(255,255,255,0.3)" }}>
          Every number is read in this browser during the run, from the dot&apos;s rendered position in each
          requestAnimationFrame. Frame gaps follow your display refresh and whatever else the page is doing, so
          they say little about the cost of each approach in isolation. Run it a few times; the values move.
        </p>
      </div>
    </div>
  );
}
