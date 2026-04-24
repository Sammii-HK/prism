"use client";
import { useState } from "react";
import { GlowInput } from "../lib/components/glow-input";

export default function GlowInputDemo() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("hunter2");
  const [username, setUsername] = useState("");

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: "#050505" }}
    >
      <div className="w-full max-w-sm flex flex-col gap-5 rounded-2xl">
        {/* Eyebrow */}
        <p className="text-xs tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.25)" }}>
          glow-input
        </p>

        {/* (a) Email — empty, shows full label-float spring on click */}
        <GlowInput
          label="Email address"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={setEmail}
        />

        {/* (b) Password — pre-filled, error glow immediately visible on load */}
        <GlowInput
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          error="Incorrect password"
        />

        {/* (c) Disabled — suppressed, faded, no glow */}
        <GlowInput
          label="Username"
          value={username}
          onChange={setUsername}
          disabled
        />

        {/* Footer hint */}
        <p
          className="text-xs italic"
          style={{ color: "rgba(255,255,255,0.2)" }}
        >
          Focus any field. Move your cursor.
        </p>
      </div>
    </div>
  );
}
