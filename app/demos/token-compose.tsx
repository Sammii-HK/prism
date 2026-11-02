"use client";
import { TokenComposePanel } from "../lib/components/token-compose";

export default function TokenComposeDemo() {
  return (
    <div className="min-h-screen px-6 py-16" style={{ background: "#050505" }}>
      <TokenComposePanel />
    </div>
  );
}
