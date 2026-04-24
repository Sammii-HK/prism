import { notFound } from "next/navigation";
import { registry } from "../lib/registry";
import { ExperimentLayout } from "./experiment-layout";
import dynamic from "next/dynamic";

// Explicit component map — add new entries here when adding components/playground items
const componentMap: Record<string, React.ComponentType> = {
  // Components
  "animated-border": dynamic(() => import("../demos/animated-border")),
  "avatar": dynamic(() => import("../demos/avatar")),
  "glow-checkbox": dynamic(() => import("../demos/glow-checkbox")),
  "glow-input": dynamic(() => import("../demos/glow-input")),
  "glow-select": dynamic(() => import("../demos/glow-select")),
  "glow-slider": dynamic(() => import("../demos/glow-slider")),
  "glow-textarea": dynamic(() => import("../demos/glow-textarea")),
  "icon-button": dynamic(() => import("../demos/icon-button")),
  "magnetic-button": dynamic(() => import("../demos/magnetic-button")),
  "spotlight-card": dynamic(() => import("../demos/spotlight-card")),
  "ripple-button": dynamic(() => import("../demos/ripple-button")),
  "floating-dock": dynamic(() => import("../demos/floating-dock")),
  "fluid-tooltip": dynamic(() => import("../demos/fluid-tooltip")),
  "spring-toggle": dynamic(() => import("../demos/spring-toggle")),
  "tilt-card": dynamic(() => import("../demos/tilt-card")),
  "hover-reveal": dynamic(() => import("../demos/hover-reveal")),
  "morph-tabs": dynamic(() => import("../demos/morph-tabs")),
  "shimmer-text": dynamic(() => import("../demos/shimmer-text")),
  "skeleton": dynamic(() => import("../demos/skeleton")),
  "glow-badge": dynamic(() => import("../demos/glow-badge")),
  "progress-bar": dynamic(() => import("../demos/progress-bar")),
  "pulse-dot": dynamic(() => import("../demos/pulse-dot")),
  // Playground
  "colour-field": dynamic(() => import("../playground/colour-field")),
  "fluid-mesh": dynamic(() => import("../playground/fluid-mesh")),
  "text-dissolve": dynamic(() => import("../playground/text-dissolve")),
  "gravity-wells": dynamic(() => import("../playground/gravity-wells")),
  "shader-marbling": dynamic(() => import("../playground/shader-marbling")),
};

export function generateStaticParams() {
  return registry.map((item) => ({ slug: item.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const item = registry.find((r) => r.slug === slug);
  if (!item) return { title: "Not found" };
  return {
    title: `${item.title} — Prism`,
    description: item.description,
  };
}

export default async function ItemPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const item = registry.find((r) => r.slug === slug);
  if (!item) notFound();

  const Component = componentMap[slug];
  if (!Component) notFound();

  return (
    <ExperimentLayout experiment={item}>
      <Component />
    </ExperimentLayout>
  );
}
