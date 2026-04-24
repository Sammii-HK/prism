import { defineConfig } from "tsup";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

// Collect every re-export in src/{components,primitives,hooks} so each gets its own
// chunk (enabling per-component subpath imports without loading the rest of the lib).
const entry: Record<string, string> = {
  index: "src/index.ts",
};

const subdirs = ["components", "primitives", "hooks"] as const;
for (const dir of subdirs) {
  const full = join("src", dir);
  for (const file of readdirSync(full)) {
    if (!file.endsWith(".ts") && !file.endsWith(".tsx")) continue;
    const name = file.replace(/\.tsx?$/, "");
    // Components and primitives are flat at the root of the package dist so consumers
    // can do `@sammii/prism-ui/ripple-button` — hooks keep a `hooks/` prefix to avoid
    // naming collisions with components.
    const key = dir === "hooks" ? `hooks/${name}` : name;
    entry[key] = join(full, file);
  }
}

// Which dist/*.js files need a "use client" directive at the top. Every
// component and every primitive that renders DOM is a client module; the
// pure gradient utilities (`gradient.js`) are server-safe and left alone.
const clientFiles = [
  "index.js",
  ...Object.keys(entry)
    .filter((k) => k !== "index" && k !== "gradient")
    .map((k) => `${k}.js`),
];

export default defineConfig({
  entry,
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  target: "es2020",
  external: ["react", "react-dom", "react/jsx-runtime"],
  // esbuild strips top-level directives during bundling (and its `banner`
  // option ends up below the generated imports). Prepend the directive
  // ourselves after the build completes so RSC boundaries behave.
  async onSuccess() {
    const distDir = resolve("dist");
    for (const rel of clientFiles) {
      const file = join(distDir, rel);
      try {
        const contents = readFileSync(file, "utf8");
        if (contents.startsWith('"use client"')) continue;
        writeFileSync(file, `"use client";\n${contents}`);
      } catch {
        // file might not exist for this entry — ignore
      }
    }
  },
});
