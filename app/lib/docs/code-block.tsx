"use client";
import { useState, type ReactNode } from "react";

/**
 * A small TSX highlighter: strings, comments, JSX tag names, keywords and
 * numbers. Enough to make examples readable without shipping a parser.
 */
const TOKEN =
  /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(<\/?)([A-Za-z][\w.]*)|\b(import|from|export|const|let|return|function|await|async|new|true|false|null|undefined)\b|\b(\d+(?:\.\d+)?)\b/g;

const highlight = (code: string): ReactNode[] => {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of code.matchAll(TOKEN)) {
    const at = m.index ?? 0;
    if (at > last) out.push(code.slice(last, at));
    const key = `${at}`;
    if (m[1]) out.push(<span key={key} className="text-white/40">{m[1]}</span>);
    else if (m[2]) out.push(<span key={key} className="text-[rgb(200_230_210)]">{m[2]}</span>);
    else if (m[3]) {
      out.push(
        <span key={key}>
          <span className="text-white/45">{m[3]}</span>
          <span className="text-[rgb(196_210_255)]">{m[4]}</span>
        </span>
      );
    } else if (m[5]) out.push(<span key={key} className="text-[rgb(240_200_225)]">{m[5]}</span>);
    else if (m[6]) out.push(<span key={key} className="text-[rgb(255_214_170)]">{m[6]}</span>);
    last = at + m[0].length;
  }
  if (last < code.length) out.push(code.slice(last));
  return out;
};

export const CodeBlock = ({ code, label }: { code: string; label?: string }) => {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      // Clipboard can be blocked (insecure context, permissions); the code is still selectable.
    }
  };

  return (
    <figure className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
        <figcaption className="font-mono text-[11px] text-white/50">{label ?? "tsx"}</figcaption>
        <button
          type="button"
          onClick={copy}
          className="rounded-md px-2 py-1 font-mono text-[11px] text-white/55 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          {copied ? "Copied" : "Copy"}
          <span className="sr-only" aria-live="polite">
            {copied ? " to clipboard" : ""}
          </span>
        </button>
      </div>
      <pre className="overflow-x-auto px-4 py-4 font-mono text-[13px] leading-relaxed text-white/80">
        <code>{highlight(code)}</code>
      </pre>
    </figure>
  );
};
