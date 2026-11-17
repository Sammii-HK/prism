import Link from "next/link";
import { Container } from "./ui";

const groups: Array<{ title: string; links: Array<{ label: string; href: string; external?: boolean }> }> = [
  {
    title: "Prism",
    links: [
      { label: "Showcase", href: "/showcase" },
      { label: "Components", href: "/components" },
      { label: "Interaction Lab", href: "/lab" },
      { label: "Atoms reference", href: "/atoms" },
    ],
  },
  {
    title: "Sammii",
    links: [
      { label: "Hiring me", href: "/hire" },
      { label: "Portfolio", href: "https://sammii.dev", external: true },
      { label: "GitHub", href: "https://github.com/Sammii-HK/prism", external: true },
      { label: "X / @technicalyblond", href: "https://x.com/technicalyblond", external: true },
    ],
  },
];

export const SiteFooter = () => (
  <footer className="mt-24 border-t border-white/[0.06]">
    <Container className="grid gap-12 py-16 sm:grid-cols-[1.4fr_1fr_1fr]">
      <div className="max-w-sm">
        <p className="text-sm leading-relaxed text-white/60">
          Prism is a craft catalogue of cursor-reactive UI primitives by Sammii, a design engineer in London.
          Every spring and colour is tuned by hand.
        </p>
      </div>
      {groups.map((group) => (
        <div key={group.title}>
          <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.22em] text-white/50">{group.title}</p>
          <ul className="space-y-2.5 text-sm">
            {group.links.map((link) => (
              <li key={link.href}>
                {link.external ? (
                  <a href={link.href} target="_blank" rel="noopener" className="text-white/60 transition-colors hover:text-white">
                    {link.label}
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                ) : (
                  <Link href={link.href} className="text-white/60 transition-colors hover:text-white">
                    {link.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </Container>
    <Container className="pb-10">
      <p className="font-mono text-[11px] text-white/50">© Sammii · Next.js, Tailwind and a lot of spring constants</p>
    </Container>
  </footer>
);
