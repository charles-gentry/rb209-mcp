import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { SERVER_INSTRUCTIONS } from "../src/serverInstructions.js";
import { TOOL_GUIDANCE } from "../src/toolGuidance.js";
import { loadSpec } from "../src/openapi/loadSpec.js";
import { buildToolDefs } from "../src/openapi/toToolSchema.js";

const root = resolve(import.meta.dirname, "..");
const skill = readFileSync(resolve(root, "skill/rb209-nutrient-planning/SKILL.md"), "utf8");
const toolGuidance = Object.values(TOOL_GUIDANCE).join("\n");

/**
 * The same RB209 rules are stated in three places — the skill (the full guide),
 * the MCP `instructions` brief, and the per-tool descriptions — because each
 * reaches a different audience and none can import from another. Both source
 * files say "keep in sync by hand"; these are the four rules whose loss
 * measurably degrades recommendations, so drift fails here instead of silently.
 */
const INVARIANTS: Array<{ rule: string; pattern: RegExp }> = [
  { rule: "arable requests must carry an empty field.grass", pattern: /grass/i },
  { rule: "call the recommendation endpoint exactly once", pattern: /\bonce\b/i },
  { rule: "no soil analysis means soilAnalyses: []", pattern: /soilAnalyses/ },
  { rule: "straw handling (cropInfo2Id) must be asked, not assumed", pattern: /cropInfo2Id/ },
];

const SOURCES: Array<[string, string]> = [
  ["SKILL.md", skill],
  ["serverInstructions.ts", SERVER_INSTRUCTIONS],
  ["toolGuidance.ts", toolGuidance],
];

describe("RB209 guidance stays in sync across its three homes", () => {
  for (const { rule, pattern } of INVARIANTS) {
    for (const [name, text] of SOURCES) {
      it(`${name} still states: ${rule}`, () => {
        expect(pattern.test(text)).toBe(true);
      });
    }
  }

  it("every guided tool path actually exists in the spec", () => {
    // A renamed or removed endpoint would leave guidance keyed to a dead path,
    // where it silently never reaches the model.
    const doc = JSON.parse(readFileSync(resolve(root, "spec/swagger.json"), "utf8"));
    const paths = new Set(Object.keys(doc.paths).map((p) => p.toLowerCase()));
    for (const guidedPath of Object.keys(TOOL_GUIDANCE)) {
      expect(paths.has(guidedPath), `${guidedPath} is not in swagger.json`).toBe(true);
    }
  });

  it("every rb209_* tool name cited in the guidance actually exists", () => {
    // The guidance names tools in prose; a rename that misses one leaves the
    // model chasing a tool that is not there. Prefix forms like
    // `rb209_soil_nutrient_index…` count as valid if any real tool starts
    // with them, since the guidance uses them as deliberate wildcards.
    const real = buildToolDefs(loadSpec()).map((d) => d.name);
    const isReal = (cited: string) =>
      real.includes(cited) || real.some((n) => n.startsWith(cited));

    for (const [name, text] of SOURCES) {
      for (const cited of new Set(text.match(/rb209_[a-z0-9_]+/g) ?? [])) {
        expect(isReal(cited), `${name} cites unknown tool ${cited}`).toBe(true);
      }
    }
  });

  it("no backticked tool-shaped name in the skill is stale", () => {
    // The rb209_* check above misses names written without the prefix, which is
    // how `grass_growth_class_by_soil_type_id…` survived a rename. Catch any
    // backticked snake_case token that starts with an RB209 tag, after
    // stripping a trailing ellipsis used as a "and the rest" marker.
    const real = buildToolDefs(loadSpec()).map((d) => d.name);
    const TAG_PREFIX =
      /^(rb209_)?(soil|grass|arable|field|organic_material|rainfall|recommendation|advice_note|previous_cropping|measurement|fertiliser_prices)_/;

    // Fenced code blocks must go first: their ``` runs corrupt inline-backtick
    // pairing for the rest of the file, which silently reduces this scan to
    // nothing. Their JSON payloads are not tool names anyway.
    const prose = skill.replace(/```[\s\S]*?```/g, "");
    const cited = (prose.match(/`[^`\n]+`/g) ?? [])
      .map((t) => t.slice(1, -1).replace(/(\u2026|\.\.\.|\*)+$/, "").replace(/_$/, ""))
      .filter((t) => /^[a-z][a-z0-9_]*$/.test(t) && t.includes("_") && TAG_PREFIX.test(t));

    for (const name of new Set(cited)) {
      const ok = [name, `rb209_${name}`].some(
        (c) => real.includes(c) || real.some((n) => n.startsWith(c)),
      );
      expect(ok, `SKILL.md cites unknown tool \`${name}\``).toBe(true);
    }
  });
});
