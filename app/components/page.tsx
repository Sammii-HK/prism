import type { Metadata } from "next";
import { Suspense } from "react";
import { ComponentsGallery } from "./gallery";

export const metadata: Metadata = {
  title: "Components — Prism",
  description: "Filterable gallery of cursor-reactive components with spring physics, hand-built by Sammii.",
};

export default function ComponentsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <ComponentsGallery />
    </Suspense>
  );
}
