import type { Metadata } from "next";
import { ConsoleShowcase } from "./console-app";

export const metadata: Metadata = {
  title: "Release console — Prism",
  description:
    "A working deploy console built only from Prism: a pipeline that tells the truth about waiting, streaming logs that pause when you scroll, rollbacks, staged feature flags and a keyboard-first command bar.",
};

export default function ConsolePage() {
  return <ConsoleShowcase />;
}
