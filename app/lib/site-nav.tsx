"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Home" },
  { href: "/components", label: "Components" },
  { href: "/playground", label: "Playground" },
  { href: "/atoms", label: "Atoms" },
];

export const SiteNav = () => {
  const pathname = usePathname();
  return (
    <nav className="sticky top-0 z-40 flex items-center justify-between px-4 sm:px-6 py-3 bg-black/40 backdrop-blur-md border-b border-white/5">
      <Link href="/" className="text-[11px] font-mono text-white/60 hover:text-white transition-colors tracking-wider">
        PRISM
      </Link>
      <div className="flex items-center gap-1">
        {links.slice(1).map((link) => {
          const active = pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href));
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`text-[11px] font-mono px-3 py-1.5 rounded-lg transition-colors ${
                active
                  ? "text-white/90 bg-white/[0.06]"
                  : "text-white/40 hover:text-white/70"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
