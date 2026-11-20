"use client";
import { useEffect, useRef, useState } from "react";
import { getAttention, type AttentionKind } from "../hooks/attention";
import { motionTime } from "../hooks/reduced-motion";
import { pastelColour } from "../primitives/gradient";
import {
  accessibleName,
  contrastOf,
  firstTextElement,
  interactiveElements,
  roleOf,
  tabSequence,
  textElementAt,
  trackMotion,
  XRAY_ROOT_ATTR,
  type ContrastReading,
  type RunStats,
} from "./measure";
import { getXray } from "./store";

const INK = "rgba(255,255,255,0.32)";
const INK_SOFT = "rgba(255,255,255,0.12)";
const LABEL = "rgba(255,255,255,0.78)";
const WARN = "#ff9d8a";
const FOCUS = "#c4b5fd";
const SPRING = "#86efac";
const MIN_TARGET = 24;

const KIND_LABEL: Record<AttentionKind, string> = {
  mouse: "cursor",
  touch: "touch",
  keyboard: "keyboard focus",
  none: "idle",
};

const truncate = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

const fmt = (n: number, unit: string) => {
  const digits = unit === "px" || unit === "°" ? 1 : 3;
  return `${n.toFixed(digits)}${unit}`;
};

/** A pill of mono text, clamped so it never runs off-screen. */
const pill = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, colour: string, w: number, h: number) => {
  ctx.font = "500 10px var(--font-geist-mono), ui-monospace, monospace";
  const width = ctx.measureText(text).width + 10;
  const left = Math.max(4, Math.min(x, w - width - 4));
  const top = Math.max(4, Math.min(y, h - 18));
  ctx.fillStyle = "rgba(5,5,5,0.86)";
  ctx.beginPath();
  ctx.roundRect(left, top, width, 15, 4);
  ctx.fill();
  ctx.strokeStyle = colour;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = colour;
  ctx.fillText(text, left + 5, top + 10.5);
};

type Inspected = {
  role: string;
  name: string;
  size: string;
  contrast: ContrastReading | null;
  stop: number | null;
  stops: number;
  spring: RunStats | null;
};

/**
 * Draws every X-ray layer on one canvas over the page. The canvas and the
 * inspector card ignore the pointer, so the site underneath works exactly as
 * normal while it is being inspected.
 */
