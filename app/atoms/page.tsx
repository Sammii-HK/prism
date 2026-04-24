"use client";
import { useState } from "react";
import { usePointer } from "../lib/hooks/use-pointer";
import { colourField } from "../lib/primitives/gradient";
import { CursorGlow } from "../lib/primitives";
import { MagneticButton } from "../lib/components/magnetic-button";
import { RippleButton } from "../lib/components/ripple-button";
import { SpotlightCard } from "../lib/primitives/spotlight-card";
import { TiltCard } from "../lib/components/tilt-card";
import { AnimatedBorder } from "../lib/components/animated-border";
import { GlowInput } from "../lib/components/glow-input";
import { SpringToggle } from "../lib/components/spring-toggle";
import { MorphTabs } from "../lib/components/morph-tabs";
import { FloatingDock } from "../lib/components/floating-dock";
import { FluidTooltip } from "../lib/components/fluid-tooltip";
import { ShimmerText } from "../lib/components/shimmer-text";
import { GlowBadge } from "../lib/components/glow-badge";
import { PulseDot } from "../lib/components/pulse-dot";
import { HoverReveal } from "../lib/components/hover-reveal";
import { GlowCheckbox } from "../lib/components/glow-checkbox";
import { GlowSelect } from "../lib/components/glow-select";
import { GlowTextarea } from "../lib/components/glow-textarea";
import { GlowSlider } from "../lib/components/glow-slider";
import { Avatar } from "../lib/components/avatar";
import { ProgressBar } from "../lib/components/progress-bar";
import { Skeleton } from "../lib/components/skeleton";
import { IconButton } from "../lib/components/icon-button";
import { X, Heart, Settings, Plus, Home, Search, BarChart3, User } from "lucide-react";

const Section = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <section className="flex flex-col gap-4">
    <p
      className="text-[10px] tracking-[0.2em] uppercase select-none"
      style={{ color: "rgba(255,255,255,0.25)" }}
    >
      {title}
    </p>
    <div className="flex flex-wrap items-center gap-6">{children}</div>
  </section>
);

