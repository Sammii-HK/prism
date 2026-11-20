import Link from "next/link";
import type { Metadata } from "next";
import { SiteNav } from "../../lib/site-nav";
import { SiteFooter } from "../../lib/shell/site-footer";
import { Container, Eyebrow } from "../../lib/shell/ui";
import { CodeBlock } from "../../lib/docs/code-block";
import installable from "../../../registry.config.json";

export const metadata: Metadata = {
  title: "Install Prism components",
  description: "Copy Prism’s AI response, async button and overlay components into your React project with the shadcn CLI.",
};

export default function Installation() {
  return (
    <div className="relative min-h-screen">
      <SiteNav />
      <main id="main">
        <Container className="max-w-3xl py-16">
          <Eyebrow>Prism in your project</Eyebrow>
          <h1 className="mt-5 text-4xl font-light tracking-tight text-white/95">Keep the source. Make it yours.</h1>
          <p className="mt-6 text-base leading-relaxed text-white/60">
            Install a component with its shared hooks using the shadcn CLI. The files become part of your project,
            ready to read and change. React 18+ and Tailwind CSS 4 are required. The current visual styles use a dark surface.
          </p>
          <section className="mt-12 space-y-5" aria-labelledby="setup">
            <h2 id="setup" className="text-2xl font-light text-white/90">Start with shadcn</h2>
            <p className="text-sm leading-relaxed text-white/60">If your project already has a components.json file, skip init. Installation follows its UI directory and import alias.</p>
            <CodeBlock label="terminal" code={'npx shadcn@latest init\nnpx shadcn@latest add https://prism.sammii.dev/r/prism-async-button.json'} />
            <CodeBlock label="example · default UI alias" code={'"use client";\nimport { AsyncButton } from "@/components/ui/prism/components/async-button";\n\nexport function SaveButton() {\n  return <AsyncButton onPress={async () => {\n    const response = await fetch("/api/save", { method: "POST" });\n    if (!response.ok) throw new Error("Could not save");\n  }} />;\n}'} />
            <p className="text-sm leading-relaxed text-white/60">The example assumes the default @/components/ui alias. Use your configured UI alias if it differs. Keep the prism folder together: components import their hooks and primitives using relative paths. Shared files are reused across installs; review the CLI’s overwrite prompt if you have edited them.</p>
          </section>
          <section className="mt-12 space-y-5" aria-labelledby="available">
            <h2 id="available" className="text-2xl font-light text-white/90">Choose a component</h2>
            <ul className="space-y-5">
              {installable.items.map(({ name, title }) => (
                <li key={name}>
                  <Link href={`/${name}`} className="mb-2 inline-block text-sm text-white/80 underline underline-offset-4">{title}: demo and API</Link>
                  <CodeBlock label="terminal" code={`npx shadcn@latest add https://prism.sammii.dev/r/prism-${name}.json`} />
                </li>
              ))}
            </ul>
          </section>
          <section className="mt-12 space-y-5" aria-labelledby="ai">
            <h2 id="ai" className="text-2xl font-light text-white/90">Connect your response stream</h2>
            <p className="text-sm leading-relaxed text-white/60">AI response includes useAssistant and the StreamSource event contract. Supply an abortable stream of text, tool and completion events from your own backend. It includes no provider, API key, model call or Prism recordings.</p>
            <CodeBlock label="hook imports · default UI alias" code={'import { AIResponse } from "@/components/ui/prism/components/ai-response";\nimport { useAssistant, type StreamSource } from "@/components/ui/prism/hooks/assistant";'} />
            <p className="text-sm leading-relaxed text-white/60">The token composer and latency experiments remain studies in the Lab. A source install does not turn them into AI generation or add their demo recordings to your product.</p>
          </section>
        </Container>
      </main>
      <SiteFooter />
    </div>
  );
}