export const XrayOverlay = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [inspected, setInspected] = useState<Inspected | null>(null);

  // Overlays live in the browser's top layer, above any z-index. X-ray joins
  // it too, and steps back to the top whenever another one opens, so it
  // always draws over the menu or dialog it is measuring.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const raise = () => {
      try {
        if (root.matches(":popover-open")) root.hidePopover();
        root.showPopover();
      } catch {
        // No Popover API: it stays a fixed layer at z-90.
      }
    };
    raise();
    let open = -1;
    const timer = window.setInterval(() => {
      const count = document.querySelectorAll(":popover-open, dialog[open]").length;
      if (count !== open) {
        open = count;
        raise();
      }
    }, 200);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const motion = trackMotion();
    let elements: HTMLElement[] = [];
    let elementSet = new Set<HTMLElement>();
    let sequence: HTMLElement[] = [];
    let lastScan = 0;
    let lastKey = "";
    let frame = 0;
    let w = 0;
    let h = 0;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const inView = (r: DOMRect) => r.bottom > 0 && r.top < h && r.right > 0 && r.left < w;

    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      const { layers } = getXray();
      ctx.clearRect(0, 0, w, h);

      // The element list changes rarely; rescan twice a second, measure every frame.
      if (now - lastScan > 500) {
        lastScan = now;
        elements = interactiveElements();
        elementSet = new Set(elements);
        sequence = tabSequence(elements);
      }

      const attention = getAttention();
      const active = attention.kind !== "none";
      const focused = document.activeElement instanceof HTMLElement ? document.activeElement : null;

      // Hit targets
      if (layers.targets) {
        for (const el of elements) {
          const r = el.getBoundingClientRect();
          if (!inView(r)) continue;
          const small = Math.min(r.width, r.height) < MIN_TARGET;
          ctx.strokeStyle = small ? WARN : INK;
          ctx.setLineDash(small ? [3, 3] : []);
          ctx.lineWidth = 1;
          ctx.strokeRect(r.left + 0.5, r.top + 0.5, r.width - 1, r.height - 1);
          ctx.setLineDash([]);
          if (small || r.width > 56) {
            ctx.font = "500 9px var(--font-geist-mono), ui-monospace, monospace";
            ctx.fillStyle = small ? WARN : "rgba(255,255,255,0.45)";
            ctx.fillText(`${Math.round(r.width)}×${Math.round(r.height)}`, r.left + 3, r.bottom - 3);
          }
        }
      }

      // Focus order: numbered stops joined by a path
      if (layers.focus) {
        let previous: { x: number; y: number } | null = null;
        ctx.strokeStyle = FOCUS;
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = 1;
        ctx.beginPath();
        sequence.forEach((el) => {
          const r = el.getBoundingClientRect();
          const point = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
          if (inView(r) && previous) {
            ctx.moveTo(previous.x, previous.y);
            ctx.lineTo(point.x, point.y);
          }
          previous = inView(r) ? point : null;
        });
        ctx.stroke();
        ctx.globalAlpha = 1;
        sequence.forEach((el, i) => {
          const r = el.getBoundingClientRect();
          if (!inView(r)) return;
          const current = el === focused;
          ctx.fillStyle = current ? FOCUS : "rgba(5,5,5,0.9)";
          ctx.strokeStyle = FOCUS;
          ctx.beginPath();
          ctx.arc(r.left, r.top, 8, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.font = "600 9px var(--font-geist-mono), ui-monospace, monospace";
          ctx.fillStyle = current ? "#050505" : FOCUS;
          ctx.textAlign = "center";
          ctx.fillText(String(i + 1), r.left, r.top + 3);
          ctx.textAlign = "left";
        });
      }

      // Roles and accessible names
      if (layers.roles) {
        for (const el of elements) {
          const r = el.getBoundingClientRect();
          if (!inView(r)) continue;
          const name = accessibleName(el);
          pill(ctx, `${roleOf(el)} · ${name ? truncate(name, 26) : "no name"}`, r.left, r.top - 17, name ? LABEL : WARN, w, h);
        }
      }

      // Springs: a live trace beside everything a spring is moving
      if (layers.springs) {
        for (const item of motion.active(now)) {
          const r = item.el.getBoundingClientRect();
          if (!inView(r) || item.trace.length < 2) continue;
          // Page-sized reveals are layout, not component springs.
          if (r.width * r.height > w * h * 0.25) continue;
          ctx.strokeStyle = SPRING;
          ctx.globalAlpha = item.moving ? 0.9 : 0.4;
          ctx.strokeRect(r.left - 2.5, r.top - 2.5, r.width + 5, r.height + 5);

          const boxW = 96;
          const boxH = 30;
          const bx = Math.max(4, Math.min(r.right + 6, w - boxW - 4));
          const by = Math.max(22, Math.min(r.top, h - boxH - 4));
          ctx.globalAlpha = 1;
          ctx.fillStyle = "rgba(5,5,5,0.86)";
          ctx.beginPath();
          ctx.roundRect(bx, by, boxW, boxH, 5);
          ctx.fill();

          const t0 = now - 1400;
          const values = item.trace.map((s) => s.v);
          const rest = item.stats?.to ?? values[values.length - 1];
          const lo = Math.min(...values, rest);
          const hi = Math.max(...values, rest);
          const span = hi - lo || 1;
          const yOf = (v: number) => by + boxH - 5 - ((v - lo) / span) * (boxH - 10);
          // The resting value, dashed, so overshoot reads as the line crossing it.
          ctx.strokeStyle = INK_SOFT;
          ctx.setLineDash([2, 3]);
          ctx.beginPath();
          ctx.moveTo(bx + 4, yOf(rest));
          ctx.lineTo(bx + boxW - 4, yOf(rest));
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.strokeStyle = SPRING;
          ctx.lineWidth = 1.25;
          ctx.beginPath();
          item.trace.forEach((s, i) => {
            const x = bx + 4 + Math.max(0, (s.t - t0) / 1400) * (boxW - 8);
            if (i === 0) ctx.moveTo(x, yOf(s.v));
            else ctx.lineTo(x, yOf(s.v));
          });
          ctx.stroke();
          ctx.lineWidth = 1;

          const stats = item.stats;
          const caption = item.looping
            ? `${item.channel} · loop`
            : stats
              ? `${stats.channel} · +${fmt(stats.overshoot, stats.unit)} · ${Math.round(stats.settleMs)}ms`
              : item.channel;
          pill(ctx, caption, bx, by - 17, SPRING, w, h);
        }
        ctx.globalAlpha = 1;
      }

      // Attention: the one point every component is reacting to
      if (layers.attention && active) {
        const { r, g, b } = pastelColour((attention.x / w) * 100, (attention.y / h) * 100, motionTime());
        const colour = `rgb(${Math.round(r)} ${Math.round(g)} ${Math.round(b)})`;
        ctx.strokeStyle = colour;
        ctx.globalAlpha = 0.22;
        ctx.beginPath();
        ctx.moveTo(0, attention.y + 0.5);
        ctx.lineTo(w, attention.y + 0.5);
        ctx.moveTo(attention.x + 0.5, 0);
        ctx.lineTo(attention.x + 0.5, h);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(attention.x, attention.y, 11, 0, Math.PI * 2);
        ctx.stroke();
        ctx.lineWidth = 1;
        pill(
          ctx,
          `${KIND_LABEL[attention.kind]} · ${((attention.x / w) * 100).toFixed(0)}%, ${((attention.y / h) * 100).toFixed(0)}% · rgb ${Math.round(r)} ${Math.round(g)} ${Math.round(b)}`,
          attention.x + 16,
          attention.y + 14,
          colour,
          w,
          h,
        );
      }

      // Inspector: what is under the attention point (or focused), measured
      const card = cardRef.current;
      if (layers.contrast && active) {
        const byKeyboard = attention.kind === "keyboard" && focused !== null;
        const target = byKeyboard
          ? focused
          : (document.elementsFromPoint(attention.x, attention.y).find((el) => !el.closest(`[${XRAY_ROOT_ATTR}]`)) ?? null);
        // The control the target belongs to, if any.
        let interactive: HTMLElement | null = null;
        for (let node: Element | null = target; node && !interactive; node = node.parentElement) {
          if (elementSet.has(node as HTMLElement)) interactive = node as HTMLElement;
        }
        const textEl = byKeyboard && focused ? firstTextElement(focused) : textElementAt(attention.x, attention.y);
        const contrast = textEl ? contrastOf(textEl) : null;
        const subject = interactive ?? (textEl as HTMLElement | null);

        if (textEl) {
          const tr = textEl.getBoundingClientRect();
          ctx.strokeStyle = contrast?.verdict === "fail" ? WARN : "rgba(255,255,255,0.55)";
          ctx.setLineDash([4, 3]);
          ctx.strokeRect(tr.left - 1.5, tr.top - 1.5, tr.width + 3, tr.height + 3);
          ctx.setLineDash([]);
        }

        if (card && subject) {
          const r = subject.getBoundingClientRect();
          const stopIndex = sequence.indexOf(subject);
          const springItem = motion.active(now).find((m) => subject.contains(m.el));
          const next: Inspected = {
            role: roleOf(subject),
            name: accessibleName(subject),
            size: `${Math.round(r.width)}×${Math.round(r.height)}`,
            contrast,
            stop: stopIndex >= 0 ? stopIndex + 1 : null,
            stops: sequence.length,
            spring: springItem?.stats ?? null,
          };
          const key = JSON.stringify([next.role, next.name, next.size, contrast?.ratio.toFixed(2), contrast?.verdict, next.stop, next.spring?.overshoot.toFixed(2), next.spring ? Math.round(next.spring.settleMs / 10) : null]);
          if (key !== lastKey) {
            lastKey = key;
            setInspected(next);
          }
          const cw = card.offsetWidth;
          const ch = card.offsetHeight;
          const x = attention.x + 18 + cw > w ? attention.x - cw - 18 : attention.x + 18;
          const y = Math.max(8, Math.min(attention.y + 34, h - ch - 8));
          card.style.transform = `translate(${Math.max(8, x)}px, ${y}px)`;
          card.style.opacity = "1";
        } else if (card) {
          card.style.opacity = "0";
        }
      } else if (card) {
        card.style.opacity = "0";
      }
    };
    frame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frame);
      motion.stop();
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      {...{ [XRAY_ROOT_ATTR]: "" }}
      popover="manual"
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[90] m-0 h-full w-full overflow-visible border-0 bg-transparent p-0"
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      <div
        ref={cardRef}
        className="absolute left-0 top-0 w-[232px] rounded-xl border border-white/[0.1] bg-[#070707]/95 p-3 font-mono text-[10.5px] leading-relaxed text-white/70 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.9)] backdrop-blur-md"
        style={{ opacity: 0 }}
      >
        {inspected && <InspectorBody data={inspected} />}
      </div>
    </div>
  );
};

