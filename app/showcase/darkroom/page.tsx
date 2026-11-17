import type { Metadata } from "next";
import { DarkroomShowcase } from "./darkroom-app";

export const metadata: Metadata = {
  title: "Darkroom — Prism",
  description:
    "A black and white photo grading tool built from Prism components: tone curve, split-toning from the Prism palette, grain, vignette and a t-shirt knockout.",
};

export default function DarkroomPage() {
  return <DarkroomShowcase />;
}
