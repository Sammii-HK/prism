"use client";
import { FluidTooltip } from "../lib/components";

export default function FluidTooltipDemo() {
  return (
    <div className="fixed inset-0 flex items-center justify-center gap-16 bg-[#050505]">
      <FluidTooltip content="Save your progress">
        <button className="rounded-xl bg-white/[0.06] border border-white/[0.12] text-white/80 font-medium tracking-tight px-8 py-4 cursor-pointer hover:text-white select-none">
          Save
        </button>
      </FluidTooltip>

      <FluidTooltip content="3 new notifications">
        <span className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] border border-white/[0.12] text-white/70 text-sm font-medium px-5 py-2 select-none">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          Inbox
        </span>
      </FluidTooltip>

      <FluidTooltip content="Opens in new tab">
        <span className="text-white/50 text-sm underline underline-offset-4 decoration-white/20 cursor-pointer hover:text-white/80 select-none">
          View documentation
        </span>
      </FluidTooltip>
    </div>
  );
}