const Row = ({ k, children }: { k: string; children: React.ReactNode }) => (
  <div className="flex justify-between gap-3">
    <span className="text-white/40">{k}</span>
    <span className="truncate text-right text-white/85">{children}</span>
  </div>
);

const VERDICT_COLOUR: Record<ContrastReading["verdict"], string> = {
  AAA: "text-[#86efac]",
  AA: "text-[#86efac]",
  "AA large": "text-[#fde68a]",
  fail: "text-[#ff9d8a]",
};

const InspectorBody = ({ data }: { data: Inspected }) => (
  <div className="grid gap-0.5">
    <Row k="role">{data.role}</Row>
    <Row k="name">{data.name ? truncate(data.name, 28) : <span className="text-[#ff9d8a]">none</span>}</Row>
    <Row k="size">{data.size}</Row>
    {data.stop !== null && (
      <Row k="tab stop">
        {data.stop} of {data.stops}
      </Row>
    )}
    {data.contrast && (
      <Row k="contrast">
        {data.contrast.ratio.toFixed(2)}:1{" "}
        <span className={VERDICT_COLOUR[data.contrast.verdict]}>{data.contrast.verdict}</span>
        {data.contrast.approximate ? " ~" : ""}
      </Row>
    )}
    {data.spring && (
      <Row k="spring">
        +{fmt(data.spring.overshoot, data.spring.unit)} · {Math.round(data.spring.settleMs)}ms
      </Row>
    )}
  </div>
);
