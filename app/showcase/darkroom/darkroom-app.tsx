"use client";
import { useCallback, useEffect, useId, useMemo, useReducer, useRef, useState } from "react";
import { Redo2, RotateCcw, Undo2 } from "lucide-react";
import {
  AsyncButton,
  FluidTooltip,
  GlowBadge,
  GlowSelect,
  GlowSlider,
  IconButton,
  MorphTabs,
  SpringToggle,
} from "../../lib/components";
import { AppSurface, ShowcaseFrame } from "../showcase-frame";
import { CurvesEditor } from "./curves-editor";
import { TonePad } from "./tone-pad";
import {
  DEFAULT_GRADE,
  PRESETS,
  describeGrade,
  makePlate,
  render,
  type Grade,
  type Plate,
  type RenderMode,
} from "./grade";

const PHOTO = "/showcase/flowerscape-1.jpg";
const PHOTO_ALT = "Flowerscape 1: a sunflower in black and white, petals bright against dark leaves";
/** Working resolution for the live preview. Export uses the full image. */
const PREVIEW = 1100;
const PANELS = ["Light", "Tone", "Finish", "Output"] as const;

const SHIRTS = [
  { id: "black", name: "Black", hex: "#0d0d0f" },
  { id: "navy", name: "Navy", hex: "#18203a" },
  { id: "forest", name: "Forest", hex: "#1b2a22" },
  { id: "plum", name: "Plum", hex: "#2b1d2d" },
];

/* --------------------------------------------------------------------------
 * History: every edit is undoable. Changes within 400ms of each other (one
 * slider drag, one curve drag) fold into a single step.
 * ------------------------------------------------------------------------ */

type History = { past: Grade[]; present: Grade; future: Grade[]; lastAt: number };
type Action =
  | { type: "patch"; patch: Partial<Grade>; at: number }
  | { type: "replace"; grade: Grade }
  | { type: "undo" }
  | { type: "redo" };

const historyReducer = (h: History, a: Action): History => {
  switch (a.type) {
    case "patch": {
      // Patches apply to the latest grade, so rapid edits (key repeat) never read a stale one.
      const fold = a.at - h.lastAt < 400;
      return {
        past: fold ? h.past : [...h.past, h.present].slice(-80),
        present: { ...h.present, ...a.patch },
        future: [],
        lastAt: a.at,
      };
    }
    case "replace":
      return { past: [...h.past, h.present].slice(-80), present: a.grade, future: [], lastAt: 0 };
    case "undo":
      if (!h.past.length) return h;
      return { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future], lastAt: 0 };
    case "redo":
      if (!h.future.length) return h;
      return { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1), lastAt: 0 };
  }
};

const loadPlate = (img: HTMLImageElement, maxSide: number): Plate => {
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, w, h);
  return makePlate(ctx.getImageData(0, 0, w, h));
};

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));

const round = (v: number, step: number) => Math.round(v / step) * step;

