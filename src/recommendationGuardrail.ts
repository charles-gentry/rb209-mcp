import type { Operation } from "./openapi/types.js";

/**
 * The RB209 recommendation endpoint has a footgun: its request-validation layer
 * only reports a missing `field.grassland`, but the calculation layer *also*
 * silently requires `field.grass` (and `organicMaterials` / `mannerOutputs`).
 * When those are absent it fails at runtime with the misleading
 * `422 "Error: occurred while calculating the crop order"` rather than naming
 * the missing field — which sends callers chasing crop dates and yields.
 *
 * This guardrail fills only the *incidental* required-but-empty container
 * sections when they are absent or null. It never overwrites data the caller
 * supplied, and an empty section contributes nothing to a recommendation, so it
 * cannot change any result — it only removes the footgun.
 */

export function isRecommendationOp(op: Operation): boolean {
  return (
    op.method === "post" &&
    op.path.toLowerCase() === "/api/recommendation/recommendations"
  );
}

export function applyRecommendationDefaults(body: unknown): unknown {
  if (body === null || typeof body !== "object") return body;
  const b = body as Record<string, unknown>;
  const field = b.field;
  if (field === null || typeof field !== "object") return body;

  const f = { ...(field as Record<string, unknown>) };
  const emptyObject = (v: unknown) => v === undefined || v === null;

  if (emptyObject(f.grass)) f.grass = {};
  if (emptyObject(f.grassland)) f.grassland = {};
  if (f.organicMaterials === undefined || f.organicMaterials === null) {
    f.organicMaterials = [];
  }
  if (f.mannerOutputs === undefined || f.mannerOutputs === null) {
    f.mannerOutputs = [];
  }

  return { ...b, field: f };
}