export default function AtomsPage() {
  const { xPc, yPc, time, mounted } = usePointer({ lerp: 0.08 });

  // Form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("hunter2");
  const [toggleA, setToggleA] = useState(false);
  const [toggleB, setToggleB] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [checkA, setCheckA] = useState(false);
  const [checkB, setCheckB] = useState(true);
  const [country, setCountry] = useState("");
  const [bio, setBio] = useState("");
  const [volume, setVolume] = useState(65);

  return (
    <div
      className="min-h-screen relative"
      style={mounted ? colourField(xPc, yPc, time, 5) : undefined}
    >
      {mounted && <CursorGlow size={400} blur={40} opacity={0.04} />}

      <header className="pt-16 pb-8 px-6 text-center">
        <h1 className="text-4xl font-light tracking-tight text-white/90">
          Atoms
        </h1>
        <p className="mt-2 text-sm text-white/30 font-mono tracking-wide">
          Every base component in the design system
        </p>
      </header>

      <main className="max-w-4xl mx-auto px-6 pb-24 flex flex-col gap-16">
        {/* --- Buttons --- */}
        <Section title="Buttons">
          <MagneticButton>Magnetic</MagneticButton>
          <RippleButton>Ripple</RippleButton>
        </Section>

        {/* --- Cards --- */}
        <Section title="Cards">
          <SpotlightCard className="bg-white/[0.03] p-6 w-64">
            <p className="text-sm text-white/60">Spotlight card</p>
            <p className="text-xs text-white/30 mt-2">
              Cursor-reactive pastel border
            </p>
          </SpotlightCard>
          <TiltCard className="w-64">
            <div className="p-6">
              <p className="text-sm text-white/60">Tilt card</p>
              <p className="text-xs text-white/30 mt-2">
                Perspective tilt toward cursor
              </p>
            </div>
          </TiltCard>
          <AnimatedBorder className="w-64">
            <div className="p-6">
              <p className="text-sm text-white/60">Animated border</p>
              <p className="text-xs text-white/30 mt-2">
                Rotating conic gradient
              </p>
            </div>
          </AnimatedBorder>
        </Section>

        {/* --- Form controls --- */}
        <Section title="Form controls">
          <div className="w-72 flex flex-col gap-4">
            <GlowInput
              label="Email address"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={setEmail}
            />
            <GlowInput
              label="Password"
              type="password"
              value={password}
              onChange={setPassword}
              error="Incorrect password"
            />
          </div>
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <SpringToggle checked={toggleA} onChange={setToggleA} />
              <span className="text-sm text-white/50">Notifications</span>
            </div>
            <div className="flex items-center gap-3">
              <SpringToggle checked={toggleB} onChange={setToggleB} />
              <span className="text-sm text-white/50">Dark mode</span>
            </div>
            <div className="flex items-center gap-3">
              <SpringToggle checked={false} onChange={() => {}} disabled />
              <span className="text-sm text-white/30">Disabled</span>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <GlowCheckbox checked={checkA} onChange={setCheckA} label="Remember me" />
            <GlowCheckbox checked={checkB} onChange={setCheckB} label="I agree to terms" />
            <GlowCheckbox checked={false} onChange={() => {}} label="Disabled" disabled />
          </div>
        </Section>

        {/* --- Selects & textareas --- */}
        <Section title="Select & textarea">
          <div className="w-72 flex flex-col gap-5">
            <GlowSelect
              label="Country"
              placeholder="Choose one"
              options={[
                { value: "uk", label: "United Kingdom" },
                { value: "us", label: "United States" },
                { value: "de", label: "Germany" },
                { value: "jp", label: "Japan" },
              ]}
              value={country}
              onChange={setCountry}
            />
            <GlowTextarea
              label="Bio"
              placeholder="Tell us about yourself"
              value={bio}
              onChange={setBio}
              rows={3}
            />
          </div>
        </Section>

        {/* --- Sliders --- */}
        <Section title="Sliders">
          <div className="w-full max-w-sm">
            <GlowSlider
              label="Volume"
              value={volume}
              onChange={setVolume}
              showValue
            />
          </div>
        </Section>

        {/* --- Navigation --- */}
        <Section title="Navigation">
          <div className="w-full max-w-md">
            <MorphTabs
              tabs={["Overview", "Analytics", "Settings", "Billing"]}
              activeIndex={activeTab}
              onChange={setActiveTab}
            />
          </div>
        </Section>

        {/* --- Feedback --- */}
        <Section title="Feedback">
          <FluidTooltip content="Save your progress">
            <button className="px-4 py-2 rounded-xl bg-white/[0.06] border border-white/[0.12] text-white/60 text-sm">
              Hover me
            </button>
          </FluidTooltip>
          <div className="flex items-center gap-4">
            <GlowBadge>Active</GlowBadge>
            <GlowBadge variant="success">Shipped</GlowBadge>
            <GlowBadge variant="warning">Pending</GlowBadge>
            <GlowBadge variant="error">Failed</GlowBadge>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <PulseDot size={8} />
              <span className="text-xs text-white/40">Online</span>
            </div>
            <div className="flex items-center gap-2">
              <PulseDot size={10} colour="#ff9b91" />
              <span className="text-xs text-white/40">Alert</span>
            </div>
          </div>
        </Section>

        {/* --- Avatars --- */}
        <Section title="Avatars">
          <Avatar fallback="SK" size={40} />
          <Avatar fallback="A" size={28} />
          <Avatar fallback="JD" size={56} />
        </Section>

        {/* --- Progress --- */}
        <Section title="Progress">
          <div className="w-full max-w-md flex flex-col gap-5">
            <ProgressBar value={25} showLabel />
            <ProgressBar value={65} showLabel />
            <ProgressBar value={100} showLabel />
          </div>
        </Section>

        {/* --- Loading --- */}
        <Section title="Skeleton">
          <div className="flex items-start gap-3">
            <Skeleton width={40} height={40} rounded="rounded-full" />
            <div className="flex flex-col gap-2">
              <Skeleton width={180} height={12} />
              <Skeleton width={120} height={12} />
            </div>
          </div>
        </Section>

        {/* --- Icon buttons --- */}
        <Section title="Icon buttons">
          <IconButton size="sm"><X size={14} /></IconButton>
          <IconButton size="md"><Heart size={16} /></IconButton>
          <IconButton size="lg"><Settings size={20} /></IconButton>
          <IconButton size="md"><Plus size={16} /></IconButton>
        </Section>

        {/* --- Typography --- */}
        <Section title="Typography">
          <div className="flex flex-col gap-3">
            <ShimmerText className="text-2xl font-light text-white/80">
              Design engineering
            </ShimmerText>
            <ShimmerText className="text-sm text-white/50" speed={0.7}>
              Components with soul
            </ShimmerText>
          </div>
        </Section>

        {/* --- Disclosure --- */}
        <Section title="Disclosure">
          <div className="w-full max-w-sm flex flex-col gap-2">
            <HoverReveal
              revealContent={
                <p className="text-xs text-white/35 pt-2">
                  Starting at $9/month for individuals
                </p>
              }
            >
              <p className="text-sm text-white/60">Pricing</p>
            </HoverReveal>
            <HoverReveal
              revealContent={
                <p className="text-xs text-white/35 pt-2">
                  Spring physics, cursor-reactive colour, pastel glows
                </p>
              }
            >
              <p className="text-sm text-white/60">Features</p>
            </HoverReveal>
            <HoverReveal
              revealContent={
                <p className="text-xs text-white/35 pt-2">
                  24/7 live chat and email support
                </p>
              }
              direction="up"
            >
              <p className="text-sm text-white/60">Support</p>
            </HoverReveal>
          </div>
        </Section>

        {/* --- Dock --- */}
        <Section title="Dock">
          <div className="w-full flex justify-center">
            <FloatingDock
              items={[
                { icon: <Home size={22} />, label: "Home" },
                { icon: <Search size={22} />, label: "Search" },
                { icon: <BarChart3 size={22} />, label: "Analytics" },
                { icon: <Settings size={22} />, label: "Settings" },
                { icon: <User size={22} />, label: "Profile" },
              ]}
            />
          </div>
        </Section>
      </main>
    </div>
  );
}
