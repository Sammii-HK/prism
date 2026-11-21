import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, mkdirSync, writeFileSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const registry = JSON.parse(readFileSync(resolve(root, "public/r/registry.json"), "utf8"));

test("all registry items coexist and compile outside the Prism app", () => {
  const fixture = mkdtempSync(resolve(tmpdir(), "prism-registry-"));
  symlinkSync(resolve(root, "node_modules"), resolve(fixture, "node_modules"));
  const files = new Map();
  for (const item of registry.items) {
    for (const file of item.files) {
      assert.match(file.target, /^@ui\/prism\/[a-z0-9/.-]+\.tsx?$/);
      assert.ok(!file.target.includes(".."));
      const path = resolve(fixture, file.target.replace("@ui/", "components/ui/"));
      if (files.has(path)) assert.equal(files.get(path), file.content, `Shared file diverged: ${path}`);
      files.set(path, file.content);
    }
  }
  for (const [path, content] of files) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }
  const program = ts.createProgram([...files.keys()], {
    target: ts.ScriptTarget.ES2017,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.ReactJSX,
    strict: true,
    skipLibCheck: true,
    esModuleInterop: true,
    noEmit: true,
  });
  const errors = ts.getPreEmitDiagnostics(program);
  assert.equal(errors.length, 0, ts.formatDiagnosticsWithColorAndContext(errors, {
    getCanonicalFileName: (path) => path,
    getCurrentDirectory: () => fixture,
    getNewLine: () => "\n",
  }));
});
