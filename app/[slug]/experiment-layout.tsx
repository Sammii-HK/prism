"use client";
import Link from "next/link";
import { type Experiment } from "../lib/registry";
import { type ReactNode } from "react";

type Props = {
  experiment: Experiment;
  children: ReactNode;
};

export const ExperimentLayout = ({ experiment, children }: Props) => {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Minimal top bar */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 bg-black/40 backdrop-blur-md border-b border-white/5">
        <Link
          href="/"
          className="text-[11px] font-mono text-white/30 hover:text-white/60 transition-colors"
        >
          Prism
        </Link>
        <span className="text-[11px] font-mono text-white/50">
          {experiment.title}
        </span>
        <span className="text-[10px] font-mono text-white/20">
          {experiment.date}
        </span>
      </nav>

      {/* Full-screen experiment canvas */}
      <main className="flex-1 pt-[41px]">
        {children}
      </main>
    </div>
  );
};
