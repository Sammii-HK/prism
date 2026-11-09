"use client";
import { useId, useState } from "react";
import { useSystemReducedMotion } from "./async-button";
import {
  BLOCK_COUNTS, BODY_SIZES, INJECT_KINDS, LAYOUTS, PALETTE, PASTELS, RADII, SPACING_STEPS, TITLE_SIZES, TYPE_SIZES,
  formatValue, injectOffToken, runBatch, validateComposition,
  type Batch, type Composition, type InjectKind, type Violation,
} from "../token-compose-core";

// The pure functions live in token-compose-core.ts (so node can test them); re-exported here.
export * from "../token-compose-core";

const TITLES = ["Quiet release", "Weekly summary", "New arrival", "Almost there", "Field notes", "Open studio"];
const BODIES = [
  "Small steps, one at a time.",
  "Nothing here is off the scale.",
  "Built only from what the system allows.",
  "Same tokens, different arrangement.",
];

/**
 * One composed card. Every number and colour comes straight from the
 * composition, which is why a composition is validated before it is drawn.
 */
export const ComposedCard = ({ c, animate = false }: { c: Composition; animate?: boolean }) => {
  const { card, title, body, chip } = c;
  const bars = Array.from({ length: c.blocks }, (_, i) => i);
  return (
    <div
      data-composed-card={c.seed}
      data-layout={c.layout}
      className="min-w-0"
      style={{
        display: "flex",
        flexDirection: c.layout === "split" ? "row" : "column",
        flexWrap: c.layout === "split" ? "wrap" : "nowrap",
        justifyContent: "space-between",
        gap: card.gap,
        padding: card.padding,
        borderRadius: card.radius,
        background: card.background,
        animation: animate ? "prism-compose-in 220ms ease-out both" : "none",
      }}
    >
      <div className="min-w-0" style={{ display: "flex", flexDirection: "column", gap: card.gap }}>
        <p style={{ margin: 0, fontSize: title.size, lineHeight: 1.1, color: title.colour, fontWeight: 600 }}>
          {TITLES[c.seed % TITLES.length]}
        </p>
        <p style={{ margin: 0, fontSize: body.size, lineHeight: 1.35, color: body.colour }}>{BODIES[c.seed % BODIES.length]}</p>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: c.layout === "grid" ? "1fr 1fr" : "1fr",
          gap: card.gap,
          alignContent: "start",
          minWidth: c.layout === "split" ? 64 : undefined,
        }}
      >
        {bars.map((i) => (
          <span key={i} aria-hidden style={{ display: "block", height: card.gap, borderRadius: chip.radius, background: title.colour }} />
        ))}
        <span
          style={{
            display: "inline-block",
            justifySelf: "start",
            padding: chip.padding / 2 + 2,
            borderRadius: chip.radius,
            background: chip.background,
            color: body.colour,
            fontSize: body.size,
            lineHeight: 1,
          }}
        >
          {c.layout}
        </span>
      </div>
    </div>
  );
};

export interface TokenObservation {
  generated: number;
  valuesChecked: number;
  outside: number;
  seeds: [number, number];
  injected: null | { kind: InjectKind; path: string; value: string; rule: string; rejected: boolean };
}

export const TOKEN_DEFAULT_SEED = 1;
export const TOKEN_DEFAULT_COUNT = 24;
export const TOKEN_COUNTS = [6, 24, 120, 1000] as const;
const SHOWN = 4;

const observeBatch = (b: Batch, injected: TokenObservation["injected"]): TokenObservation => ({
  generated: b.count,
  valuesChecked: b.valuesChecked,
  outside: b.outside,
  seeds: [b.startSeed, b.startSeed + b.count - 1],
  injected,
});

/** The numbers the lab shows before anything has been pressed: the same batch the demo draws on load. */
export const initialTokenObservation = (): TokenObservation =>
  observeBatch(runBatch(TOKEN_DEFAULT_SEED, TOKEN_DEFAULT_COUNT), null);

interface Injection {
  kind: InjectKind;
  violation: Violation | null;
  total: number;
}

const btn =
  "rounded-lg border px-3.5 py-2 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black";
const btnStyle = { borderColor: "rgba(255,255,255,0.24)", background: "rgba(255,255,255,0.08)" } as const;

const Tokens = ({ label, values }: { label: string; values: readonly (string | number)[] }) => (
  <div className="min-w-0">
    <dt className="text-[11px] uppercase tracking-[0.14em] text-white/50">{label}</dt>
    <dd className="mt-1 flex flex-wrap gap-1.5">
      {values.map((v) => (
        <span
          key={v}
          className="inline-flex items-center gap-1.5 rounded border px-1.5 py-0.5 text-[11px] text-white/75"
          style={{ borderColor: "rgba(255,255,255,0.18)", fontFamily: "var(--font-geist-mono), monospace" }}
        >
          {typeof v === "string" && v.startsWith("rgb(") && (
            <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full border border-white/30" style={{ background: v }} />
          )}
          {typeof v === "string" && v.startsWith("rgb(") ? v.slice(4, -1) : v}
        </span>
      ))}
    </dd>
  </div>
);

