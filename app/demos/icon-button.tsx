"use client";
import { IconButton } from "../lib/components/icon-button";
import { X, Heart, Settings, Plus } from "lucide-react";

export default function IconButtonDemo() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: "#050505" }}
    >
      <div className="flex flex-col items-center gap-8">
        <p className="text-xs tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.25)" }}>
          icon-button
        </p>

        <div className="flex flex-col items-center gap-6">
          <div className="flex items-center gap-3">
            <IconButton size="sm"><X size={12} /></IconButton>
            <IconButton size="sm"><Heart size={12} /></IconButton>
            <IconButton size="sm"><Settings size={12} /></IconButton>
            <IconButton size="sm"><Plus size={12} /></IconButton>
          </div>
          <div className="flex items-center gap-3">
            <IconButton size="md"><X size={16} /></IconButton>
            <IconButton size="md"><Heart size={16} /></IconButton>
            <IconButton size="md"><Settings size={16} /></IconButton>
            <IconButton size="md"><Plus size={16} /></IconButton>
          </div>
          <div className="flex items-center gap-3">
            <IconButton size="lg"><X size={20} /></IconButton>
            <IconButton size="lg"><Heart size={20} /></IconButton>
            <IconButton size="lg"><Settings size={20} /></IconButton>
            <IconButton size="lg"><Plus size={20} /></IconButton>
          </div>
        </div>

        <p
          className="text-xs italic"
          style={{ color: "rgba(255,255,255,0.2)" }}
        >
          Hover and click the buttons.
        </p>
      </div>
    </div>
  );
}
