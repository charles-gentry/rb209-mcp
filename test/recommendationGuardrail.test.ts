import { describe, it, expect } from "vitest";
import {
  applyRecommendationDefaults,
  isRecommendationOp,
} from "../src/recommendationGuardrail.js";
import type { Operation } from "../src/openapi/types.js";

const recOp: Operation = {
  method: "post",
  path: "/api/Recommendation/Recommendations",
  tag: "Recommendation",
  summary: "",
  parameters: [{ name: "body", in: "body" }],
};

describe("isRecommendationOp", () => {
  it("matches the recommendations POST (case-insensitive)", () => {
    expect(isRecommendationOp(recOp)).toBe(true);
    expect(isRecommendationOp({ ...recOp, path: "/api/recommendation/recommendations" })).toBe(true);
  });
  it("does not match other ops", () => {
    expect(isRecommendationOp({ ...recOp, method: "get" })).toBe(false);
    expect(isRecommendationOp({ ...recOp, path: "/api/Soil/SoilTypes" })).toBe(false);
    expect(isRecommendationOp({ ...recOp, path: "/api/Recommendation/CalculateNutrientOfftake" })).toBe(false);
  });
});

describe("applyRecommendationDefaults", () => {
  it("fills absent grass, grassland, organicMaterials, mannerOutputs for an arable body", () => {
    const out = applyRecommendationDefaults({
      field: { fieldType: 1, arable: [{ cropOrder: 1 }] },
      nutrients: { nitrogen: true },
    }) as any;
    expect(out.field.grass).toEqual({});
    expect(out.field.grassland).toEqual({});
    expect(out.field.organicMaterials).toEqual([]);
    expect(out.field.mannerOutputs).toEqual([]);
    // untouched data preserved
    expect(out.field.arable).toEqual([{ cropOrder: 1 }]);
    expect(out.nutrients).toEqual({ nitrogen: true });
  });

  it("treats null the same as absent (the API rejects grassland:null)", () => {
    const out = applyRecommendationDefaults({ field: { grassland: null, grass: null } }) as any;
    expect(out.field.grass).toEqual({});
    expect(out.field.grassland).toEqual({});
  });

  it("never overwrites a populated crop section", () => {
    const grass = { swardTypeId: 1, yield: 11 };
    const oms = [{ materialId: 18 }];
    const out = applyRecommendationDefaults({
      field: { fieldType: 2, arable: [], grass, organicMaterials: oms },
    }) as any;
    expect(out.field.grass).toBe(grass);
    expect(out.field.organicMaterials).toBe(oms);
    expect(out.field.grassland).toEqual({}); // still filled because absent
  });

  it("does not mutate the input object", () => {
    const input = { field: { arable: [] } };
    const out = applyRecommendationDefaults(input) as any;
    expect(input.field).not.toHaveProperty("grass");
    expect(out.field.grass).toEqual({});
  });

  it("leaves non-object or field-less bodies untouched", () => {
    expect(applyRecommendationDefaults(null)).toBeNull();
    expect(applyRecommendationDefaults("x")).toBe("x");
    expect(applyRecommendationDefaults({ nutrients: {} })).toEqual({ nutrients: {} });
  });
});
