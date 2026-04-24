"use client";
import { useState } from "react";
import { GlowCheckbox } from "../lib/components/glow-checkbox";

export default function GlowCheckboxDemo() {
  const [remember, setRemember] = useState(false);
  const [agree, setAgree] = useState(true);
  const [subscribe, setSubscribe] = useState(false);

  return (
    <div
      className="flex items-center justify-center w-full"
      style={{ minHeight: "100vh", backgroundColor: "#050505" }}
    >
      <div className="flex flex-col gap-4">
        <GlowCheckbox
          checked={remember}
          onChange={setRemember}
          label="Remember me"
        />
        <GlowCheckbox
          checked={agree}
          onChange={setAgree}
          label="I agree to terms"
        />
        <GlowCheckbox
          checked={subscribe}
          onChange={setSubscribe}
          label="Subscribe to updates"
        />
        <GlowCheckbox
          checked={false}
          onChange={() => {}}
          label="Enable notifications"
          disabled
        />
      </div>
    </div>
  );
}
