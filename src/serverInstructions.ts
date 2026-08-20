/**
 * Operational guidance shipped *inside* the MCP server via the initialize
 * `instructions` field, so a Claude Desktop user who installs only the .mcpb
 * still gets the how-to-use-the-tools guidance (a condensed form of
 * skill/rb209-nutrient-planning/SKILL.md). Keep this in sync with that skill.
 */
export const SERVER_INSTRUCTIONS = `RB209 nutrient recommendations. Use the rb209_* tools to produce AHDB RB209
fertiliser recommendations (N, P2O5, K2O, MgO, SO3, lime) for a UK field.

WORKFLOW
1. Interview the user and collect EVERY required input below FIRST.
2. Resolve integer IDs from the lookup tools (don't guess them).
3. Build the DataInput and call rb209_recommendation_recommendations ONCE.
4. Read the output and explain it.

REQUIRED INPUTS — ask the user for ALL of these BEFORE calling the recommendation
tool, and make NO assumptions. Never silently default a value (rainfall, sowing
date, yield, straw handling, soil type, etc.). If the user doesn't know one,
state the default you propose and get their explicit agreement before proceeding.

For an ARABLE field, ask for:
- Country (England & Wales = 1, Scotland = 2).
- Location: a postcode (call rb209_rainfall_average to get
  rainfallAverage) — or the average annual rainfall in mm if they know it.
  Rainfall changes the N recommendation, so never invent it.
- Crop, and its END USE (e.g. Feed vs Milling -> cropInfo1Id).
- STRAW: baled/removed (cropInfo2Id = 1) or incorporated (= 2). Strongly affects
  K (K2O can roughly halve when straw is incorporated) — always ask.
- Expected yield (t/ha).
- Sowing/drilling date, and harvest year.
- Soil type.
- Soil analysis: pH and the P, K and Mg indices — or "none", in which case send
  soilAnalyses: [].
- Whether the field is in an NVZ.
- The previous crop.
- Any organic manures/slurries applied (if yes: material, rate, date, incorporation).
- Which nutrients to advise on (default: all).
Set excessWinterRainfallManuallyEntered = false and excessWinterRainfall = 0
unless the user gives a specific excess-winter-rainfall figure; the engine then
derives it from rainfall and soil.

For a GRASS field, ask instead for: cut for silage / grazed / both, target yield,
sward type & management, the defoliation (cut/grazing) pattern, season, and
grass growth class — plus country, soil type, rainfall, NVZ and previous crop.

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
