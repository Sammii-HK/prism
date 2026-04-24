import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: "https://prism.sammii.dev/sitemap.xml",
    host: "https://prism.sammii.dev",
  };
}
