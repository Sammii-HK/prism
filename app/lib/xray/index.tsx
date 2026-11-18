"use client";
import { XrayOverlay } from "./overlay";
import { XrayPanel } from "./panel";
import { toggleXray, useXray } from "./store";

/**
 * X-ray mode: flip it on anywhere on the site (⌥X, the nav button, or
 * `?xray=1`) to see the engineering under the surface: the attention point,
 * spring traces with overshoot and settle time, hit targets, focus order,
 * roles and names, and contrast. It only observes; nothing is retuned.
 */
export const Xray = () => {
  const { on } = useXray();
  if (!on) return null;
  return (
    <>
      <XrayOverlay />
      <XrayPanel />
    </>
  );
};

/** The nav switch for X-ray mode. */
export const XrayToggle = () => {
  const { on } = useXray();
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => toggleXray()}
      title="X-ray mode (⌥X): see the engineering under every component"
      className={`flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 font-mono text-[11px] uppercase tracking-[0.18em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${
        on ? "border-[#86efac]/50 text-white" : "border-white/[0.1] text-white/55 hover:border-white/25 hover:text-white/85"
      }`}
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${on ? "bg-[#86efac] shadow-[0_0_8px_#86efac]" : "bg-white/35"}`}
      />
      X-ray
    </button>
  );
};
