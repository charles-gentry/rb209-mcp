import { describe, it, expect } from "vitest";
import { loadConfig } from "../src/config.js";
import { AuthManager } from "../src/http/authManager.js";
import { Rb209Client } from "../src/http/client.js";

const hasCreds = !!(process.env.RB209_EMAIL && process.env.RB209_PASSWORD);

describe.runIf(hasCreds)("live RB209 API", () => {
  it("authenticates and fetches soil types", async () => {
    const config = loadConfig();
    const client = new Rb209Client(config.baseUrl, new AuthManager(config));
    const data = (await client.request({ method: "get", path: "/api/Soil/SoilTypes" })) as any[];
    expect(Array.isArray(data)).toBe(true);
    expect(data[0]).toHaveProperty("soilTypeId");
    expect(data[0]).toHaveProperty("soilType");
  }, 30000);
});
