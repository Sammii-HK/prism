import type { MetadataRoute } from "next";
import { registry } from "./lib/registry";

const SITE = "https://prism.sammii.dev";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const fixed: MetadataRoute.Sitemap = [
    { url: `${SITE}/`, changeFrequency: "daily", priority: 1.0, lastModified: now },
    { url: `${SITE}/components`, changeFrequency: "daily", priority: 0.9, lastModified: now },
    { url: `${SITE}/playground`, changeFrequency: "weekly", priority: 0.6, lastModified: now },
    { url: `${SITE}/atoms`, changeFrequency: "weekly", priority: 0.6, lastModified: now },
    { url: `${SITE}/hire`, changeFrequency: "monthly", priority: 0.8, lastModified: now },
  ];
  const items: MetadataRoute.Sitemap = registry.map((r) => ({
    url: `${SITE}/${r.slug}`,
    changeFrequency: "monthly",
    priority: r.type === "component" ? 0.7 : 0.5,
    lastModified: new Date(r.date),
  }));
  return [...fixed, ...items];
}
