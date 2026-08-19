import { describe, it, expect, afterEach, vi } from "vitest";
import { resolve } from "node:path";
import { loadSpec, listOperations } from "../src/openapi/loadSpec.js";

describe("loadSpec", () => {
  it("loads the vendored Swagger 2.0 doc", () => {
    const doc = loadSpec();
    expect(doc.swagger).toBe("2.0");
    expect(Object.keys(doc.definitions).length).toBeGreaterThan(100);
  });

  it("loads an explicit path to spec/swagger.json", () => {
    const explicitPath = resolve(import.meta.dirname, "../spec/swagger.json");
    const doc = loadSpec(explicitPath);
    expect(doc.swagger).toBe("2.0");
  });

  describe("RB209_SPEC_PATH env override", () => {
    afterEach(() => {
      delete process.env.RB209_SPEC_PATH;
    });

    it("honors RB209_SPEC_PATH when no explicit path arg is given", async () => {
      // Point at a distinct fixture (not the vendored spec) so the assertion
      // can only pass if the env var — not the built-in default — was used.
      process.env.RB209_SPEC_PATH = resolve(import.meta.dirname, "fixtures/env-override-spec.json");
      // Re-import fresh so the module re-reads process.env at load time.
      vi.resetModules();
      const mod = await import("../src/openapi/loadSpec.js");
      const doc = mod.loadSpec();
      expect(doc.swagger).toBe("2.0-env-override-marker");
    });
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
