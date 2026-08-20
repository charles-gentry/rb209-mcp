import { describe, it, expect } from "vitest";
import { loadSpec, listOperations } from "../src/openapi/loadSpec.js";
import { buildRequest } from "../src/executor.js";
import type { Operation } from "../src/openapi/types.js";

const ops = listOperations(loadSpec());
const find = (path: string, method: "get" | "post" = "get"): Operation =>
  ops.find((o) => o.path === path && o.method === method)!;

describe("buildRequest", () => {
  it("substitutes path params", () => {
    const op = ops.find((o) => o.path.includes("{") && o.parameters.some((p) => p.in === "path"))!;
    const param = op.parameters.find((p) => p.in === "path")!;
    const req = buildRequest(op, { [param.name]: 7 });
    expect(req.path).toContain("7");
    expect(req.path).not.toContain("{");
  });

  it("passes the body through unchanged for a non-recommendation POST", () => {
    const op = find("/api/Recommendation/CalculateNutrientOfftake", "post");
    const body = { cropTypeId: 0, nutrientId: 1 };
    const req = buildRequest(op, { body });
    expect(req.method).toBe("post");
    expect(req.body).toBe(body);
  });

  it("fills the required empty crop sections for the recommendation POST", () => {
    const op = find("/api/Recommendation/Recommendations", "post");
    const body = { field: { fieldType: 1, arable: [{ cropOrder: 1 }] }, nutrients: { nitrogen: true } };
    const req = buildRequest(op, { body }) as any;
    expect(req.body.field.grass).toEqual({});
    expect(req.body.field.grassland).toEqual({});
    expect(req.body.field.organicMaterials).toEqual([]);
    expect(req.body.field.mannerOutputs).toEqual([]);
    expect(req.body.field.arable).toEqual([{ cropOrder: 1 }]);
  });

  it("adds only defined query params", () => {
    const op = ops.find((o) => o.parameters.some((p) => p.in === "query"))!;
    const qp = op.parameters.find((p) => p.in === "query")!;
    const pathArgs = Object.fromEntries(
      op.parameters.filter((p) => p.in === "path").map((p) => [p.name, 1]),
    );
    const req = buildRequest(op, { ...pathArgs, [qp.name]: "x" });
    expect(req.query?.get(qp.name)).toBe("x");
  });

  it("throws a named error when a required path param is missing", () => {
    const op = find("/api/Soil/NutrientIndexes/{methodologyId}");
    expect(() => buildRequest(op, {})).toThrow(/Missing required parameter "methodologyId"/);
  });

  it("never interpolates the literal 'undefined' into a path", () => {
    for (const op of ops.filter((o) => o.parameters.some((p) => p.in === "path"))) {
      expect(() => buildRequest(op, {})).toThrow(/Missing required parameter/);
    }
  });
});
