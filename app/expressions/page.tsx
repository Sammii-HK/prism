import type { Metadata } from "next";
import { SiteNav } from "../lib/site-nav";
import { SiteFooter } from "../lib/shell/site-footer";
import { ExpressionsView } from "./expressions-view";

export const metadata: Metadata = {
  title: "Expressions — Prism",
  description:
    "One component API, three complete design languages built with three different techniques: JavaScript physics, native CSS motion, and the platform itself.",
};

export default function ExpressionsPage() {
  return (
    <div className="relative min-h-screen">
      <SiteNav />
      <main id="main">
        <ExpressionsView />
      </main>
      <SiteFooter />
    </div>
  );
}
