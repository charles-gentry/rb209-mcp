import { createHash } from "node:crypto";
import type { SwaggerDoc, Operation, JsonSchema, SwaggerParam } from "./types.js";
import { inlineSchema } from "./resolveRef.js";
import { listOperations } from "./loadSpec.js";
import { guidanceFor } from "../toolGuidance.js";

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
      required.push("body");
    }
  }

  const inputSchema: JsonSchema = { type: "object", properties };
  if (required.length) inputSchema.required = required;

  const guidance = guidanceFor(op);
  const desc =
    `${op.method.toUpperCase()} ${op.path}` +
    (op.summary ? ` — ${op.summary}` : "") +
    (guidance ? ` — ${guidance}` : "");

  return { name: toolName(op), description: desc, inputSchema, operation: op };
}

export function buildToolDefs(doc: SwaggerDoc): ToolDef[] {
  const ops = listOperations(doc);
  const defs = ops.map((op) => toToolDef(doc, op));
  const used = new Set<string>();
  for (const d of defs) {
    let name = d.name;
    let n = 2;
    while (used.has(name)) name = `${d.name}_${n++}`;
    used.add(name);
    d.name = name;
  }
  return defs;
}
