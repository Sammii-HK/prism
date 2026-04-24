"use client";
import { useState } from "react";
import { GlowSlider } from "../lib/components/glow-slider";

export default function GlowSliderDemo() {
  const [volume, setVolume] = useState(65);
  const [opacity, setOpacity] = useState(0.8);
  const [brightness] = useState(50);

  return (
    <div className="flex items-center justify-center min-h-screen" style={{ background: "#050505" }}>
      <div className="flex flex-col gap-6 w-full max-w-sm px-4">
        <GlowSlider
          label="Volume"
          value={volume}
          onChange={setVolume}
          min={0}
          max={100}
          step={1}
        />
        <GlowSlider
          label="Opacity"
          value={opacity}
          onChange={setOpacity}
          min={0}
          max={1}
          step={0.01}
        />
        <GlowSlider
          label="Brightness"
          value={brightness}
          onChange={() => {}}
          min={0}
          max={100}
          step={1}
          disabled
        />
      </div>
    </div>
  );
}
