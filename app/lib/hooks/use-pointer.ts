"use client";
import { useEffect, useRef, useState } from "react";
import { usePointerContext } from "./pointer-context";
import { subscribeAttention } from "./attention";
import { motionTime } from "./reduced-motion";

type PointerState = {
  /** Smoothed cursor X as 0-100 percentage of viewport width */
  xPc: number;
  /** Smoothed cursor Y as 0-100 percentage of viewport height */
  yPc: number;
  /** Elapsed time in seconds (for animation) */
  time: number;
  /** Raw pixel position */
  clientX: number;
  clientY: number;
  /** Whether pointer is currently over the tracked element */
  isHovering: boolean;
  /** Whether the hook has mounted (use to guard SSR-sensitive rendering) */
  mounted: boolean;
};

type UsePointerOptions = {
  /** Lerp smoothing factor (0-1). Lower = smoother/laggier. Default: 0.12 */
  lerp?: number;
  /** Whether to track globally or only within a ref'd element. Default: true (global) */
  global?: boolean;
};

/**
 * Tolerance for reusing the shared provider's smoothing. If a consumer's
 * requested lerp differs from the provider's lerp by more than this, we bind
 * our own listener so the consumer's visual intent is preserved.
 *
 * Trade-off: a handful of components (lerps 0.15–0.2) will still bind their
 * own listener even under the provider. The heavy 0.06–0.08 majority — which
 * is most of the gallery — shares a single listener.
 */
const LERP_TOLERANCE = 0.03;

export const usePointer = (options: UsePointerOptions = {}): PointerState => {
  const { lerp: lerpFactor = 0.12 } = options;
  const sharedCtx = usePointerContext();

  // If we're inside a PointerProvider and its lerp is close enough to what the
  // consumer asked for, reuse the shared smoothing and skip binding a listener.
  const canUseShared =
    sharedCtx !== null && Math.abs(sharedCtx.lerp - lerpFactor) <= LERP_TOLERANCE;

  const [state, setState] = useState<PointerState>({
    xPc: 50,
    yPc: 50,
    time: 0,
    clientX: 0,
    clientY: 0,
    isHovering: false,
    mounted: false,
  });

  const targetRef = useRef({ x: 50, y: 50, clientX: 0, clientY: 0 });
  const currentRef = useRef({ x: 50, y: 50 });
  const hoveringRef = useRef(false);

  useEffect(() => {
    // When the shared provider is driving us, don't bind our own listener or
    // rAF — the context value itself re-renders us on throttled snapshots.
    if (canUseShared) return;

    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    const onLeave = () => {
      hoveringRef.current = false;
    };

    // Mouse, touch and keyboard focus all count as the user being here.
    const unsubscribe = subscribeAttention(({ x, y, kind }) => {
      if (kind === "none") {
        hoveringRef.current = false;
        return;
      }
      targetRef.current = {
        x: (x / window.innerWidth) * 100,
        y: (y / window.innerHeight) * 100,
        clientX: x,
        clientY: y,
      };
      hoveringRef.current = true;
    });
    document.addEventListener("mouseleave", onLeave);

    let raf: number;
    const tick = () => {
      currentRef.current.x = lerp(currentRef.current.x, targetRef.current.x, lerpFactor);
      currentRef.current.y = lerp(currentRef.current.y, targetRef.current.y, lerpFactor);

      setState({
        xPc: currentRef.current.x,
        yPc: currentRef.current.y,
        time: motionTime(),
        clientX: targetRef.current.clientX,
        clientY: targetRef.current.clientY,
        isHovering: hoveringRef.current,
        mounted: true,
      });

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    return () => {
      unsubscribe();
      document.removeEventListener("mouseleave", onLeave);
      cancelAnimationFrame(raf);
    };
  }, [lerpFactor, canUseShared]);

  // Shared path: synthesise the public shape from the provider snapshot.
  // `isHovering` is always true under the provider (there's no onLeave tracked
  // shared-side). Consumers that depend on isHovering going false on tab/window
  // blur should bind their own listener (pass a lerp outside tolerance or use
  // usePointer outside of the provider).
  if (canUseShared && sharedCtx) {
    return {
      xPc: sharedCtx.xPc,
      yPc: sharedCtx.yPc,
      time: sharedCtx.time,
      clientX: sharedCtx.clientX,
      clientY: sharedCtx.clientY,
      isHovering: sharedCtx.mounted,
      mounted: sharedCtx.mounted,
    };
  }

  return state;
};