export const DarkroomShowcase = () => {
  const id = useId();
  const [history, dispatch] = useReducer(historyReducer, {
    past: [],
    present: DEFAULT_GRADE,
    future: [],
    lastAt: 0,
  });
  const grade = history.present;
  const [presetId, setPresetId] = useState("neutral");
  const [panel, setPanel] = useState(0);
  const [mode, setMode] = useState<Exclude<RenderMode, "original">>("print");
  const [shirt, setShirt] = useState(SHIRTS[0]);
  const [compare, setCompare] = useState(false);
  const [split, setSplit] = useState(50);
  const [holding, setHolding] = useState(false);
  const [histogram, setHistogram] = useState<Uint32Array | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const originalRef = useRef<HTMLCanvasElement>(null);
  const plateRef = useRef<Plate | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [ready, setReady] = useState(false);

  const update = useCallback((patch: Partial<Grade>) => {
    dispatch({ type: "patch", patch, at: performance.now() });
    setPresetId("custom");
  }, []);

  /* Load the photograph and build the preview plate once. */
  useEffect(() => {
    const img = new Image();
    img.decoding = "async";
    img.src = PHOTO;
    img.onload = () => {
      imageRef.current = img;
      const plate = loadPlate(img, PREVIEW);
      plateRef.current = plate;
      for (const c of [canvasRef.current, originalRef.current]) {
        if (!c) continue;
        c.width = plate.width;
        c.height = plate.height;
      }
      // The untouched original, for the compare split and the hold-to-see view.
      const octx = originalRef.current?.getContext("2d");
      if (octx) {
        const o = octx.createImageData(plate.width, plate.height);
        render(plate, DEFAULT_GRADE, o, "original");
        octx.putImageData(o, 0, 0);
      }
      setReady(true);
    };
  }, []);

  /* Re-grade on every change, coalesced to one render per frame. */
  const pending = useRef(0);
  useEffect(() => {
    if (!ready) return;
    cancelAnimationFrame(pending.current);
    pending.current = requestAnimationFrame(() => {
      const plate = plateRef.current;
      const ctx = canvasRef.current?.getContext("2d");
      if (!plate || !ctx) return;
      const out = ctx.createImageData(plate.width, plate.height);
      setHistogram(render(plate, grade, out, mode));
      ctx.putImageData(out, 0, 0);
    });
    return () => cancelAnimationFrame(pending.current);
  }, [grade, mode, ready]);

  const applyPreset = (pid: string) => {
    const preset = PRESETS.find((p) => p.id === pid);
    if (!preset) return;
    setPresetId(pid);
    dispatch({ type: "replace", grade: { ...DEFAULT_GRADE, ...preset.grade } });
    setAnnouncement(`${preset.name} applied`);
  };

  const undo = useCallback(() => {
    dispatch({ type: "undo" });
    setPresetId("custom");
    setAnnouncement("Undone");
  }, []);
  const redo = useCallback(() => {
    dispatch({ type: "redo" });
    setPresetId("custom");
    setAnnouncement("Redone");
  }, []);
  const reset = () => {
    dispatch({ type: "replace", grade: DEFAULT_GRADE });
    setPresetId("neutral");
    setAnnouncement("Grade reset");
  };

  /* Keyboard: ⌘Z / ⇧⌘Z, hold \ to see the original, 1–4 for panels, C to compare. */
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (e.key === "\\" && !e.repeat) {
        setHolding(true);
      } else if (!mod && /^[1-4]$/.test(e.key)) {
        setPanel(Number(e.key) - 1);
      } else if (!mod && e.key.toLowerCase() === "c" && !(e.target instanceof HTMLButtonElement && e.target.role === "slider")) {
        setCompare((c) => !c);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === "\\") setHolding(false);
    };
    const blur = () => setHolding(false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [undo, redo]);

  const exportImage = async () => {
    const img = imageRef.current;
    if (!img) throw new Error("Photo not loaded");
    // Full resolution, graded the same way as the preview (same grain seed, same tables).
    await new Promise((r) => setTimeout(r, 30));
    const plate = loadPlate(img, Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = plate.width;
    c.height = plate.height;
    const ctx = c.getContext("2d")!;
    const out = ctx.createImageData(plate.width, plate.height);
    render(plate, grade, out, mode);
    ctx.putImageData(out, 0, 0);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/png"));
    if (!blob) throw new Error("Couldn't encode the image");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `flowerscape-1-${mode === "tshirt" ? "tshirt" : "print"}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  const edited = history.past.length > 0 || presetId !== "neutral";
  const presetOptions = useMemo(
    () => [
      ...(presetId === "custom" ? [{ value: "custom", label: "Custom" }] : []),
      ...PRESETS.map((p) => ({ value: p.id, label: p.name })),
    ],
    [presetId]
  );

  const showOriginalFull = holding;
  const splitClip = compare && !holding ? `inset(0 ${100 - split}% 0 0)` : undefined;

  return (
    <ShowcaseFrame
      slug="darkroom"
      title="Darkroom"
      lede="Grade a black and white photograph for print and for a t-shirt. Tone curve, split-toning from the Prism palette, grain, vignette and a knockout for screen printing."
      keys={[
        { keys: "⌘Z", does: "Undo, ⇧ to redo" },
        { keys: "\\", does: "Hold to see the original" },
        { keys: "1–4", does: "Switch panel" },
        { keys: "C", does: "Compare split" },
      ]}
      uses={[
        { slug: "glow-slider", title: "Glow slider" },
        { slug: "morph-tabs", title: "Morph tabs" },
        { slug: "glow-select", title: "Glow select" },
        { slug: "spring-toggle", title: "Spring toggle" },
        { slug: "icon-button", title: "Icon button" },
        { slug: "fluid-tooltip", title: "Fluid tooltip" },
        { slug: "glow-badge", title: "Glow badge" },
        { slug: "async-button", title: "Async button" },
      ]}
      notes={[
        {
          title: "One lookup table per edit",
          body: "Exposure, contrast, the curve and split-toning only depend on a pixel's brightness, so they fold into a 256-entry colour table. A full re-grade is one pass over the image, fast enough to follow a drag.",
        },
        {
          title: "The palette is the picker",
          body: "The tone pad is Prism's own pastelColour function laid out flat. Choosing a shadow or highlight tone is choosing a place in the same colour space the cursor moves through on every page.",
        },
        {
          title: "Precision doesn't spring",
          body: "Curve points and tone handles go exactly where you put them, by pointer or arrow key. Spring motion is kept for feedback, like the tabs and toggles, never for a value you're setting.",
        },
        {
          title: "Borrowed, then rebuilt",
          body: "The curve maths (monotone cubic, no overshoot) and the t-shirt knockout come from ScapeStudio, a print-prep tool I built. Here the editor became keyboard and touch first, with undo for every change.",
        },
      ]}
    >
      <AppSurface>
        <p aria-live="polite" className="sr-only">
          {announcement}
        </p>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 border-b border-white/[0.06] px-4 py-3 sm:px-5">
          <div className="w-full sm:w-56">
            <GlowSelect label="Preset" value={presetId} onChange={applyPreset} options={presetOptions} />
          </div>
          <div className="flex items-center gap-1.5">
            <FluidTooltip content="Undo (⌘Z)">
              <IconButton size="sm" onClick={undo} disabled={!history.past.length} aria-label="Undo">
                <Undo2 size={15} />
              </IconButton>
            </FluidTooltip>
            <FluidTooltip content="Redo (⇧⌘Z)">
              <IconButton size="sm" onClick={redo} disabled={!history.future.length} aria-label="Redo">
                <Redo2 size={15} />
              </IconButton>
            </FluidTooltip>
            <FluidTooltip content="Reset grade">
              <IconButton size="sm" onClick={reset} disabled={!edited} aria-label="Reset grade">
                <RotateCcw size={15} />
              </IconButton>
            </FluidTooltip>
          </div>
          <div className="ml-auto flex items-center gap-4">
            <label className="flex items-center gap-2.5 text-[13px] text-white/60">
              <span id={`${id}-compare`}>Compare</span>
              <SpringToggle checked={compare} onChange={setCompare} aria-labelledby={`${id}-compare`} />
            </label>
            <GlowBadge variant={edited ? "success" : "default"}>{edited ? "Edited" : "Original"}</GlowBadge>
          </div>
        </div>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_380px]">
          {/* The print */}
          <div className="relative flex items-center justify-center p-4 sm:p-8 lg:border-r lg:border-white/[0.06]">
            <div
              className="relative w-full max-w-[min(720px,calc(100svh-15rem))] overflow-hidden rounded-xl transition-colors"
              style={{ backgroundColor: mode === "tshirt" ? shirt.hex : "#000" }}
            >
              <canvas
                ref={canvasRef}
                role="img"
                aria-label={`${PHOTO_ALT}. ${mode === "tshirt" ? `T-shirt knockout on ${shirt.name.toLowerCase()}` : "Print"}: ${describeGrade(grade)}.`}
                className="block aspect-square h-auto w-full"
              />
              <canvas
                ref={originalRef}
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 h-full w-full"
                style={{
                  opacity: showOriginalFull || compare ? 1 : 0,
                  clipPath: showOriginalFull ? undefined : splitClip ?? "inset(0 100% 0 0)",
                }}
              />
              {!ready && <div className="absolute inset-0 animate-pulse bg-white/[0.03] motion-reduce:animate-none" aria-hidden="true" />}
              {showOriginalFull && (
                <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 font-mono text-[11px] text-white/80 backdrop-blur">
                  Original
                </span>
              )}
              {compare && !holding && (
                <>
                  <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 w-px bg-white/70" style={{ left: `${split}%` }} />
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={split}
                    onChange={(e) => setSplit(Number(e.target.value))}
                    aria-label="Compare split, original on the left"
                    className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
                  />
                  <span className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-black/60 px-2.5 py-1 font-mono text-[11px] text-white/80 backdrop-blur">
                    Before
                  </span>
                  <span className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-black/60 px-2.5 py-1 font-mono text-[11px] text-white/80 backdrop-blur">
                    After
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-col gap-6 p-4 sm:p-6">
            <div className="-mx-1 overflow-x-auto px-1 no-scrollbar">
              <MorphTabs tabs={[...PANELS]} activeIndex={panel} onChange={setPanel} ariaLabel="Adjustments" idPrefix={`${id}-p`} />
            </div>

            {PANELS.map((name, i) => (
              <div
                key={name}
                role="tabpanel"
                id={`${id}-p-panel-${i}`}
                aria-labelledby={`${id}-p-tab-${i}`}
                hidden={panel !== i}
                className="flex flex-col gap-6"
              >
                {name === "Light" && (
                  <>
                    <GlowSlider label="Exposure" min={-2} max={2} step={0.05} value={grade.exposure} onChange={(v) => update({ exposure: round(v, 0.05) })} showValue />
                    <GlowSlider label="Contrast" min={-100} max={100} step={1} value={grade.contrast} onChange={(v) => update({ contrast: Math.round(v) })} showValue />
                    <CurvesEditor points={grade.curve} onChange={(curve) => update({ curve })} histogram={histogram} />
                  </>
                )}
                {name === "Tone" && (
                  <>
                    <p className="text-[13px] leading-relaxed text-white/55">
                      Split-toning tints the shadows and highlights separately, like a selenium or platinum print. Pick both tones from the Prism palette.
                    </p>
                    <TonePad
                      shadow={grade.shadowTint}
                      highlight={grade.highlightTint}
                      onChange={(which, p) => update(which === "shadow" ? { shadowTint: p, toneStrength: grade.toneStrength || 40 } : { highlightTint: p, toneStrength: grade.toneStrength || 40 })}
                    />
                    <GlowSlider label="Strength" min={0} max={100} value={grade.toneStrength} onChange={(v) => update({ toneStrength: Math.round(v) })} showValue />
                    <GlowSlider label="Balance" min={-100} max={100} value={grade.toneBalance} onChange={(v) => update({ toneBalance: Math.round(v) })} showValue />
                  </>
                )}
                {name === "Finish" && (
                  <>
                    <GlowSlider label="Grain" min={0} max={100} value={grade.grain} onChange={(v) => update({ grain: Math.round(v) })} showValue />
                    <GlowSlider label="Vignette" min={0} max={100} value={grade.vignette} onChange={(v) => update({ vignette: Math.round(v) })} showValue />
                    <p className="text-[13px] leading-relaxed text-white/55">
                      Grain is seeded, so it holds still between edits and matches exactly in the export.
                    </p>
                  </>
                )}
                {name === "Output" && (
                  <>
                    <fieldset className="flex flex-col gap-3">
                      <legend className="mb-3 font-mono text-[11px] uppercase tracking-[0.22em] text-white/50">Output</legend>
                      <div className="grid grid-cols-2 gap-2">
                        {(["print", "tshirt"] as const).map((m) => (
                          <button
                            key={m}
                            type="button"
                            aria-pressed={mode === m}
                            onClick={() => setMode(m)}
                            className={`rounded-xl border px-3 py-2.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${
                              mode === m ? "border-white/25 bg-white/[0.07] text-white" : "border-white/[0.08] text-white/60 hover:text-white"
                            }`}
                          >
                            {m === "print" ? "Fine art print" : "T-shirt"}
                            <span className="mt-0.5 block text-xs text-white/50">{m === "print" ? "Full tone, on paper" : "Darks knocked out"}</span>
                          </button>
                        ))}
                      </div>
                    </fieldset>
                    {mode === "tshirt" && (
                      <>
                        <GlowSlider label="Knockout" min={0} max={160} value={grade.threshold} onChange={(v) => update({ threshold: Math.round(v) })} showValue />
                        <GlowSlider label="Feather" min={0} max={64} value={grade.feather} onChange={(v) => update({ feather: Math.round(v) })} showValue />
                        <fieldset>
                          <legend className="mb-3 font-mono text-[11px] uppercase tracking-[0.22em] text-white/50">Shirt</legend>
                          <div className="flex gap-2">
                            {SHIRTS.map((s) => (
                              <button
                                key={s.id}
                                type="button"
                                aria-pressed={shirt.id === s.id}
                                aria-label={`${s.name} shirt`}
                                onClick={() => setShirt(s)}
                                className={`h-9 w-9 rounded-full border-2 transition-[border-color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${
                                  shirt.id === s.id ? "border-white/80" : "border-white/15 hover:border-white/40"
                                }`}
                                style={{ backgroundColor: s.hex }}
                              />
                            ))}
                          </div>
                        </fieldset>
                      </>
                    )}
                    <div className="border-t border-white/[0.06] pt-5">
                      <AsyncButton
                        onPress={exportImage}
                        labels={{ idle: "Export PNG", pending: "Rendering full size", slow: "Still rendering", success: "Downloaded", error: "Export failed" }}
                      />
                      <p className="mt-3 text-xs leading-relaxed text-white/50">
                        Renders at the photograph&apos;s full resolution with the same grade, grain and knockout as the preview.
                      </p>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </AppSurface>
    </ShowcaseFrame>
  );
};
