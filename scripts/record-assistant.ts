/**
 * Record real assistant runs for the AI response demo.
 *
 * Runs a local model through Ollama (no API cost), gives it two tools over
 * Prism's real registry, and writes every text chunk, tool call and tool
 * result with the time it actually happened. The demo replays these, so a
 * visitor sees real model output at its real pace and nobody pays per view.
 *
 *   ollama serve
 *   node --experimental-strip-types scripts/record-assistant.ts
 *
 * Faults are injected only where a scenario says so, and the scenario's
 * `note` says exactly what was injected, so the demo can label it.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { registry } from "../app/lib/registry.ts";

const MODEL = process.env.MODEL ?? "qwen2.5-coder:7b";
const OLLAMA = process.env.OLLAMA ?? "http://localhost:11434";
const OUT = new URL("../app/lib/recordings/", import.meta.url).pathname;

type Source = { n: number; title: string; href: string };
type Event =
  | { t: number; type: "text"; text: string }
  | { t: number; type: "tool_call"; id: string; name: string; args: Record<string, unknown> }
  | { t: number; type: "tool_result"; id: string; ok: boolean; summary: string; sources?: Source[] }
  | { t: number; type: "error"; message: string }
  | { t: number; type: "done" };

type Scenario = {
  id: string;
  title: string;
  prompt: string;
  note: string;
  /** Fail the first call to this tool, to record how the model recovers. */
  failTool?: string;
};

const SCENARIOS: Scenario[] = [
  {
    id: "confirm-delete",
    title: "Picks a component, with sources",
    prompt: "Which Prism component should I use to confirm deleting a project, and why?",
    note: "Recorded as it ran. Nothing injected.",
  },
  {
    id: "slow-save",
    title: "Answers from a search",
    prompt: "How should my app show that a save is taking a while, without flashing a spinner on fast saves?",
    note: "Recorded as it ran. Nothing injected.",
  },
  {
    id: "tool-fails",
    title: "A tool times out",
    prompt: "Which Prism component should I use for a share-link panel that opens from a button?",
    note: "The get_component call was made to time out while recording. The model's reply to that is its own.",
    failTool: "get_component",
  },
  {
    id: "tool-fails-retry",
    title: "The retry",
    prompt: "Which Prism component should I use for a share-link panel that opens from a button?",
    note: "A second, separate run of the same question, recorded with nothing injected. Played when you press Retry.",
  },
  {
    id: "wrong-source",
    title: "The model reads the wrong component",
    prompt: "What does Prism's action menu do with the keyboard?",
    note: "Recorded as it ran. Search ranked Menu first; the model opened Radial menu instead, on every seed tried. Left as it happened: the citation is how a reader catches it.",
  },
];

const items = registry.filter((r) => r.type === "component");

