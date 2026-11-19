"use client";
import { useState } from "react";
import { Copy, Eye, FileText, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { IconButton, Menu, Toaster, toast } from "../lib/components";

type File = { id: number; name: string; pinned: boolean };

const START: File[] = [
  { id: 1, name: "Brand guidelines.pdf", pinned: true },
  { id: 2, name: "Launch plan.md", pinned: false },
  { id: 3, name: "Interview notes.md", pinned: false },
];

export default function MenuDemo() {
  const [files, setFiles] = useState(START);
  const [showHidden, setShowHidden] = useState(false);
  const [compact, setCompact] = useState(false);

  const update = (id: number, change: Partial<File>) => setFiles((fs) => fs.map((f) => (f.id === id ? { ...f, ...change } : f)));

  const trash = (file: File) => {
    const before = files;
    setFiles((fs) => fs.filter((f) => f.id !== file.id));
    toast(`Moved “${file.name}” to trash`, { action: { label: "Undo", onClick: () => setFiles(before) } });
  };

  const sorted = [...files].sort((a, b) => Number(b.pinned) - Number(a.pinned));

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#050505] px-6 py-16">
      <div className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-white/[0.02]">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
          <span className="text-[13px] text-white/80">Files</span>
          <Menu
            align="end"
            trigger={
              <button type="button" className="rounded-lg px-2.5 py-1 text-[12px] text-white/60 hover:bg-white/[0.05] hover:text-white/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60">
                View
              </button>
            }
            items={[
              { type: "label", label: "Display" },
              { label: "Compact rows", checked: compact, onSelect: () => setCompact((c) => !c) },
              { label: "Show hidden files", checked: showHidden, onSelect: () => setShowHidden((s) => !s) },
            ]}
          />
        </div>
        <ul>
          {sorted.map((file) => (
            <li key={file.id} className={`flex items-center gap-3 px-4 ${compact ? "py-1.5" : "py-3"} [&+li]:border-t [&+li]:border-white/[0.04]`}>
              <FileText size={15} className="text-white/40" aria-hidden="true" />
              <span className="flex-1 truncate text-[13px] text-white/80">{file.name}</span>
              {file.pinned && <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/35">Pinned</span>}
              <Menu
                align="end"
                trigger={
                  <IconButton size="sm" aria-label={`Actions for ${file.name}`}>
                    <MoreHorizontal size={15} />
                  </IconButton>
                }
                items={[
                  { label: "Open", icon: <Eye size={14} />, shortcut: "↵", onSelect: () => toast(`Opened “${file.name}”`) },
                  { label: "Rename", icon: <Pencil size={14} />, shortcut: "R", onSelect: () => toast("Rename is a demo") },
                  {
                    label: "Duplicate",
                    icon: <Copy size={14} />,
                    shortcut: "D",
                    onSelect: () => {
                      setFiles((fs) => [...fs, { id: Date.now(), name: file.name.replace(/(\.\w+)$/, " copy$1"), pinned: false }]);
                      toast.success("Duplicated");
                    },
                  },
                  { label: "Pin to top", checked: file.pinned, onSelect: () => update(file.id, { pinned: !file.pinned }) },
                  { label: "Share externally", disabled: true },
                  { type: "separator" },
                  { label: "Move to trash", icon: <Trash2 size={14} />, tone: "danger", onSelect: () => trash(file) },
                ]}
              />
            </li>
          ))}
        </ul>
      </div>
      <p className="max-w-sm text-center text-xs leading-relaxed text-white/50">
        Tab to a ⋯ button and press ArrowDown, then use the arrows, Home and End, or type a letter. Escape gives focus back to the
        button. Pin to top stays open; everything else closes.
      </p>
      <Toaster />
    </div>
  );
}
