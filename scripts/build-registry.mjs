import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve, relative, extname } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = resolve(root, "app/lib");
const config = JSON.parse(readFileSync(resolve(root, "registry.config.json"), "utf8"));
const check = process.argv.includes("--check");
const dependencies = { "lucide-react": "lucide-react@^0.577.0" };

function collect(roots) {
  const files = new Map();
  const packages = new Set();
  function visit(path) {
    path = resolve(sourceRoot, path);
    if (!path.startsWith(`${sourceRoot}/`)) throw new Error(`Source outside app/lib: ${path}`);
    if (files.has(path)) return;
    const content = readFileSync(path, "utf8");
    files.set(path, content);
    const tree = ts.createSourceFile(path, content, ts.ScriptTarget.Latest, true);
    for (const statement of tree.statements) {
      if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) continue;
      const specifier = statement.moduleSpecifier;
      if (!specifier || !ts.isStringLiteral(specifier)) continue;
      const name = specifier.text;
      if (name.startsWith(".")) {
        const base = resolve(dirname(path), name);
        const target = [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]
          .find((candidate) => extname(candidate) && existsSync(candidate));
        if (!target) throw new Error(`Unresolved import ${name} in ${path}`);
        visit(target);
      } else if (name !== "react" && name !== "react-dom") {
        if (!dependencies[name]) throw new Error(`Undeclared registry dependency ${name}`);
        packages.add(dependencies[name]);
      }
    }
  }
  roots.forEach(visit);
  return {
    dependencies: [...packages].sort(),
    files: [...files].sort(([a], [b]) => a.localeCompare(b)).map(([path, content]) => ({
      path: `registry/prism/${relative(sourceRoot, path)}`,
      // Keeping the source tree together preserves relative imports and lets
      // the host choose its own shadcn alias (including src/ and monorepos).
      type: "registry:file",
      target: `@ui/prism/${relative(sourceRoot, path)}`,
      content,
    })),
  };
}

function output(path, value) {
  const full = resolve(root, path);
  const content = `${JSON.stringify(value, null, 2)}\n`;
  if (check) {
    if (!existsSync(full) || readFileSync(full, "utf8") !== content) {
      throw new Error(`${path} is stale. Run npm run registry:build.`);
    }
  } else {
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
}

const items = config.items.map(({ name, title, roots }) => ({
  $schema: "https://ui.shadcn.com/schema/registry-item.json",
  name: `prism-${name}`,
  type: "registry:block",
  title: `Prism ${title}`,
  description: `${title} and its shared Prism hooks, copied as editable source.`,
  ...collect(roots),
  docs: "Requires React 18+ and Tailwind CSS 4. Styled for a dark surface. Imports live under your configured UI alias at prism/components; shared hooks stay beside them. AI response includes a stream adapter hook, not an AI provider or credentials. See https://prism.sammii.dev/docs/installation for usage and boundaries.",
}));

for (const item of items) output(`public/r/${item.name}.json`, item);
output("public/r/registry.json", {
  $schema: "https://ui.shadcn.com/schema/registry.json",
  name: "prism",
  homepage: "https://prism.sammii.dev",
  items,
});
console.log(`${check ? "Checked" : "Built"} ${items.length} Prism registry items.`);
