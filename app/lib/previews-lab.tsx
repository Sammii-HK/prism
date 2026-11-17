"use client";
/**
 * Card previews for the Interaction Lab components. These components are
 * larger than a card, so several previews are small specimens: a quiet,
 * static picture of the idea rather than the full working piece.
 */
import { Copy, Pencil, Share2, Trash2 } from "lucide-react";
import { AsyncButton } from "./components/async-button";
import { RadialMenu } from "./components/radial-menu";
import { ComposedCard, compose } from "./components/token-compose";

const Frame = ({ children }: { children: React.ReactNode }) => (
  <div className="flex h-full w-full items-center justify-center px-4 py-6">{children}</div>
);

const Mono = ({ children }: { children: React.ReactNode }) => (
  <span className="font-mono text-[10px] tracking-wide text-white/50">{children}</span>
);

export const AsyncButtonPreview = () => (
  <Frame>
    <AsyncButton onPress={() => new Promise((resolve) => setTimeout(resolve, 900))} />
  </Frame>
);

export const RadialMenuPreview = () => (
  <Frame>
    <RadialMenu
      label="Actions"
      radius={56}
      items={[
        { id: "edit", label: "Edit", icon: <Pencil size={14} /> },
        { id: "copy", label: "Copy", icon: <Copy size={14} /> },
        { id: "share", label: "Share", icon: <Share2 size={14} /> },
        { id: "delete", label: "Delete", icon: <Trash2 size={14} /> },
      ]}
    />
  </Frame>
);

/** Three easing curves on one axis: the comparison the experiment measures. */
export const MotionComparePreview = () => (
  <Frame>
    <svg viewBox="0 0 200 96" className="w-52" aria-hidden="true">
      <path d="M10 84 C 70 84, 90 12, 190 12" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.25" />
      <path d="M10 84 C 40 84, 60 4, 110 6 S 160 14, 190 12" fill="none" stroke="rgb(196 210 255)" strokeWidth="1.5" />
      <path d="M10 84 L 190 12" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1" strokeDasharray="3 4" />
      <line x1="10" y1="12" x2="190" y2="12" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
    </svg>
  </Frame>
);

/** The three thresholds the component switches between while waiting. */
export const LatencyAdaptPreview = () => (
  <Frame>
    <div className="w-52">
      <div className="relative h-1 rounded-full bg-white/[0.06]">
        <div className="absolute inset-y-0 left-0 w-[62%] rounded-full bg-gradient-to-r from-white/20 to-[rgb(255_214_170)]" />
        {[0, 22, 62].map((left) => (
          <span key={left} className="absolute -top-1 h-3 w-px bg-white/40" style={{ left: `${left}%` }} />
        ))}
      </div>
      <div className="mt-3 flex justify-between">
        <Mono>0 ms</Mono>
        <Mono>skeleton</Mono>
        <Mono>still working…</Mono>
      </div>
    </div>
  </Frame>
);

export const TokenComposePreview = () => (
  <div className="flex h-full w-full items-center justify-center overflow-hidden px-4 py-4">
    <div className="w-56 origin-center scale-[0.72]">
      <ComposedCard c={compose(7)} />
    </div>
  </div>
);

/** A dialog with the trail focus took to reach it and the way back. */
export const FocusTrailPreview = () => (
  <Frame>
    <div className="relative h-24 w-52">
      <div className="absolute bottom-0 left-0 rounded-md border border-white/20 px-2 py-1">
        <Mono>Open</Mono>
      </div>
      <svg className="absolute inset-0" viewBox="0 0 208 96" aria-hidden="true">
        <path d="M30 76 C 40 40, 80 30, 108 30" fill="none" stroke="rgb(200 230 210)" strokeWidth="1.25" strokeDasharray="2 4" />
      </svg>
      <div className="absolute right-0 top-0 w-28 rounded-lg border border-white/15 bg-white/[0.04] p-2.5 shadow-[0_0_0_3px_rgba(200,230,210,0.25)]">
        <div className="h-1.5 w-14 rounded bg-white/40" />
        <div className="mt-1.5 h-1.5 w-20 rounded bg-white/15" />
        <div className="mt-3 flex justify-end">
          <div className="h-3 w-8 rounded border border-white/25" />
        </div>
      </div>
    </div>
  </Frame>
);

export const CommandPalettePreview = () => (
  <Frame>
    <div className="w-56 overflow-hidden rounded-xl border border-white/[0.12] bg-[#0b0b0b]">
      <div className="flex items-center justify-between border-b border-white/[0.08] px-3 py-2">
        <span className="text-[11px] text-white/50">Search commands…</span>
        <span className="rounded border border-white/15 px-1 font-mono text-[9px] text-white/60">⌘K</span>
      </div>
      {["New file", "Toggle theme", "Go to settings"].map((label, i) => (
        <div
          key={label}
          className={`px-3 py-1.5 text-[11px] ${i === 0 ? "bg-white/[0.06] text-white/90" : "text-white/55"}`}
        >
          {label}
        </div>
      ))}
    </div>
  </Frame>
);

export const labPreviewMap: Record<string, React.ComponentType> = {
  "async-button": AsyncButtonPreview,
  "radial-menu": RadialMenuPreview,
  "motion-compare": MotionComparePreview,
  "latency-adapt": LatencyAdaptPreview,
  "token-compose": TokenComposePreview,
  "focus-trail": FocusTrailPreview,
  "command-palette": CommandPalettePreview,
};
