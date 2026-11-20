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
        <p className="text-xs tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.5)" }}>
          spring-toggle
        </p>

        {/* (a) Notifications — off by default */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-white/70" id="toggle-notifications">Notifications</span>
          <SpringToggle checked={notifications} onChange={setNotifications} aria-labelledby="toggle-notifications" />
        </div>

        {/* (b) Dark mode — pre-checked */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-white/70" id="toggle-dark-mode">Dark mode</span>
          <SpringToggle checked={darkMode} onChange={setDarkMode} aria-labelledby="toggle-dark-mode" />
        </div>

        {/* (c) Beta features — disabled */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-white/50" id="toggle-beta-features">Beta features</span>
          <SpringToggle checked={beta} onChange={setBeta} disabled aria-labelledby="toggle-beta-features" />
        </div>

        {/* Footer hint */}
        <p
          className="text-xs italic"
          style={{ color: "rgba(255,255,255,0.5)" }}
        >
          Click to toggle. Move your cursor near the track.
        </p>
      </div>
    </div>
  );
}
