"use client";
import Link from "next/link";
import type { ReactNode } from "react";

export const SERIF = 'ui-serif, "Iowan Old Style", "Palatino Linotype", Georgia, serif';

export const Kbd = ({ children }: { children: ReactNode }) => (
  <kbd
    className="rounded border px-1.5 py-0.5 text-[11px] text-white/80"
    style={{ borderColor: "rgba(255,255,255,0.25)", background: "rgba(255,255,255,0.06)", fontFamily: "var(--font-geist-mono), monospace" }}
  >
    {children}
  </kbd>
);

export type EvidenceRow = { key: string; label: string; value: string };

/** Facts read from the page this visit. Anything not yet produced says so. */
export const Evidence = ({ rows, note }: { rows: EvidenceRow[]; note?: string }) => (
  <div>
    <dl className="flex flex-col gap-3 text-sm" data-testid="evidence">
      {rows.map((r) => (
        <div key={r.key} className="min-w-0">
          <dt className="text-[11px] uppercase tracking-[0.14em] text-white/50">{r.label}</dt>
          <dd
            data-evidence={r.key}
            className="mt-0.5 break-words text-white/85"
            style={{ fontFamily: "var(--font-geist-mono), monospace", fontSize: 12.5 }}
          >
            {r.value}
          </dd>
        </div>
      ))}
    </dl>
    {note && <p className="mt-4 text-xs leading-relaxed text-white/50">{note}</p>}
  </div>
);

export type KeyRow = { keys: string[]; does: string };

export const KeyList = ({ rows }: { rows: KeyRow[] }) => (
  <ul className="flex flex-col gap-2.5 text-sm text-white/70">
    {rows.map((r) => (
      <li key={r.does} className="flex flex-col items-start gap-1">
        <span className="flex flex-wrap gap-1">
          {r.keys.map((k) => (
            <Kbd key={k}>{k}</Kbd>
          ))}
        </span>
        <span className="min-w-0">{r.does}</span>
      </li>
    ))}
  </ul>
);

export const ColumnTitle = ({ children }: { children: ReactNode }) => (
  <h3 className="mb-4 text-[11px] font-medium uppercase tracking-[0.2em] text-white/60">{children}</h3>
);

type SectionProps = {
  slug: string;
  index: string;
  kicker: string;
  question: string;
  name: string;
  demo: ReactNode;
  why: ReactNode;
  keys: KeyRow[];
  reducedNote: string;
  evidence: EvidenceRow[];
  evidenceNote?: string;
};

export const LabSection = ({
  slug, index, kicker, question, name, demo, why, keys, reducedNote, evidence, evidenceNote,
}: SectionProps) => (
  <section
    id={slug}
    aria-labelledby={`${slug}-heading`}
    className="scroll-mt-32 border-t py-16 sm:py-24"
    style={{ borderColor: "rgba(255,255,255,0.1)" }}
  >
    <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
      <p className="mb-5 flex flex-wrap items-baseline gap-x-3 text-[11px] uppercase tracking-[0.22em] text-white/55">
        <span style={{ fontFamily: "var(--font-geist-mono), monospace" }}>{index}</span>
        <span>{kicker}</span>
      </p>
      <h2
        id={`${slug}-heading`}
        tabIndex={-1}
        className="max-w-3xl rounded-sm text-[28px] font-normal leading-[1.12] tracking-tight text-white/95 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-4 focus-visible:ring-offset-black sm:text-5xl"
        style={{ fontFamily: SERIF }}
      >
        {question}
      </h2>
      <p className="mt-4 text-sm text-white/60">
        The experiment: <span className="text-white/85">{name}</span>
        <span aria-hidden> · </span>
        <Link
          href={`/${slug}`}
          className="underline decoration-white/30 underline-offset-4 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          open it on its own page
        </Link>
      </p>

      <div
        data-lab-demo={slug}
        className="mt-8 min-w-0 rounded-2xl border p-4 sm:p-8"
        style={{ borderColor: "rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.025)" }}
      >
        {demo}
      </div>

      <div className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
        <div className="min-w-0">
          <ColumnTitle>Why this effect exists</ColumnTitle>
          <div className="text-[15px] leading-relaxed text-white/75" style={{ fontFamily: SERIF }}>
            {why}
          </div>
        </div>
        <div className="min-w-0">
          <ColumnTitle>Keyboard and accessibility</ColumnTitle>
          <KeyList rows={keys} />
          <p className="mt-4 text-sm leading-relaxed text-white/70">
            <span className="text-white/90">Reduced motion: </span>
            {reducedNote}
          </p>
        </div>
        <div className="min-w-0">
          <ColumnTitle>Evidence</ColumnTitle>
          <Evidence rows={evidence} note={evidenceNote} />
        </div>
      </div>
    </div>
  </section>
);
