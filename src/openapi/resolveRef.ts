import type { SwaggerDoc, JsonSchema } from "./types.js";

function refName(ref: string): string {
  return ref.replace("#/definitions/", "");
}

export function inlineSchema(
  doc: SwaggerDoc,
  schema: JsonSchema,
  seen: Set<string> = new Set(),
): JsonSchema {
  if (schema == null || typeof schema !== "object") return schema;

  if (typeof schema.$ref === "string") {
    const name = refName(schema.$ref);
    if (seen.has(name)) {
      return { type: "object", description: `circular ref: ${name}` };
    }
    const def = doc.definitions[name];
    if (!def) return { type: "object", description: `unknown ref: ${name}` };
    return inlineSchema(doc, def, new Set(seen).add(name));
  }

  const out: JsonSchema = {};
  for (const [key, value] of Object.entries(schema)) {
    if (key === "properties" && value && typeof value === "object") {
      out.properties = {};
      for (const [pk, pv] of Object.entries(value as JsonSchema)) {
        out.properties[pk] = inlineSchema(doc, pv as JsonSchema, seen);
      }
    } else if (key === "items" && value && typeof value === "object") {
      out.items = inlineSchema(doc, value as JsonSchema, seen);
    } else if (key === "additionalProperties" && value && typeof value === "object") {
      out.additionalProperties = inlineSchema(doc, value as JsonSchema, seen);
    } else {
      out[key] = value;
    }
  }
  return out;
}
