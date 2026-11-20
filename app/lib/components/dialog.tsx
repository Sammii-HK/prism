"use client";
import { useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { reducedMotionNow } from "../hooks/reduced-motion";
import { useModal, type DismissReason } from "../hooks/overlay";

export interface DialogProps {
  /** Whether it is open. */
  open: boolean;
  /** Called with false when it asks to close: Escape, the close button, or a press on the backdrop. */
  onOpenChange: (open: boolean, reason: DismissReason) => void;
  /** Names the dialog. Rendered as its heading. */
  title: string;
  /** Describes it, linked with aria-describedby. */
  description?: ReactNode;
  children?: ReactNode;
  /** Buttons along the bottom. Put `data-autofocus` on the one that should take focus first. */
  footer?: ReactNode;
  /**
   * "alertdialog" for confirmations that need an answer: a backdrop press does
   * not dismiss it, and there is no close button. Default: "dialog"
   */
  role?: "dialog" | "alertdialog";
  /** Panel width. Default: "md" */
  size?: "sm" | "md" | "lg";
  className?: string;
}

const WIDTH = { sm: "max-w-sm", md: "max-w-md", lg: "max-w-xl" } as const;

/**
 * A modal dialog built on the native `<dialog>` element and showModal(), so
 * the browser does what it is best at: the rest of the page becomes inert
 * (not just visually covered), and the dialog sits in the top layer above
 * every stacking context. Everything it cannot animate, Prism does: the
 * panel and backdrop spring in and out, and Escape is routed through the
 * spring rather than cutting it off.
 *
 * Focus moves to `data-autofocus` or the first control, and goes back to
 * whatever opened it once it has gone. The page behind does not scroll.
 *
 * @example
 * <Dialog
 *   open={open}
 *   onOpenChange={setOpen}
 *   role="alertdialog"
 *   title="Delete this project?"
 *   description="Its 12 files go with it. This cannot be undone."
 *   footer={<>
 *     <button data-autofocus onClick={() => setOpen(false)}>Cancel</button>
 *     <button onClick={remove}>Delete</button>
 *   </>}
 * />
 */
export const Dialog = ({ open, onOpenChange, title, description, children, footer, role = "dialog", size = "md", className = "" }: DialogProps) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  const alert = role === "alertdialog";

  const { mounted } = useModal({
    open,
    onDismiss: (reason) => onOpenChange(false, reason),
    dialogRef,
    panelRef,
    dismissOnOutside: !alert,
    render: (p) => {
      const panel = panelRef.current;
      const backdrop = backdropRef.current;
      const o = Math.min(1, Math.max(0, p));
      if (backdrop) backdrop.style.opacity = o.toFixed(3);
      if (!panel) return;
      panel.style.opacity = o.toFixed(3);
      panel.style.transform = reducedMotionNow() ? "none" : `translateY(${((1 - p) * 10).toFixed(2)}px) scale(${(0.965 + 0.035 * p).toFixed(4)})`;
      panel.style.pointerEvents = open ? "auto" : "none";
    },
  });

  if (!mounted) return null;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      role={alert ? "alertdialog" : undefined}
      className="fixed inset-0 m-0 h-full max-h-none w-full max-w-none overflow-y-auto bg-transparent p-0 text-white backdrop:bg-transparent"
    >
      <div ref={backdropRef} aria-hidden="true" className="fixed inset-0 bg-black/55 backdrop-blur-[2px]" style={{ opacity: 0 }} />
      <div className="relative flex min-h-full items-center justify-center p-4">
        <div
          ref={panelRef}
          className={`relative w-full ${WIDTH[size]} rounded-2xl border border-white/[0.1] bg-[#0b0b0b] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.6)] ${className}`}
          style={{ opacity: 0 }}
        >
          <h2 id={titleId} className="pr-8 text-[17px] font-medium tracking-[-0.01em] text-white/95">
            {title}
          </h2>
          {description && (
            <div id={descId} className="mt-2 text-sm leading-relaxed text-white/60">
              {description}
            </div>
          )}
          {children && <div className="mt-5">{children}</div>}
          {footer && <div className="mt-6 flex flex-wrap justify-end gap-2">{footer}</div>}
          {!alert && (
            <button
              type="button"
              aria-label="Close"
              onClick={() => onOpenChange(false, "button")}
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg text-white/50 transition-colors hover:bg-white/[0.06] hover:text-white/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>
    </dialog>
  );
};
