import type { Metadata } from "next";
import { PlaygroundGrid } from "./grid";

export const metadata: Metadata = {
  title: "Playground — Prism",
  description: "Visual experiments: canvas, WebGL, particle systems.",
};

export default function PlaygroundPage() {
  return <PlaygroundGrid />;
}
