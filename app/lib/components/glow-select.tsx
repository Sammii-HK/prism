"use client";
import { useRef, useEffect, useState, useCallback, useId } from "react";
import { pastelColour } from "../primitives/gradient";
import { subscribeAttention, type Attention, proximityTo } from "../hooks/attention";
import { motionTime, reducedMotionNow } from "../hooks/reduced-motion";

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
  // Keyboard-highlighted option while open (aria-activedescendant)
  const [activeIndex, setActiveIndex] = useState(-1);
  const activeRef = useRef(-1);
  useEffect(() => {
    activeRef.current = isOpen ? activeIndex : -1;
  }, [isOpen, activeIndex]);
  const typeahead = useRef({ text: "", timer: 0 });

  const baseId = useId();
  const labelId = `${baseId}-label`;
  const listboxId = `${baseId}-listbox`;
  const optionId = (i: number) => `${baseId}-option-${i}`;

  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const chevronRef = useRef<SVGSVGElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const selectedOption = options.find((o) => o.value === value);
  const selectedIndex = options.findIndex((o) => o.value === value);

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
    labelY: startsFloated ? -12 : 0,
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

  const openAt = (index: number) => {
    setIsOpen(true);
    setIsFocused(true);
    setActiveIndex(Math.max(0, Math.min(options.length - 1, index)));
  };

  // Select-only combobox keyboard model (WAI-ARIA APG): focus stays on the trigger
  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled || options.length === 0) return;
    const last = options.length - 1;
    const current = activeIndex >= 0 ? activeIndex : Math.max(0, selectedIndex);

    // Type-ahead: jump to the next option whose label starts with the typed text
    if (e.key.length === 1 && e.key !== " " && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const ta = typeahead.current;
      window.clearTimeout(ta.timer);
      ta.text += e.key.toLowerCase();
      ta.timer = window.setTimeout(() => {
        ta.text = "";
      }, 500);
      const from = ta.text.length === 1 ? current + 1 : current;
      for (let n = 0; n < options.length; n++) {
        const i = (from + n) % options.length;
        if (options[i].label.toLowerCase().startsWith(ta.text)) {
          openAt(i);
          break;
        }
      }
      return;
    }

    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openAt(selectedIndex >= 0 ? selectedIndex : 0);
      } else if (e.key === "Home") {
        e.preventDefault();
        openAt(0);
      } else if (e.key === "End") {
        e.preventDefault();
        openAt(last);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex(Math.min(last, current + 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex(Math.max(0, current - 1));
        break;
      case "Home":
        e.preventDefault();
        setActiveIndex(0);
        break;
      case "End":
        e.preventDefault();
        setActiveIndex(last);
        break;
      case "PageDown":
        e.preventDefault();
        setActiveIndex(Math.min(last, current + 10));
        break;
      case "PageUp":
        e.preventDefault();
        setActiveIndex(Math.max(0, current - 10));
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        handleSelect(options[current].value);
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        break;
      case "Tab":
        setIsOpen(false);
        break;
    }
  };

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

    const onMove = ({ x: clientX, y: clientY, kind }: Attention) => {
      // Released attention (FAR_AWAY) only fades proximity; colour keeps its last point
      if (kind !== "none") {
        rawX = (clientX / window.innerWidth) * 100;
        rawY = (clientY / window.innerHeight) * 100;
      }

      if (wrapRef.current) {
        const rect = wrapRef.current.getBoundingClientRect();
        proximity = proximityTo(rect, clientX, clientY);
      }
    };
    const unsubscribe = subscribeAttention(onMove);

    let raf: number;

    const tick = () => {
      smoothX += (rawX - smoothX) * 0.08;
      smoothY += (rawY - smoothY) * 0.08;

      const s = sp.current;
      const { isOpen: open, isFocused: focused, value: val, disabled: dis } = live.current;
      const filled = val.length > 0;
      const floated = focused || filled || open;

      // Spring targets
      const targetLabelY = floated ? -12 : 0;
      const targetLabelScale = floated ? 0.75 : 1;
      const targetGlow = dis ? 0 : open || focused ? 1 : Math.min(proximity, 0.45);
      const targetChevronRot = open ? 180 : 0;
      const targetDropOpacity = open ? 1 : 0;
      const targetDropY = open ? 0 : -8;

      // Integrate springs — with reduced motion, label, chevron and dropdown
      // jump straight to their end state instead of springing
      const reduce = reducedMotionNow();
      const [ly, lyv] = reduce ? [targetLabelY, 0] : step(s.labelY, s.labelYVel, targetLabelY, 180, 22);
      const [ls, lsv] = reduce ? [targetLabelScale, 0] : step(s.labelScale, s.labelScaleVel, targetLabelScale, 180, 22);
      const [gw, gwv] = step(s.glow, s.glowVel, targetGlow, 120, 18);
      const [cr, crv] = reduce ? [targetChevronRot, 0] : step(s.chevronRot, s.chevronRotVel, targetChevronRot, 200, 24);
      const [dop, dopv] = reduce ? [targetDropOpacity, 0] : step(s.dropOpacity, s.dropOpacityVel, targetDropOpacity, 200, 24);
      const [dy, dyv] = reduce ? [targetDropY, 0] : step(s.dropY, s.dropYVel, targetDropY, 200, 24);

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
      const t = motionTime();

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
          labelRef.current.style.color = "rgba(255,255,255,0.5)";
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
        } else if (i === activeRef.current) {
          // Keyboard-active option reuses the existing hover treatment
          el.style.backgroundColor = "rgba(255,255,255,0.06)";
          el.style.color = "rgba(255,255,255,0.7)";
        } else {
          el.style.color = "rgba(255,255,255,0.5)";
          el.style.backgroundColor = "transparent";
        }
      });

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    return () => {
      unsubscribe();
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
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-labelledby={labelId}
        aria-activedescendant={isOpen && activeIndex >= 0 ? optionId(activeIndex) : undefined}
        onKeyDown={handleKeyDown}
        onKeyUp={(e) => {
          // Space is handled on keydown; stop the native button click on keyup
          if (e.key === " ") e.preventDefault();
        }}
        onClick={() => {
          if (!disabled) {
            setIsOpen((prev) => !prev);
            setIsFocused(true);
            setActiveIndex(Math.max(0, selectedIndex));
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
        className="w-full bg-transparent border border-white/[0.15] relative rounded-xl pl-4 pr-10 pt-7 pb-3 text-left text-sm outline-none disabled:cursor-not-allowed flex items-center justify-between"
        style={{
          transition: "none",
          willChange: "box-shadow",
          boxShadow: "0 0 0 1px rgba(255,255,255,0.1)",
        }}
      >
        <span className={`min-h-5 leading-5 ${selectedOption ? "text-white" : "text-white/50"}`}>
          {selectedOption ? selectedOption.label : (isFocused || isOpen ? placeholder : "")}
        </span>

        {/* Chevron: centred on the whole field, like the resting label, not on the value line. */}
        <span aria-hidden="true" className="pointer-events-none absolute top-1/2 -translate-y-1/2" style={{ right: 16 }}>
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
          className="block will-change-transform"
          style={{ color: "rgba(255,255,255,0.5)" }}
        >
          <path d="M4 6l4 4 4-4" />
        </svg>
        </span>
      </button>

      {/* Floating label */}
      <span
        ref={labelRef}
        id={labelId}
        className="absolute left-[17px] top-[21px] pointer-events-none text-sm inline-block will-change-transform origin-top-left"
        style={{
          color: "rgba(255,255,255,0.5)",
          transform: `translateY(${startsFloated ? -12 : 0}px) scale(${startsFloated ? 0.75 : 1})`,
        }}
      >
        {label}
      </span>

      {/* Dropdown */}
      <div
        ref={dropdownRef}
        id={listboxId}
        role="listbox"
        aria-labelledby={labelId}
        aria-hidden={!isOpen}
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
            id={optionId(i)}
            role="option"
            aria-selected={opt.value === value}
            tabIndex={-1}
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
