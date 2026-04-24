"use client";
import { useState } from "react";
import { MorphTabs } from "../lib/components";

const TABS = ["Overview", "Analytics", "Settings", "Billing"];

const CONTENT: Record<string, string> = {
  Overview: "Your project at a glance. Key metrics, recent activity, and quick actions.",
  Analytics: "Traffic, conversions, and engagement trends over time.",
  Settings: "Configure integrations, notifications, and team permissions.",
  Billing: "Manage your plan, payment methods, and invoices.",
};

export default function MorphTabsDemo() {
  const [active, setActive] = useState(0);

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#050505]">
      <MorphTabs tabs={TABS} activeIndex={active} onChange={setActive} />

      <div className="mt-8 w-full max-w-md px-6">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-6">
          <p className="text-sm text-white/50 leading-relaxed tracking-tight">
            {CONTENT[TABS[active]]}
          </p>
        </div>
      </div>
    </div>
  );
}
