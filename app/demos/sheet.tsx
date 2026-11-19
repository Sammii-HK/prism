"use client";
import { useState } from "react";
import { Link2, Mail, MessageCircle } from "lucide-react";
import { Sheet, SpringToggle, Toaster, toast } from "../lib/components";

const button =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.05] px-4 py-2.5 text-sm text-white/85 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60";
const primary =
  "inline-flex items-center justify-center rounded-xl bg-white/90 px-4 py-2.5 text-sm font-medium text-black hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60";

const SETTINGS = [
  { id: "digest", label: "Daily digest", hint: "One email at 8am with everything new" },
  { id: "mentions", label: "Mentions", hint: "When someone tags you in a comment" },
  { id: "launches", label: "Launch reminders", hint: "The day before anything ships" },
] as const;

export default function SheetDemo() {
  const [settings, setSettings] = useState(false);
  const [share, setShare] = useState(false);
  const [on, setOn] = useState<Record<string, boolean>>({ digest: true, mentions: true, launches: false });

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#050505] px-6 py-16">
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button type="button" className={button} onClick={() => setSettings(true)}>
          Notification settings
        </button>
        <button type="button" className={button} onClick={() => setShare(true)}>
          Share sheet
        </button>
      </div>
      <p className="max-w-sm text-center text-xs leading-relaxed text-white/50">
        Drag either sheet by its handle. Let go past a third of the way, or flick it, and it closes; otherwise it settles back. The
        spring starts from exactly where you let go.
      </p>

      <Sheet
        open={settings}
        onOpenChange={setSettings}
        title="Notifications"
        description="Choose what reaches your inbox."
        footer={
          <button
            type="button"
            className={primary}
            onClick={() => {
              setSettings(false);
              toast.success("Preferences saved");
            }}
          >
            Done
          </button>
        }
      >
        <ul className="grid gap-1">
          {SETTINGS.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-4 rounded-xl px-1 py-3">
              <div>
                <p id={`sheet-${s.id}`} className="text-[14px] text-white/85">
                  {s.label}
                </p>
                <p className="mt-0.5 text-[12px] text-white/45">{s.hint}</p>
              </div>
              <SpringToggle checked={on[s.id]} onChange={(v) => setOn((cur) => ({ ...cur, [s.id]: v }))} aria-labelledby={`sheet-${s.id}`} />
            </li>
          ))}
        </ul>
      </Sheet>

      <Sheet open={share} onOpenChange={setShare} side="bottom" title="Share “Launch plan”">
        <div className="grid grid-cols-3 gap-3 pb-2">
          {[
            { label: "Copy link", Icon: Link2 },
            { label: "Email", Icon: Mail },
            { label: "Message", Icon: MessageCircle },
          ].map(({ label, Icon }) => (
            <button
              key={label}
              type="button"
              onClick={() => {
                setShare(false);
                toast(label === "Copy link" ? "Link copied" : `${label} is a demo`);
              }}
              className="flex flex-col items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3 py-4 text-[12px] text-white/75 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <Icon size={18} aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
      </Sheet>
      <Toaster />
    </div>
  );
}
