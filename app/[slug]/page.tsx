import { notFound } from "next/navigation";
import { registry } from "../lib/registry";
import { ItemDetail } from "./item-detail";
import { loadSourceDocs } from "../lib/docs/source-docs";
import dynamic from "next/dynamic";

// Explicit component map — add new entries here when adding components/playground items
const componentMap: Record<string, React.ComponentType> = {
  // Components
  "animated-border": dynamic(() => import("../demos/animated-border")),
  "async-button": dynamic(() => import("../demos/async-button")),
  "radial-menu": dynamic(() => import("../demos/radial-menu")),
  "motion-compare": dynamic(() => import("../demos/motion-compare")),
  "latency-adapt": dynamic(() => import("../demos/latency-adapt")),
  "token-compose": dynamic(() => import("../demos/token-compose")),
  "focus-trail": dynamic(() => import("../demos/focus-trail")),
  "avatar": dynamic(() => import("../demos/avatar")),
  "command-palette": dynamic(() => import("../demos/command-palette")),
  "glow-checkbox": dynamic(() => import("../demos/glow-checkbox")),
  "glow-input": dynamic(() => import("../demos/glow-input")),
  "glow-select": dynamic(() => import("../demos/glow-select")),
  "glow-slider": dynamic(() => import("../demos/glow-slider")),
  "glow-textarea": dynamic(() => import("../demos/glow-textarea")),
  "icon-button": dynamic(() => import("../demos/icon-button")),
  "spotlight-card": dynamic(() => import("../demos/spotlight-card")),
  "ripple-button": dynamic(() => import("../demos/ripple-button")),
  "tooltip": dynamic(() => import("../demos/tooltip")),
  "popover": dynamic(() => import("../demos/popover")),
  "menu": dynamic(() => import("../demos/menu")),
  "dialog": dynamic(() => import("../demos/dialog")),
  "sheet": dynamic(() => import("../demos/sheet")),
  "toast": dynamic(() => import("../demos/toast")),
  "ai-response": dynamic(() => import("../demos/ai-response")),
  "floating-dock": dynamic(() => import("../demos/floating-dock")),
  "spring-toggle": dynamic(() => import("../demos/spring-toggle")),
  "hover-reveal": dynamic(() => import("../demos/hover-reveal")),
  "morph-tabs": dynamic(() => import("../demos/morph-tabs")),
  "skeleton": dynamic(() => import("../demos/skeleton")),
  "glow-badge": dynamic(() => import("../demos/glow-badge")),
  "progress-bar": dynamic(() => import("../demos/progress-bar")),
  "pulse-dot": dynamic(() => import("../demos/pulse-dot")),
  // "lab" has its own static route at app/lab, which takes precedence over this dynamic one.
  "lab": dynamic(() => import("../lab/lab").then((m) => m.Lab)),
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

  // Neighbours within the same section, in registry order, for prev / next.
  const siblings = registry.filter((r) => r.type === item.type && r.slug !== "lab");
  const at = siblings.findIndex((r) => r.slug === slug);
  const neighbour = (i: number) => (siblings[i] ? { slug: siblings[i].slug, title: siblings[i].title } : null);
  const docs = item.type === "component" ? await loadSourceDocs(slug) : null;

  return (
    <ItemDetail item={item} docs={docs} prev={neighbour(at - 1)} next={neighbour(at + 1)}>
      <Component />
    </ItemDetail>
  );
}
