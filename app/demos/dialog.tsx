"use client";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Dialog, GlowInput, Menu, Toaster, toast } from "../lib/components";

const button =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.05] px-4 py-2.5 text-sm text-white/85 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60";
const primary =
  "inline-flex items-center justify-center rounded-xl bg-white/90 px-4 py-2.5 text-sm font-medium text-black hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0b0b]";
const danger =
  "inline-flex items-center justify-center rounded-xl border border-[#fca5a5]/30 bg-[#fca5a5]/10 px-4 py-2.5 text-sm text-[#fecaca] hover:bg-[#fca5a5]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fca5a5]/60";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function DialogDemo() {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [name, setName] = useState("Sammii");
  const [role, setRole] = useState("Design engineer");
  const [visibility, setVisibility] = useState("Public");

  const save = () => {
    setEditing(false);
    toast.promise(wait(900), { loading: "Saving profile…", success: "Profile saved", error: "Could not save" });
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#050505] px-6 py-16">
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button type="button" className={button} onClick={() => setEditing(true)}>
          Edit profile
        </button>
        <button type="button" className={danger} onClick={() => setConfirming(true)}>
          Delete project
        </button>
      </div>
      <p className="max-w-sm text-center text-xs leading-relaxed text-white/50">
        The page behind becomes inert, not just covered. Open the visibility menu inside the dialog and press Escape: the menu closes
        first, then the dialog. Focus comes back to the button that opened it.
      </p>

      <Dialog
        open={editing}
        onOpenChange={setEditing}
        title="Edit profile"
        description="This is how you appear on shared projects."
        footer={
          <>
            <button type="button" className={button} onClick={() => setEditing(false)}>
              Cancel
            </button>
            <button type="button" className={primary} onClick={save}>
              Save
            </button>
          </>
        }
      >
        <div className="grid gap-4">
          <GlowInput label="Name" value={name} onChange={setName} />
          <GlowInput label="Role" value={role} onChange={setRole} />
          <div className="flex items-center justify-between rounded-xl border border-white/[0.08] px-4 py-3">
            <span className="text-[13px] text-white/70">Profile visibility</span>
            <Menu
              align="end"
              trigger={
                <button type="button" className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[13px] text-white/85 hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60">
                  {visibility}
                  <ChevronDown size={14} aria-hidden="true" />
                </button>
              }
              items={["Public", "Team only", "Private"].map((v) => ({ label: v, checked: visibility === v, onSelect: () => setVisibility(v) }))}
            />
          </div>
        </div>
      </Dialog>

      <Dialog
        open={confirming}
        onOpenChange={setConfirming}
        role="alertdialog"
        size="sm"
        title="Delete this project?"
        description="Its 12 files and their history go with it. This cannot be undone."
        footer={
          <>
            <button type="button" data-autofocus className={button} onClick={() => setConfirming(false)}>
              Cancel
            </button>
            <button
              type="button"
              className={danger}
              onClick={() => {
                setConfirming(false);
                toast.error("Project deleted", { description: "This was a demo, nothing was lost." });
              }}
            >
              Delete project
            </button>
          </>
        }
      />
      <Toaster />
    </div>
  );
}
