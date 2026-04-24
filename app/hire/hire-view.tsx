"use client";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import {
  Archive,
  Home,
  Monitor,
  Moon,
  Plus,
  Settings,
  Sun,
  Trash2,
  User,
  Copy,
  Palette,
  Search,
  Mail,
  Calendar,
  Star,
  Camera,
  Music,
} from "lucide-react";

import { usePointer } from "../lib/hooks/use-pointer";
import { colourField } from "../lib/primitives/gradient";
import { CursorGlow } from "../lib/primitives";
import { ShimmerText } from "../lib/components/shimmer-text";
import { SiteNav } from "../lib/site-nav";

import { RippleButton } from "../lib/components/ripple-button";
import { FloatingDock } from "../lib/components/floating-dock";
import { MorphTabs } from "../lib/components/morph-tabs";
import {
  CommandPalette,
  type Command,
} from "../lib/components/command-palette";
import { GlowBadge } from "../lib/components/glow-badge";

/* -------------------------------------------------------------------------- */
/* Content                                                                     */
/* -------------------------------------------------------------------------- */

const ROLES = [
  "Senior Frontend Engineer",
  "Design Engineer",
  "Creative Engineer",
  "Design Systems Engineer",
];

const PROOF_BULLETS: Array<{ title: string; body: string }> = [
  {
    title: "Design systems & design tokens",
    body: "Every surface on this site is driven by one primitive colour system — `pastelColour`, `colourField`, `colourBlend` — mapping cursor position to RGB. One palette, many components, always in sync. That's a token system with physics, not Figma exports.",
  },
  {
    title: "Interaction & motion craft",
    body: "No animation libraries. Every component integrates position and velocity every frame via hand-rolled `requestAnimationFrame` spring equations. Overshoot, damping, settle — motion that feels alive, not scripted.",
  },
  {
    title: "Frontend performance",
    body: "A single shared pointer listener drives every cursor-reactive surface. Preview frames pause via `IntersectionObserver` when offscreen. Zero runtime dependencies beyond React and Next. One file per component.",
  },
  {
    title: "Accessibility as craft, not checklist",
    body: "The command palette below has a real focus trap, `aria-activedescendant` between input and list, keyboard-only navigation, and a `prefers-reduced-motion` guard that swaps spring animation for an instant state change.",
  },
  {
    title: "Autonomous systems",
    body: "A Claude-driven pipeline scouts patterns, curates a brief, builds the component, records a video, and publishes to X — every day. Code on GitHub, daily log on the portfolio.",
  },
];

/* -------------------------------------------------------------------------- */
/* Command palette data (trimmed from the demo)                                */
/* -------------------------------------------------------------------------- */

const icon = (node: ReactNode) => (
  <span style={{ display: "inline-flex", width: 16, height: 16 }}>{node}</span>
);

const COMMANDS: Command[] = [
  {
    id: "go-home",
    label: "Go to Home",
    group: "Navigation",
    keywords: ["navigate", "index"],
    hint: "⌘1",
    icon: icon(<Home size={16} strokeWidth={1.5} />),
    action: () => console.log("Go to Home"),
  },
  {
    id: "go-settings",
    label: "Go to Settings",
    group: "Navigation",
    keywords: ["preferences", "config"],
    icon: icon(<Settings size={16} strokeWidth={1.5} />),
    action: () => console.log("Go to Settings"),
  },
  {
    id: "go-profile",
    label: "Go to Profile",
    group: "Navigation",
    keywords: ["account", "me"],
    icon: icon(<User size={16} strokeWidth={1.5} />),
    action: () => console.log("Go to Profile"),
  },
  {
    id: "new-post",
    label: "New post",
    group: "Actions",
    keywords: ["create", "write", "draft"],
    icon: icon(<Plus size={16} strokeWidth={1.5} />),
    action: () => console.log("New post"),
  },
  {
    id: "duplicate",
    label: "Duplicate",
    group: "Actions",
    keywords: ["copy", "clone"],
    icon: icon(<Copy size={16} strokeWidth={1.5} />),
    action: () => console.log("Duplicate"),
  },
  {
    id: "archive",
    label: "Archive",
    group: "Actions",
    keywords: ["stash", "hide"],
    icon: icon(<Archive size={16} strokeWidth={1.5} />),
    action: () => console.log("Archive"),
  },
  {
    id: "delete",
    label: "Delete",
    group: "Actions",
    keywords: ["remove", "trash"],
    hint: "⌘⌫",
    icon: icon(<Trash2 size={16} strokeWidth={1.5} />),
    action: () => console.log("Delete"),
  },
  {
    id: "change-theme",
    label: "Change theme",
    group: "Appearance",
    keywords: ["appearance", "mode", "dark", "light"],
    icon: icon(<Palette size={16} strokeWidth={1.5} />),
    children: [
      {
        id: "theme-light",
        label: "Light",
        icon: icon(<Sun size={16} strokeWidth={1.5} />),
        action: () => console.log("Theme: Light"),
      },
      {
        id: "theme-dark",
        label: "Dark",
        icon: icon(<Moon size={16} strokeWidth={1.5} />),
        action: () => console.log("Theme: Dark"),
      },
      {
        id: "theme-system",
        label: "System",
        icon: icon(<Monitor size={16} strokeWidth={1.5} />),
        action: () => console.log("Theme: System"),
      },
    ],
  },
];

