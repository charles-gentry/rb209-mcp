import { describe, it, expect } from "vitest";
import { loadSpec } from "../src/openapi/loadSpec.js";
import { inlineSchema } from "../src/openapi/resolveRef.js";

describe("inlineSchema", () => {
  const doc = loadSpec();

  it("resolves the DataInput body schema deeply with no residual $ref", () => {
    const ref = { $ref: "#/definitions/RB209Models.RB209WebApi.Recommendation.Requests.DataInput" };
    const s = inlineSchema(doc, ref);
    expect(s.type).toBe("object");
    // field -> soil -> soilTypeId is deeply nested and must be present
    const soil = s.properties.field.properties.soil;
    expect(soil.properties.soilTypeId.type).toBe("integer");
    // nutrients flags are booleans
    expect(s.properties.nutrients.properties.nitrogen.type).toBe("boolean");
    // no $ref anywhere in the serialized output
    expect(JSON.stringify(s)).not.toContain("$ref");
  });

  it("does not infinitely recurse on cyclic definitions", () => {
    // Should return without throwing even if a definition references itself.
    const ref = { $ref: "#/definitions/RB209Models.RB209WebApi.Recommendation.Requests.DataInput" };
    expect(() => inlineSchema(doc, ref)).not.toThrow();
  });
});
