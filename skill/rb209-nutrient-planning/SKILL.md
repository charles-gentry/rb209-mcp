---
name: rb209-nutrient-planning
description: Use when producing AHDB RB209 nutrient (N/P/K/Mg/S/lime) recommendations for a UK field via the rb209-mcp tools — guides gathering soil, crop, and organic-material inputs and calling the recommendation engine.
---

# RB209 Nutrient Planning

Produce a nutrient recommendation for a field using the `rb209_*` MCP tools.
The recommendation engine (`rb209_recommendation_recommendations`) needs a
`DataInput` object; most of the work is gathering the right IDs to fill it.

**Before assembling the request, read `test/fixtures/RecommendationsSampleInput.json`
in this repo — it is a known-good `DataInput` payload. Copy its shape and only
swap the field/crop/soil values for the values you resolved from the lookup
tools.** A matching example response is at `test/fixtures/RecommendationsSample.json`.

## Workflow

1. **Country & nutrients.** Call `rb209_field_countries` to resolve
   `countryId`. Call `rb209_field_nutrients` if you need the canonical
   nutrient ID/name list (nutrient IDs also appear in the recommendation
   output — see below).
2. **Soil.** Call `rb209_soil_soil_types` to resolve `soilTypeId`.
3. **Crop.** Call `rb209_arable_crop_groups` → pick `cropGroupId`; then
   `rb209_arable_crop_types_by_crop_group_id` (or `rb209_arable_crop_types`)
   → pick `cropTypeId`; then `rb209_arable_crop_info1s_by_crop_type_id` →
   pick `cropInfo1Id`; then `rb209_arable_crop_info2s` → pick `cropInfo2Id`.
   These four IDs plus `cropOrder`, `sowingDate`, and `expectedYield` form one
   entry in the `field.arable` array (see structure below).
4. **Organic materials (optional).** If manures/composts were applied, use
   `rb209_organic_material_organic_material_categories` and
   `rb209_organic_material_organic_material_types` to resolve a material, and
   `rb209_organic_material_incorporation_methods` for the incorporation
   method. Add entries to `field.organicMaterials`.
5. **Previous cropping (optional).** Use
   `rb209_previous_cropping_previous_grasses` (and related previous-cropping
   lookups) to resolve `field.previousCropping.previousGrassId` /
   `previousCropGroupId` / `previousCropTypeId`.
6. **Assemble the `DataInput` body.** See the exact structure below, and
   mirror `test/fixtures/RecommendationsSampleInput.json`.
7. **Calculate.** Call `rb209_recommendation_recommendations` with
   `{ body: <DataInput> }`.
8. **Read the output.** The response (`DataOutput`) has a flat
   `calculations[]` array — each entry has `nutrientId`, `recommendation`
   (kg/ha, or t/ha for lime), `description`, and a `breakdown: true` "Total"
   row per nutrient with `cropNeed`. It also has `adviceNotes[]` (free-text
   guidance per nutrient), `referenceValue`, and `versionNumber`. Summarise
   the Total row per nutrient (N, P₂O₅, K₂O, MgO, Na₂O, SO₃, lime) and surface
   any relevant advice notes.

   `nutrientId` mapping in `calculations[]`: `0` = Nitrogen, `1` = Phosphate
   (P₂O₅), `2` = Potash (K₂O), `3` = Magnesium (MgO), `4` = Sodium (Na₂O),
   `5` = Sulphur (SO₃), `6` = Lime.

## `DataInput` structure — the facts that matter

The brief/spec description of this shape is easy to get wrong. These are
verified against a real request/response pair:

- `field.arable` is an **array** of crop objects, one per `cropOrder`, each
  shaped like:
  ```json
  {
    "cropOrder": 1,
    "cropGroupId": 0,
    "cropTypeId": 1,
    "cropInfo1Id": 1,
    "cropInfo2Id": 1,
    "sowingDate": "2025-09-01T00:00:00",
    "expectedYield": 8.0
  }
  ```
- `field.grassland` and `field.grass` **must both be present** even for a
  purely arable field — pass empty objects (`{}`) when not used. Omitting
  either causes a validation error, and populating `grass` on an arable field
  also causes an error.
- `field.soil.soilAnalyses[]` entries use: `soilAnalysisDate`, `soilPh`,
  `sulphurDeficient`, `pIndexId`, `pMethodologyId`, `kIndexId`,
  `kMethodologyId`, `mgIndexId`, `mgMethodologyId`, and optionally
  `snsIndexId` / `snsMethodologyId` / `snsCropOrder`. There is **no**
  `nutrientId`/`index` pair here — each nutrient has its own named index +
  methodology fields.
- `field` also requires: `fieldType`, `multipleCrops`, `harvestYear`,
  `rainfallAverage`, `excessWinterRainfall`,
  `excessWinterRainfallManuallyEntered`, `mannerManures`, `organicMaterials`
  (array, `[]` if none), `mannerOutputs` (array, `[]` if none),
  `previousCropping` (object), and `countryId`.
- Top level: `{ field, nutrients, totals, referenceValue }`, where
  `nutrients` is a set of booleans: `nitrogen`, `phosphate`, `potash`,
  `magnesium`, `sodium`, `sulphur`, `lime` — set `true` for each nutrient you
  want recommendations for.

## Tips

- IDs are API-specific integers — always resolve them from the lookup tools,
  do not guess.
- Only populate the crop sub-object that matches the field's data
  (`field.arable` for an arable field), but still include `grassland: {}` and
  `grass: {}` as empty objects per the rule above.
- If a call returns a rate-limit message, wait the stated seconds and retry.
- Soil analysis values (P/K/Mg indices) go in `field.soil.soilAnalyses`;
  without them the engine falls back to index defaults.
- When in doubt about a field name or nesting, re-check
  `test/fixtures/RecommendationsSampleInput.json` rather than guessing from
  the OpenAPI schema description alone — the fixture is the verified source
  of truth for what the live API actually accepts.
