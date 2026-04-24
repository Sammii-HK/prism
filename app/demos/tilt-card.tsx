"use client";
import { TiltCard } from "../lib/components";

export default function TiltCardDemo() {
  return (
    <div className="fixed inset-0 flex items-center justify-center gap-8 bg-[#050505]">
      {/* Card 1: Heading + paragraph */}
      <TiltCard className="w-[300px] p-8">
        <h2 className="text-lg font-semibold text-white/90 tracking-tight mb-3">
          Spring physics
        </h2>
        <p className="text-sm text-white/50 leading-relaxed">
          Every interaction is driven by spring equations. No CSS transitions,
          no easing curves. Just stiffness, damping, and velocity.
        </p>
      </TiltCard>

      {/* Card 2: Icon + label */}
      <TiltCard className="w-[300px] p-8 flex flex-col items-center text-center" tiltMax={2}>
        <div className="w-14 h-14 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center mb-4">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-white/60"
          >
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        </div>
        <span className="text-sm font-medium text-white/80 tracking-tight">
          Cursor reactive
        </span>
        <span className="text-xs text-white/40 mt-1">
          Colour mapped to pointer position
        </span>
      </TiltCard>

      {/* Card 3: Stats */}
      <TiltCard className="w-[300px] p-8" glowIntensity={0.6}>
        <div className="space-y-5">
          <div>
            <div className="text-2xl font-semibold text-white/90 tracking-tight">
              120
            </div>
            <div className="text-xs text-white/40 mt-0.5">Spring stiffness</div>
          </div>
          <div>
            <div className="text-2xl font-semibold text-white/90 tracking-tight">
              18
            </div>
            <div className="text-xs text-white/40 mt-0.5">Damping coefficient</div>
          </div>
          <div>
            <div className="text-2xl font-semibold text-white/90 tracking-tight">
              3&deg;
            </div>
            <div className="text-xs text-white/40 mt-0.5">Maximum tilt angle</div>
          </div>
        </div>
      </TiltCard>
    </div>
  );
}