const RECENTS = ["new-post", "go-settings", "change-theme"];

/* -------------------------------------------------------------------------- */
/* Floating dock items                                                         */
/* -------------------------------------------------------------------------- */

const DOCK_ITEMS = [
  {
    label: "Home",
    icon: (
      <Home
        size={24}
        strokeWidth={1.5}
        className="text-white/70"
        aria-hidden="true"
      />
    ),
  },
  {
    label: "Search",
    icon: (
      <Search
        size={24}
        strokeWidth={1.5}
        className="text-white/70"
        aria-hidden="true"
      />
    ),
  },
  {
    label: "Music",
    icon: (
      <Music
        size={24}
        strokeWidth={1.5}
        className="text-white/70"
        aria-hidden="true"
      />
    ),
  },
  {
    label: "Camera",
    icon: (
      <Camera
        size={24}
        strokeWidth={1.5}
        className="text-white/70"
        aria-hidden="true"
      />
    ),
  },
  {
    label: "Mail",
    icon: (
      <Mail
        size={24}
        strokeWidth={1.5}
        className="text-white/70"
        aria-hidden="true"
      />
    ),
  },
  {
    label: "Calendar",
    icon: (
      <Calendar
        size={24}
        strokeWidth={1.5}
        className="text-white/70"
        aria-hidden="true"
      />
    ),
  },
  {
    label: "Star",
    icon: (
      <Star
        size={24}
        strokeWidth={1.5}
        className="text-white/70"
        aria-hidden="true"
      />
    ),
  },
];

const TABS = ["Overview", "Analytics", "Settings", "Billing"];
const TAB_CONTENT: Record<string, string> = {
  Overview:
    "Your project at a glance. Key metrics, recent activity, and quick actions.",
  Analytics: "Traffic, conversions, and engagement trends over time.",
  Settings: "Configure integrations, notifications, and team permissions.",
  Billing: "Manage your plan, payment methods, and invoices.",
};

/* -------------------------------------------------------------------------- */
/* Page                                                                         */
/* -------------------------------------------------------------------------- */

