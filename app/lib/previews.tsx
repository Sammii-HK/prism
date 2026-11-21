"use client";
/**
 * Card-sized previews for gallery listings. Each preview is a tiny, live
 * render of the component — not the full demo page. Kept intentionally
 * small so a grid of 20+ stays responsive.
 */

import { useState } from "react";
import {
  AnimatedBorder,
  Avatar,
  FloatingDock,
  GlowBadge,
  GlowCheckbox,
  GlowInput,
  GlowSelect,
  GlowSlider,
  GlowTextarea,
  HoverReveal,
  IconButton,
  MorphTabs,
  ProgressBar,
  PulseDot,
  RippleButton,
  Skeleton,
  SpringToggle,
  SpotlightCard,
  Tooltip,
} from "./components";
import { Heart, Home, Search, Settings, User, GripVertical } from "lucide-react";

const Frame = ({ children }: { children: React.ReactNode }) => (
  <div className="w-full h-full flex items-center justify-center px-4 py-6 pointer-events-auto">
    {children}
  </div>
);

// --- Component previews -----------------------------------------------------

const AnimatedBorderPreview = () => (
  <Frame>
    <AnimatedBorder className="w-48">
      <div className="p-4">
        <p className="text-xs text-white/60">Animated</p>
        <p className="text-[10px] text-white/50 mt-1">Conic gradient</p>
      </div>
    </AnimatedBorder>
  </Frame>
);

const SpotlightCardPreview = () => (
  <Frame>
    <SpotlightCard className="bg-white/[0.03] p-4 w-48">
      <p className="text-xs text-white/60">Spotlight card</p>
      <p className="text-[10px] text-white/50 mt-1">Pastel border</p>
    </SpotlightCard>
  </Frame>
);

const GlowCheckboxPreview = () => {
  const [a, setA] = useState(true);
  const [b, setB] = useState(false);
  return (
    <Frame>
      <div className="flex flex-col gap-2.5">
        <GlowCheckbox checked={a} onChange={setA} label="Remember me" />
        <GlowCheckbox checked={b} onChange={setB} label="Subscribe" />
      </div>
    </Frame>
  );
};

const GlowSelectPreview = () => {
  const [v, setV] = useState("uk");
  return (
    <Frame>
      <div className="w-48">
        <GlowSelect
          label="Country"
          options={[
            { value: "uk", label: "United Kingdom" },
            { value: "us", label: "United States" },
            { value: "de", label: "Germany" },
          ]}
          value={v}
          onChange={setV}
        />
      </div>
    </Frame>
  );
};

const GlowInputPreview = () => {
  const [v, setV] = useState("");
  return (
    <Frame>
      <div className="w-48">
        <GlowInput label="Email" value={v} onChange={setV} />
      </div>
    </Frame>
  );
};

const GlowTextareaPreview = () => {
  const [v, setV] = useState("");
  return (
    <Frame>
      <div className="w-48">
        <GlowTextarea label="Notes" value={v} onChange={setV} rows={2} />
      </div>
    </Frame>
  );
};

const FloatingDockPreview = () => (
  <Frame>
    <FloatingDock
      iconSize={36}
      items={[
        { icon: <Home size={18} />, label: "Home" },
        { icon: <Search size={18} />, label: "Search" },
        { icon: <Settings size={18} />, label: "Settings" },
        { icon: <User size={18} />, label: "Profile" },
      ]}
    />
  </Frame>
);

const MorphTabsPreview = () => {
  const [i, setI] = useState(0);
  return (
    <Frame>
      <MorphTabs tabs={["Overview", "Analytics", "Settings"]} activeIndex={i} onChange={setI} />
    </Frame>
  );
};

const HoverRevealPreview = () => (
  <Frame>
    <div className="w-48 flex flex-col gap-1">
      <HoverReveal
        revealContent={<p className="text-[10px] text-white/50 pt-1">From $9/mo</p>}
      >
        <p className="text-xs text-white/60">Pricing</p>
      </HoverReveal>
      <HoverReveal
        revealContent={<p className="text-[10px] text-white/50 pt-1">Spring physics</p>}
      >
        <p className="text-xs text-white/60">Features</p>
      </HoverReveal>
    </div>
  </Frame>
);

const GlowBadgePreview = () => (
  <Frame>
    <div className="flex flex-wrap items-center justify-center gap-2">
      <GlowBadge>Active</GlowBadge>
      <GlowBadge variant="success">Shipped</GlowBadge>
      <GlowBadge variant="warning">Pending</GlowBadge>
    </div>
  </Frame>
);

const PulseDotPreview = () => (
  <Frame>
    <div className="flex items-center gap-5">
      <div className="flex items-center gap-2">
        <PulseDot size={8} />
        <span className="text-[11px] text-white/50">Online</span>
      </div>
      <div className="flex items-center gap-2">
        <PulseDot size={10} colour="#ff9b91" />
        <span className="text-[11px] text-white/50">Alert</span>
      </div>
    </div>
  </Frame>
);

