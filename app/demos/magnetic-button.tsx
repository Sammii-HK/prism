"use client";
import { MagneticButton } from "../lib/components";

export default function MagneticButtonDemo() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#050505]">
      <MagneticButton className="px-12 py-6 text-xl" radius={250} strength={45}>
        Get started
      </MagneticButton>
    </div>
  );
}
