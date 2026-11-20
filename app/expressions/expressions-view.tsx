"use client";
import { useId, useState } from "react";
import { Container, Eyebrow, SectionHeading } from "../lib/shell/ui";
import { EXPRESSIONS, setExpression, useExpression, type Expression } from "../lib/expressions/store";
import { compileSpring, SPRINGS } from "../lib/expressions/spring-css";
import { Button, Checkbox, ExpressionScope, Select, Slider, Switch, Tabs, TextField, Tooltip } from "../lib/ui";

/**
 * The same product, written once against Prism's shared API. Nothing in
 * this component knows which expression it is drawn in.
 */
const SettingsProduct = ({ idBase }: { idBase: string }) => {
  const [tab, setTab] = useState(0);
  const [email, setEmail] = useState("sammii@");
  const [frequency, setFrequency] = useState("daily");
  const [volume, setVolume] = useState(64);
  const [digest, setDigest] = useState(true);
  const [mentions, setMentions] = useState(false);
  const [terms, setTerms] = useState(false);
  const emailValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);

  return (
    <div className="grid gap-7">
      <Tabs id={idBase} label="Settings sections" tabs={["Notifications", "Privacy", "Advanced"]} value={tab} onChange={setTab} />
      <div role="tabpanel" id={`${idBase}-panel-${tab}`} aria-labelledby={`${idBase}-tab-${tab}`} className="grid gap-6">
        {tab === 0 && (
          <>
            <TextField label="Email" type="email" value={email} onChange={setEmail} error={emailValid ? undefined : "Enter a full email address"} />
            <Select
              label="Send it"
              value={frequency}
              onChange={setFrequency}
              options={[
                { value: "instant", label: "As it happens" },
                { value: "daily", label: "Once a day" },
                { value: "weekly", label: "Once a week" },
              ]}
            />
            <Slider label="Volume" value={volume} onChange={setVolume} />
            <Switch label="Daily digest" checked={digest} onChange={setDigest} />
            <Switch label="Mentions only" checked={mentions} onChange={setMentions} />
          </>
        )}
        {tab === 1 && (
          <>
            <Switch label="Show my activity" checked={!mentions} onChange={(v) => setMentions(!v)} />
            <Checkbox label="I agree to the privacy terms" checked={terms} onChange={setTerms} />
          </>
        )}
        {tab === 2 && <Slider label="Retention (days)" value={volume} onChange={setVolume} min={1} max={365} />}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button>Save changes</Button>
        <Button variant="quiet">Cancel</Button>
        <Tooltip content="Changes apply to every device">
          <button
            type="button"
            aria-label="About these settings"
            className="grid h-9 w-9 place-items-center rounded-full border border-white/20 text-[13px] text-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            ?
          </button>
        </Tooltip>
      </div>
    </div>
  );
};

const PRODUCT_CODE = `<Tabs id="settings" label="Settings sections" tabs={sections} value={tab} onChange={setTab} />
<TextField label="Email" type="email" value={email} onChange={setEmail} error={error} />
<Select label="Send it" value={frequency} onChange={setFrequency} options={frequencies} />
<Slider label="Volume" value={volume} onChange={setVolume} />
<Switch label="Daily digest" checked={digest} onChange={setDigest} />
<Button>Save changes</Button>`;

/** A radio group: one expression at a time, arrow keys between them. */
const ExpressionPicker = ({ value, onChange }: { value: Expression; onChange: (e: Expression) => void }) => {
  const name = useId();
  return (
    <fieldset className="flex flex-wrap gap-2">
      <legend className="sr-only">Expression</legend>
      {EXPRESSIONS.map((e) => (
        <label
          key={e.id}
          className={`cursor-pointer rounded-full border px-4 py-2 text-[13px] transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-white/70 ${
            value === e.id ? "border-white/60 bg-white/[0.08] text-white" : "border-white/[0.1] text-white/60 hover:border-white/25 hover:text-white/85"
          }`}
        >
          <input type="radio" name={name} value={e.id} checked={value === e.id} onChange={() => onChange(e.id)} className="sr-only" />
          {e.label}
          <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">{e.technique}</span>
        </label>
      ))}
    </fieldset>
  );
};

/**
 * The JavaScript spring (Luminous) and its compiled CSS linear() easing
 * (Reserved), drawn on the same axes. They are the same curve.
 */
