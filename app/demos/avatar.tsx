"use client";
import { Avatar } from "../lib/components/avatar";

export default function AvatarDemo() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: "#050505" }}
    >
      <div className="flex flex-col items-center gap-8">
        <p className="text-xs tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.25)" }}>
          avatar
        </p>

        <div className="flex items-center gap-5">
          <Avatar src="https://i.pravatar.cc/80?u=1" alt="User" />
          <Avatar fallback="SK" />
          <Avatar fallback="A" size={28} />
          <Avatar fallback="JD" size={56} />
        </div>

        <p
          className="text-xs italic"
          style={{ color: "rgba(255,255,255,0.2)" }}
        >
          Move your cursor near the avatars.
        </p>
      </div>
    </div>
  );
}
