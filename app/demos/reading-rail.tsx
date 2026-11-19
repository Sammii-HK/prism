"use client";
import { ReadingRailPanel } from "../lib/components/reading-rail";

export default function ReadingRailDemo() {
  return (
    <div className="min-h-screen px-6 py-16" style={{ background: "#050505" }}>
      <ReadingRailPanel height={620} />
    </div>
  );
}
