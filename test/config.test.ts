import { describe, it, expect } from "vitest";
import { loadConfig } from "../src/config.js";

const base = { RB209_EMAIL: "a@b.com", RB209_PASSWORD: "pw" };

describe("loadConfig", () => {
  it("uses the v2 base URL by default", () => {
    expect(loadConfig(base).baseUrl).toBe("https://rb209api.ahdb.org.uk");
  });
  it("strips a trailing slash from an override", () => {
    expect(loadConfig({ ...base, RB209_BASE_URL: "https://x.test/" }).baseUrl).toBe("https://x.test");
  });
  it("parses enabled groups into a trimmed array", () => {
    expect(loadConfig({ ...base, RB209_ENABLED_GROUPS: "Soil, Recommendation" }).enabledGroups)
      .toEqual(["Soil", "Recommendation"]);
  });
  it("defaults enabled groups to null", () => {
    expect(loadConfig(base).enabledGroups).toBeNull();
  });
  it("throws a named error when password is missing", () => {
    expect(() => loadConfig({ RB209_EMAIL: "a@b.com" })).toThrow(/RB209_PASSWORD/);
  });
});
