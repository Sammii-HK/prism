"use client";
import { ProgressBar } from "../lib/components/progress-bar";

export default function ProgressBarDemo() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: "#050505" }}
    >
      <div className="flex flex-col items-center gap-8 w-full max-w-md">
        <p className="text-xs tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.25)" }}>
          progress-bar
        </p>

        <div className="flex flex-col gap-6 w-full">
          <ProgressBar value={25} showLabel />
          <ProgressBar value={50} showLabel />
          <ProgressBar value={75} showLabel />
          <ProgressBar value={100} showLabel />
        </div>

        <p
          className="text-xs italic"
          style={{ color: "rgba(255,255,255,0.2)" }}
        >
          Move your cursor near the bars.
        </p>
      </div>
    </div>
  );
}