export function TokenComposePanel({
  embedded = false,
  forceReduced = false,
  onObserve,
}: {
  embedded?: boolean;
  /** Host-forced reduced motion. Cards then appear in place instead of easing in. */
  forceReduced?: boolean;
  /** Called from event handlers with the numbers produced by the validator. */
  onObserve?: (o: TokenObservation) => void;
}) {
  const countName = useId();
  const systemReduced = useSystemReducedMotion();
  const reduced = forceReduced || systemReduced;
  const [count, setCount] = useState<number>(TOKEN_DEFAULT_COUNT);
  const [startSeed, setStartSeed] = useState(TOKEN_DEFAULT_SEED);
  const [batch, setBatch] = useState<Batch>(() => runBatch(TOKEN_DEFAULT_SEED, TOKEN_DEFAULT_COUNT));
  const [injection, setInjection] = useState<Injection | null>(null);
  const [nextKind, setNextKind] = useState(0);

  const observe = (b: Batch, inj: Injection | null) =>
    onObserve?.(
      observeBatch(
        b,
        inj && inj.violation
          ? { kind: inj.kind, path: inj.violation.path, value: formatValue(inj.violation.value), rule: inj.violation.rule, rejected: true }
          : inj
            ? { kind: inj.kind, path: "", value: "", rule: "none", rejected: false }
            : null
      )
    );

  const generate = (start: number, n: number) => {
    const b = runBatch(start, n);
    setBatch(b);
    setStartSeed(start);
    setCount(n);
    observe(b, injection);
  };

  const inject = () => {
    const kind = INJECT_KINDS[nextKind % INJECT_KINDS.length];
    const bad = injectOffToken(batch.compositions[0], kind);
    const result = validateComposition(bad);
    const inj: Injection = { kind, violation: result.violations[0] ?? null, total: result.checked };
    setInjection(inj);
    setNextKind((k) => k + 1);
    observe(batch, inj);
  };

  const clear = () => {
    setInjection(null);
    observe(batch, null);
  };

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-10 md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <style>{`@keyframes prism-compose-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }`}</style>
      <section className="flex min-w-0 flex-col gap-6" aria-label="Composer">
        {!embedded && <p className="text-xs uppercase tracking-widest text-white/25">token-compose</p>}

        <fieldset className="flex flex-col gap-3 border-0 p-0">
          <legend className="mb-2 text-xs uppercase tracking-widest text-white/40">Compositions to generate</legend>
          <div role="radiogroup" aria-label="How many compositions" className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/75">
            {TOKEN_COUNTS.map((n) => (
              <label key={n} className="flex items-center gap-2">
                <input
                  type="radio"
                  name={countName}
                  checked={count === n}
                  onChange={() => generate(startSeed, n)}
                />
                {n}
              </label>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className={btn} style={btnStyle} onClick={() => generate(startSeed + count, count)}>
              Generate another batch
            </button>
            <span className="text-xs text-white/50" data-testid="seed-range">
              seeds {startSeed} to {startSeed + count - 1}
            </span>
          </div>
        </fieldset>

        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}
          data-testid="composed-cards"
          aria-label={`The first ${Math.min(SHOWN, count)} of ${count} generated compositions`}
          role="group"
        >
          {batch.compositions.slice(0, SHOWN).map((c) => (
            <ComposedCard key={c.seed} c={c} animate={!reduced} />
          ))}
        </div>
        <p className="-mt-3 text-xs text-white/50">
          Showing the first {Math.min(SHOWN, count)} of {count}. The validator ran over all {count}.
        </p>

        <p
          role="status"
          aria-live="polite"
          data-testid="token-summary"
          className="rounded-lg border px-3 py-2 text-sm text-white/85"
          style={{ borderColor: "rgba(255,255,255,0.18)", fontFamily: "var(--font-geist-mono), monospace", fontSize: 12.5 }}
        >
          {batch.count} generated · {batch.valuesChecked} values checked · {batch.outside} outside the system
        </p>
      </section>

      <section className="flex min-w-0 flex-col gap-6" aria-label="Validator">
        <div>
          <h3 className="mb-3 text-xs uppercase tracking-widest text-white/40">Try to break it</h3>
          <div className="flex flex-wrap gap-3">
            <button type="button" className={btn} style={btnStyle} onClick={inject} data-testid="inject">
              Inject an off-token value
            </button>
            <button type="button" className={btn} style={btnStyle} onClick={clear} disabled={!injection} data-testid="clear-injection">
              Clear
            </button>
          </div>
          <div role="status" aria-live="polite" data-testid="injection-result" className="mt-3 min-h-[3.5rem] text-sm">
            {!injection ? (
              <p className="text-white/50">
                Takes the first composition and swaps one value for something off the scale. Each press tries a different kind.
              </p>
            ) : injection.violation ? (
              <div className="rounded-lg border px-3 py-2" style={{ borderColor: "rgba(255,130,130,0.6)", background: "rgba(255,130,130,0.08)" }}>
                <p className="text-white/90">
                  Rejected: <code data-testid="rejected-path">{injection.violation.path}</code> ={" "}
                  <code data-testid="rejected-value">{formatValue(injection.violation.value)}</code>
                </p>
                <p className="mt-1 text-white/70">
                  Rule <code data-testid="rejected-rule">{injection.violation.rule}</code>: {injection.violation.message}.
                </p>
                <p className="mt-1 text-xs text-white/50">Not drawn. {injection.total} values in that composition were checked.</p>
              </div>
            ) : (
              <p className="text-white/90" data-testid="not-rejected">Not rejected (unexpected).</p>
            )}
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-xs uppercase tracking-widest text-white/40">The closed vocabulary</h3>
          <dl className="flex flex-col gap-3">
            <Tokens label="Spacing (px)" values={SPACING_STEPS} />
            <Tokens label="Radius (px)" values={RADII} />
            <Tokens label="Type (px)" values={TYPE_SIZES} />
            <Tokens label={`Palette (${PASTELS.length} from pastelColour, plus ink)`} values={PALETTE} />
            <Tokens label="Layouts" values={LAYOUTS} />
            <Tokens label="Blocks" values={BLOCK_COUNTS} />
          </dl>
          <p className="mt-3 text-xs text-white/50">
            Titles use {TITLE_SIZES.join(", ")}; body text uses {BODY_SIZES.join(", ")}.
          </p>
        </div>
      </section>
    </div>
  );
}
