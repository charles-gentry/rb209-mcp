import type { Operation } from "./openapi/types.js";

/**
 * Extra usage guidance appended to specific tools' descriptions. Tool
 * descriptions are the one channel the model is guaranteed to see (they travel
 * in tools/list), so the RB209 footguns that cost real users dozens of failed
 * calls are documented right on the tools that trigger them. Keep in sync with
 * skill/rb209-nutrient-planning/SKILL.md (the fuller doc).
 *
 * Keyed by lowercased operation path.
 */
export const TOOL_GUIDANCE: Record<string, string> = {
  "/api/recommendation/recommendations": [
    "Call this ONCE — it returns every nutrient you enable in `nutrients`",
    "(N, P2O5, K2O, MgO, SO3, lime); do not call it per-nutrient or repeat it.",
    "For an ARABLE field the body MUST include field.grass = {} AND",
    "field.grassland = {} (both empty objects) alongside field.arable = [ ... ];",
    "a missing field.grass causes the misleading 422 '…calculating the crop",
    "order', not a 'grass required' error (this server auto-fills them, but be",
    "explicit). No soil analysis? send field.soil.soilAnalyses = [] and skip the",
    "soil index/methodology lookups. cropInfo2Id (1 = straw baled/removed,",
    "2 = straw incorporated) strongly affects K — always ask the user. Resolve",
    "all IDs from the lookup tools.",
  ].join(" "),
  "/api/field/fieldtypes/{countryid}": [
    "You usually don't need this — fieldType is fixed: 1 = Arable & Horticulture,",
    "2 = Grassland, 3 = Both. It only returns data for countryId 3.",
  ].join(" "),
  "/api/soil/nutrientindexes/{methodologyid}": [
    "Returns T04 'No nutrient indexes found' for many nutrient/methodology combos.",
    "If the user has no soil analysis, skip it and send soilAnalyses: []; only",
    "convert a measured value via the NutrientIndexIdFromValue tool.",
  ].join(" "),
};

export function guidanceFor(op: Operation): string | undefined {
  return TOOL_GUIDANCE[op.path.toLowerCase()];
}
