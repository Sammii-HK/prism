"use client";
import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Square } from "lucide-react";
import {
  RippleButton,
  Tooltip,
  GlowBadge,
  GlowSelect,
  GlowSlider,
  IconButton,
  MorphTabs,
  ProgressBar,
  PulseDot,
  SpringToggle,
} from "../../lib/components";
import { SpotlightCard } from "../../lib/primitives";
import { AppSurface, ShowcaseFrame } from "../showcase-frame";
import { MAX_VOICES, SynthEngine, type SynthParams, type Wave } from "./engine";
import { Keyboard } from "./keyboard";
import { Knob } from "./knob";
import {
  cutoffToNorm,
  DETUNE_MAX,
  filterColour,
  formatCents,
  formatHz,
  formatQ,
  KEY_TO_SEMITONE,
  noteName,
  normToCutoff,
  normToResonance,
  OCTAVE_MAX,
  OCTAVE_MIN,
  PRESETS,
  resonanceToNorm,
  rgb,
  WAVE_NAMES,
  WAVES,
  type PresetId,
  type RGB,
} from "./music";
import { Scope } from "./scope";
import { XYPad } from "./xy-pad";

const DEFAULT_PRESET: PresetId = "keys";

const Label = ({ children, id }: { children: ReactNode; id?: string }) => (
  <p id={id} className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/50">
    {children}
  </p>
);

const Panel = ({ title, children, className = "" }: { title: string; children: ReactNode; className?: string }) => (
  <SpotlightCard className={`rounded-2xl bg-white/[0.02] p-4 sm:p-5 ${className}`}>
    <section aria-label={title} className="flex h-full flex-col">
      {children}
    </section>
  </SpotlightCard>
);

