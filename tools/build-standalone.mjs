#!/usr/bin/env node
/**
 * Bundle the ES modules into a single standalone HTML file.
 *
 * Why this exists: the app is written as ES modules, and browsers block module
 * scripts on the file:// protocol (CORS — a null origin cannot load them).
 * Opening docs/index.html by double-clicking therefore renders nothing.
 *
 * This produces dist/fingerprint-lab.html: one self-contained file that runs
 * from the filesystem with no server, no build tooling, and no dependencies.
 *
 * Approach — a tiny module runtime rather than a naive concatenation.
 * Concatenating modules and stripping `import`/`export` puts every module in
 * one shared scope, which breaks as soon as two modules declare the same name
 * (all 27 probes declare `export const probe`). So instead each module is
 * wrapped in its own function and receives its imports as arguments:
 *
 *     __def("key", function (__exports, __require) {
 *       const { probe } = __require("other-key");
 *       ...
 *       __exports.probe = probe;
 *     });
 *
 * That preserves module scope exactly, which is what a real bundler does.
 *
 * Usage:  node tools/build-standalone.mjs
 * Output: dist/fingerprint-lab.html
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const DOCS = join(ROOT, "docs");
const OUT_DIR = join(ROOT, "dist");
const OUT_FILE = join(OUT_DIR, "fingerprint-lab.html");

/** Stable, short key for a module path, used as the registry key. */
function keyFor(file) {
  return file.replace(DOCS + "/", "").replace(/\.js$/, "");
}

/** Read a module and list its relative dependency specifiers. */
async function readModule(file) {
  const source = await readFile(file, "utf8");
  const dir = dirname(file);
  const deps = [];
  const importRe = /(?:^|\n)\s*import\s+(?:[\s\S]*?)\s+from\s+["']([^"']+)["']\s*;?/g;
  let m;
  while ((m = importRe.exec(source))) {
    if (m[1].startsWith(".")) deps.push(resolve(dir, m[1]));
  }
  return { file, source, deps };
}

/**
 * Rewrite one module's source into a runtime factory function.
 */
function toFactory(mod) {
  const { source, file } = mod;
  const key = keyFor(file);

  // Collect imports so we can synthesise a `require` call per specifier.
  const imports = [];
  const importRe = /^[ \t]*import\s+([\s\S]*?)\s+from\s+["']([^"']+)["']\s*;?[ \t]*$/gm;
  let m;
  while ((m = importRe.exec(source))) {
    const clause = m[1].trim();
    const spec = m[2];
    if (!spec.startsWith(".")) continue; // bare specifier — none in this project
    const depKey = keyFor(resolve(dirname(file), spec));
    imports.push({ clause, depKey, index: imports.length });
  }

  let body = source
    // Drop all import statements (replaced by require() below).
    .replace(/^[ \t]*import\s+[\s\S]*?\s+from\s+["'][^"']+["']\s*;?[ \t]*$/gm, "")
    .replace(/^[ \t]*import\s+["'][^"']+["']\s*;?[ \t]*$/gm, "");

  // Collect exported names before rewriting, so we know what to assign.
  const exported = new Set();
  const declRe = /^[ \t]*export\s+(?:async\s+function|function|class|const|let|var)\s+([A-Za-z_$][\w$]*)/gm;
  let dm;
  while ((dm = declRe.exec(source))) exported.add(dm[1]);

  const listRe = /^[ \t]*export\s*\{([^}]*)\}\s*;?/gm;
  while ((dm = listRe.exec(source))) {
    for (const part of dm[1].split(",")) {
      const piece = part.trim();
      if (!piece) continue;
      const asMatch = piece.match(/\bas\s+([A-Za-z_$][\w$]*)\s*$/);
      exported.add(asMatch ? asMatch[1] : piece);
    }
  }

  // Strip the `export` keyword from declarations and lists.
  body = body
    .replace(/^[ \t]*export\s+(async\s+function|function|class|const|let|var)\s/gm, "$1 ")
    .replace(/^[ \t]*export\s*\{[^}]*\}\s*;?/gm, "")
    .replace(/^[ \t]*export\s+default\s+/gm, "const __default = ")
    .replace(/^[ \t]*export\s+/gm, "");

  // Prepend a require() per import, destructured the way the module declared.
  //
  // `import { probe as foo }` must become two statements — the `as` alias
  // syntax only exists inside an import clause and is a syntax error in an
  // ordinary destructuring pattern.
  const requires = imports.map(({ clause, depKey }) => {
    if (clause.startsWith("{")) {
      const inner = clause.slice(1, -1).trim();
      const specs = inner.split(",").map((s) => s.trim()).filter(Boolean);
      // Unique binding name per import: a module may import from several
      // modules and a shared `__mod` would be redeclared in the same scope.
      const modVar = `__m${clause.length}_${depKey.replace(/\W/g, "_")}_${clause.slice(0, 12).replace(/\W/g, "")}`;
      const simple = [];
      const aliased = [];
      for (const spec of specs) {
        const alias = spec.match(/^([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)$/);
        if (alias) aliased.push(`  const ${alias[2]} = ${modVar}[${JSON.stringify(alias[1])}];`);
        else simple.push(spec);
      }
      const lines = [`  const ${modVar} = __require(${JSON.stringify(depKey)});`];
      if (simple.length) lines.push(`  const { ${simple.join(", ")} } = ${modVar};`);
      lines.push(...aliased);
      return lines.join("\n");
    }
    // default or namespace import — none used in this project, but handle it
    // defensively rather than silently dropping it.
    return `  const __m_${depKey.replace(/\W/g, "_")} = __require(${JSON.stringify(depKey)});`;
  });

  const tail = [...exported].map((n) => `  __exports[${JSON.stringify(n)}] = ${n};`);

  return `__def(${JSON.stringify(key)}, function (__exports, __require) {
${requires.join("\n")}
${body}
${tail.join("\n")}
});`;
}

