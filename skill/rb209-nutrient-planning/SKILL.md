---
name: rb209-nutrient-planning
description: Use when the user wants an AHDB RB209 fertiliser / nutrient recommendation (N, P₂O₅, K₂O, MgO, Na₂O, SO₃, lime) for a UK field or crop via the rb209-mcp tools. Guides an interview to collect the field's real details, resolves the required lookup IDs, builds a valid recommendation request, and explains the result.
---

# RB209 Nutrient Planning

Produce a fertiliser recommendation for a UK field with the `rb209_*` MCP tools.
The one calculation tool is **`rb209_recommendation_recommendations`** (a POST
taking `{ body: <DataInput> }`). Everything else is lookups that give you the
integer IDs the `DataInput` needs.

## Golden rules — read first

1. **Interview the user before calling anything. Do not invent field details.**
   A recommendation depends on real facts about a real field (crop, soil,
   location, previous crop, manures, soil-test results). If you don't have one
   of these, **ask the user a short, specific question** — never guess a crop,
   a yield, or a soil type. See *Phase 1*.
2. **Resolve every ID from a lookup tool.** IDs like `cropTypeId`, `soilTypeId`,
   `swardTypeId` are API-specific integers. Look them up; never hard-code them
   from memory. Show the user the options when a choice is theirs to make.
3. **Copy the shape of a known-good request.** This repo has two real, accepted
   `DataInput`/response pairs — mirror the one matching your field type and only
   swap in the values you gathered:
   - **Arable:** `test/fixtures/RecommendationsSampleInput.json` (+ `…Sample.json`) — winter barley, England & Wales.
   - **Grass:** `test/fixtures/RecommendationsGrassInput.json` (+ `…GrassSample.json`) — first-cut silage plus grazing, England & Wales.
4. **If the API returns a validation error, read it — the field is named.**
   The error tells you exactly what to fix. See *Troubleshooting* for the
   common ones and their fixes.

## The process at a glance

```
Phase 1  Interview the user → what field, crop, soil, history, manures, nutrients?
Phase 2  Resolve IDs via lookup tools (country, soil type, crop, indices, etc.)
Phase 3  Assemble the DataInput (mirror the fixture; pick arable vs grass shape)
Phase 4  Call rb209_recommendation_recommendations, fix any validation errors
Phase 5  Read the DataOutput and explain the recommendation to the user
```

---

## Phase 1 — Interview the user

Ask for whatever you don't already have. Keep questions short and grouped; a
couple of quick messages is fine. Cover:

**The field & crop**
- Is this an **arable** crop, a **grass** field, or **grassland**?
- Which **country**: England & Wales, or Scotland? (affects available options)
- What **crop** is being grown? For arable also ask the **end use**
  (e.g. feed vs milling wheat; whether **straw is removed or incorporated**),
  the **expected yield** (t/ha), and the **sowing/drilling date** and
  **harvest year**.
- For **grass**: is it cut for silage, grazed, or both? What **target yield**
  (t DM/ha), and roughly what **grass growth class / season**?

**The soil**
- What **soil type** (e.g. medium/sandy loam, clay, sand, peat)?
- Is there a recent **soil analysis**? If so, capture **pH** and the
  **P, K and Mg indices** (and the analysis date). If not, say so — the engine
  falls back to default indices, but the advice is weaker.
- Is the field in an **NVZ** (Nitrogen Vulnerable Zone)?

**History & inputs**
- What was the **previous crop** (or previous grass)?
- Were any **organic manures / slurries / composts** applied? If yes: material,
  application **rate**, **date**, and whether it was **incorporated** (and how).
- Any **MANNER-NPK outputs** to feed in, or a **lab analysis** of the manure?

**What they want**
- Which **nutrients** do they want advice on? Default to all
  (N, P₂O₅, K₂O, MgO, Na₂O, SO₃, lime) unless they say otherwise.

If the user gives everything up front, great — skip straight to Phase 2. If
they're vague ("what should I put on my wheat?"), ask the essentials first
(crop, end use, expected yield, soil type, country, previous crop, soil
analysis?) before proceeding.

---

## Phase 2 — Resolve the lookup IDs

Call these as needed. List the returned options to the user when the choice is
theirs.

