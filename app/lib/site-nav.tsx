"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { subscribeAttention } from "./hooks/attention";
import { motionTime } from "./hooks/reduced-motion";
import { pastelColour } from "./primitives/gradient";

const links = [
  { href: "/showcase", label: "Showcase" },
  { href: "/components", label: "Components" },
  { href: "/playground", label: "Playground" },
  { href: "/lab", label: "Lab" },
  { href: "/hire", label: "Hire" },
];

/**
 * The prism mark: a small triangle whose edge picks up the attention colour,
 * so the wordmark is quietly live on every page.
 */
const PrismMark = () => {
  const ref = useRef<SVGPathElement>(null);

  useEffect(() => {
    let frame = 0;
    return subscribeAttention(({ x, y, kind }) => {
      if (kind === "none" || frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const { r, g, b } = pastelColour((x / window.innerWidth) * 100, (y / window.innerHeight) * 100, motionTime());
        ref.current?.setAttribute("stroke", `rgb(${r} ${g} ${b})`);
      });
    });
  }, []);

  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" className="shrink-0">
      <path ref={ref} d="M7 1.5 12.6 12H1.4Z" fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth="1.25" strokeLinejoin="round" />
    </svg>
  );
};

/** `skipTo` is the skip link target; pass null when the page provides its own. */
export const SiteNav = ({ skipTo = "#main" }: { skipTo?: string | null } = {}) => {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#050505]/70 backdrop-blur-xl">
      {skipTo && (
        <a
          href={skipTo}
          className="sr-only rounded-lg bg-white px-3 py-2 text-sm text-black focus:not-sr-only focus:absolute focus:left-4 focus:top-3"
        >
          Skip to content
        </a>
      )}
      <nav aria-label="Primary" className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-5 sm:px-8">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2.5 rounded-md font-mono text-[12px] tracking-[0.2em] text-white/80 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          <PrismMark />
          <span className="max-sm:sr-only">PRISM</span>
        </Link>
        <ul className="no-scrollbar -mr-2 flex min-w-0 items-center gap-0.5 overflow-x-auto pr-2 sm:mr-0 sm:gap-1 sm:overflow-visible sm:pr-0">
          {links.map((link) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={`relative block whitespace-nowrap rounded-lg px-2 py-1.5 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 sm:px-3 ${
                    active ? "text-white" : "text-white/55 hover:text-white/85"
                  }`}
                >
                  {link.label}
                  {active && (
                    <span className="absolute inset-x-2 -bottom-[13px] h-px bg-gradient-to-r from-transparent via-white/70 to-transparent sm:inset-x-3" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
};
