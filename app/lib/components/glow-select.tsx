"use client";
import { useRef, useEffect, useState, useCallback } from "react";
import { pastelColour } from "../primitives/gradient";

export interface GlowSelectOption {
  value: string;
  label: string;
}

export interface GlowSelectProps {
  /** Available options */
  options: GlowSelectOption[];
  /** Controlled value */
  value: string;
  /** Change handler */
  onChange: (value: string) => void;
  /** Floating label text */
  label?: string;
  /** Placeholder when no value is selected */
  placeholder?: string;
  /** Disables the select and suppresses all glow and spring motion */
  disabled?: boolean;
  /** Additional class names applied to the outermost wrapper div */
  className?: string;
}

/**
 * Dropdown select with a floating label that springs on selection and a
 * cursor-mapped pastel border glow. Dropdown springs in with opacity and
 * translateY. Chevron rotates with spring physics.
 *
 * @example
 * <GlowSelect
 *   label="Country"
 *   options={[{ value: "uk", label: "United Kingdom" }]}
 *   value={country}
 *   onChange={setCountry}
 * />
 */
export const GlowSelect = ({
  options,
  value,
  onChange,
  label = "Label",
  placeholder = "Select…",
  disabled = false,
  className = "",
}: GlowSelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const chevronRef = useRef<SVGSVGElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const selectedOption = options.find((o) => o.value === value);

  // Live values for rAF reads
  const live = useRef({
    isOpen: false,
    isFocused: false,
    value: "",
    disabled: false,
  });
  useEffect(() => {
    live.current = { isOpen, isFocused, value, disabled };
  }, [isOpen, isFocused, value, disabled]);

  // Spring state — mutable, never triggers re-render
  const isFilled = value.length > 0;
  const startsFloated = isFilled || isFocused || isOpen;

  const sp = useRef({
    labelY: startsFloated ? -24 : 0,
    labelYVel: 0,
    labelScale: startsFloated ? 0.75 : 1,
    labelScaleVel: 0,
    glow: 0,
    glowVel: 0,
    chevronRot: 0,
    chevronRotVel: 0,
    dropOpacity: 0,
    dropOpacityVel: 0,
    dropY: 0,
    dropYVel: 0,
  });

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setIsFocused(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = useCallback(
    (val: string) => {
      onChange(val);
      setIsOpen(false);
      triggerRef.current?.focus();
    },
    [onChange]
  );

  useEffect(() => {
    const step = (
      pos: number,
      vel: number,
      target: number,
      k: number,
      d: number
    ): [number, number] => {
      const acc = k * (target - pos) - d * vel;
      const newVel = vel + acc / 60;
      return [pos + newVel / 60, newVel];
    };

    let rawX = 50;
    let rawY = 50;
    let smoothX = 50;
    let smoothY = 50;
    let proximity = 0;

    const onMove = (e: PointerEvent) => {
      rawX = (e.clientX / window.innerWidth) * 100;
      rawY = (e.clientY / window.innerHeight) * 100;

      if (wrapRef.current) {
        const rect = wrapRef.current.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = Math.max(0, Math.abs(e.clientX - cx) - rect.width / 2);
        const dy = Math.max(0, Math.abs(e.clientY - cy) - rect.height / 2);
        const dist = Math.sqrt(dx * dx + dy * dy);
        const range = 120;
        proximity = Math.max(0, 1 - dist / range);
      }
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    let raf: number;

    const tick = () => {
      smoothX += (rawX - smoothX) * 0.08;
      smoothY += (rawY - smoothY) * 0.08;

      const s = sp.current;
      const { isOpen: open, isFocused: focused, value: val, disabled: dis } = live.current;
      const filled = val.length > 0;
      const floated = focused || filled || open;

      // Spring targets
      const targetLabelY = floated ? -24 : 0;
      const targetLabelScale = floated ? 0.75 : 1;
      const targetGlow = dis ? 0 : open || focused ? 1 : Math.min(proximity, 0.45);
      const targetChevronRot = open ? 180 : 0;
      const targetDropOpacity = open ? 1 : 0;
      const targetDropY = open ? 0 : -8;

      // Integrate springs
      const [ly, lyv] = step(s.labelY, s.labelYVel, targetLabelY, 180, 22);
      const [ls, lsv] = step(s.labelScale, s.labelScaleVel, targetLabelScale, 180, 22);
      const [gw, gwv] = step(s.glow, s.glowVel, targetGlow, 120, 18);
      const [cr, crv] = step(s.chevronRot, s.chevronRotVel, targetChevronRot, 200, 24);
      const [dop, dopv] = step(s.dropOpacity, s.dropOpacityVel, targetDropOpacity, 200, 24);
      const [dy, dyv] = step(s.dropY, s.dropYVel, targetDropY, 200, 24);

      s.labelY = ly;
      s.labelYVel = lyv;
      s.labelScale = ls;
      s.labelScaleVel = lsv;
      s.glow = gw;
      s.glowVel = gwv;
      s.chevronRot = cr;
      s.chevronRotVel = crv;
      s.dropOpacity = dop;
      s.dropOpacityVel = dopv;
      s.dropY = dy;
      s.dropYVel = dyv;

      const glowClamped = Math.max(0, Math.min(1, gw));
      const t = performance.now() / 1000;

      const { r, g, b } = pastelColour(smoothX, smoothY, t);

      // Label
      if (labelRef.current) {
        labelRef.current.style.transform = `translateY(${ly}px) scale(${ls})`;
        if (floated) {
          const lr = Math.round(255 + (r - 255) * glowClamped);
          const lg = Math.round(255 + (g - 255) * glowClamped);
          const lb = Math.round(255 + (b - 255) * glowClamped);
          labelRef.current.style.color = `rgba(${lr},${lg},${lb},0.9)`;
        } else {
          labelRef.current.style.color = "rgba(255,255,255,0.35)";
        }
      }

      // Trigger border + glow
      if (triggerRef.current) {
        if (glowClamped < 0.005) {
          triggerRef.current.style.boxShadow = "0 0 0 1px rgba(255,255,255,0.1)";
        } else {
          const g0 = glowClamped;
          const outerGlow = Math.max(0, (g0 - 0.45) / 0.55);
          triggerRef.current.style.boxShadow = [
            `0 0 0 1px rgba(${r},${g},${b},${(0.85 * g0).toFixed(3)})`,
            `0 0 16px 3px rgba(${r},${g},${b},${(0.18 * outerGlow).toFixed(3)})`,
            "0 0 0 1px rgba(255,255,255,0.04)",
          ].join(", ");
        }
      }

      // Chevron rotation
      if (chevronRef.current) {
        chevronRef.current.style.transform = `rotate(${cr}deg)`;
        const chevronAlpha = floated ? 0.7 : 0.35;
        chevronRef.current.style.color = `rgba(255,255,255,${chevronAlpha})`;
      }

      // Dropdown
      if (dropdownRef.current) {
        const dropClamped = Math.max(0, Math.min(1, dop));
        dropdownRef.current.style.opacity = `${dropClamped}`;
        dropdownRef.current.style.transform = `translateY(${dy}px)`;
        dropdownRef.current.style.pointerEvents = open ? "auto" : "none";

        if (glowClamped > 0.005) {
          dropdownRef.current.style.borderColor = `rgba(${r},${g},${b},${(0.4 * glowClamped).toFixed(3)})`;
        } else {
          dropdownRef.current.style.borderColor = "rgba(255,255,255,0.1)";
        }
      }

      // Option hover colour — highlight active option
      optionRefs.current.forEach((el, i) => {
        if (!el) return;
        const opt = options[i];
        if (opt && opt.value === live.current.value) {
          el.style.color = "rgba(255,255,255,0.9)";
          el.style.backgroundColor = `rgba(${r},${g},${b},0.12)`;
        } else {
          el.style.color = "rgba(255,255,255,0.5)";
          el.style.backgroundColor = "transparent";
        }
      });

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, [options]);

  return (
    <div
      ref={wrapRef}
      className={`relative${className ? ` ${className}` : ""}`}
      style={{ opacity: disabled ? 0.4 : 1 }}
    >
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          if (!disabled) {
            setIsOpen((prev) => !prev);
            setIsFocused(true);
          }
        }}
        onFocus={() => setIsFocused(true)}
        onBlur={() => {
          // Delay blur to allow option click to register
          setTimeout(() => {
            if (wrapRef.current && !wrapRef.current.contains(document.activeElement)) {
              setIsFocused(false);
              setIsOpen(false);
            }
          }, 0);
        }}
        disabled={disabled}
        className="w-full bg-transparent border border-white/[0.15] rounded-xl px-4 pt-7 pb-3 text-left text-sm outline-none disabled:cursor-not-allowed flex items-center justify-between"
        style={{
          transition: "none",
          willChange: "box-shadow",
          boxShadow: "0 0 0 1px rgba(255,255,255,0.1)",
        }}
      >
        <span className={selectedOption ? "text-white" : "text-white/30"}>
          {selectedOption ? selectedOption.label : (isFocused || isOpen ? placeholder : "")}
        </span>

        {/* Chevron */}
        <svg
          ref={chevronRef}
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0 ml-2 will-change-transform"
          style={{ color: "rgba(255,255,255,0.35)" }}
        >
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>

      {/* Floating label */}
      <span
        ref={labelRef}
        className="absolute left-4 top-5 pointer-events-none text-sm inline-block will-change-transform origin-top-left"
        style={{
          color: "rgba(255,255,255,0.35)",
          transform: `translateY(${startsFloated ? -24 : 0}px) scale(${startsFloated ? 0.75 : 1})`,
        }}
      >
        {label}
      </span>

      {/* Dropdown */}
      <div
        ref={dropdownRef}
        className="absolute left-0 right-0 top-full mt-2 rounded-xl border overflow-hidden z-50"
        style={{
          backgroundColor: "rgba(20,20,20,0.95)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderColor: "rgba(255,255,255,0.1)",
          opacity: 0,
          transform: "translateY(-8px)",
          pointerEvents: "none",
          willChange: "opacity, transform",
        }}
      >
        {options.map((opt, i) => (
          <button
            key={opt.value}
            ref={(el) => {
              optionRefs.current[i] = el;
            }}
            type="button"
            onClick={() => handleSelect(opt.value)}
            className="w-full text-left px-4 py-2.5 text-sm outline-none cursor-pointer"
            style={{
              color: "rgba(255,255,255,0.5)",
              backgroundColor: "transparent",
              transition: "none",
            }}
            onMouseEnter={(e) => {
              if (opt.value !== value) {
                e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.06)";
                e.currentTarget.style.color = "rgba(255,255,255,0.7)";
              }
            }}
            onMouseLeave={(e) => {
              if (opt.value !== value) {
                e.currentTarget.style.backgroundColor = "transparent";
                e.currentTarget.style.color = "rgba(255,255,255,0.5)";
              }
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
};
