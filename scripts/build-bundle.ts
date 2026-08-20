import { build } from "esbuild";
import { execSync } from "node:child_process";
import { mkdirSync, rmSync, cpSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const stage = resolve(root, "build/bundle");

rmSync(stage, { recursive: true, force: true });
mkdirSync(resolve(stage, "dist"), { recursive: true });

await build({
  entryPoints: [resolve(root, "src/index.ts")],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  banner: { js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);" },
  // Emit as .mjs so Node always treats the bundle as ESM — a plain .js entry
  // with no package.json only runs on Node ≥20.17 (which auto-detects ESM);
  // older Node (e.g. Claude Desktop's bundled runtime) defaults to CommonJS
  // and fails with "Cannot use import statement outside a module".
  outfile: resolve(stage, "dist/index.mjs"),
});

cpSync(resolve(root, "spec"), resolve(stage, "spec"), { recursive: true });
cpSync(resolve(root, "manifest.json"), resolve(stage, "manifest.json"));

// Pack the staged folder into an .mcpb using the official MCPB CLI.
// The official packer produces the archive layout Claude Desktop expects
// (files at their paths, no bare directory entries) and validates the
// manifest — a hand-rolled `zip -r` adds `dist/`/`spec/` directory entries
// that Claude Desktop's loader rejects.
const mcpbPath = resolve(root, "rb209-mcp.mcpb");
rmSync(mcpbPath, { force: true });
execSync(`npx --yes @anthropic-ai/mcpb@2 pack "${stage}" "${mcpbPath}"`, {
  stdio: "inherit",
});
console.error("built rb209-mcp.mcpb");
