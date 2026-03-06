"use client";
import { MagneticButton } from "../lib/components";
import { usePointer } from "../lib/hooks/use-pointer";
import { colourField } from "../lib/primitives/gradient";

export default function MagneticButtonDemo() {
  const { xPc, yPc, time, mounted } = usePointer({ lerp: 0.08 });

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center gap-12 px-8"
      style={{ top: "41px", ...(mounted ? colourField(xPc, yPc, time, 6) : {}) }}
    >
      {/* Hero row */}
      <div className="flex flex-wrap gap-4 justify-center">
        <MagneticButton className="px-8 py-4 text-base">
          Get started
        </MagneticButton>
        <MagneticButton className="px-8 py-4 text-base" strength={50}>
          Strong pull
        </MagneticButton>
        <MagneticButton className="px-8 py-4 text-base" radius={300} strength={20}>
          Wide radius
        </MagneticButton>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 max-w-2xl w-full">
        {["Save", "Cancel", "Delete", "Edit", "Share", "Copy", "Export", "Search", "Filter", "Undo"].map((label) => (
          <MagneticButton key={label} className="px-4 py-3">
            {label}
          </MagneticButton>
        ))}
      </div>

      {/* Small dense cluster */}
      <div className="flex flex-wrap gap-2 justify-center max-w-md">
        {["xs", "sm", "md", "lg", "xl", "2xl"].map((size) => (
          <MagneticButton key={size} className="px-3 py-1.5 text-xs" radius={120} strength={25}>
            {size}
          </MagneticButton>
        ))}
      </div>
    </div>
  );
}
