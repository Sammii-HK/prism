"use client";
import { useEffect, useRef, useState } from "react";
import { reducedMotionNow } from "../../lib/hooks/reduced-motion";
import type { SynthEngine } from "./engine";
import { isBlack, noteName, pitchColour, rgb, SEMITONE_TO_HINT, spokenName } from "./music";

type KeyboardProps = {
  engine: SynthEngine;
  /** Octave of the lowest C (4 = middle C). */
  octave: number;
  /** Envelope times in seconds: the key light rises and fades with them. */
  attack: number;
  release: number;
};

type KeyState = { el: HTMLButtonElement; y: number; v: number; glow: number };

/**
 * Two octaves of keys (one on narrow screens). Each key lights in its pitch
 * colour and springs down while held; the light rises over the attack time
 * and fades over the release, so what you see follows the amp envelope.
 *
 * Pointer: press and drag across keys for a glissando; every finger is
 * tracked separately for chords. Keyboard: arrows move between keys,
 * Space or Enter plays the focused key for as long as it is held.
 */
export const Keyboard = ({ engine, octave, attack, release }: KeyboardProps) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const keys = useRef(new Map<number, KeyState>());
  const pointers = useRef(new Map<number, number | null>());
  const focusHeld = useRef<number | null>(null);
  const env = useRef({ attack, release });
  const [octaves, setOctaves] = useState(2);
  const [focusMidi, setFocusMidi] = useState<number | null>(null);

  useEffect(() => {
    env.current = { attack, release };
  }, [attack, release]);

  // Fewer keys on narrow screens, so every key stays a comfortable target.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setOctaves(entry.contentRect.width < 560 ? 1 : 2));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const low = (octave + 1) * 12;
  const high = low + 12 * octaves;
  const all: number[] = [];
  for (let m = low; m <= high; m++) all.push(m);
  const whites = all.filter((m) => !isBlack(m));
  const blacks = all.filter(isBlack);
  const tabbable = focusMidi !== null && focusMidi >= low && focusMidi <= high ? focusMidi : low;

  // One rAF loop springs and lights every key.
  useEffect(() => {
    const map = keys.current;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const held = engine.getSnapshot().held;
      const reduced = reducedMotionNow();
      const { attack: a, release: r } = env.current;

      map.forEach((k, midi) => {
        const down = held.includes(midi);
        // Light follows the envelope: rise over the attack, fade over the release.
        if (down) k.glow += (1 - k.glow) * (1 - Math.exp(-dt / Math.max(0.012, a / 3)));
        else k.glow *= Math.exp(-dt / Math.max(0.03, r / 4));
        if (k.glow < 0.002) k.glow = 0;

        const target = down ? 1 : 0;
        if (reduced) {
          k.y = target;
          k.v = 0;
        } else {
          k.v = (k.v + (target - k.y) * 0.32) * 0.58;
          k.y += k.v;
        }

        const black = isBlack(midi);
        const col = pitchColour(midi);
        const g = k.glow;
        k.el.style.transform = `translateY(${(k.y * (black ? 2 : 3)).toFixed(2)}px)`;
        k.el.style.backgroundImage = black
          ? `linear-gradient(180deg, ${rgb(col, 0.2 * g)}, ${rgb(col, 0.75 * g)}), linear-gradient(180deg, #141414, #0a0a0a)`
          : `linear-gradient(180deg, ${rgb(col, 0.08 * g)}, ${rgb(col, 0.5 * g)}), linear-gradient(180deg, rgba(255,255,255,0.075), rgba(255,255,255,0.035))`;
        k.el.style.boxShadow =
          g > 0.01
            ? `0 0 ${(22 * g).toFixed(1)}px ${rgb(col, 0.35 * g)}, inset 0 -3px 0 ${rgb(col, 0.95 * g)}`
            : black
              ? "inset 0 -2px 0 rgba(255,255,255,0.06)"
              : "inset 0 -2px 0 rgba(255,255,255,0.05)";
        k.el.style.borderColor = g > 0.01 ? rgb(col, 0.25 + 0.5 * g) : "";
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [engine]);

  // Let go of anything still held if the keyboard unmounts.
  useEffect(() => {
    const ptrs = pointers.current;
    return () => {
      ptrs.forEach((m) => m !== null && engine.noteOff(m));
      ptrs.clear();
      if (focusHeld.current !== null) engine.noteOff(focusHeld.current);
      focusHeld.current = null;
    };
  }, [engine]);

  // Keep each key's spring state across re-renders and octave shifts; only the element changes.
  const register = (midi: number) => (el: HTMLButtonElement | null) => {
    if (!el) return;
    const existing = keys.current.get(midi);
    if (existing) existing.el = el;
    else keys.current.set(midi, { el, y: 0, v: 0, glow: 0 });
  };

  const midiAt = (x: number, y: number): number | null => {
    const hit = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-midi]");
    if (!hit || !wrapRef.current?.contains(hit)) return null;
    return Number(hit.dataset.midi);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    engine.ensure();
    e.currentTarget.setPointerCapture(e.pointerId);
    const m = midiAt(e.clientX, e.clientY);
    pointers.current.set(e.pointerId, m);
    if (m !== null) {
      engine.noteOn(m);
      setFocusMidi(m);
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    const prev = pointers.current.get(e.pointerId) ?? null;
    const m = midiAt(e.clientX, e.clientY);
    if (m === prev) return;
    if (prev !== null) engine.noteOff(prev);
    if (m !== null) engine.noteOn(m);
    pointers.current.set(e.pointerId, m);
  };

  const onPointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    const prev = pointers.current.get(e.pointerId) ?? null;
    if (prev !== null) engine.noteOff(prev);
    pointers.current.delete(e.pointerId);
  };

  const releaseFocusHeld = () => {
    if (focusHeld.current !== null) engine.noteOff(focusHeld.current);
    focusHeld.current = null;
  };

  const moveFocus = (midi: number) => {
    const next = Math.max(low, Math.min(high, midi));
    releaseFocusHeld();
    setFocusMidi(next);
    keys.current.get(next)?.el.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>("[data-midi]");
    if (!el) return;
    const midi = Number(el.dataset.midi);
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      if (e.repeat || focusHeld.current === midi) return;
      releaseFocusHeld();
      engine.noteOn(midi);
      focusHeld.current = midi;
    } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      moveFocus(midi + 1);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      moveFocus(midi - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      moveFocus(low);
    } else if (e.key === "End") {
      e.preventDefault();
      moveFocus(high);
    }
  };

  const onKeyUp = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      releaseFocusHeld();
    }
  };

  const keyProps = (midi: number) => ({
    ref: register(midi),
    type: "button" as const,
    "data-midi": midi,
    tabIndex: midi === tabbable ? 0 : -1,
    "aria-label": spokenName(midi),
    onFocus: () => setFocusMidi(midi),
  });

  const hint = (midi: number) => SEMITONE_TO_HINT[midi - low];
  const whiteWidth = 100 / whites.length;

  return (
    <div
      ref={wrapRef}
      role="group"
      aria-label={`Keyboard, ${noteName(low)} to ${noteName(high)}. Arrow keys move, Space or Enter plays.`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onLostPointerCapture={onPointerEnd}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      onBlur={releaseFocusHeld}
      onContextMenu={(e) => e.preventDefault()}
      className="relative h-40 w-full touch-none select-none sm:h-44 lg:h-48"
    >
      <div className="flex h-full gap-[3px]">
        {whites.map((m) => (
          <button
            key={m}
            {...keyProps(m)}
            className="relative flex h-full min-w-0 flex-1 cursor-pointer flex-col items-center justify-end gap-1 rounded-b-xl rounded-t-[4px] border border-white/[0.08] pb-3 outline-none focus-visible:z-20 focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#080808]"
          >
            {hint(m) && <span aria-hidden="true" className="font-mono text-[11px] text-white/50">{hint(m)}</span>}
            {m % 12 === 0 && (
              <span aria-hidden="true" className="font-mono text-[11px] text-white/60">
                {noteName(m)}
              </span>
            )}
          </button>
        ))}
      </div>
      {blacks.map((m) => {
        const whitesBefore = whites.filter((w) => w < m).length;
        return (
          <button
            key={m}
            {...keyProps(m)}
            className="absolute top-0 z-10 flex h-[60%] cursor-pointer flex-col items-center justify-end rounded-b-lg rounded-t-[3px] border border-white/[0.1] pb-2 outline-none focus-visible:z-20 focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#080808]"
            style={{ left: `${whitesBefore * whiteWidth}%`, width: `${whiteWidth * 0.62}%`, marginLeft: `-${whiteWidth * 0.31}%` }}
          >
            {hint(m) && <span aria-hidden="true" className="font-mono text-[11px] text-white/50">{hint(m)}</span>}
          </button>
        );
      })}
    </div>
  );
};
