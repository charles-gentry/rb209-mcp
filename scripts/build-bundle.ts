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
  outfile: resolve(stage, "dist/index.js"),
});

cpSync(resolve(root, "spec"), resolve(stage, "spec"), { recursive: true });
cpSync(resolve(root, "manifest.json"), resolve(stage, "manifest.json"));

// Zip the staged folder into an .mcpb (a zip archive by spec).
const mcpbPath = resolve(root, "rb209-mcp.mcpb");
rmSync(mcpbPath, { force: true });
execSync(`cd "${stage}" && zip -r "${mcpbPath}" .`, { stdio: "inherit" });
console.error("built rb209-mcp.mcpb");
