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

  it("stubs a genuine circular definition instead of recursing forever", () => {
    const cyclicDoc = {
      swagger: "2.0",
      paths: {},
      definitions: {
        Node: {
          type: "object",
          properties: {
            value: { type: "string" },
            next: { $ref: "#/definitions/Node" },
          },
        },
      },
    } as unknown as import("../src/openapi/types.js").SwaggerDoc;

    const s = inlineSchema(cyclicDoc, { $ref: "#/definitions/Node" });
    expect(s.type).toBe("object");
    expect(s.properties.value.type).toBe("string");
    // the recursive `next` must be replaced by the circular-ref stub, not expanded
    expect(s.properties.next.description).toContain("circular ref: Node");
  });
});