export const HireView = () => {
  const { xPc, yPc, time, mounted } = usePointer({ lerp: 0.08 });
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div
      className="min-h-screen relative"
      style={mounted ? colourField(xPc, yPc, time, 10) : undefined}
    >
      {mounted && <CursorGlow size={500} blur={60} opacity={0.06} />}
      <SiteNav />

      {/* ------------------------------------------------------------------ */}
      {/* Hero — positioning sentence                                        */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative px-6 pt-20 sm:pt-28 pb-14 sm:pb-20 flex flex-col items-center text-center">
        <p className="text-[11px] font-mono text-white/35 uppercase tracking-[0.25em] mb-6">
          Hire — Sammii Kellow
        </p>
        <h1 className="text-3xl sm:text-5xl md:text-6xl font-light tracking-tight leading-[1.1] max-w-4xl">
          <ShimmerText className="text-white/90 block">
            Senior frontend / design engineer.
          </ShimmerText>
          <span className="text-white/45 block mt-3 text-xl sm:text-2xl md:text-3xl">
            London. UK citizen. Available for permanent or contract.
          </span>
        </h1>

        <p className="mt-8 text-sm sm:text-base text-white/55 max-w-2xl leading-relaxed">
          Prism is the proof-of-craft — cursor-reactive UI primitives, spring
          physics, zero runtime dependencies, shipped every day by an
          autonomous pipeline I built and maintain.
        </p>

        {/* Availability / location line */}
        <p className="mt-6 text-[12px] font-mono text-white/50 tracking-wide">
          London · UK citizen · permanent or contract · remote or hybrid
        </p>

        {/* Primary CTAs */}
        <div className="mt-10 flex flex-col sm:flex-row gap-3 items-center">
          <a
            href="mailto:kellow.sammii@gmail.com"
            className="group inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white/[0.06] border border-white/[0.14] text-sm text-white/85 hover:bg-white/[0.09] hover:border-white/[0.22] transition-colors"
          >
            Email Sammii
            <span className="text-white/50 group-hover:translate-x-0.5 transition-transform">
              →
            </span>
          </a>
          <a
            href="https://sammii.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm text-white/55 hover:text-white/85 transition-colors"
          >
            Portfolio: sammii.dev
          </a>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Roles targeted                                                      */}
      {/* ------------------------------------------------------------------ */}
      <section className="max-w-4xl mx-auto px-6 py-10 border-t border-white/[0.06]">
        <p className="text-[10px] tracking-[0.2em] text-white/30 uppercase mb-4 text-center">
          Roles targeted
        </p>
        <ul className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
          {ROLES.map((role) => (
            <li
              key={role}
              className="text-[12px] sm:text-sm font-mono text-white/70 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08]"
            >
              {role}
            </li>
          ))}
        </ul>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Proof bullets                                                       */}
      {/* ------------------------------------------------------------------ */}
      <section className="max-w-5xl mx-auto px-6 py-16 border-t border-white/[0.06]">
        <div className="mb-10">
          <p className="text-[10px] tracking-[0.2em] text-white/30 uppercase mb-2">
            What Prism proves
          </p>
          <h2 className="text-2xl sm:text-3xl font-light text-white/85">
            Five things this codebase is evidence of.
          </h2>
        </div>

        <ol className="grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-10">
          {PROOF_BULLETS.map((bullet, i) => (
            <li key={bullet.title} className="flex flex-col gap-3">
              <span className="text-[10px] font-mono text-white/30 tracking-wider">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="text-lg font-light text-white/90 leading-snug">
                {bullet.title}
              </h3>
              <p className="text-sm text-white/55 leading-relaxed">
                {bullet.body}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Featured demos — dogfood                                            */}
      {/* ------------------------------------------------------------------ */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 border-t border-white/[0.06]">
        <div className="mb-10 px-1">
          <p className="text-[10px] tracking-[0.2em] text-white/30 uppercase mb-2">
            Featured components
          </p>
          <h2 className="text-2xl sm:text-3xl font-light text-white/85">
            Four live demos, rendered inline.
          </h2>
          <p className="mt-2 text-sm text-white/45 leading-relaxed max-w-2xl">
            No screenshots. No iframes. These are the same components as on the
            rest of the site, running in the same React tree as this page.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Ripple Button */}
          <DemoFrame
            label="ripple-button"
            caption="Cursor-position tints each ripple. Spring-physics scale on press."
          >
            <div className="flex flex-col items-center gap-3">
              <RippleButton
                rippleDuration={750}
                rippleScale={3}
                style={{ fontSize: "15px", padding: "12px 28px" }}
              >
                Click anywhere
              </RippleButton>
              <div className="flex items-center gap-2 flex-wrap justify-center">
                <RippleButton style={{ padding: "6px 14px", fontSize: "12px" }}>
                  Dismiss
                </RippleButton>
                <RippleButton>Confirm</RippleButton>
              </div>
            </div>
          </DemoFrame>

          {/* Morph Tabs */}
          <DemoFrame
            label="morph-tabs"
            caption="Active pill morphs between tabs with spring-damped width and x."
          >
            <div className="flex flex-col items-center gap-5 w-full">
              <MorphTabs
                tabs={TABS}
                activeIndex={activeTab}
                onChange={setActiveTab}
              />
              <div className="w-full max-w-sm rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                <p className="text-xs text-white/50 leading-relaxed tracking-tight">
                  {TAB_CONTENT[TABS[activeTab]]}
                </p>
              </div>
            </div>
          </DemoFrame>

          {/* Floating Dock */}
          <DemoFrame
            label="floating-dock"
            caption="Magnetic magnification — neighbours scale with a falloff curve."
          >
            <div className="w-full flex items-center justify-center py-4">
              <FloatingDock
                items={DOCK_ITEMS}
                iconSize={42}
                gap={4}
                maxScale={1.7}
              />
            </div>
          </DemoFrame>

          {/* Command Palette */}
          <DemoFrame
            label="command-palette"
            caption="Real focus trap, aria-activedescendant, ⌘K and prefers-reduced-motion aware."
          >
            <div className="flex flex-col items-center gap-4 w-full">
              <GlowBadge>accessible</GlowBadge>
              <p className="text-xs text-white/55 text-center max-w-xs">
                Press{" "}
                <kbd
                  className="inline-flex items-center justify-center rounded-md font-mono px-2 py-1 mx-0.5 text-[11px]"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "rgba(255,255,255,0.8)",
                  }}
                >
                  ⌘K
                </kbd>{" "}
                or click below.
              </p>
              <button
                type="button"
                onClick={() => setPaletteOpen(true)}
                className="text-xs rounded-full px-4 py-1.5 cursor-pointer outline-none transition-colors hover:bg-white/[0.08]"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "rgba(255,255,255,0.7)",
                }}
              >
                Open command palette
              </button>
              <CommandPalette
                open={paletteOpen}
                onOpenChange={setPaletteOpen}
                commands={COMMANDS}
                recents={RECENTS}
                placeholder="Type a command or search…"
              />
            </div>
          </DemoFrame>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Links out                                                           */}
      {/* ------------------------------------------------------------------ */}
      <section className="max-w-5xl mx-auto px-6 py-16 border-t border-white/[0.06]">
        <p className="text-[10px] tracking-[0.2em] text-white/30 uppercase mb-6">
          Get in touch
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ContactLink
            label="Email"
            value="kellow.sammii@gmail.com"
            href="mailto:kellow.sammii@gmail.com"
          />
          <ContactLink
            label="Portfolio"
            value="sammii.dev"
            href="https://sammii.dev"
            external
          />
          <ContactLink
            label="GitHub — Prism source"
            value="github.com/Sammii-HK/prism"
            href="https://github.com/Sammii-HK/prism"
            external
          />
          <ContactLink
            label="X"
            value="@sammiihk"
            href="https://x.com/sammiihk"
            external
          />
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Footer                                                              */}
      {/* ------------------------------------------------------------------ */}
      <footer className="border-t border-white/[0.06] mt-8">
        <div className="max-w-5xl mx-auto px-6 py-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <p className="text-[10px] font-mono text-white/25 tracking-wide">
            © Sammii · The work is the portfolio.
          </p>
          <div className="flex items-center gap-4 text-[11px] font-mono text-white/40">
            <Link href="/" className="hover:text-white/70 transition-colors">
              Home
            </Link>
            <Link
              href="/components"
              className="hover:text-white/70 transition-colors"
            >
              Components
            </Link>
            <Link
              href="/playground"
              className="hover:text-white/70 transition-colors"
            >
              Playground
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* Presentational helpers                                                      */
/* -------------------------------------------------------------------------- */