const SpringTogglePreview = () => {
  const [a, setA] = useState(true);
  const [b, setB] = useState(false);
  return (
    <Frame>
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center gap-3">
          <SpringToggle checked={a} onChange={setA} />
          <span className="text-xs text-white/50">Notifications</span>
        </div>
        <div className="flex items-center gap-3">
          <SpringToggle checked={b} onChange={setB} />
          <span className="text-xs text-white/50">Dark mode</span>
        </div>
      </div>
    </Frame>
  );
};

const GlowSliderPreview = () => {
  const [v, setV] = useState(65);
  return (
    <Frame>
      <div className="w-48">
        <GlowSlider label="Volume" value={v} onChange={setV} showValue />
      </div>
    </Frame>
  );
};

const AvatarPreview = () => (
  <Frame>
    <div className="flex items-center gap-3">
      <Avatar fallback="SK" size={40} />
      <Avatar fallback="A" size={28} />
      <Avatar fallback="JD" size={48} />
    </div>
  </Frame>
);

const ProgressBarPreview = () => (
  <Frame>
    <div className="w-48 flex flex-col gap-3">
      <ProgressBar value={30} />
      <ProgressBar value={70} />
    </div>
  </Frame>
);

const SkeletonPreview = () => (
  <Frame>
    <div className="flex items-start gap-3">
      <Skeleton width={36} height={36} rounded="rounded-full" />
      <div className="flex flex-col gap-2">
        <Skeleton width={140} height={10} />
        <Skeleton width={100} height={10} />
      </div>
    </div>
  </Frame>
);

const IconButtonPreview = () => (
  <Frame>
    <div className="flex items-center gap-2">
      <IconButton size="sm"><Heart size={14} /></IconButton>
      <IconButton size="md"><Settings size={16} /></IconButton>
      <IconButton size="lg"><Home size={18} /></IconButton>
    </div>
  </Frame>
);

const RippleButtonPreview = () => (
  <Frame>
    <RippleButton>Click me</RippleButton>
  </Frame>
);

const TooltipPreview = () => (
  <Frame>
    <Tooltip content="Drag to reorder">
      <button className="px-4 py-2 rounded-xl bg-white/[0.06] border border-white/[0.12] text-white/60 text-xs">
        Hover me
      </button>
    </Tooltip>
  </Frame>
);

// Overlays are drawn open and still, so a gallery card never throws a real overlay over the page.

const panel = "rounded-xl border border-white/[0.12] bg-[#0b0b0b] shadow-[0_12px_32px_rgba(0,0,0,0.5)]";
const chip = "rounded-lg border border-white/[0.12] bg-white/[0.05] px-3 py-1.5 text-[11px] text-white/70";

const PopoverPreview = () => (
  <Frame>
    <div aria-hidden="true" className="flex flex-col items-start gap-2">
      <span className={chip}>Share</span>
      <div className={`${panel} w-44 p-3`} style={{ borderColor: "rgb(190 210 255 / 0.3)" }}>
        <div className="h-2 w-20 rounded bg-white/25" />
        <div className="mt-3 flex gap-1.5">
          <div className="h-6 flex-1 rounded-md bg-white/[0.06]" />
          <div className="h-6 w-10 rounded-md bg-white/[0.12]" />
        </div>
      </div>
    </div>
  </Frame>
);

const MenuPreview = () => (
  <Frame>
    <div aria-hidden="true" className="flex flex-col items-end gap-2">
      <span className={chip}>⋯</span>
      <div className={`${panel} relative w-40 p-1`}>
        {["Open", "Rename", "Duplicate"].map((l, i) => (
          <div key={l} className={`rounded-md px-2.5 py-1.5 text-[11px] ${i === 1 ? "bg-white/[0.09] text-white" : "text-white/60"}`}>
            {l}
          </div>
        ))}
        <div className="mx-2 my-1 h-px bg-white/[0.08]" />
        <div className="rounded-md px-2.5 py-1.5 text-[11px] text-[#fca5a5]">Move to trash</div>
      </div>
    </div>
  </Frame>
);

const DialogPreview = () => (
  <Frame>
    <div aria-hidden="true" className="relative flex h-32 w-full max-w-[220px] items-center justify-center rounded-xl bg-black/60">
      <div className={`${panel} w-40 p-3`}>
        <div className="h-2 w-24 rounded bg-white/30" />
        <div className="mt-2 h-1.5 w-32 rounded bg-white/10" />
        <div className="mt-4 flex justify-end gap-1.5">
          <div className="h-5 w-11 rounded-md bg-white/[0.08]" />
          <div className="h-5 w-11 rounded-md bg-[#fca5a5]/20" />
        </div>
      </div>
    </div>
  </Frame>
);

const SheetPreview = () => (
  <Frame>
    <div aria-hidden="true" className="relative h-32 w-full max-w-[220px] overflow-hidden rounded-xl bg-black/50">
      <div className="absolute inset-y-0 right-0 w-24 rounded-l-xl border-l border-white/[0.12] bg-[#0b0b0b] p-3">
        <div className="h-2 w-14 rounded bg-white/30" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="mt-3 flex items-center justify-between">
            <div className="h-1.5 w-10 rounded bg-white/15" />
            <div className={`h-3 w-5 rounded-full ${i === 1 ? "bg-white/10" : "bg-white/40"}`} />
          </div>
        ))}
      </div>
      <div className="absolute inset-y-0 right-[92px] my-auto h-6 w-0.5 rounded-full bg-white/25" />
    </div>
  </Frame>
);

