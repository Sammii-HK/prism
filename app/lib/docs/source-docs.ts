import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Documentation read straight from a component's source file at build time:
 * the JSDoc summary and `@example` blocks above the exported component, and
 * the members of its props interface. Docs written next to the code can't
 * drift from it, and nothing is duplicated into a separate content file.
 */

export type PropDoc = {
  name: string;
  type: string;
  optional: boolean;
  defaultValue?: string;
  description?: string;
};

export type SourceDocs = {
  componentName: string;
  summary?: string;
  examples: string[];
  props: PropDoc[];
  /** Import specifier using the project's `@/` alias. */
  importPath: string;
};

const pascal = (slug: string) => slug.replace(/(^|-)(\w)/g, (_, __, c: string) => c.toUpperCase());

/** Strip the leading `*` gutter from a JSDoc body. */
const docLines = (block: string) =>
  block
    .replace(/^\/\*\*|\*\/$/g, "")
    .split("\n")
    .map((line) => line.replace(/^\s*\* ?/, ""));

const findComponent = (src: string, slug: string) => {
  const exported = [...src.matchAll(/^export (?:const|function) ([A-Z]\w*)/gm)].map((m) => ({
    name: m[1],
    index: m.index ?? 0,
  }));
  const wanted = pascal(slug);
  const hasProps = (name: string) => new RegExp(`(?:interface|type)\\s+${name}Props\\b`).test(src);
  const hasExample = (index: number) => (jsDocBefore(src, index) ?? "").includes("@example");
  // Prefer the component named after the file, then any documented component
  // with a props interface (a reusable piece rather than its demo panel).
  return (
    exported.find((e) => e.name === wanted) ??
    exported.find((e) => hasProps(e.name) && hasExample(e.index)) ??
    exported.find((e) => hasProps(e.name)) ??
    exported.find((e) => e.name.startsWith(wanted))
  );
};

const jsDocBefore = (src: string, index: number) => {
  const before = src.slice(0, index).trimEnd();
  if (!before.endsWith("*/")) return undefined;
  const start = before.lastIndexOf("/**");
  return start >= 0 ? before.slice(start) : undefined;
};

const parseJsDoc = (block: string | undefined) => {
  if (!block) return { summary: undefined, examples: [] as string[] };
  const summary: string[] = [];
  const examples: string[][] = [];
  let inExample = false;
  for (const line of docLines(block)) {
    if (line.startsWith("@example")) {
      inExample = true;
      examples.push([]);
    } else if (line.startsWith("@")) {
      inExample = false;
    } else if (inExample) {
      examples[examples.length - 1].push(line);
    } else {
      summary.push(line);
    }
  }
  return {
    summary: summary.join(" ").replace(/\s+/g, " ").trim() || undefined,
    examples: examples.map((e) => e.join("\n").replace(/^\n+|\s+$/g, "")).filter(Boolean),
  };
};

/** Body of `interface XProps { … }` or `type XProps = … { … }`, braces balanced. */
const propsBody = (src: string, componentName: string) => {
  const head = src.match(new RegExp(`(?:interface|type)\\s+${componentName}Props\\b[^{]*\\{`));
  if (!head || head.index === undefined) return undefined;
  let depth = 1;
  let i = head.index + head[0].length;
  const start = i;
  for (; i < src.length && depth > 0; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") depth--;
  }
  return src.slice(start, i - 1);
};

const parseProps = (body: string): PropDoc[] => {
  const props: PropDoc[] = [];
  let pendingDoc: string | undefined;
  let i = 0;
  while (i < body.length) {
    const rest = body.slice(i);
    const ws = rest.match(/^\s+/);
    if (ws) {
      i += ws[0].length;
      continue;
    }
    if (rest.startsWith("/**")) {
      const end = rest.indexOf("*/");
      pendingDoc = docLines(rest.slice(0, end + 2)).join(" ").replace(/\s+/g, " ").trim();
      i += end + 2;
      continue;
    }
    if (rest.startsWith("//")) {
      const nl = rest.indexOf("\n");
      i += nl === -1 ? rest.length : nl + 1;
      continue;
    }
    const member = rest.match(/^("?[\w-]+"?)(\??):\s*/);
    if (!member) {
      i += 1;
      continue;
    }
    // Read the type up to the `;` (or line end) that closes this member, at bracket depth 0.
    let j = member[0].length;
    let depth = 0;
    for (; j < rest.length; j++) {
      const c = rest[j];
      if ("({[<".includes(c)) depth++;
      else if (")}]".includes(c) || (c === ">" && rest[j - 1] !== "=")) depth--;
      else if ((c === ";" || c === "\n") && depth <= 0) break;
    }
    props.push({
      name: member[1].replace(/"/g, ""),
      optional: member[2] === "?",
      type: rest.slice(member[0].length, j).replace(/\s+/g, " ").trim(),
      description: pendingDoc,
    });
    pendingDoc = undefined;
    i += j + 1;
  }
  return props;
};

/** Defaults from the component's parameter destructuring: `radius = 200,`. */
const parseDefaults = (src: string, index: number) => {
  const open = src.indexOf("{", src.indexOf("(", index));
  let depth = 1;
  let i = open + 1;
  for (; i < src.length && depth > 0; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") depth--;
  }
  const defaults = new Map<string, string>();
  for (const m of src.slice(open + 1, i - 1).matchAll(/(?:^|,)\s*("?[\w-]+"?)(?:\s*:\s*\w+)?\s*=\s*([^,\n]+?)\s*(?=,|$)/gm)) {
    defaults.set(m[1].replace(/"/g, ""), m[2].trim());
  }
  return defaults;
};

export const loadSourceDocs = async (slug: string): Promise<SourceDocs | null> => {
  let src: string | undefined;
  let foundIn = "";
  for (const dir of ["app/lib/components", "app/lib/primitives"]) {
    try {
      src = await readFile(path.join(process.cwd(), dir, `${slug}.tsx`), "utf8");
      foundIn = dir;
      break;
    } catch {
      // Try the next location.
    }
  }
  if (!src) return null;
  const component = findComponent(src, slug);
  if (!component) return null;

  const { summary, examples } = parseJsDoc(jsDocBefore(src, component.index));
  const body = propsBody(src, component.name);
  const defaults = parseDefaults(src, component.index);
  const props = body ? parseProps(body).map((p) => ({ ...p, defaultValue: defaults.get(p.name) })) : [];

  return { componentName: component.name, summary, examples, props, importPath: `@/${foundIn}/${slug}` };
};
