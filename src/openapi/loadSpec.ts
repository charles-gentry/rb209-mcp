import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { SwaggerDoc, Operation } from "./types.js";

const here = dirname(fileURLToPath(import.meta.url));
// Bundled builds (see scripts/build-bundle.ts) inline this module into a
// single dist/index.js, which shifts import.meta.url by one directory level
// and breaks the relative "../../spec" resolution below. RB209_SPEC_PATH lets
// the bundle (and any other packaging) tell loadSpec exactly where the
// vendored spec landed, without relying on fragile relative-path math.
const DEFAULT_SPEC = process.env.RB209_SPEC_PATH ?? resolve(here, "../../spec/swagger.json");

export function loadSpec(specPath: string = DEFAULT_SPEC): SwaggerDoc {
  const raw = readFileSync(specPath, "utf8");
  return JSON.parse(raw) as SwaggerDoc;
}

export function listOperations(doc: SwaggerDoc): Operation[] {
  const ops: Operation[] = [];
  for (const [path, methods] of Object.entries(doc.paths)) {
    for (const [method, op] of Object.entries(methods)) {
      if (method !== "get" && method !== "post") continue;
      ops.push({
        method,
        path,
        tag: op.tags?.[0] ?? "Default",
        summary: op.summary ?? "",
        parameters: op.parameters ?? [],
      });
    }
  }
  return ops;
}
