"use client";
import { Bold, Italic, Link2, List, Underline } from "lucide-react";
import { IconButton, Tooltip } from "../lib/components";

const tools = [
  { label: "Bold", keys: "⌘B", Icon: Bold },
  { label: "Italic", keys: "⌘I", Icon: Italic },
  { label: "Underline", keys: "⌘U", Icon: Underline },
  { label: "Link", keys: "⌘K", Icon: Link2 },
  { label: "Bulleted list", keys: "⇧⌘8", Icon: List },
];

export default function TooltipDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#050505] px-6">
      <div role="toolbar" aria-label="Formatting" className="flex items-center gap-1.5 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-2">
        {tools.map(({ label, keys, Icon }) => (
          <Tooltip
            key={label}
            content={
              <span className="flex items-center gap-2">
                {label}
                <kbd className="font-mono text-[10px] text-white/55">{keys}</kbd>
              </span>
            }
          >
            <IconButton aria-label={label}>
              <Icon size={16} />
            </IconButton>
          </Tooltip>
        ))}
      </div>
      <p className="max-w-xs text-center text-xs leading-relaxed text-white/50">
        Hover a tool, or press Tab to move through them. Escape hides the tooltip.
      </p>
    </div>
  );
}
