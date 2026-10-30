import type { Metadata } from "next";
import { Lab } from "./lab";

export const metadata: Metadata = {
  title: "Interaction Lab — Prism",
  description:
    "Can interfaces become expressive without sacrificing usability? Four live experiments (an async button, a radial menu, a motion comparison and a latency-aware region), each with keyboard notes and evidence read from your own browser.",
};

export default function LabPage() {
  return <Lab />;
}