**Always**
- `rb209_field_countries` → `countryId` (England & Wales = 1, Scotland = 2, All = 3).
- `rb209_field_field_types_by_country_id` → `fieldType` (arable / grass / grassland).
- `rb209_soil_soil_types` → `soilTypeId` (note whether it's a K-releasing clay).

**Arable crop** (`fieldType` = arable)
- `rb209_arable_crop_groups` → `cropGroupId`.
- `rb209_arable_crop_types_by_crop_group_id` (pass the `cropGroupId`) → `cropTypeId`.
- `rb209_arable_crop_info1s_by_crop_type_id` (pass the `cropTypeId`) → `cropInfo1Id`
  (the crop's end use, e.g. Feed / Milling).
- `rb209_arable_crop_info2s` → `cropInfo2Id` (e.g. straw baled vs incorporated).

**Grass field** (`fieldType` = grass)
- `rb209_grass_sward_types` → `swardTypeId`.
- `rb209_grass_sward_managements_by_sward_type_id` → `swardManagementId`.
- `rb209_grass_defoliation_sequences_by_sward_type_id_by_s_…` → `defoliationSequenceId`
  (the cut/grazing pattern; needs swardType, swardManagement, number of cuts, new-sward flag).
- `rb209_grass_grass_growth_classes_by_country_id` → `grassGrowthClassId`
  (or derive it from soil/rainfall/altitude via the `grass_growth_class_by_soil_type_id…` tool).
- `rb209_grass_grass_seasons_by_country_id` → `seasonId`.

**Previous cropping**
- `rb209_previous_cropping_previous_grasses` → `previousGrassId`.
- Previous arable crop uses `previousCropGroupId` / `previousCropTypeId` — the
  same IDs as the arable crop-group/crop-type lookups above.

**Soil analysis → index conversion (optional)**
If the user gives a measured value rather than an index, or you need methodology
IDs, use the Soil tools (names may carry a short hash suffix — match by the API
path in the tool description):
- `rb209_soil_methodologies_by_nutrient_id_by_country_id` → methodology IDs per nutrient.
- `…/Soil/NutrientIndexIdFromValue/{nutrientId}/{methodologyId}/{nutrientValue}/{countryId}`
  → converts a measured value to an index ID.
- `rb209_soil_nvz_action_program_by_country_id` → `nvzActionProgrammeId`.

**Organic materials (optional)**
- `rb209_organic_material_organic_material_categories` → category.
- `rb209_organic_material_organic_material_types` → `materialId`.
- `rb209_organic_material_incorporation_methods` → `incorporationMethodId`.

**Nutrient IDs** (for reading output): `rb209_field_nutrients`, or use the map in Phase 5.

---

## Phase 3 — Assemble the `DataInput`

Mirror `test/fixtures/RecommendationsSampleInput.json`. The top level is:

```json
{ "field": { … }, "nutrients": { … }, "totals": false, "referenceValue": "…" }
```

`nutrients` is a set of booleans — set `true` for each nutrient you want:
`{ "nitrogen": true, "phosphate": true, "potash": true, "magnesium": true, "sodium": true, "sulphur": true, "lime": true }`.

### Rules that trip people up (verified against the live API)

- **`field.arable` is an ARRAY** of crop objects (one per `cropOrder`) — even
  for a single crop. `field.grass` and `field.grassland` are **objects**.
- **Include all three crop keys.** The current API build requires `grass`,
  `grassland`, *and* `arable` to be present. Populate the one that matches the
  field; pass **`[]`** for `arable` and **`{}`** for `grass`/`grassland` when
  unused. (The published worked examples predate this and omit `grassland` — if
  you copy them, add `"grassland": {}`.)
- **Don't populate the wrong crop section.** Putting data in `grass` on an
  arable field errors with "the Grass section can't be populated".
- **`field.soil.soilAnalyses[]`** uses named per-nutrient fields, **not**
  `nutrientId`/`index`: `soilAnalysisDate`, `soilPh`, `sulphurDeficient`,
  `pIndexId`, `pMethodologyId`, `kIndexId`, `kMethodologyId`, `mgIndexId`,
  `mgMethodologyId`, and optionally `snsIndexId` / `snsMethodologyId` /
  `snsCropOrder`. Every entry needs a `soilAnalysisDate`.
- **`field` also requires:** `fieldType`, `multipleCrops`, `harvestYear`,
  `rainfallAverage`, `excessWinterRainfall`, `excessWinterRainfallManuallyEntered`,
  `mannerManures`, `organicMaterials` (`[]` if none), `mannerOutputs` (`[]` if
  none), `previousCropping` (object with `previousCropTypeId` set), `countryId`.

### Arable field skeleton (verified — winter barley, England & Wales)

```json
{
  "field": {
    "fieldType": 1,
    "multipleCrops": false,
    "arable": [
      { "cropOrder": 1, "cropGroupId": 0, "cropTypeId": 1,
        "cropInfo1Id": 1, "cropInfo2Id": 1,
        "sowingDate": "2025-09-01T00:00:00", "expectedYield": 8.0 }
    ],
    "grass": {},
    "grassland": {},
    "soil": {
      "soilTypeId": 2,
      "nvzActionProgrammeId": 1,
      "soilAnalyses": [
        { "soilAnalysisDate": "2026-02-01T00:00:00", "soilPh": 6.5,
          "sulphurDeficient": false, "snsIndexId": null, "snsMethodologyId": null,
          "snsCropOrder": null, "pIndexId": 1, "pMethodologyId": 1,
          "kIndexId": 0, "kMethodologyId": 4, "mgIndexId": 2, "mgMethodologyId": 4 }
      ]
    },
    "harvestYear": 2026,
    "rainfallAverage": 650.0,
    "excessWinterRainfall": 0.0,
    "excessWinterRainfallManuallyEntered": false,
    "mannerManures": false,
    "organicMaterials": [],
    "mannerOutputs": [],
    "previousCropping": { "previousGrassId": 1, "previousCropGroupId": 0,
                          "previousCropTypeId": 0, "grassHistoryId": null },
    "countryId": 1
  },
  "nutrients": { "nitrogen": true, "phosphate": true, "potash": true,
                 "magnesium": true, "sodium": true, "sulphur": true, "lime": true },
  "totals": false,
  "referenceValue": "Winter Barley feed crop"
}
```

### Grass field skeleton (verified — first-cut silage + grazing, England & Wales)

Verified end-to-end against the live API; full payload at
`test/fixtures/RecommendationsGrassInput.json`. Set `fieldType` to the grass
type, `arable: []`, include `"grassland": {}`, and populate `grass`:

```json
"grass": {
  "cropOrder": 1, "swardTypeId": 1, "swardManagementId": 4,
  "defoliationSequenceId": 16, "grassGrowthClassId": 3, "yield": 11, "seasonId": 1
}
```

For grass, N comes back **per defoliation** (one "Total" row per cut/grazing in
`calculations[]`, keyed by `defoliationId`) — sum them for the season's total N
(the fixture's grazing example totals 250 kg N/ha across four defoliations).

### Organic materials (optional, verified) — add to `field.organicMaterials`; keep `mannerManures: false`

Verified end-to-end; full payload at `test/fixtures/RecommendationsOrganicInput.json`
(30 m³/ha of 6% cattle slurry on the arable base). Resolve `materialId` from
`rb209_organic_material_organic_material_types` and `incorporationMethodId` from
`rb209_organic_material_incorporation_methods`:

```json
{ "id": 1, "defoliationId": 1, "applicationDate": "2025-10-18T00:00:00",
  "applicationRate": 30.0, "incorporationMethodId": 5, "materialId": 18 }
```
The engine credits the manure against the crop's need: in the output each
affected nutrient's Total row gains a `manures` value (available nutrient) and a
`totalAvailable` object (`{total, available}`), and **`cropNeed = recommendation
− manures`**. In the verified example the slurry supplied 20 kg N, 18 kg P₂O₅,
68 kg K₂O available, dropping N cropNeed from 200 to 180.

For a **lab analysis** of the manure, add per-unit nutrient values to the same
entry to override the material defaults: `"nitrogen": 2.0, "phosphate": 1.1,
"potash": 3.4, "sulphur": 0.7, "magnesium": 0.6`.

### MANNER-NPK outputs (optional) — set `mannerManures: true`, add to `field.mannerOutputs`

```json
{ "id": "1", "defoliationId": "1", "totalN": 80, "availableN": 20,
  "totalP": 35, "availableP": 25, "totalK": 75, "availableK": 70,
  "totalM": 15, "totalS": 10, "availableS": 5 }
```

---

## Phase 4 — Call the engine

Call `rb209_recommendation_recommendations` with `{ "body": <the DataInput> }`.

If you get an **HTTP 400** validation error, it names the field — fix it and
retry (see *Troubleshooting*). An **HTTP 422** with an `error` string (e.g.
"occurred while calculating the crop order") means the inputs are structurally
valid but agronomically inconsistent — re-check the crop section, previous
cropping, and that only the matching crop sub-object is populated.

---

## Phase 5 — Read and explain the output

The response (`DataOutput`) has:
- **`calculations[]`** — a flat list. Each entry has `nutrientId`,
  `recommendation` (kg/ha; **t/ha for lime**), `cropNeed`, a `description`, and
  a `breakdown` flag. Rows with **`breakdown: true` and `description: "Total"`**
  are the bottom-line figure for that nutrient; the other rows show how it was
  built up (base recommendation, yield adjustment, manure credit, etc.). When
  manures/MANNER are supplied, `cropNeed = recommendation − applied`.
- **`adviceNotes[]`** — free-text agronomic guidance per nutrient (timing,
  splits, cautions). Surface the relevant ones — they're genuinely useful.
- **`referenceValue`**, **`versionNumber`**.

**`nutrientId` map:** `0` = Nitrogen, `1` = Phosphate (P₂O₅), `2` = Potash (K₂O),
`3` = Magnesium (MgO), `4` = Sodium (Na₂O), `5` = Sulphur (SO₃), `6` = Lime.

Summarise for the user as the **Total per nutrient** (e.g. "N 200, P₂O₅ 70,
K₂O 85 kg/ha, lime 0 t/ha"), then add the key advice notes (application timing,
splits, any "new soil analysis needed" flags).

---

## Troubleshooting — validation errors and their fixes

| Error message (HTTP 400 unless noted) | Fix |
|---|---|
| `The Grassland field is required` | Add `"grassland": {}` to `field`. |
| `$.field.arable … could not be converted to … List` | `field.arable` must be an **array**, e.g. `[ { … } ]`. |
| `$.field.grass … could not be converted to … Grass` | `field.grass` must be an **object** (`{}` if unused), not an array. |
| `the Grass section can't be populated` (arable field) | Don't put crop data in `grass` on an arable field — use `"grass": {}`. |
| `The ExcessWinterRainfallManuallyEntered field is required` | Add `"excessWinterRainfallManuallyEntered": false`. |
| `Please provide a date for soilAnalysisDate` | Every `soilAnalyses[]` entry needs `"soilAnalysisDate"`. |
| `Field:Arable[0]:CropInfo1Id … missing` (or CropInfo2Id) | Provide `cropInfo1Id` / `cropInfo2Id` on the arable crop (resolve via the CropInfo lookups). |
| `The PreviousCropTypeId value is missing` | Set `previousCropping.previousCropTypeId` (resolve via the crop-type lookup). |
| `The ReferenceValue input parameter is not valid` | Keep `referenceValue` plain text — special characters like `+`, `/`, `%` are rejected. Use e.g. `"Cattle slurry example"`. |
| **422** `Error … calculating the crop order` | Inputs valid but inconsistent — check the crop section matches `fieldType`, only the right sub-object is populated, and previous-cropping IDs are sensible. |
| **401** on the call | Auth expired; the server refreshes automatically — just retry once. |
| **429** rate-limit message | Wait the number of seconds stated, then retry. |

## Reference

- **Known-good request/response pairs** (the verified source of truth for the
  payload shape), all captured from live API 200 responses:
  - arable — `test/fixtures/RecommendationsSampleInput.json` / `RecommendationsSample.json`
  - grass — `test/fixtures/RecommendationsGrassInput.json` / `RecommendationsGrassSample.json`
  - organic materials — `test/fixtures/RecommendationsOrganicInput.json` / `RecommendationsOrganicSample.json`
- **AHDB worked examples** (Arable, Grass, Organic Materials, MANNER Outputs,
  Lab Analysis, Measurement): <https://rb209.ahdb.org.uk/Home/WorkedExamples>.
  When copying one, add `"grassland": {}` for the current API build.
- When a field name or nesting is unclear, trust the fixture over the OpenAPI
  schema description — the fixture is what the live API actually accepts.
