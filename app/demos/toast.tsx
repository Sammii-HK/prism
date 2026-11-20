"use client";
import { Toaster, toast } from "../lib/components";

const button =
  "inline-flex items-center justify-center rounded-xl border border-white/[0.12] bg-white/[0.05] px-4 py-2.5 text-sm text-white/85 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60";

const after = <T,>(ms: number, value: T, fail = false) =>
  new Promise<T>((resolve, reject) => setTimeout(() => (fail ? reject(new Error("offline")) : resolve(value)), ms));

const retry = () =>
  toast.promise(after(1600, null), { loading: "Retrying…", success: "Sent", error: "Still offline" });

export default function ToastDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-[#050505] px-6 py-16">
      <div className="grid w-full max-w-md gap-3 sm:grid-cols-2">
        <button
          type="button"
          className={button}
          onClick={() => toast.promise(after(180, null), { loading: "Saving…", success: "Saved", error: "Could not save" })}
        >
          Save, fast server
        </button>
        <button
          type="button"
          className={button}
          onClick={() => toast.promise(after(2200, null), { loading: "Saving…", success: "Saved", error: "Could not save" })}
        >
          Save, slow server
        </button>
        <button
          type="button"
          className={button}
          onClick={() => toast("Moved 3 items to archive", { action: { label: "Undo", onClick: () => toast("Restored 3 items") } })}
        >
          Archive, with undo
        </button>
        <button
          type="button"
          className={button}
          onClick={() => toast.error("Message not sent", { description: "You are offline.", action: { label: "Retry", onClick: retry } })}
        >
          Fail, with retry
        </button>
        <button
          type="button"
          className={`${button} sm:col-span-2`}
          onClick={() => {
            toast("Uploading 4 photos");
            setTimeout(() => toast.success("Darkroom export finished"), 250);
            setTimeout(() => toast("2 new comments", { description: "On “Launch plan”" }), 500);
            setTimeout(() => toast.success("Backup complete"), 750);
          }}
        >
          Send four at once
        </button>
      </div>
      <p className="max-w-sm text-center text-xs leading-relaxed text-white/50">
        A fast save shows only “Saved”: nothing flashes for a request that finishes in under 400ms. Hover the stack to fan it out and
        pause every timer. Swipe one sideways to dismiss it. Press F8 to reach the toasts from the keyboard.
      </p>
      <Toaster />
    </div>
  );
}
