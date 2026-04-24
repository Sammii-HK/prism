"use client";
import { useState } from "react";
import { GlowSelect } from "../lib/components/glow-select";

export default function GlowSelectDemo() {
  const [country, setCountry] = useState("");
  const [plan, setPlan] = useState("pro");
  const [status, setStatus] = useState("");

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: "#050505" }}
    >
      <div className="w-full max-w-sm flex flex-col gap-5 rounded-2xl">
        {/* Eyebrow */}
        <p className="text-xs tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.25)" }}>
          glow-select
        </p>

        {/* (a) Country — empty, shows full label-float spring on open */}
        <GlowSelect
          label="Country"
          placeholder="Choose a country"
          options={[
            { value: "uk", label: "United Kingdom" },
            { value: "us", label: "United States" },
            { value: "de", label: "Germany" },
            { value: "jp", label: "Japan" },
            { value: "au", label: "Australia" },
          ]}
          value={country}
          onChange={setCountry}
        />

        {/* (b) Plan — pre-selected, shows floated label on load */}
        <GlowSelect
          label="Plan"
          options={[
            { value: "free", label: "Free" },
            { value: "pro", label: "Pro" },
            { value: "enterprise", label: "Enterprise" },
          ]}
          value={plan}
          onChange={setPlan}
        />

        {/* (c) Status — disabled, suppressed */}
        <GlowSelect
          label="Status"
          options={[
            { value: "active", label: "Active" },
            { value: "inactive", label: "Inactive" },
          ]}
          value={status}
          onChange={setStatus}
          disabled
        />

        {/* Footer hint */}
        <p
          className="text-xs italic"
          style={{ color: "rgba(255,255,255,0.2)" }}
        >
          Click to open. Move your cursor around.
        </p>
      </div>
    </div>
  );
}
