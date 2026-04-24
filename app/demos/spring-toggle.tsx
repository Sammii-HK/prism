"use client";
import { useState } from "react";
import { SpringToggle } from "../lib/components/spring-toggle";

export default function SpringToggleDemo() {
  const [notifications, setNotifications] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [beta, setBeta] = useState(false);

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: "#050505" }}
    >
      <div className="w-full max-w-sm flex flex-col gap-6 rounded-2xl">
        {/* Eyebrow */}
        <p className="text-xs tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.25)" }}>
          spring-toggle
        </p>

        {/* (a) Notifications — off by default */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-white/70">Notifications</span>
          <SpringToggle checked={notifications} onChange={setNotifications} />
        </div>

        {/* (b) Dark mode — pre-checked */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-white/70">Dark mode</span>
          <SpringToggle checked={darkMode} onChange={setDarkMode} />
        </div>

        {/* (c) Beta features — disabled */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-white/40">Beta features</span>
          <SpringToggle checked={beta} onChange={setBeta} disabled />
        </div>

        {/* Footer hint */}
        <p
          className="text-xs italic"
          style={{ color: "rgba(255,255,255,0.2)" }}
        >
          Click to toggle. Move your cursor near the track.
        </p>
      </div>
    </div>
  );
}