const ToastPreview = () => (
  <Frame>
    <div aria-hidden="true" className="relative h-24 w-48">
      {[2, 1, 0].map((i) => (
        <div
          key={i}
          className={`${panel} absolute inset-x-0 bottom-0 flex items-center gap-2 px-3 py-2.5`}
          style={{ transform: `translateY(${-i * 9}px) scale(${1 - i * 0.05})`, opacity: i === 0 ? 1 : 0.7 - i * 0.15 }}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-[#86efac]" style={{ opacity: i === 0 ? 1 : 0 }} />
          <span className="text-[11px] text-white/80" style={{ opacity: i === 0 ? 1 : 0 }}>
            Saved
          </span>
        </div>
      ))}
    </div>
  </Frame>
);

const AIResponsePreview = () => (
  <Frame>
    <div aria-hidden="true" className="grid w-52 gap-2">
      <div className="ml-auto rounded-xl rounded-br-sm bg-white/[0.08] px-3 py-1.5 text-[10px] text-white/75">Which component confirms a delete?</div>
      <div className={`${panel} p-3`}>
        <div className="flex items-center gap-1.5 text-[10px] text-white/45">
          <span className="h-1.5 w-1.5 rounded-full bg-[#86efac]" /> Opened dialog
        </div>
        <div className="mt-2 h-1.5 w-36 rounded bg-white/25" />
        <div className="mt-1.5 flex items-center gap-1">
          <div className="h-1.5 w-24 rounded bg-white/15" />
          <span className="rounded px-1 font-mono text-[8px] text-white/60 ring-1 ring-white/20">1</span>
        </div>
      </div>
    </div>
  </Frame>
);

const SpringFieldPreview = () => (
  <Frame><div className="grid grid-cols-9 gap-3" aria-label="A field of spring dots">
    {Array.from({ length: 45 }, (_, i) => { const x = i % 9 - 4; const y = Math.floor(i / 9) - 2; const distance = Math.hypot(x, y); return <span key={i} className="h-1.5 w-1.5 rounded-full bg-violet-200" style={{ opacity: 0.25 + Math.min(distance, 4) * 0.15, transform: `translate(${x / (distance + 1) * 9}px, ${y / (distance + 1) * 9}px)` }} />; })}
  </div></Frame>
);
const ReadingRailPreview = () => (
  <Frame><div className="flex w-52 gap-4"><div className="w-1 shrink-0 rounded bg-white/10"><div className="h-14 rounded bg-emerald-200/60" /></div><div className="grid flex-1 gap-3">{[0,1,2].map((i) => <div className="grid gap-1.5" key={i}><div className="h-1.5 w-full rounded bg-white/25" /><div className="h-1.5 w-4/5 rounded bg-white/15" /><div className="h-1.5 w-3/5 rounded bg-white/10" /></div>)}</div></div></Frame>
);
const FlipReorderPreview = () => (
  <Frame><div className="grid w-52 gap-2">{['Write the explainer','Record the demo','Check keyboard paths'].map((text, i) => <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-[10px] ${i === 1 ? 'border-violet-200/40 bg-violet-200/10' : 'border-white/10 bg-white/[0.03]'}`} key={text}><GripVertical size={12} aria-hidden="true" className="text-white/40" /><span className="text-white/70">{text}</span></div>)}</div></Frame>
);

export const previewMap: Record<string, React.ComponentType> = {
  // Components
  "spring-field": SpringFieldPreview,
  "reading-rail": ReadingRailPreview,
  "flip-reorder": FlipReorderPreview,
  "animated-border": AnimatedBorderPreview,
  "avatar": AvatarPreview,
  "glow-checkbox": GlowCheckboxPreview,
  "glow-input": GlowInputPreview,
  "glow-select": GlowSelectPreview,
  "glow-slider": GlowSliderPreview,
  "glow-textarea": GlowTextareaPreview,
  "icon-button": IconButtonPreview,
  "spotlight-card": SpotlightCardPreview,
  "ripple-button": RippleButtonPreview,
  "tooltip": TooltipPreview,
  "popover": PopoverPreview,
  "menu": MenuPreview,
  "dialog": DialogPreview,
  "sheet": SheetPreview,
  "toast": ToastPreview,
  "ai-response": AIResponsePreview,
  "floating-dock": FloatingDockPreview,
  "spring-toggle": SpringTogglePreview,
  "hover-reveal": HoverRevealPreview,
  "morph-tabs": MorphTabsPreview,
  "skeleton": SkeletonPreview,
  "glow-badge": GlowBadgePreview,
  "progress-bar": ProgressBarPreview,
  "pulse-dot": PulseDotPreview,
  // Playground
};
