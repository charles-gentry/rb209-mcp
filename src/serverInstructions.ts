/**
 * Operational guidance shipped *inside* the MCP server via the initialize
 * `instructions` field, so a Claude Desktop user who installs only the .mcpb
 * still gets the how-to-use-the-tools guidance (a condensed form of
 * skill/rb209-nutrient-planning/SKILL.md). Keep this in sync with that skill.
 */
export const SERVER_INSTRUCTIONS = `RB209 nutrient recommendations. Use the rb209_* tools to produce AHDB RB209
fertiliser recommendations (N, P2O5, K2O, MgO, SO3, lime) for a UK field.

WORKFLOW
1. Interview the user for the field's real details — never invent a crop, yield,
   or soil type; ask short questions for anything missing.
2. Resolve integer IDs from the lookup tools (don't guess them).
3. Build the DataInput and call rb209_recommendation_recommendations ONCE.
4. Read the output and explain it.

INTERVIEW (arable): country (England&Wales=1, Scotland=2); crop; END USE
(Feed/Milling -> cropInfo1Id); STRAW baled/removed vs incorporated
(cropInfo2Id 1 vs 2) — this strongly affects K (K2O can roughly halve when straw
is incorporated), so ALWAYS ask; expected yield; sowing date + harvest year;
soil type; recent soil analysis (pH, P/K/Mg indices) or none; NVZ; previous crop;
any organic manures.

CRITICAL RULES (avoid wasted/failed calls)
- ONE recommendation call returns ALL nutrients. Set the nutrients booleans you
  want and call once. Do not repeat it, call it per-nutrient, or use the
  offtake / nutrient-target-index tools for a standard recommendation.
- fieldType is FIXED: 1 = Arable & Horticulture, 2 = Grassland, 3 = Both. Do not
  look it up (the field-types lookup only works for countryId 3).
- NO soil analysis -> send field.soil.soilAnalyses = [] and SKIP every soil
  methodology/index lookup (they return T04 "not found" for indexes you don't
  need). The engine applies default indices.
- For an ARABLE field the body must include field.grass = {} AND
  field.grassland = {} (both empty objects) alongside field.arable = [ ... ].
  Missing field.grass causes the misleading 422 "…calculating the crop order",
  NOT a "grass required" error. (This server auto-fills the empty sections, but
  include them so the request is explicit.)
- Resolve cropGroupId, cropTypeId, cropInfo1Id, cropInfo2Id, soilTypeId,
  materialId, incorporationMethodId, etc. from the lookup tools.

READING OUTPUT: calculations[] contains a Total row per nutrient
(breakdown=true, description="Total"). nutrientId: 0=N, 1=P2O5, 2=K2O, 3=MgO,
4=Na2O, 5=SO3, 6=Lime (lime in t/ha, others kg/ha). adviceNotes[] carries timing
and cautions. Summarise the Totals per nutrient plus the key advice notes.`;
