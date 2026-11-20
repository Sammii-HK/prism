"use client";
import { useState } from "react";
import { Check, Copy, Link2, SlidersHorizontal } from "lucide-react";
import { Popover, SpringToggle, Toaster, toast } from "../lib/components";
import { useAnchorSupport, type Positioning } from "../lib/hooks/anchor";

const button =
  "inline-flex items-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.05] px-4 py-2.5 text-sm text-white/85 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60";

const SharePanel = ({ close }: { close: () => void }) => {
  const [anyone, setAnyone] = useState(true);
  const [copied, setCopied] = useState(false);
  const url = "https://prism.sammii.dev/popover";
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard can be blocked; the link is still selectable in the field.
    }
    setCopied(true);
    toast.success("Link copied");
    window.setTimeout(close, 450);
  };
  return (
    <div className="w-[300px]">
      <p className="text-[13px] text-white/90">Share this page</p>
      <div className="mt-3 flex items-center gap-2">
        <input
          readOnly
          value={url}
          aria-label="Link"
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-2 font-mono text-[11px] text-white/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
        />
        <button type="button" onClick={copy} data-autofocus className={`${button} px-3 py-2`}>
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div className="mt-4 flex items-center justify-between gap-4 border-t border-white/[0.06] pt-4">
        <span id="share-anyone" className="text-[13px] text-white/70">
          Anyone with the link can view
        </span>
        <SpringToggle checked={anyone} onChange={setAnyone} aria-labelledby="share-anyone" />
      </div>
    </div>
  );
};

export default function PopoverDemo() {
  const supported = useAnchorSupport();
  const [positioning, setPositioning] = useState<Positioning>("auto");
  const [tags, setTags] = useState<string[]>(["Design"]);
  const all = ["Design", "Engineering", "Research", "Writing"];

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-14 bg-[#050505] px-6 py-16">
      <Popover label="Share" trigger={<button type="button" className={button}><Link2 size={15} />Share</button>}>
        {(close) => <SharePanel close={close} />}
      </Popover>

      <div className="w-full max-w-md">
        <p className="mb-3 text-center text-xs leading-relaxed text-white/50">
          This card clips its overflow, scrolls, and is rotated. A menu positioned inside it would be cut off. The popover sits in the
          top layer, so it is not.
        </p>
        <div className="h-40 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]" style={{ transform: "rotate(-1deg)" }}>
          <div className="h-full overflow-y-auto p-5">
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-white/75">Projects</span>
              <Popover
                label="Filter by tag"
                align="end"
                positioning={positioning}
                trigger={
                  <button type="button" className={`${button} px-3 py-1.5 text-[13px]`}>
                    <SlidersHorizontal size={14} />
                    Filter{tags.length ? ` (${tags.length})` : ""}
                  </button>
                }
              >
                <fieldset className="w-48">
                  <legend className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">Tags</legend>
                  <div className="mt-2 grid gap-1">
                    {all.map((t) => (
                      <label key={t} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] text-white/80 hover:bg-white/[0.04]">
                        <input
                          type="checkbox"
                          checked={tags.includes(t)}
                          onChange={() => setTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]))}
                          className="accent-white"
                        />
                        {t}
                      </label>
                    ))}
                  </div>
                </fieldset>
              </Popover>
            </div>
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="mt-3 h-8 rounded-lg bg-white/[0.03]" />
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center gap-3">
        <div role="group" aria-label="Positioning" className="flex rounded-xl border border-white/[0.1] p-1">
          {(["auto", "js"] as const).map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={positioning === p}
              onClick={() => setPositioning(p)}
              className={`rounded-lg px-3 py-1.5 font-mono text-[11px] ${positioning === p ? "bg-white/[0.08] text-white/90" : "text-white/50 hover:text-white/75"}`}
            >
              {p === "auto" ? "CSS anchor() when available" : "JavaScript always"}
            </button>
          ))}
        </div>
        <p className="font-mono text-[11px] text-white/40">
          This browser {supported ? "supports" : "does not support"} anchor positioning, so the filter uses{" "}
          {positioning === "auto" && supported ? "CSS" : "JavaScript"}.
        </p>
      </div>
      <Toaster />
    </div>
  );
}
