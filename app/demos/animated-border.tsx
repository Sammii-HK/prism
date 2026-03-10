"use client";
import { AnimatedBorder } from "../lib/components/animated-border";

export default function AnimatedBorderDemo() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#050505]">
      <AnimatedBorder borderWidth={2} borderRadius={20}>
        <div className="px-14 py-12 flex flex-col gap-3 max-w-md">
          <h2 className="text-white/90 text-xl font-medium tracking-tight">
            Animated border
          </h2>
          <p className="text-white/40 text-sm leading-relaxed font-light">
            A rotating conic gradient border whose colours shift with your
            cursor position. Every spot on screen produces a unique palette.
          </p>
        </div>
      </AnimatedBorder>
    </div>
  );
}
