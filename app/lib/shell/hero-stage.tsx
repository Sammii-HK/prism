"use client";
import { useId, useState } from "react";
import { Bell, Home, Moon, Search, Settings } from "lucide-react";
import {
  Avatar,
  FloatingDock,
  GlowBadge,
  GlowSelect,
  GlowSlider,
  RippleButton,
  SpringToggle,
} from "../components";
import { SpotlightCard } from "../primitives";

/**
 * The home page's live specimen: real Prism components composed into a small
 * settings panel, all reading the same attention point. It is a working UI,
 * not a screenshot, so it can be used with a mouse, a finger or the keyboard.
 */
export const HeroStage = () => {
  const id = useId();
  const [digest, setDigest] = useState(true);
  const [mentions, setMentions] = useState(false);
  const [volume, setVolume] = useState(64);
  const [cadence, setCadence] = useState("daily");
  const [saved, setSaved] = useState(false);

  const touch = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setSaved(false);
  };

  return (
    <div className="relative mx-auto w-full max-w-[440px]">
      <SpotlightCard className="relative rounded-3xl bg-white/[0.025] p-6 backdrop-blur-md sm:p-7">
        <div className="flex items-center gap-3">
          <Avatar fallback="SK" size={40} alt="Sammii" />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-white/90">Notifications</p>
            <p className="text-xs text-white/50">How Prism gets your attention</p>
          </div>
          <GlowBadge variant={saved ? "success" : "default"}>{saved ? "Saved" : "Draft"}</GlowBadge>
        </div>

        <div className="mt-7 flex flex-col gap-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p id={`${id}-digest`} className="text-sm text-white/80">
                Daily digest
              </p>
              <p className="text-xs text-white/50">One summary, no pings</p>
            </div>
            <SpringToggle checked={digest} onChange={touch(setDigest)} aria-labelledby={`${id}-digest`} />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p id={`${id}-mentions`} className="text-sm text-white/80">
                Mentions only
              </p>
              <p className="text-xs text-white/50">Ignore everything else</p>
            </div>
            <SpringToggle checked={mentions} onChange={touch(setMentions)} aria-labelledby={`${id}-mentions`} />
          </div>

          <GlowSlider label="Volume" value={volume} onChange={touch(setVolume)} showValue />

          <GlowSelect
            label="Send it"
            value={cadence}
            onChange={touch(setCadence)}
            options={[
              { value: "instant", label: "As it happens" },
              { value: "hourly", label: "Every hour" },
              { value: "daily", label: "Once a day" },
              { value: "weekly", label: "Once a week" },
            ]}
          />
        </div>

        <div className="mt-7 flex justify-end">
          <RippleButton className="text-sm" onClick={() => setSaved(true)}>
            Save changes
          </RippleButton>
        </div>
      </SpotlightCard>

      <div className="mt-6 flex justify-center">
        <FloatingDock
          iconSize={40}
          items={[
            { icon: <Home size={18} />, label: "Home" },
            { icon: <Search size={18} />, label: "Search" },
            { icon: <Bell size={18} />, label: "Notifications" },
            { icon: <Moon size={18} />, label: "Focus mode" },
            { icon: <Settings size={18} />, label: "Settings" },
          ]}
        />
      </div>
    </div>
  );
};
