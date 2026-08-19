import { describe, it, expect } from "vitest";
import { loadSpec, listOperations } from "../src/openapi/loadSpec.js";

describe("loadSpec", () => {
  it("loads the vendored Swagger 2.0 doc", () => {
    const doc = loadSpec();
    expect(doc.swagger).toBe("2.0");
    expect(Object.keys(doc.definitions).length).toBeGreaterThan(100);
  });

  it("flattens exactly 97 operations", () => {
    const ops = listOperations(loadSpec());
    expect(ops.length).toBe(97);
    const post = ops.filter((o) => o.method === "post");
    expect(post.length).toBe(8);
    const rec = ops.find((o) => o.path === "/api/Recommendation/Recommendations");
    expect(rec?.method).toBe("post");
    expect(rec?.tag).toBe("Recommendation");
  });
});
