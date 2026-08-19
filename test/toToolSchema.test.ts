import { describe, it, expect } from "vitest";
import { loadSpec, listOperations } from "../src/openapi/loadSpec.js";
import { toolName, toToolDef, buildToolDefs } from "../src/openapi/toToolSchema.js";
import type { Operation } from "../src/openapi/types.js";

const doc = loadSpec();
const ops = listOperations(doc);
const find = (path: string, method: "get" | "post" = "get"): Operation =>
  ops.find((o) => o.path === path && o.method === method)!;

describe("toolName", () => {
  it("derives a snake_case name for a simple GET", () => {
    expect(toolName(find("/api/Soil/SoilTypes"))).toBe("rb209_soil_soil_types");
  });
  it("encodes path params with by_", () => {
    const op = ops.find((o) => o.path.includes("{") && o.tag === "Arable")!;
    expect(toolName(op)).toMatch(/^rb209_arable_.*by_/);
  });
  it("keeps names within 64 chars and valid", () => {
    for (const o of ops) expect(toolName(o)).toMatch(/^[a-zA-Z0-9_-]{1,64}$/);
  });
});

describe("toToolDef", () => {
  it("puts path params as required top-level properties", () => {
    const op = ops.find((o) => o.parameters.some((p) => p.in === "path"))!;
    const def = toToolDef(doc, op);
    const pathParam = op.parameters.find((p) => p.in === "path")!;
    expect(def.inputSchema.type).toBe("object");
    expect(def.inputSchema.properties[pathParam.name]).toBeDefined();
    expect(def.inputSchema.required).toContain(pathParam.name);
  });

  it("inlines the recommendation body under a `body` property", () => {
    const def = toToolDef(doc, find("/api/Recommendation/Recommendations", "post"));
    const body = def.inputSchema.properties.body;
    expect(body.type).toBe("object");
    expect(body.properties.field.properties.soil.properties.soilTypeId.type).toBe("integer");
    expect(JSON.stringify(def.inputSchema)).not.toContain("$ref");
  });
});

describe("buildToolDefs", () => {
  it("produces 97 tools with unique names", () => {
    const defs = buildToolDefs(doc);
    expect(defs.length).toBe(97);
    expect(new Set(defs.map((d) => d.name)).size).toBe(97);
  });
});
