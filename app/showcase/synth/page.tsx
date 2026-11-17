import type { Metadata } from "next";
import { SynthShowcase } from "./synth-app";

export const metadata: Metadata = {
  title: "Synth — Prism",
  description:
    "A small polyphonic Web Audio synthesiser built from Prism components: an XY filter pad whose colour is the sound, spring knobs, keys that light with the envelope, and full mouse, touch and keyboard play.",
};

export default function SynthPage() {
  return <SynthShowcase />;
}
