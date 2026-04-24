"use client";
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
} from "lucide-react";
import { CommandPalette, type Command } from "../lib/components/command-palette";
import { GlowBadge } from "../lib/components/glow-badge";
import { colourField } from "../lib/primitives/gradient";
import { usePointer } from "../lib/hooks/use-pointer";

const icon = (node: ReactNode) => (
  <span style={{ display: "inline-flex", width: 16, height: 16 }}>{node}</span>
);

const COMMANDS: Command[] = [
  // Navigation
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

  // Actions
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

  // Appearance — has children → sub-palette
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

export default function CommandPaletteDemo() {
  const [open, setOpen] = useState(false);
  const { xPc, yPc, time, mounted } = usePointer({ lerp: 0.08 });

  const bg = mounted
    ? colourField(xPc, yPc, time, 10).background
    : "transparent";

  return (
    <div
      className="fixed inset-0 flex items-center justify-center overflow-hidden"
      style={{ background: "#050505" }}
    >
      {/* Cursor-reactive backdrop */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background: bg,
          filter: "blur(60px) saturate(1.1)",
          opacity: 0.6,
        }}
      />

      {/* Hint card */}
      <div
        className="relative flex flex-col items-center gap-6 px-10 py-8 rounded-2xl"
        style={{
          background: "rgba(20,20,20,0.5)",
          border: "1px solid rgba(255,255,255,0.06)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
      >
        <GlowBadge>live</GlowBadge>

        <div className="flex flex-col items-center gap-2">
          <p
            className="text-xs tracking-widest uppercase"
            style={{ color: "rgba(255,255,255,0.3)" }}
          >
            command palette
          </p>
          <h2
            className="text-3xl font-light tracking-tight"
            style={{ color: "rgba(255,255,255,0.9)" }}
          >
            Press{" "}
            <kbd
              className="inline-flex items-center justify-center rounded-lg text-lg font-mono px-3 py-1.5 ml-1"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.85)",
              }}
            >
              ⌘K
            </kbd>
          </h2>
        </div>

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-xs rounded-full px-4 py-1.5 cursor-pointer outline-none"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "rgba(255,255,255,0.6)",
          }}
        >
          or click to open
        </button>

        <p
          className="text-xs italic"
          style={{ color: "rgba(255,255,255,0.2)" }}
        >
          Try typing, arrow keys, ⌘1 to fire the first match.
        </p>
      </div>

      <CommandPalette
        open={open}
        onOpenChange={setOpen}
        commands={COMMANDS}
        recents={RECENTS}
        placeholder="Type a command or search…"
      />
    </div>
  );
}