const SpringProof = () => {
  const spring = SPRINGS.settle;
  const stops = spring.easing.slice(7, -1).split(",").map(Number);
  const W = 320;
  const H = 120;
  const lo = 0;
  const hi = 1 + Math.max(0.08, spring.overshoot * 1.6);
  const y = (v: number) => H - 8 - ((v - lo) / (hi - lo)) * (H - 16);

  // The live JS integrator, frame by frame, as Luminous runs it.
  const frames: number[] = [];
  let pos = 0;
  let vel = 0;
  const total = Math.round(spring.durationMs / (1000 / 60));
  for (let i = 0; i <= total; i++) {
    frames.push(pos);
    vel += (180 * (1 - pos) - 22 * vel) / 60;
    pos += vel / 60;
  }
  const jsPath = frames.map((v, i) => `${i === 0 ? "M" : "L"}${((i / total) * W).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const soft = compileSpring(120, 18);

  return (
    <figure className="rounded-2xl border border-white/[0.08] bg-white/[0.015] p-5">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`The JavaScript spring and its CSS linear() easing overlap exactly. Settles in ${spring.durationMs}ms with ${(spring.overshoot * 100).toFixed(1)}% overshoot.`}>
        <line x1="0" x2={W} y1={y(1)} y2={y(1)} stroke="rgba(255,255,255,0.15)" strokeDasharray="3 4" />
        <path d={jsPath} fill="none" stroke="rgba(134,239,172,0.9)" strokeWidth="3" strokeLinecap="round" />
        {stops.map((v, i) => (
          <circle key={i} cx={(i / (stops.length - 1)) * W} cy={y(v)} r="1.8" fill="#fff" />
        ))}
      </svg>
      <figcaption className="mt-4 grid gap-1.5 font-mono text-[11px] leading-relaxed text-white/55">
        <span>
          <span className="text-[#86efac]">━</span> Luminous: requestAnimationFrame, k 180, d 22, every frame in JS
        </span>
        <span>
          <span className="text-white">•</span> Reserved: the same constants compiled once into {stops.length} CSS linear() stops
        </span>
        <span className="text-white/40">
          settle {spring.durationMs}ms · overshoot {(spring.overshoot * 100).toFixed(1)}% · glow spring (k 120, d 18) {soft.durationMs}ms
        </span>
      </figcaption>
    </figure>
  );
};

export const ExpressionsView = () => {
  const expression = useExpression();
  const [sideBySide, setSideBySide] = useState(false);

  const active = EXPRESSIONS.find((e) => e.id === expression)!;

  return (
    <>
      <Container as="header" className="pb-12 pt-16 sm:pt-20">
        <Eyebrow>Expressions</Eyebrow>
        <h1 className="mt-5 max-w-3xl text-[44px] font-light leading-[1.02] tracking-[-0.035em] text-white/90 sm:text-6xl">
          One API. Three ways to build it.
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/60">
          Every Prism component shares one set of props and one behaviour contract: the same roles, the same keys,
          the same focus. On top of that sit three complete design languages, each built with a different technique.
          The product below is written once. Switch it.
        </p>
      </Container>

      <Container className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <ExpressionPicker value={expression} onChange={setExpression} />
        <label className="flex cursor-pointer items-center gap-2 text-[13px] text-white/60">
          <input type="checkbox" checked={sideBySide} onChange={(e) => setSideBySide(e.target.checked)} className="h-4 w-4 accent-white" />
          Side by side
        </label>
      </Container>

      {sideBySide ? (
        <div className="mx-auto mt-8 grid w-full max-w-[1400px] gap-4 px-3 sm:px-6 lg:grid-cols-3">
          {EXPRESSIONS.map((e) => (
            <section key={e.id} aria-label={e.label} className="rounded-[24px] border border-white/[0.08] bg-[#080808] p-6">
              <p className="mb-6 font-mono text-[11px] uppercase tracking-[0.2em] text-white/50">
                {e.label} · {e.technique}
              </p>
              <ExpressionScope expression={e.id}>
                <SettingsProduct idBase={`side-${e.id}`} />
              </ExpressionScope>
            </section>
          ))}
        </div>
      ) : (
        <Container className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section aria-label={`Settings, drawn in ${active.label}`} className="rounded-[28px] border border-white/[0.08] bg-[#080808] p-6 sm:p-10">
            <SettingsProduct idBase="product" />
          </section>
          <aside className="grid content-start gap-5">
            <div>
              <Eyebrow className="mb-2">{active.technique}</Eyebrow>
              <p className="text-[15px] leading-relaxed text-white/70">{active.summary}</p>
            </div>
            <p className="text-[13px] leading-relaxed text-white/50">
              Turn on <span className="font-mono text-white/70">X-ray</span> in the nav to watch the difference: Luminous
              shows springs traced frame by frame in JavaScript, Reserved shows none, because the browser runs them.
            </p>
          </aside>
        </Container>
      )}

      <Container className="mt-24">
        <SectionHeading eyebrow="The same curve" title="A spring, compiled to CSS" />
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <SpringProof />
          <div className="grid content-start gap-4 text-[15px] leading-relaxed text-white/65">
            <p>
              Luminous runs its springs in JavaScript, every frame. Reserved does not run them at all. It takes the same
              hand-tuned stiffness and damping, simulates the spring once, and hands the browser a CSS{" "}
              <code className="font-mono text-[13px] text-white/85">linear()</code> easing that traces the identical curve,
              overshoot included. The animation then runs on the compositor with no script.
            </p>
            <p>
              The tuning stays the single source of truth: change the constants and both expressions move the same new way.
              Editorial is the control: no easing at all, every state change instant.
            </p>
          </div>
        </div>
      </Container>

      <Container className="mt-24">
        <SectionHeading eyebrow="Written once" title="The product code doesn't change" />
        <pre className="overflow-x-auto rounded-2xl border border-white/[0.08] bg-white/[0.015] p-6 font-mono text-[12.5px] leading-[1.8] text-white/75">
          <code>{PRODUCT_CODE}</code>
        </pre>
        <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-white/60">
          Each expression is held to one contract: a switch is a switch to a screen reader, tabs move with the arrow keys,
          a slider takes Page Up and Home, a select opens with Enter and closes with Escape. The same automated tests run
          against all three.
        </p>
      </Container>
    </>
  );
};
