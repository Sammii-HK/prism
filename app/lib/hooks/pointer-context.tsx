"use client";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

type PointerSnapshot = {
  xPc: number;
  yPc: number;
  time: number;
  clientX: number;
  clientY: number;
  mounted: boolean;
};

type PointerContextValue = PointerSnapshot & {
  /** Ref to the smoothed values — updated every rAF without triggering renders. */
  ref: React.MutableRefObject<PointerSnapshot>;
};

const defaultSnapshot: PointerSnapshot = {
  xPc: 50,
  yPc: 50,
  time: 0,
  clientX: 0,
  clientY: 0,
  mounted: false,
};

const PointerContext = createContext<PointerContextValue | null>(null);

type Props = {
  children: ReactNode;
  /** Lerp smoothing factor. Lower = smoother/laggier. Default: 0.08 */
  lerp?: number;
  /** Milliseconds between React state updates (ref is always live). Default: 60 (~16fps) */
  throttleMs?: number;
};

/**
 * A single global pointer provider. One `pointermove` listener, one rAF loop,
 * shared across every consumer. Ref is live every frame; React state is
 * throttled to avoid re-rendering large trees.
 */
export const PointerProvider = ({ children, lerp = 0.08, throttleMs = 60 }: Props) => {
  const ref = useRef<PointerSnapshot>({ ...defaultSnapshot });
  const [snapshot, setSnapshot] = useState<PointerSnapshot>(defaultSnapshot);

  useEffect(() => {
    const lerpFn = (a: number, b: number, t: number) => a + (b - a) * t;

    let targetX = 50;
    let targetY = 50;
    let targetClientX = 0;
    let targetClientY = 0;
    let currentX = 50;
    let currentY = 50;
    let lastEmit = 0;

    const onMove = (e: PointerEvent) => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      targetX = (e.clientX / vw) * 100;
      targetY = (e.clientY / vh) * 100;
      targetClientX = e.clientX;
      targetClientY = e.clientY;
    };

    window.addEventListener("pointermove", onMove, { passive: true });

    let raf: number;
    const tick = () => {
      currentX = lerpFn(currentX, targetX, lerp);
      currentY = lerpFn(currentY, targetY, lerp);
      const now = performance.now();
      const next: PointerSnapshot = {
        xPc: currentX,
        yPc: currentY,
        time: now / 1000,
        clientX: targetClientX,
        clientY: targetClientY,
        mounted: true,
      };
      ref.current = next;
      if (now - lastEmit > throttleMs) {
        lastEmit = now;
        setSnapshot(next);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, [lerp, throttleMs]);

  return (
    <PointerContext.Provider value={{ ...snapshot, ref }}>
      {children}
    </PointerContext.Provider>
  );
};

/** Consume the shared pointer. Returns the throttled snapshot; use `.ref` for live rAF loops. */
export const useSharedPointer = () => {
  const ctx = useContext(PointerContext);
  if (!ctx) {
    // Fall back to default snapshot — lets components work outside the provider.
    return { ...defaultSnapshot, ref: { current: { ...defaultSnapshot } } as React.MutableRefObject<PointerSnapshot> };
  }
  return ctx;
};
