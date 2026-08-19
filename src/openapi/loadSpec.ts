import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { SwaggerDoc, Operation } from "./types.js";

const here = dirname(fileURLToPath(import.meta.url));
const DEFAULT_SPEC = resolve(here, "../../spec/swagger.json");

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
