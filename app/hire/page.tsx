import type { Metadata } from "next";
import { HireView } from "./hire-view";

export const metadata: Metadata = {
  title: "Hire — Sammii · Senior Frontend / Design Engineer",
  description:
    "Sammii Kellow — senior frontend / design engineer, London, UK citizen. Available for permanent or contract. Prism is the proof-of-craft: cursor-reactive UI primitives, spring physics, zero runtime dependencies.",
  alternates: {
    canonical: "https://prism.sammii.dev/hire",
  },
  openGraph: {
    title: "Hire Sammii — Senior Frontend / Design Engineer",
    description:
      "London · UK citizen · permanent or contract · remote or hybrid. Prism is the proof-of-craft.",
    url: "https://prism.sammii.dev/hire",
    siteName: "Prism",
    type: "profile",
    locale: "en_GB",
  },
  twitter: {
    card: "summary_large_image",
    title: "Hire Sammii — Senior Frontend / Design Engineer",
    description:
      "London · UK citizen · permanent or contract · remote or hybrid. Prism is the proof-of-craft.",
    creator: "@sammiihk",
  },
};

export default function HirePage() {
  return <HireView />;
}