const RUNTIME = `
/* ---- module runtime (minimal, for the standalone build only) ---------- */
var __registry = Object.create(null);
var __cache = Object.create(null);
function __def(key, factory) { __registry[key] = factory; }
function __require(key) {
  if (__cache[key]) return __cache[key];
  var factory = __registry[key];
  if (!factory) throw new Error("Module not found: " + key);
  var exports = {};
  __cache[key] = exports;
  factory(exports, __require);
  return exports;
}
`;

async function main() {
  const entry = join(DOCS, "src", "js", "app.js");

  // Load the graph.
  const modules = new Map();
  const queue = [entry];
  while (queue.length) {
    const file = queue.shift();
    if (modules.has(file)) continue;
    const mod = await readModule(file);
    modules.set(file, mod);
    queue.push(...mod.deps);
  }

  // Emit every module as a factory. Order does not matter now — the runtime
  // resolves lazily — but keeping it dependency-first aids readability.
  const factories = [];
  const seen = new Set();
  const emit = (file) => {
    if (seen.has(file) || !modules.has(file)) return;
    seen.add(file);
    for (const d of modules.get(file).deps) emit(d);
    factories.push(toFactory(modules.get(file)));
  };
  emit(entry);

  const css = await readFile(join(DOCS, "assets", "css", "main.css"), "utf8");
  let html = await readFile(join(DOCS, "index.html"), "utf8");

  html = html.replace(
    /<link rel="stylesheet" href="assets\/css\/main\.css">/,
    `<style>\n${css}\n</style>`
  );
  html = html.replace(/<script type="module" src="src\/js\/app\.js"><\/script>/, "");
  html = html.replace(/<script>\n  \/\/ Runs only if the module above failed[\s\S]*?<\/script>/, "");

  const bundle = `${RUNTIME}
${factories.join("\n\n")}

/* Boot the entry point. */
__require("src/js/app");
`;

  html = html.replace("</body>", `<script>\n${bundle}\n</script>\n</body>`);

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_FILE, html, "utf8");

  console.log(`Bundled ${factories.length} modules`);
  console.log(`Wrote ${OUT_FILE}`);
  console.log(`  ${(Buffer.byteLength(html) / 1024).toFixed(1)} KB`);
  console.log(`  Open it directly — no server required.`);
}

main().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});