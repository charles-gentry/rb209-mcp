import { createHash } from "node:crypto";
import type { SwaggerDoc, Operation, JsonSchema, SwaggerParam } from "./types.js";
import { inlineSchema } from "./resolveRef.js";

export interface ToolDef {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  operation: Operation;
}

export function toolName(op: Operation): string {
  const rest = op.path
    .replace(/^\/api\//, "")
    .split("/")
    .map((seg) => (seg.startsWith("{") ? "by_" + seg.slice(1, -1) : seg))
    .join("_");
  let name =
    ("rb209_" + rest)
      .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .toLowerCase();
  if (name.length > 64) {
    const hash = createHash("sha1").update(name).digest("hex").slice(0, 8);
    name = name.slice(0, 55) + "_" + hash;
  }
  return name;
}

function paramSchema(p: SwaggerParam): JsonSchema {
  const type = p.type ?? "string";
  const s: JsonSchema = { type };
  if (p.description) s.description = p.description;
  return s;
}

export function toToolDef(doc: SwaggerDoc, op: Operation): ToolDef {
  const properties: JsonSchema = {};
  const required: string[] = [];

  for (const p of op.parameters) {
    if (p.in === "path") {
      properties[p.name] = paramSchema(p);
      required.push(p.name);
    } else if (p.in === "query") {
      properties[p.name] = paramSchema(p);
    } else if (p.in === "body" && p.schema) {
      properties.body = inlineSchema(doc, p.schema);
      if (p.required) required.push("body");
    }
  }

  const inputSchema: JsonSchema = { type: "object", properties };
  if (required.length) inputSchema.required = required;

  const desc =
    `${op.method.toUpperCase()} ${op.path}` +
    (op.summary ? ` — ${op.summary}` : "");

  return { name: toolName(op), description: desc, inputSchema, operation: op };
}

export function buildToolDefs(doc: SwaggerDoc): ToolDef[] {
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
  const defs = ops.map((op) => toToolDef(doc, op));
  const counts = new Map<string, number>();
  for (const d of defs) {
    const n = counts.get(d.name) ?? 0;
    counts.set(d.name, n + 1);
    if (n > 0) d.name = `${d.name}_${n + 1}`;
  }
  return defs;
}
