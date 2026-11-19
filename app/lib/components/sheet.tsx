"use client";
import { useId, useRef, type PointerEvent, type ReactNode } from "react";
import { X } from "lucide-react";
import { reducedMotionNow } from "../hooks/reduced-motion";
import { useModal, type DismissReason } from "../hooks/overlay";

export type SheetSide = "right" | "left" | "bottom";

export interface SheetProps {
  /** Whether it is open. */
  open: boolean;
  /** Called with false when it asks to close: Escape, the close button, the backdrop, or a drag past the threshold. */
  onOpenChange: (open: boolean, reason: DismissReason | "drag") => void;
  /** Names the sheet. Rendered as its heading. */
  title: string;
  /** Describes it, linked with aria-describedby. */
  description?: ReactNode;
  children?: ReactNode;
  /** Pinned to the bottom of the sheet. */
  footer?: ReactNode;
  /** Which edge it comes from. Default: "right" */
  side?: SheetSide;
  className?: string;
}

/** Fraction of its size a drag has to travel to close it. */
const CLOSE_AT = 0.3;
/** Or a flick faster than this, in px per ms. */
const FLICK = 0.5;

/**
 * A panel that slides in from an edge: settings, filters, a cart, a share
 * sheet on a phone. It is the same native modal as Dialog (inert page, top
 * layer, focus in and back, no scroll behind) with a different entrance.
 *
 * It can be dragged closed from its handle. The drag follows the finger one
 * to one, resists being pulled the wrong way, and on release the spring takes
 * over from exactly where the finger let go: past a third of the way or
 * flicked, it closes; otherwise it settles back.
 *
 * @example
 * <Sheet open={open} onOpenChange={setOpen} title="Filters" side="right">
 *   <FilterForm />
 * </Sheet>
 */
export const Sheet = ({ open, onOpenChange, title, description, children, footer, side = "right", className = "" }: SheetProps) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  const drag = useRef<{ id: number; start: number; last: number; lastT: number; v: number; offset: number } | null>(null);
  const vertical = side === "bottom";

  const size = () => {
    const panel = panelRef.current;
    return panel ? (vertical ? panel.offsetHeight : panel.offsetWidth) : 1;
  };

  /** Signed direction a closing sheet moves in. */
  const away = side === "left" ? -1 : 1;

  const paint = (p: number) => {
    // While a finger holds it, the drag owns the position and the spring waits.
    const d = drag.current;
    if (d) {
      p = 1 - d.offset / size();
      drive(p);
    }
    const panel = panelRef.current;
    const backdrop = backdropRef.current;
    const o = Math.min(1, Math.max(0, p));
    if (backdrop) backdrop.style.opacity = o.toFixed(3);
    if (!panel) return;
    const reduced = reducedMotionNow();
    // With reduced motion it fades in place instead of travelling.
    const shift = reduced ? 0 : (1 - p) * size() * away;
    panel.style.transform = vertical ? `translateY(${shift.toFixed(2)}px)` : `translateX(${shift.toFixed(2)}px)`;
    panel.style.opacity = reduced ? o.toFixed(3) : "1";
    panel.style.pointerEvents = open ? "auto" : "none";
  };

  const { mounted, drive, kick } = useModal({
    open,
    onDismiss: (reason) => onOpenChange(false, reason),
    dialogRef,
    panelRef,
    render: paint,
  });

  const along = (e: PointerEvent) => (vertical ? e.clientY : e.clientX);

  const onPointerDown = (e: PointerEvent<HTMLElement>) => {
    if (e.button !== 0 || !open) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const at = along(e);
    drag.current = { id: e.pointerId, start: at, last: at, lastT: e.timeStamp, v: 0, offset: 0 };
  };

  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const at = along(e);
    const dt = Math.max(1, e.timeStamp - d.lastT);
    d.v = ((at - d.last) / dt) * away;
    d.last = at;
    d.lastT = e.timeStamp;
    const raw = (at - d.start) * away;
    // One to one towards closed; a stiff rubber band the other way.
    d.offset = raw >= 0 ? raw : -Math.sqrt(-raw) * 2;
    paint(1 - d.offset / size());
  };

  const onPointerUp = (e: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    // Hand the drag's speed to the spring so the release has no seam.
    drive(1 - d.offset / size(), (-d.v * 1000) / size());
    if (d.offset > size() * CLOSE_AT || d.v > FLICK) onOpenChange(false, "drag");
    kick();
  };

  if (!mounted) return null;

  const edge = {
    right: "inset-y-0 right-0 h-full w-[min(420px,100vw)] rounded-l-2xl border-l",
    left: "inset-y-0 left-0 h-full w-[min(420px,100vw)] rounded-r-2xl border-r",
    // Full width on a phone, a centred column on anything wider.
    bottom: "inset-x-0 bottom-0 mx-auto max-h-[85vh] w-full max-w-xl rounded-t-3xl border-x border-t",
  }[side];

  const handle = (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className={`flex shrink-0 cursor-grab touch-none items-center justify-center active:cursor-grabbing ${
        vertical ? "h-7 w-full" : `absolute inset-y-0 ${side === "right" ? "left-0" : "right-0"} w-5`
      }`}
      aria-hidden="true"
    >
      <span className={`rounded-full bg-white/20 ${vertical ? "h-1 w-10" : "h-10 w-1"}`} />
    </div>
  );

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      className="fixed inset-0 m-0 h-full max-h-none w-full max-w-none overflow-hidden bg-transparent p-0 text-white backdrop:bg-transparent"
    >
      <div ref={backdropRef} aria-hidden="true" className="fixed inset-0 bg-black/50" style={{ opacity: 0 }} />
      <div
        ref={panelRef}
        className={`fixed flex flex-col border-white/[0.1] bg-[#0b0b0b] shadow-[0_0_80px_rgba(0,0,0,0.6)] ${edge} ${className}`}
        style={{ transform: vertical ? "translateY(100%)" : `translateX(${away * 100}%)` }}
      >
        {handle}
        <div className={`flex items-start justify-between gap-4 px-6 ${vertical ? "pt-1" : "pt-6"}`}>
          <div>
            <h2 id={titleId} className="text-[17px] font-medium tracking-[-0.01em] text-white/95">
              {title}
            </h2>
            {description && (
              <div id={descId} className="mt-1.5 text-sm leading-relaxed text-white/55">
                {description}
              </div>
            )}
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={() => onOpenChange(false, "button")}
            className="-mr-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/50 transition-colors hover:bg-white/[0.06] hover:text-white/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            <X size={16} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-white/[0.08] px-6 py-4">{footer}</div>}
      </div>
    </dialog>
  );
};
