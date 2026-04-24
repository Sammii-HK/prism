"use client";
import { useState } from "react";
import { GlowTextarea } from "../lib/components/glow-textarea";

export default function GlowTextareaDemo() {
  const [bio, setBio] = useState("");
  const [message, setMessage] = useState(
    "Spring physics drive the floating label and border glow. Move your cursor around to see the pastel colour shift."
  );
  const [notes, setNotes] = useState("");

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: "#050505" }}
    >
      <div className="w-full max-w-sm flex flex-col gap-5 rounded-2xl">
        {/* Eyebrow */}
        <p className="text-xs tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.25)" }}>
          glow-textarea
        </p>

        {/* (a) Bio — empty, shows full label-float spring on click */}
        <GlowTextarea
          label="Bio"
          placeholder="Tell us about yourself..."
          rows={3}
          value={bio}
          onChange={setBio}
        />

        {/* (b) Message — pre-filled, label already floated on load */}
        <GlowTextarea
          label="Message"
          rows={4}
          value={message}
          onChange={setMessage}
        />

        {/* (c) Notes — disabled, suppressed, faded, no glow */}
        <GlowTextarea
          label="Notes"
          rows={3}
          value={notes}
          onChange={setNotes}
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
