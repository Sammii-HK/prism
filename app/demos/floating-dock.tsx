"use client";
import { Home, Search, Music2, Camera, Mail, Calendar, Star } from "lucide-react";
import { FloatingDock } from "../lib/components";

const DOCK_ITEMS = [
  {
    label: "Home",
    icon: (
      <Home width="24" height="24"   stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/70" />
    ),
  },
  {
    label: "Search",
    icon: (
      <Search width="24" height="24"   stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/70" />
    ),
  },
  {
    label: "Music",
    icon: (
      <Music2 width="24" height="24"   stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/70" />
    ),
  },
  {
    label: "Camera",
    icon: (
      <Camera width="24" height="24"   stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/70" />
    ),
  },
  {
    label: "Mail",
    icon: (
      <Mail width="24" height="24"   stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/70" />
    ),
  },
  {
    label: "Calendar",
    icon: (
      <Calendar width="24" height="24"   stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/70" />
    ),
  },
  {
    label: "Star",
    icon: (
      <Star width="24" height="24"   stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/70" />
    ),
  },
];

export default function FloatingDockDemo() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#050505]">
      <FloatingDock items={DOCK_ITEMS} iconSize={52} gap={8} />
    </div>
  );
}