const TOOLS = [
  {
    type: "function",
    function: {
      name: "search_components",
      description: "Search Prism's components by what they are for. Returns matching components with their slug and a one-line summary.",
      parameters: { type: "object", properties: { query: { type: "string", description: "What the user needs, in plain words" } }, required: ["query"] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_component",
      description: "Get the full description of one Prism component by slug.",
      parameters: { type: "object", properties: { slug: { type: "string" } }, required: ["slug"] },
    },
  },
];

const SYSTEM = `You are the assistant on Prism, a component library. Answer using only what the tools return.
Call search_components first, then get_component for the best match before answering.
Cite sources inline with the number given in the tool result, like [1]. Keep the answer under 120 words, in plain British English, with no headings.`;

/**
 * Score components by where the query's words appear: a title match counts
 * most, then tags, then the description. Deterministic, so a recording can be
 * reproduced exactly.
 */
const STOP = new Set(["the", "and", "for", "with", "what", "does", "how", "should", "prism", "use", "that", "this", "show", "without", "while"]);
const search = (query: string) => {
  const words = query.toLowerCase().split(/\W+/).filter((w) => w.length > 2 && !STOP.has(w));
  return items
    .map((r) => {
      const title = r.title.toLowerCase();
      const tags = r.tags.join(" ").toLowerCase();
      const body = `${r.tagline ?? ""} ${r.description}`.toLowerCase();
      const score = words.reduce((sum, w) => sum + (title.includes(w) ? 3 : 0) + (tags.includes(w) ? 2 : 0) + (body.includes(w) ? 1 : 0), 0);
      return { r, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((x) => x.r);
};

/** Parse `{"name": ..., "arguments": ...}` (one or several, optionally fenced) written as text. */
const parseTextCalls = (text: string) => {
  const body = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
  if (!body.startsWith("{") && !body.startsWith("[")) return null;
  const tryParse = (chunk: string) => {
    try {
      return JSON.parse(chunk);
    } catch {
      return undefined;
    }
  };
  let parsed = tryParse(body);
  // Several objects on separate lines.
  if (parsed === undefined) {
    const lines = body.split(/\n(?=\s*\{)/).map(tryParse);
    if (lines.some((l) => l === undefined)) return null;
    parsed = lines;
  }
  const list = Array.isArray(parsed) ? parsed : [parsed];
  if (!list.every((c) => c && typeof c.name === "string")) return null;
  return list.map((c) => ({ function: { name: c.name as string, arguments: (c.arguments ?? c.parameters ?? {}) as Record<string, unknown> } }));
};

const record = async (s: Scenario) => {
  const events: Event[] = [];
  const sources = new Map<string, Source>();
  const t0 = performance.now();
  const at = () => Math.round(performance.now() - t0);
  const messages: Array<Record<string, unknown>> = [
    { role: "system", content: SYSTEM },
    { role: "user", content: s.prompt },
  ];
  let failed = false;
  let callCount = 0;

  const sourceFor = (slug: string, title: string) => {
    if (!sources.has(slug)) sources.set(slug, { n: sources.size + 1, title, href: `/${slug}` });
    return sources.get(slug)!;
  };

  for (let round = 0; round < 5; round++) {
    const res = await fetch(`${OLLAMA}/api/chat`, {
      method: "POST",
      body: JSON.stringify({ model: MODEL, messages, tools: TOOLS, stream: true, options: { temperature: 0.3, seed: Number(process.env.SEED ?? 7) } }),
    });
    if (!res.ok || !res.body) throw new Error(`Ollama ${res.status}`);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let content = "";
    const roundStart = events.length;
    const calls: Array<{ function: { name: string; arguments: Record<string, unknown> } }> = [];

    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line) continue;
        const chunk = JSON.parse(line);
        const text: string = chunk.message?.content ?? "";
        if (text) {
          content += text;
          events.push({ t: at(), type: "text", text });
        }
        if (chunk.message?.tool_calls) calls.push(...chunk.message.tool_calls);
      }
    }

    // Small models often write the tool call as JSON text instead of using the
    // tool-call field. A reply that is nothing but calls is treated as calls,
    // and its text is taken back out of the recording.
    if (calls.length === 0) {
      const parsed = parseTextCalls(content);
      if (parsed) {
        while (events.length && events[events.length - 1].type === "text" && roundStart <= events.length - 1) events.pop();
        calls.push(...parsed);
      }
    }
    if (calls.length === 0) break;
    messages.push({ role: "assistant", content, tool_calls: calls });

    for (const call of calls) {
      const id = `call-${++callCount}`;
      const { name, arguments: args } = call.function;
      events.push({ t: at(), type: "tool_call", id, name, args });
      // Real work, timed as it happens.
      let result: unknown;
      let ok = true;
      let summary = "";
      let found: Source[] | undefined;
      if (s.failTool === name && !failed) {
        failed = true;
        await new Promise((r) => setTimeout(r, 1800));
        ok = false;
        result = { error: "Timed out after 1.8s" };
        summary = "Timed out after 1.8s";
      } else if (name === "search_components") {
        const hits = search(String(args.query ?? ""));
        found = hits.map((h) => sourceFor(h.slug, h.title));
        result = hits.map((h) => ({ source: sourceFor(h.slug, h.title).n, slug: h.slug, title: h.title, summary: h.tagline }));
        summary = hits.length ? `Found ${hits.map((h) => h.title).join(", ")}` : "No matches";
      } else if (name === "get_component") {
        const hit = items.find((r) => r.slug === String(args.slug));
        if (hit) {
          const src = sourceFor(hit.slug, hit.title);
          found = [src];
          result = { source: src.n, title: hit.title, description: hit.description };
          summary = `Read ${hit.title}`;
        } else {
          ok = false;
          result = { error: `No component called "${String(args.slug)}"` };
          summary = `No component called "${String(args.slug)}"`;
        }
      } else {
        ok = false;
        result = { error: `Unknown tool ${name}` };
        summary = `Unknown tool ${name}`;
      }
      events.push({ t: at(), type: "tool_result", id, ok, summary, sources: found });
      messages.push({ role: "tool", content: JSON.stringify(result) });
    }
  }

  events.push({ t: at(), type: "done" });
  return {
    id: s.id,
    title: s.title,
    prompt: s.prompt,
    note: s.note,
    model: `${MODEL} (local, through Ollama)`,
    recordedAt: new Date().toISOString().slice(0, 10),
    sources: [...sources.values()],
    events,
  };
};

mkdirSync(OUT, { recursive: true });
// Load the model first, so a cold start is not recorded as the model thinking.
await fetch(`${OLLAMA}/api/chat`, { method: "POST", body: JSON.stringify({ model: MODEL, messages: [{ role: "user", content: "hi" }], stream: false }) });
const only = process.argv[2];
for (const s of SCENARIOS.filter((x) => !only || x.id === only)) {
  const rec = await record(s);
  writeFileSync(`${OUT}${s.id}.json`, JSON.stringify(rec, null, 2) + "\n");
  const text = rec.events.filter((e) => e.type === "text").map((e) => (e as { text: string }).text).join("");
  const steps = rec.events.filter((e) => e.type === "tool_call").map((e) => (e as { name: string }).name);
  console.log(`\n== ${s.id} (${rec.events.at(-1)!.t}ms, tools: ${steps.join(" → ") || "none"})\n${text}`);
}