const DemoFrame = ({
  label,
  caption,
  children,
}: {
  label: string;
  caption: string;
  children: ReactNode;
}) => (
  <div className="flex flex-col rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
    <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.05]">
      <code className="text-[11px] font-mono text-white/50">{label}</code>
      <span className="text-[10px] font-mono text-white/25 tracking-wider uppercase">
        live
      </span>
    </div>
    <div className="relative flex items-center justify-center min-h-[240px] px-6 py-8">
      {children}
    </div>
    <div className="px-4 py-3 border-t border-white/[0.05]">
      <p className="text-[11px] text-white/45 leading-relaxed">{caption}</p>
    </div>
  </div>
);

const ContactLink = ({
  label,
  value,
  href,
  external,
}: {
  label: string;
  value: string;
  href: string;
  external?: boolean;
}) => (
  <a
    href={href}
    {...(external
      ? { target: "_blank", rel: "noopener noreferrer" }
      : {})}
    className="group flex flex-col gap-1 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] hover:border-white/[0.14] transition-colors"
  >
    <span className="text-[10px] font-mono text-white/35 tracking-[0.2em] uppercase">
      {label}
    </span>
    <span className="text-sm text-white/80 group-hover:text-white/95 transition-colors">
      {value}{" "}
      <span className="text-white/40 group-hover:translate-x-0.5 inline-block transition-transform">
        →
      </span>
    </span>
  </a>
);
