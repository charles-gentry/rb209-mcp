import { createHash } from "node:crypto";
import type { SwaggerDoc, Operation, JsonSchema, SwaggerParam } from "./types.js";
import { inlineSchema } from "./resolveRef.js";
import { listOperations } from "./loadSpec.js";
import { guidanceFor } from "../toolGuidance.js";

/**
 * Tags whose endpoints the server drives itself and must never expose as tools.
 * The RB209 spec files Login / Logout / Refresh_Token under "Users", but
 * AuthManager owns that token lifecycle: surfacing them would let a caller
 * invalidate the server's own session (Logout) or handle raw credentials
 * (Login) to no benefit.
 */
export const INTERNAL_TAGS = new Set(["Users"]);

export interface ToolDef {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  operation: Operation;
}

const MAX_NAME_LENGTH = 64;

function snake(s: string): string {
  return s
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .toLowerCase()
    .replace(/^_+|_+$/g, "");
}

function pathParamNames(op: Operation): string[] {
  return op.parameters.filter((p) => p.in === "path").map((p) => p.name);
}

/**
 * The base name: the operation's literal path segments only. Path params are
 * deliberately left out — they are already in `inputSchema`, and spelling them
 * all out is what used to overflow the 64-char limit and force names to be
 * truncated to an unreadable SHA suffix. Redundant segments collapse too, so
 * /api/OrganicMaterial/OrganicMaterialTypes reads as
 * rb209_organic_material_types rather than repeating the tag.
 */
export function toolName(op: Operation): string {
  const parts: string[] = [];
  for (const seg of op.path.replace(/^\/api\//, "").split("/")) {
    if (!seg || seg.startsWith("{")) continue;
    const token = snake(seg);
    const last = parts[parts.length - 1];
    if (last !== undefined && token.startsWith(last + "_")) parts[parts.length - 1] = token;
    else if (!parts.includes(token)) parts.push(token);
  }
  return "rb209_" + parts.join("_");
}

/**
 * Shortens a path-param name for use as a disambiguating suffix: `...Id` adds
 * nothing when every one of them is an ID, and leading words already present in
 * the base name are pure repetition (organicMaterialTypeId under
 * rb209_organic_material_incorporation_methods becomes just `type`).
 */
function suffixToken(param: string, base: string): string {
  let tokens = snake(param).split("_");
  if (tokens.length > 1 && tokens[tokens.length - 1] === "id") tokens = tokens.slice(0, -1);
  const baseTokens = new Set(base.split("_"));
  while (tokens.length > 1 && baseTokens.has(tokens[0])) tokens = tokens.slice(1);
  return tokens.join("_");
}

/**
 * Several RB209 endpoints differ only by extra path params (a plain lookup and
 * a country-scoped one, say). Those share a base name, so each variant is
 * distinguished by the params it does *not* share with its siblings — which
 * leaves the simplest variant holding the clean, unsuffixed name.
 */
function desiredNames(ops: Operation[]): string[] {
  const groups = new Map<string, Operation[]>();
  for (const op of ops) {
    const base = toolName(op);
    const group = groups.get(base);
    if (group) group.push(op);
    else groups.set(base, [op]);
  }

  return ops.map((op) => {
    const base = toolName(op);
    const siblings = groups.get(base)!;
    if (siblings.length === 1) return base;
    const shared = siblings
      .map(pathParamNames)
      .reduce((a, b) => a.filter((name) => b.includes(name)));
    const distinctive = pathParamNames(op).filter((name) => !shared.includes(name));
    if (!distinctive.length) return base;
    return base + "_by_" + distinctive.map((p) => suffixToken(p, base)).join("_");
  });
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
  const ops = listOperations(doc).filter((op) => !INTERNAL_TAGS.has(op.tag));
  const defs = ops.map((op) => toToolDef(doc, op));
  const names = desiredNames(ops);

  // Final uniqueness pass over *all* names at once: a disambiguated sibling can
  // still land on a name some unrelated operation derives naturally, so the
  // counter has to walk forward past whatever is already taken.
  const used = new Set<string>();
  defs.forEach((d, i) => {
    let name = names[i];
    if (name.length > MAX_NAME_LENGTH) {
      const hash = createHash("sha1").update(name).digest("hex").slice(0, 8);
      name = name.slice(0, MAX_NAME_LENGTH - 9) + "_" + hash;
    }
    if (used.has(name)) {
      const stem = name;
      let n = 2;
      while (used.has(name)) name = `${stem}_${n++}`;
    }
    used.add(name);
    d.name = name;
  });
  return defs;
}
