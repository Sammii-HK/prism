"use client";
import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import type { RegistryItem } from "../lib/registry";
import type { SourceDocs } from "../lib/docs/source-docs";
import { CodeBlock } from "../lib/docs/code-block";
import { SiteNav } from "../lib/site-nav";
import { SiteFooter } from "../lib/shell/site-footer";
import { Container, Eyebrow } from "../lib/shell/ui";
import { AttentionReadout } from "../lib/shell/attention-readout";
import installable from "../../registry.config.json";

type Neighbour = { slug: string; title: string } | null;

type Props = {
  item: RegistryItem;
  docs: SourceDocs | null;
  prev: Neighbour;
  next: Neighbour;
  children: ReactNode;
};

const SUPPORT = [
  { input: "Cursor", detail: "Reacts to where the pointer is, not just whether it's over the element." },
  { input: "Touch", detail: "Follows your finger while it's down, then settles a moment after you lift." },
  { input: "Keyboard", detail: "Focus lights it up the way the cursor does. Every action has a key." },
  { input: "Reduced motion", detail: "Nothing moves or springs. Colour still answers, without drifting." },
];

/**
 * The page template for every component: header, a live
 * stage holding the demo, then usage, props and input support read from the
 * component's own source.
 */
export const ItemDetail = ({ item, docs, prev, next, children }: Props) => {
  const section = item.type === "study" ? { href: "/lab", label: "Lab" } : { href: "/components", label: "Components" };
  const importName = docs?.componentName;
  const canInstall = installable.items.some(({ name }) => name === item.slug);

  return (
    <div className="relative min-h-screen">
      <SiteNav />
      <main id="main">
        <Container as="header" className="pb-10 pt-12 sm:pt-16">
          <nav aria-label="Breadcrumb" className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/50">
            <Link href={section.href} className="transition-colors hover:text-white">
              {section.label}
            </Link>
            <span aria-hidden="true" className="mx-2 text-white/30">
              /
            </span>
            <span>{item.type === "study" ? "Case study" : item.category}</span>
          </nav>
          <div className="mt-5 grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <h1 className="text-[40px] font-light leading-none tracking-[-0.035em] text-white/95 sm:text-[56px]">{item.title}</h1>
              <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/60">{item.description}</p>
            </div>
            <ul className="flex flex-wrap gap-1.5 lg:max-w-xs lg:justify-end" aria-label="Built with">
              {item.tech.map((t) => (
                <li key={t} className="rounded-full border border-white/[0.08] px-2.5 py-1 font-mono text-[11px] text-white/55">
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </Container>

        {/* Stage: the demo runs inside a transformed box, so its full-viewport
            layout (fixed / min-h-screen) resolves to the stage instead. */}
        <Container>
          <section
            aria-label={`${item.title} demo`}
            className={`relative overflow-hidden [transform:translateZ(0)] [&_.h-screen]:h-full [&_.min-h-screen]:min-h-full rounded-3xl border border-white/[0.08] bg-[#050505] h-[min(70vh,680px)] min-h-[480px]`}
          >
            {children}
            <div className="pointer-events-none absolute bottom-4 left-4 z-10 hidden sm:block">
              <AttentionReadout className="bg-[#050505]/70 backdrop-blur-md" />
            </div>
          </section>
        </Container>

          <Container className="mt-20 grid gap-16 lg:grid-cols-[200px_1fr] lg:gap-12">
            <aside className="hidden lg:block">
              <div className="sticky top-24 flex flex-col gap-2 text-sm">
                <Eyebrow className="mb-2">On this page</Eyebrow>
                {docs && docs.examples.length > 0 && (
                  <a href="#usage" className="text-white/55 transition-colors hover:text-white">
                    Usage
                  </a>
                )}
                {docs && docs.props.length > 0 && (
                  <a href="#props" className="text-white/55 transition-colors hover:text-white">
                    Props
                  </a>
                )}
                <a href="#inputs" className="text-white/55 transition-colors hover:text-white">
                  Inputs
                </a>
              </div>
            </aside>

            <div className="flex min-w-0 flex-col gap-20">
              {canInstall && (
                <section aria-labelledby="installation">
                  <Eyebrow className="mb-3">Editable source</Eyebrow>
                  <h2 id="installation" className="mb-6 scroll-mt-24 text-2xl font-light text-white/90">Use it in your project</h2>
                  <CodeBlock label="terminal" code={`npx shadcn@latest add https://prism.sammii.dev/r/prism-${item.slug}.json`} />
                  <p className="mt-4 text-sm leading-relaxed text-white/55">
                    React 18+ and Tailwind CSS 4. Includes the shared hooks. Styled for a dark surface.
                    {" "}<Link href="/docs/installation" className="underline underline-offset-4 hover:text-white">Setup and usage</Link>.
                  </p>
                </section>
              )}
              {docs && (docs.examples.length > 0 || importName) && (
                <section aria-labelledby="usage">
                  <Eyebrow className="mb-3">Usage</Eyebrow>
                  <h2 id="usage" className="mb-6 scroll-mt-24 text-2xl font-light text-white/90">
                    {canInstall ? "Drop it in" : "Inspect the source"}
                  </h2>
                  {!canInstall && <p className="mb-5 text-sm leading-relaxed text-white/55">This example uses Prism’s source paths. It is not yet packaged as a registry install. Review the component and its shared dependencies before copying it. <a href={`https://github.com/Sammii-HK/prism/blob/main/app/lib/components/${item.slug}.tsx`} className="underline underline-offset-4 hover:text-white">Read the source</a>.</p>}
                  <div className="flex flex-col gap-4">
                    {importName && (
                      <CodeBlock label="import" code={`import { ${importName} } from "${canInstall ? `@/components/ui/prism/components/${item.slug}` : docs.importPath}";`} />
                    )}
                    {docs.examples.map((example, i) => (
                      <CodeBlock key={i} label={`example ${i + 1}`} code={example} />
                    ))}
                  </div>
                </section>
              )}

              {docs && docs.props.length > 0 && (
                <section aria-labelledby="props">
                  <Eyebrow className="mb-3">API</Eyebrow>
                  <h2 id="props" className="mb-6 scroll-mt-24 text-2xl font-light text-white/90">
                    Props
                  </h2>
                  <div className="overflow-x-auto rounded-2xl border border-white/[0.08]">
                    <table className="w-full min-w-[560px] text-left text-sm">
                      <thead className="border-b border-white/[0.08] font-mono text-[11px] uppercase tracking-[0.16em] text-white/50">
                        <tr>
                          <th scope="col" className="px-4 py-3 font-normal">Prop</th>
                          <th scope="col" className="px-4 py-3 font-normal">Type</th>
                          <th scope="col" className="px-4 py-3 font-normal">Default</th>
                        </tr>
                      </thead>
                      <tbody>
                        {docs.props.map((p) => (
                          <tr key={p.name} className="border-b border-white/[0.05] align-top last:border-0">
                            <th scope="row" className="px-4 py-3.5 font-normal">
                              <code className="font-mono text-[13px] text-white/90">
                                {p.name}
                                {!p.optional && <span className="text-[rgb(255_214_170)]">*</span>}
                              </code>
                              {p.description && <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-white/55">{p.description}</p>}
                            </th>
                            <td className="px-4 py-3.5">
                              <code className="font-mono text-[12px] leading-relaxed text-[rgb(196_210_255)]">{p.type}</code>
                            </td>
                            <td className="px-4 py-3.5">
                              <code className="font-mono text-[12px] text-white/60">{p.defaultValue ?? "—"}</code>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-3 text-xs text-white/50">
                    Read from the component&apos;s source at build time. <span className="text-[rgb(255_214_170)]">*</span> required.
                  </p>
                </section>
              )}

              <section aria-labelledby="inputs">
                <Eyebrow className="mb-3">Accessibility</Eyebrow>
                <h2 id="inputs" className="mb-6 scroll-mt-24 text-2xl font-light text-white/90">
                  Works with
                </h2>
                <dl className="grid gap-px overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.06] sm:grid-cols-2">
                  {SUPPORT.map((s) => (
                    <div key={s.input} className="bg-[#050505] p-5">
                      <dt className="text-sm text-white/90">{s.input}</dt>
                      <dd className="mt-1.5 text-[13px] leading-relaxed text-white/55">{s.detail}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            </div>
          </Container>

        {(prev || next) && (
          <Container as="nav" className="mt-24">
            <div className="grid gap-px overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.06] sm:grid-cols-2">
              {[{ n: prev, dir: "Previous" }, { n: next, dir: "Next" }].map(({ n, dir }) =>
                n ? (
                  <Link
                    key={dir}
                    href={`/${n.slug}`}
                    className={`group bg-[#050505] p-6 transition-colors hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/60 ${
                      dir === "Next" ? "sm:text-right" : ""
                    }`}
                  >
                    <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/50">{dir}</span>
                    <span className="mt-2 block text-lg font-light text-white/80 transition-colors group-hover:text-white">
                      {dir === "Previous" && <span aria-hidden="true"><ArrowLeft size={14} aria-hidden="true" className="inline-block align-middle" /> </span>}
                      {n.title}
                      {dir === "Next" && <span aria-hidden="true"> <ArrowRight size={14} aria-hidden="true" className="inline-block align-middle" /></span>}
                    </span>
                  </Link>
                ) : (
                  <div key={dir} className="hidden bg-[#050505] sm:block" />
                )
              )}
            </div>
          </Container>
        )}
      </main>
      <SiteFooter />
    </div>
  );
};
