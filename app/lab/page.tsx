import type { Metadata } from "next";
import { Lab } from "./lab";

export const metadata: Metadata = {
  title: "Interaction Lab — Prism",
  description:
    "Can interfaces become expressive without sacrificing usability? Nine live experiments (an async button, a radial menu, a motion comparison, a latency-aware region, a token-bound composer, a visible focus trail, a spring field, a reading rail and a reorderable list), each with keyboard notes and evidence read from your own browser.",
};

export default function LabPage() {
  return <Lab />;
}
