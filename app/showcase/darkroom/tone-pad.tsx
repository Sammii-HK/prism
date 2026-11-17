"use client";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { pastelColour } from "../../lib/primitives/gradient";
import type { TintPoint } from "./grade";

type Handle = "shadow" | "highlight";

type Props = {
  shadow: TintPoint;
  highlight: TintPoint;
  onChange: (which: Handle, point: TintPoint) => void;
};

const clamp = (v: number) => Math.max(0, Math.min(100, v));

/**
 * Split-tone picker drawn from Prism's own colour function. The square is
 * `pastelColour(x, y)` across the whole range, the same mapping every
 * component on the site uses for the cursor, so picking a tone here is
 * choosing a place in the Prism palette.
 */
export const TonePad = ({ shadow, highlight, onChange }: Props) => {
  const id = useId();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<Handle | null>(null);

  // Paint the field once: it's a fixed slice of the palette at time 0.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const n = 64;
    canvas.width = n;
    canvas.height = n;
    const img = ctx.createImageData(n, n);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const c = pastelColour((x / (n - 1)) * 100, (y / (n - 1)) * 100, 0);
        const o = (y * n + x) * 4;
        img.data[o] = c.r;
        img.data[o + 1] = c.g;
        img.data[o + 2] = c.b;
        img.data[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }, []);

  const pointFrom = (e: PointerEvent): TintPoint => {
    const rect = boxRef.current!.getBoundingClientRect();
    return {
      x: Math.round(clamp(((e.clientX - rect.left) / rect.width) * 100)),
      y: Math.round(clamp(((e.clientY - rect.top) / rect.height) * 100)),
    };
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).dataset.handle) return; // handles start their own drag
    const p = pointFrom(e);
    // Grab whichever handle is nearer to where you pressed.
    const which: Handle =
      Math.hypot(p.x - shadow.x, p.y - shadow.y) <= Math.hypot(p.x - highlight.x, p.y - highlight.y) ? "shadow" : "highlight";
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(which);
    onChange(which, p);
    document.getElementById(`${id}-${which}`)?.focus({ preventScroll: true });
  };

  const onHandleDown = (which: Handle) => (e: PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    boxRef.current?.setPointerCapture(e.pointerId);
    setDragging(which);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (dragging) onChange(dragging, pointFrom(e));
  };

  const onKey = (which: Handle, p: TintPoint) => (e: KeyboardEvent<HTMLButtonElement>) => {
    const s = e.shiftKey ? 10 : 2;
    const moves: Record<string, TintPoint> = {
      ArrowLeft: { x: p.x - s, y: p.y },
      ArrowRight: { x: p.x + s, y: p.y },
      ArrowUp: { x: p.x, y: p.y - s },
      ArrowDown: { x: p.x, y: p.y + s },
    };
    const m = moves[e.key];
    if (!m) return;
    e.preventDefault();
    onChange(which, { x: clamp(m.x), y: clamp(m.y) });
  };

  const handle = (which: Handle, p: TintPoint, label: string) => {
    const c = pastelColour(p.x, p.y, 0);
    return (
      <button
        id={`${id}-${which}`}
        type="button"
        data-handle={which}
        role="slider"
        aria-label={`${label} tone`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={p.x}
        aria-valuetext={`${label} tone, ${p.x} across, ${p.y} down, rgb ${c.r} ${c.g} ${c.b}`}
        onPointerDown={onHandleDown(which)}
        onKeyDown={onKey(which, p)}
        className="group absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full outline-none"
        style={{ left: `${p.x}%`, top: `${p.y}%` }}
      >
        <span
          className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-[#060606] font-mono text-[9px] font-medium text-[#060606] ring-2 ring-white/80 transition-[box-shadow] group-focus-visible:ring-white"
          style={{ backgroundColor: `rgb(${c.r} ${c.g} ${c.b})`, boxShadow: `0 0 16px rgb(${c.r} ${c.g} ${c.b})` }}
          aria-hidden="true"
        >
          {which === "shadow" ? "S" : "H"}
        </span>
      </button>
    );
  };

  const sc = pastelColour(shadow.x, shadow.y, 0);
  const hc = pastelColour(highlight.x, highlight.y, 0);

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={boxRef}
        className="relative aspect-[4/3] w-full touch-none select-none overflow-visible rounded-2xl"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => setDragging(null)}
        onPointerCancel={() => setDragging(null)}
      >
        <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 h-full w-full rounded-2xl" style={{ imageRendering: "auto" }} />
        <div aria-hidden="true" className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/10" />
        {handle("shadow", shadow, "Shadow")}
        {handle("highlight", highlight, "Highlight")}
      </div>
      {/* The ramp the two tones make, from black through shadow tone to highlight tone to white. */}
      <div
        aria-hidden="true"
        className="h-2 rounded-full"
        style={{
          background: `linear-gradient(90deg, #000, rgb(${sc.r * 0.45} ${sc.g * 0.45} ${sc.b * 0.45}), rgb(${hc.r} ${hc.g} ${hc.b}), #fff)`,
        }}
      />
    </div>
  );
};
