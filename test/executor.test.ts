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

  it("passes the body through for a POST", () => {
    const op = find("/api/Recommendation/Recommendations", "post");
    const body = { field: {}, nutrients: { nitrogen: true } };
    const req = buildRequest(op, { body });
    expect(req.method).toBe("post");
    expect(req.body).toBe(body);
  });

  it("adds only defined query params", () => {
    const op = ops.find((o) => o.parameters.some((p) => p.in === "query"))!;
    const qp = op.parameters.find((p) => p.in === "query")!;
    const req = buildRequest(op, { [qp.name]: "x" });
    expect(req.query?.get(qp.name)).toBe("x");
  });
});
