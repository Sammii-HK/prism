"use client";
import { SpotlightCard } from "../lib/primitives";
import { usePointer } from "../lib/hooks/use-pointer";
import { colourField } from "../lib/primitives/gradient";

export default function SpotlightCardDemo() {
  const { xPc, yPc, time, mounted } = usePointer({ lerp: 0.08 });

  return (
    <div
      className="fixed inset-0 flex items-center justify-center px-8"
      style={{ top: "41px", ...(mounted ? colourField(xPc, yPc, time, 6) : {}) }}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl w-full">
        {[
          { title: "Analytics", desc: "Real-time dashboard with live metrics and trend analysis." },
          { title: "Notifications", desc: "Smart alerts that learn your preferences over time." },
          { title: "Settings", desc: "Fine-grained control over every aspect of your experience." },
          { title: "Integrations", desc: "Connect with 200+ services through a unified API." },
          { title: "Security", desc: "End-to-end encryption with zero-knowledge architecture." },
          { title: "Billing", desc: "Transparent pricing with no hidden fees or surprises." },
        ].map((card) => (
          <SpotlightCard key={card.title} className="bg-white/[0.03] backdrop-blur-sm p-6">
            <h3 className="text-base font-light text-white/80 mb-2">{card.title}</h3>
            <p className="text-xs text-white/35 leading-relaxed">{card.desc}</p>
          </SpotlightCard>
        ))}
      </div>
    </div>
  );
}
