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
  FluidTooltip,
  GlowBadge,
  GlowCheckbox,
  GlowInput,
  GlowSelect,
  GlowSlider,
  GlowTextarea,
  HoverReveal,
  IconButton,
  MagneticButton,
  MorphTabs,
  ProgressBar,
  PulseDot,
  RippleButton,
  ShimmerText,
  Skeleton,
  SpringToggle,
  TiltCard,
  SpotlightCard,
} from "./components";
import { Heart, Home, Search, Settings, User } from "lucide-react";

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
        <p className="text-[10px] text-white/30 mt-1">Conic gradient</p>
      </div>
    </AnimatedBorder>
  </Frame>
);

const MagneticButtonPreview = () => (
  <Frame>
    <MagneticButton>Magnetic</MagneticButton>
  </Frame>
);

const SpotlightCardPreview = () => (
  <Frame>
    <SpotlightCard className="bg-white/[0.03] p-4 w-48">
      <p className="text-xs text-white/60">Spotlight card</p>
      <p className="text-[10px] text-white/30 mt-1">Pastel border</p>
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

const TiltCardPreview = () => (
  <Frame>
    <TiltCard className="w-48">
      <div className="p-4">
        <p className="text-xs text-white/60">Tilt card</p>
        <p className="text-[10px] text-white/30 mt-1">Perspective tilt</p>
      </div>
    </TiltCard>
  </Frame>
);

const FluidTooltipPreview = () => (
  <Frame>
    <FluidTooltip content="Drag to reorder">
      <button className="px-4 py-2 rounded-xl bg-white/[0.06] border border-white/[0.12] text-white/60 text-xs">
        Hover me
      </button>
    </FluidTooltip>
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
        revealContent={<p className="text-[10px] text-white/35 pt-1">From $9/mo</p>}
      >
        <p className="text-xs text-white/60">Pricing</p>
      </HoverReveal>
      <HoverReveal
        revealContent={<p className="text-[10px] text-white/35 pt-1">Spring physics</p>}
      >
        <p className="text-xs text-white/60">Features</p>
      </HoverReveal>
    </div>
  </Frame>
);

const ShimmerTextPreview = () => (
  <Frame>
    <div className="flex flex-col items-center gap-1">
      <ShimmerText className="text-lg font-light text-white/80">
        Design engineering
      </ShimmerText>
      <ShimmerText className="text-[11px] text-white/45" speed={0.7}>
        Components with soul
      </ShimmerText>
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

// --- Playground previews ----------------------------------------------------
// Playground items are full-canvas experiments. Render in a contained box.

import dynamic from "next/dynamic";

const ColourFieldPlayground = dynamic(() => import("../playground/colour-field"), { ssr: false });
const FluidMeshPlayground = dynamic(() => import("../playground/fluid-mesh"), { ssr: false });
const TextDissolvePlayground = dynamic(() => import("../playground/text-dissolve"), { ssr: false });
const GravityWellsPlayground = dynamic(() => import("../playground/gravity-wells"), { ssr: false });
const ShaderMarblingPlayground = dynamic(() => import("../playground/shader-marbling"), { ssr: false });

const PlaygroundFrame = ({ children }: { children: React.ReactNode }) => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">{children}</div>
);

const ColourFieldPreview = () => (
  <PlaygroundFrame><ColourFieldPlayground /></PlaygroundFrame>
);
const FluidMeshPreview = () => (
  <PlaygroundFrame><FluidMeshPlayground /></PlaygroundFrame>
);
const TextDissolvePreview = () => (
  <PlaygroundFrame><TextDissolvePlayground /></PlaygroundFrame>
);
const GravityWellsPreview = () => (
  <PlaygroundFrame><GravityWellsPlayground /></PlaygroundFrame>
);
const ShaderMarblingPreview = () => (
  <PlaygroundFrame><ShaderMarblingPlayground /></PlaygroundFrame>
);

export const previewMap: Record<string, React.ComponentType> = {
  // Components
  "animated-border": AnimatedBorderPreview,
  "avatar": AvatarPreview,
  "glow-checkbox": GlowCheckboxPreview,
  "glow-input": GlowInputPreview,
  "glow-select": GlowSelectPreview,
  "glow-slider": GlowSliderPreview,
  "glow-textarea": GlowTextareaPreview,
  "icon-button": IconButtonPreview,
  "magnetic-button": MagneticButtonPreview,
  "spotlight-card": SpotlightCardPreview,
  "ripple-button": RippleButtonPreview,
  "floating-dock": FloatingDockPreview,
  "fluid-tooltip": FluidTooltipPreview,
  "spring-toggle": SpringTogglePreview,
  "tilt-card": TiltCardPreview,
  "hover-reveal": HoverRevealPreview,
  "morph-tabs": MorphTabsPreview,
  "shimmer-text": ShimmerTextPreview,
  "skeleton": SkeletonPreview,
  "glow-badge": GlowBadgePreview,
  "progress-bar": ProgressBarPreview,
  "pulse-dot": PulseDotPreview,
  // Playground
  "colour-field": ColourFieldPreview,
  "fluid-mesh": FluidMeshPreview,
  "text-dissolve": TextDissolvePreview,
  "gravity-wells": GravityWellsPreview,
  "shader-marbling": ShaderMarblingPreview,
};