/** The amp envelope drawn as a shape, in the filter colour. */
const EnvelopeShape = ({ params, tint }: { params: SynthParams; tint: RGB }) => {
  const W = 240;
  const H = 56;
  const a = Math.max(0.02, params.attack);
  const d = Math.max(0.04, params.decay);
  const r = Math.max(0.04, params.release);
  const hold = (a + d + r) * 0.45 + 0.1;
  const total = a + d + hold + r;
  const x = (t: number) => (t / total) * W;
  const top = 4;
  const sy = H - 2 - params.sustain * (H - 2 - top);
  const path = `M 0 ${H - 2} L ${x(a)} ${top} L ${x(a + d)} ${sy} L ${x(a + d + hold)} ${sy} L ${W} ${H - 2}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-14 w-full" aria-hidden="true">
      <path d={`${path} Z`} fill={rgb(tint, 0.1)} />
      <path d={path} fill="none" stroke={rgb(tint, 0.85)} strokeWidth={1.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
};

export const SynthShowcase = () => {
  const ids = useId();
  const [engine] = useState(() => new SynthEngine(PRESETS[DEFAULT_PRESET].params));
  const snap = useSyncExternalStore(engine.subscribe, engine.getSnapshot, SynthEngine.serverSnapshot);
  const [params, setParams] = useState<SynthParams>(PRESETS[DEFAULT_PRESET].params);
  const [preset, setPreset] = useState<PresetId | "custom">(DEFAULT_PRESET);
  const [octave, setOctave] = useState(4);
  const [hold, setHold] = useState(false);
  const [announce, setAnnounce] = useState("");
  const pressed = useRef(new Map<string, number>());

  useEffect(() => () => engine.dispose(), [engine]);

  const update = useCallback(
    (patch: Partial<SynthParams>) => {
      setParams((p) => ({ ...p, ...patch }));
      engine.setParams(patch);
      setPreset("custom");
    },
    [engine],
  );

  const applyPreset = (id: string) => {
    if (!(id in PRESETS)) return;
    const next = PRESETS[id as PresetId];
    setParams(next.params);
    engine.setParams(next.params);
    setPreset(id as PresetId);
    setAnnounce(`${next.label} loaded`);
  };

  const shiftOctave = useCallback(
    (by: number) => {
      const next = Math.max(OCTAVE_MIN, Math.min(OCTAVE_MAX, octave + by));
      if (next === octave) return;
      setOctave(next);
      setAnnounce(`Octave ${next}, lowest key ${noteName((next + 1) * 12)}`);
    },
    [octave],
  );

  const toggleHold = (on: boolean) => {
    setHold(on);
    engine.setHold(on);
  };

  const panic = useCallback(() => {
    engine.panic();
    setAnnounce("All notes stopped");
  }, [engine]);

  const start = () => {
    engine.ensure();
    // A soft rising arpeggio: proof the sound works, and a hint of what the patch is.
    const base = (octave + 1) * 12;
    [0, 4, 7, 12].forEach((semi, i) => {
      window.setTimeout(() => engine.noteOn(base + semi), i * 120);
      window.setTimeout(() => engine.noteOff(base + semi), i * 120 + 280);
    });
  };

  // Computer keyboard, DAW style. Never steals keys from text fields or an open select.
  useEffect(() => {
    const held = pressed.current;
    const typing = (t: EventTarget | null) =>
      t instanceof HTMLElement && (t.isContentEditable || !!t.closest("input, textarea, select, [role=textbox]"));
    const selectOpen = () => !!document.querySelector('[role="combobox"][aria-expanded="true"]');

    const onDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (typing(e.target) || selectOpen()) return;
      let handled = true;
      const semi = KEY_TO_SEMITONE[e.code];
      if (semi !== undefined) {
        e.preventDefault();
        if (!e.repeat && !held.has(e.code)) {
          const midi = (octave + 1) * 12 + semi;
          held.set(e.code, midi);
          engine.noteOn(midi);
        }
      } else if (e.code === "KeyZ" || e.code === "KeyX") {
        if (!e.repeat) shiftOctave(e.code === "KeyZ" ? -1 : 1);
      } else if (/^Digit[1-4]$/.test(e.code)) {
        if (!e.repeat) update({ wave: WAVES[Number(e.code.slice(5)) - 1].id });
      } else if (e.code === "Escape") {
        panic();
      } else {
        handled = false;
      }
      // After picking a preset, focus rests on the closed preset select. Keep
      // playing from there instead of letting its type-ahead eat the letters.
      if (handled && e.target instanceof HTMLElement && e.target.closest("[role=combobox]")) e.stopPropagation();
    };

    const onUp = (e: KeyboardEvent) => {
      const midi = held.get(e.code);
      if (midi === undefined) return;
      held.delete(e.code);
      engine.noteOff(midi);
    };

    // Switching tabs mid-note would otherwise leave it hanging.
    const releaseAll = () => {
      held.forEach((m) => engine.noteOff(m));
      held.clear();
    };

    // Capture phase, so this runs before a focused control's own key handling.
    window.addEventListener("keydown", onDown, true);
    window.addEventListener("keyup", onUp, true);
    window.addEventListener("blur", releaseAll);
    return () => {
      window.removeEventListener("keydown", onDown, true);
      window.removeEventListener("keyup", onUp, true);
      window.removeEventListener("blur", releaseAll);
    };
  }, [engine, octave, shiftOctave, panic, update]);

  const cutN = cutoffToNorm(params.cutoff);
  const resN = resonanceToNorm(params.resonance);
  const tint = useMemo(() => filterColour(cutN, resN), [cutN, resN]);
  const cutoffText = formatHz(params.cutoff);
  const resonanceText = formatQ(params.resonance);
  const waveIndex = WAVES.findIndex((w) => w.id === params.wave);

  const presetOptions = useMemo(
    () => [
      ...Object.entries(PRESETS).map(([value, p]) => ({ value, label: p.label })),
      ...(preset === "custom" ? [{ value: "custom", label: "Custom" }] : []),
    ],
    [preset],
  );

  const playing = snap.held.map(noteName);
  const summary = `${WAVE_NAMES[params.wave]} through a ${cutoffText} low-pass, resonance ${resonanceText}. ${
    playing.length ? `Playing ${playing.join(", ")}.` : "Silent."
  }`;
  const lowNote = noteName((octave + 1) * 12);

  return (
    <ShowcaseFrame
      slug="synth"
      title="Synth"
      lede="A small polyphonic synthesiser you can play with a mouse, a finger or the keyboard. Colour is the sound: the glow is the filter, each key is its pitch."
      uses={[
        { slug: "glow-slider", title: "Glow slider" },
        { slug: "spring-toggle", title: "Spring toggle" },
        { slug: "morph-tabs", title: "Morph tabs" },
        { slug: "glow-select", title: "Glow select" },
        { slug: "ripple-button", title: "Ripple button" },
        { slug: "icon-button", title: "Icon button" },
        { slug: "tooltip", title: "Tooltip" },
        { slug: "glow-badge", title: "Glow badge" },
        { slug: "pulse-dot", title: "Pulse dot" },
        { slug: "progress-bar", title: "Progress bar" },
        { slug: "spotlight-card", title: "Spotlight card" },
      ]}
      keys={[
        { keys: "A – K", does: "Play notes (W E T Y U are sharps)" },
        { keys: "Z / X", does: "Octave down / up" },
        { keys: "1 – 4", does: "Sine, triangle, saw, square" },
        { keys: "Esc", does: "Stop every note" },
      ]}
      notes={[
        {
          title: "Colour is the filter",
          body: (
            <>
              The pad&apos;s glow is <code className="font-mono text-[12px] text-white/70">pastelColour</code> of the point under your finger:
              cutoff runs cool to warm, resonance lifts it. The knobs, the envelope and the scope are drawn in the same colour, and the glow
              brightens with the output level, so what you hear and what you see move together.
            </>
          ),
        },
        {
          title: "Keys light like the envelope",
          body: "Each key is coloured by pitch, cyan at the bottom to rose at the top. Its light rises over the attack time and fades over the release, so a long pad visibly lingers after you let go and a pluck blinks. Position springs; under reduced motion it snaps and the scope becomes a still readout.",
        },
        {
          title: "No clicks, no surprises",
          body: "Audio starts only on your first tap or key. The default level is quiet and a hard compressor sits before the speakers. Every change ramps with setTargetAtTime, releases fall from wherever the envelope is, and the ninth voice steals the oldest with an 8 ms fade.",
        },
        {
          title: "Every input, one instrument",
          body: "Pointer capture tracks each finger separately, so you can play chords and glissando across keys. Letters play like a DAW, arrows walk a roving focus over the keys with Space to sound them, and note keys go quiet while you type or a select is open.",
        },
      ]}
    >
      <AppSurface>
        <div className="p-3 sm:p-5 lg:p-6">
          {/* Top bar */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div>
                <Label>Prism SY-1</Label>
                <p className="mt-1 text-sm text-white/85">Eight-voice polysynth</p>
              </div>
              <div className="ml-auto flex items-center gap-1.5 sm:ml-4">
                {snap.status === "running" ? (
                  <PulseDot size={7} colour="rgb(140 220 170)" />
                ) : (
                  <span aria-hidden="true" className="mx-[7px] inline-block h-[7px] w-[7px] rounded-full bg-white/30" />
                )}
                <GlowBadge variant={snap.status === "running" ? "success" : snap.status === "suspended" ? "warning" : "default"} pulse={false}>
                  {snap.status === "running" ? "Sound on" : snap.status === "suspended" ? "Paused" : "Sound off"}
                </GlowBadge>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="w-full sm:w-52">
                <GlowSelect label="Preset" value={preset} onChange={applyPreset} options={presetOptions} />
              </div>
              <div role="group" aria-label="Octave" className="flex items-center gap-1.5">
                <Tooltip content="Octave down (Z)">
                  <IconButton aria-label="Octave down" onClick={() => shiftOctave(-1)} disabled={octave <= OCTAVE_MIN}>
                    <ChevronLeft size={16} aria-hidden="true" />
                  </IconButton>
                </Tooltip>
                <span className="w-12 text-center font-mono text-xs tabular-nums text-white/75">{lowNote}</span>
                <Tooltip content="Octave up (X)">
                  <IconButton aria-label="Octave up" onClick={() => shiftOctave(1)} disabled={octave >= OCTAVE_MAX}>
                    <ChevronRight size={16} aria-hidden="true" />
                  </IconButton>
                </Tooltip>
              </div>
              <Tooltip content="Stop every note (Esc)">
                <IconButton aria-label="Stop every note" onClick={panic}>
                  <Square size={13} aria-hidden="true" />
                </IconButton>
              </Tooltip>
            </div>
          </div>

          <p className="sr-only" aria-live="polite">
            {announce}
          </p>

          <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-12 lg:gap-4">
            {/* Scope */}
            <Panel title="Output scope" className="order-1 lg:col-span-7">
              <div className="flex items-baseline justify-between gap-3">
                <Label>Output</Label>
                <p className="min-w-0 truncate font-mono text-xs tabular-nums text-white/70" aria-hidden="true">
                  {playing.length ? playing.join("  ") : "—"}
                </p>
              </div>
              <div className="relative mt-3 flex-1 overflow-hidden rounded-xl border border-white/[0.06] bg-[#060606]">
                <Scope engine={engine} wave={params.wave} tint={tint} summary={summary} />
                {snap.status === "off" && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#060606]/70 p-4 text-center backdrop-blur-[2px]">
                    <RippleButton className="px-6 py-3 text-sm" onClick={start}>
                      Tap to start sound
                    </RippleButton>
                    <p className="text-xs text-white/55">or play any key. It starts quiet.</p>
                  </div>
                )}
              </div>
            </Panel>

            {/* Filter */}
            <Panel title="Filter" className="order-3 lg:order-2 lg:col-span-5">
              <XYPad
                engine={engine}
                x={cutN}
                y={resN}
                onChange={(x, y) => update({ cutoff: normToCutoff(x), resonance: normToResonance(y) })}
                cutoffText={cutoffText}
                resonanceText={resonanceText}
              />
              <div className="mt-4 flex items-start justify-around gap-4">
                <Knob
                  label="Cutoff"
                  value={cutN}
                  onChange={(n) => update({ cutoff: normToCutoff(n) })}
                  valueText={cutoffText}
                  tint={tint}
                  defaultValue={cutoffToNorm(PRESETS[DEFAULT_PRESET].params.cutoff)}
                />
                <Knob
                  label="Resonance"
                  value={resN}
                  onChange={(n) => update({ resonance: normToResonance(n) })}
                  valueText={`Q ${resonanceText}`}
                  tint={tint}
                  defaultValue={resonanceToNorm(PRESETS[DEFAULT_PRESET].params.resonance)}
                />
              </div>
            </Panel>

            {/* Oscillator */}
            <Panel title="Oscillator" className="order-4 lg:order-3 lg:col-span-4">
              <Label id={`${ids}-wave`}>Waveform</Label>
              <div className="mt-3 max-w-full overflow-x-auto no-scrollbar">
                <MorphTabs tabs={WAVES.map((w) => w.label)} activeIndex={waveIndex} onChange={(i) => update({ wave: WAVES[i].id as Wave })} ariaLabel="Waveform" />
              </div>
              <div className="mt-5 flex items-center justify-between gap-4">
                <Knob
                  label="Detune"
                  value={params.detune / DETUNE_MAX}
                  onChange={(n) => update({ detune: n * DETUNE_MAX })}
                  valueText={formatCents(params.detune)}
                  tint={tint}
                  defaultValue={0}
                />
                <div className="flex flex-col items-end gap-2">
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p id={`${ids}-sub`} className="text-sm text-white/80">
                        Sub
                      </p>
                      <p className="text-xs text-white/50">One octave down</p>
                    </div>
                    <SpringToggle checked={params.sub} onChange={(on) => update({ sub: on })} aria-labelledby={`${ids}-sub`} />
                  </div>
                </div>
              </div>
            </Panel>

            {/* Envelope */}
            <Panel title="Envelope" className="order-5 lg:order-4 lg:col-span-5">
              <div className="flex items-baseline justify-between">
                <Label>Envelope</Label>
                <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/50">ADSR</p>
              </div>
              <div className="mt-2">
                <EnvelopeShape params={params} tint={tint} />
              </div>
              <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                <GlowSlider
                  label="Attack (ms)"
                  min={0}
                  max={2000}
                  step={5}
                  value={Math.round(params.attack * 1000)}
                  onChange={(v) => update({ attack: v / 1000 })}
                />
                <GlowSlider
                  label="Decay (ms)"
                  min={10}
                  max={2000}
                  step={10}
                  value={Math.round(params.decay * 100) * 10}
                  onChange={(v) => update({ decay: v / 1000 })}
                />
                <GlowSlider
                  label="Sustain (%)"
                  min={0}
                  max={100}
                  value={Math.round(params.sustain * 100)}
                  onChange={(v) => update({ sustain: v / 100 })}
                />
                <GlowSlider
                  label="Release (ms)"
                  min={20}
                  max={3000}
                  step={10}
                  value={Math.round(params.release * 100) * 10}
                  onChange={(v) => update({ release: v / 1000 })}
                />
              </div>
            </Panel>

            {/* Output */}
            <Panel title="Output" className="order-6 lg:order-5 lg:col-span-3">
              <Label>Master</Label>
              <div className="mt-4">
                <GlowSlider label="Volume" value={Math.round(params.volume * 100)} onChange={(v) => update({ volume: v / 100 })} />
              </div>
              <div className="mt-5 flex items-center justify-between gap-4">
                <div>
                  <p id={`${ids}-hold`} className="text-sm text-white/80">
                    Hold
                  </p>
                  <p className="text-xs text-white/50">Notes ring after release</p>
                </div>
                <SpringToggle checked={hold} onChange={toggleHold} aria-labelledby={`${ids}-hold`} />
              </div>
              <div className="mt-5">
                <div className="mb-2 flex items-baseline justify-between">
                  <p className="text-sm text-white/50">Voices</p>
                  <p className="font-mono text-xs tabular-nums text-white/70">
                    {snap.voices} / {MAX_VOICES}
                  </p>
                </div>
                <ProgressBar value={(snap.voices / MAX_VOICES) * 100} ariaLabel="Voices in use" />
              </div>
            </Panel>

            {/* Keys */}
            <div className="order-2 rounded-2xl border border-white/[0.08] bg-white/[0.015] p-2.5 sm:p-4 lg:order-6 lg:col-span-12">
              <Keyboard engine={engine} octave={octave} attack={params.attack} release={params.release} />
            </div>
          </div>
        </div>
      </AppSurface>
    </ShowcaseFrame>
  );
};
