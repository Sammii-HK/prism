import { pastelColour } from "../../lib/primitives/gradient";
import type { SynthParams } from "./engine";

export type RGB = { r: number; g: number; b: number };

const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const SPOKEN = ["C", "C sharp", "D", "D sharp", "E", "F", "F sharp", "G", "G sharp", "A", "A sharp", "B"];

export const octaveOf = (midi: number) => Math.floor(midi / 12) - 1;
export const noteName = (midi: number) => `${NAMES[midi % 12]}${octaveOf(midi)}`;
export const spokenName = (midi: number) => `${SPOKEN[midi % 12]} ${octaveOf(midi)}`;
export const isBlack = (midi: number) => [1, 3, 6, 8, 10].includes(midi % 12);

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/**
 * Pitch as colour: low notes are cool cyan, high notes warm rose. Fixed in
 * time (t = 0) so a note is always the same colour.
 */
export const pitchColour = (midi: number): RGB => {
  const pc = clamp01((midi - 36) / 60) * 100;
  return pastelColour(pc, 100 - pc, 0);
};

/**
 * The filter as colour: cutoff runs cool to warm on one channel, resonance
 * lifts another. A dull, muffled sound is blue; a bright, ringing one glows.
 */
export const filterColour = (cutoffN: number, resonanceN: number): RGB =>
  pastelColour(cutoffN * 100, resonanceN * 100, 0);

export const rgb = ({ r, g, b }: RGB, alpha = 1) => `rgb(${r} ${g} ${b} / ${alpha})`;

// --- Filter mappings ----------------------------------------------------------

const CUT_MIN = 80;
const CUT_MAX = 12000;
const Q_MIN = 0.5;
const Q_MAX = 18;

/** Cutoff is exponential: equal travel is an equal musical interval. */
export const cutoffToNorm = (hz: number) => clamp01(Math.log(hz / CUT_MIN) / Math.log(CUT_MAX / CUT_MIN));
export const normToCutoff = (n: number) => CUT_MIN * Math.pow(CUT_MAX / CUT_MIN, clamp01(n));
export const resonanceToNorm = (q: number) => clamp01((q - Q_MIN) / (Q_MAX - Q_MIN));
export const normToResonance = (n: number) => Q_MIN + clamp01(n) * (Q_MAX - Q_MIN);
export const DETUNE_MAX = 40;

export const formatHz = (hz: number) => (hz < 1000 ? `${Math.round(hz)} Hz` : `${(hz / 1000).toFixed(hz < 10000 ? 2 : 1)} kHz`);
export const formatQ = (q: number) => q.toFixed(1);
export const formatCents = (c: number) => `${Math.round(c)} ct`;

// --- Computer keyboard ----------------------------------------------------------

/** Physical keys (KeyboardEvent.code) to semitones above the base C, DAW style. */
export const KEY_TO_SEMITONE: Record<string, number> = {
  KeyA: 0,
  KeyW: 1,
  KeyS: 2,
  KeyE: 3,
  KeyD: 4,
  KeyF: 5,
  KeyT: 6,
  KeyG: 7,
  KeyY: 8,
  KeyH: 9,
  KeyU: 10,
  KeyJ: 11,
  KeyK: 12,
  KeyO: 13,
  KeyL: 14,
};

export const SEMITONE_TO_HINT: Record<number, string> = Object.fromEntries(
  Object.entries(KEY_TO_SEMITONE).map(([code, semi]) => [semi, code.replace("Key", "")]),
);

export const OCTAVE_MIN = 2;
export const OCTAVE_MAX = 6;

// --- Presets ----------------------------------------------------------------------

export type PresetId = "keys" | "glass" | "lead" | "bass" | "chip";

export const PRESETS: Record<PresetId, { label: string; params: SynthParams }> = {
  keys: {
    label: "Soft keys",
    params: { wave: "triangle", attack: 0.005, decay: 0.7, sustain: 0.35, release: 0.6, cutoff: 2600, resonance: 2, detune: 6, sub: false, volume: 0.45 },
  },
  glass: {
    label: "Glass pad",
    params: { wave: "sine", attack: 0.45, decay: 1.2, sustain: 0.7, release: 1.8, cutoff: 5200, resonance: 1.2, detune: 10, sub: false, volume: 0.45 },
  },
  lead: {
    label: "Saw lead",
    params: { wave: "sawtooth", attack: 0.01, decay: 0.3, sustain: 0.75, release: 0.3, cutoff: 3200, resonance: 6, detune: 16, sub: false, volume: 0.45 },
  },
  bass: {
    label: "Pluck bass",
    params: { wave: "square", attack: 0.002, decay: 0.24, sustain: 0.18, release: 0.2, cutoff: 680, resonance: 9, detune: 0, sub: true, volume: 0.45 },
  },
  chip: {
    label: "Chip",
    params: { wave: "square", attack: 0.002, decay: 0.12, sustain: 0.6, release: 0.08, cutoff: 9000, resonance: 0.8, detune: 0, sub: false, volume: 0.4 },
  },
};

export const WAVES: Array<{ id: SynthParams["wave"]; label: string }> = [
  { id: "sine", label: "Sine" },
  { id: "triangle", label: "Tri" },
  { id: "sawtooth", label: "Saw" },
  { id: "square", label: "Square" },
];

export const WAVE_NAMES: Record<SynthParams["wave"], string> = {
  sine: "Sine",
  triangle: "Triangle",
  sawtooth: "Sawtooth",
  square: "Square",
};
