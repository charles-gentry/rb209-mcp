import { describe, it, expect } from "vitest";
import { loadSpec, listOperations } from "../src/openapi/loadSpec.js";
import { toolName, toToolDef, buildToolDefs } from "../src/openapi/toToolSchema.js";
import type { Operation, SwaggerDoc } from "../src/openapi/types.js";

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

  it("always requires `body` on operations with a body param, regardless of the spec's required flag", () => {
    const def = toToolDef(doc, find("/api/Recommendation/Recommendations", "post"));
    expect(def.inputSchema.required).toContain("body");
  });

  it("does not require query params", () => {
    const op = ops.find((o) => o.parameters.some((p) => p.in === "query"))!;
    const queryParam = op.parameters.find((p) => p.in === "query")!;
    const def = toToolDef(doc, op);
    expect(def.inputSchema.required ?? []).not.toContain(queryParam.name);
  });
});

describe("buildToolDefs", () => {
  it("produces 97 tools with unique names", () => {
    const defs = buildToolDefs(doc);
    expect(defs.length).toBe(97);
    expect(new Set(defs.map((d) => d.name)).size).toBe(97);
  });

  it("guarantees unique names even when a naive `_2` suffix would already collide", () => {
    // op A ("/api/Foo/Bar") derives base name "rb209_foo_bar".
    // op B ("/api/Foo/Bar_2") *naturally* derives "rb209_foo_bar_2" —
    // no collision involved, it just happens to look like a suffixed name.
    // op C ("/api/Foo/bar") also derives "rb209_foo_bar", colliding with A.
    //
    // A naive counter-based dedupe (bump-on-collision using a running
    // count keyed by original name) would resolve C's collision by
    // appending "_2", producing a duplicate of B's already-existing
    // "rb209_foo_bar_2". The used-set approach must detect that "_2" is
    // taken and walk forward to "_3".
    const syntheticDoc: SwaggerDoc = {
      swagger: "2.0",
      paths: {
        "/api/Foo/Bar": {
          get: { tags: ["Foo"], summary: "first", parameters: [] },
        },
        "/api/Foo/Bar_2": {
          get: { tags: ["Foo"], summary: "second", parameters: [] },
        },
        "/api/Foo/bar": {
          get: { tags: ["Foo"], summary: "third", parameters: [] },
        },
      },
      definitions: {},
    };
    const defs = buildToolDefs(syntheticDoc);
    const names = defs.map((d) => d.name);
    expect(names).toContain("rb209_foo_bar");
    expect(names).toContain("rb209_foo_bar_2");
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("tool description guidance", () => {
  it("enriches the recommendation tool description with the must-know rules", () => {
    const defs = buildToolDefs(doc);
    const rec = defs.find((d) => d.name === "rb209_recommendation_recommendations")!;
    expect(rec.description).toContain("grass");
    expect(rec.description).toContain("soilAnalyses");
    expect(rec.description.toLowerCase()).toContain("once");
  });

  it("leaves ordinary tools' descriptions unguided", () => {
    const defs = buildToolDefs(doc);
    const soil = defs.find((d) => d.name === "rb209_soil_soil_types")!;
    expect(soil.description).not.toContain("soilAnalyses");
  });
});
