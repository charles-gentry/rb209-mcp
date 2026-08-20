import { describe, it, expect } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server.js";
import { RateLimitError } from "../src/http/client.js";
import { TimeoutError } from "../src/http/fetchWithTimeout.js";
import type { Rb209Config } from "../src/config.js";

const cfg: Rb209Config = {
  baseUrl: "https://api.test",
  email: "a@b.com",
  password: "pw",
  enabledGroups: null,
};

async function connect(config: Rb209Config, httpStub: { request: (req: any) => Promise<unknown> }) {
  const { server } = createServer(config, httpStub as any);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "0.0.0" }, { capabilities: {} });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

describe("createServer", () => {
  it("exposes the server instructions over the protocol", async () => {
    const client = await connect(cfg, { request: async () => ({}) });
    const instructions = client.getInstructions() ?? "";
    expect(instructions).toContain("RB209 nutrient recommendations");
    expect(instructions).toContain("soilAnalyses");
    expect(instructions).toContain("REQUIRED INPUTS");
    expect(instructions.toLowerCase()).toContain("rainfall");
  });

  it("lists all 94 non-internal tools", async () => {
    const client = await connect(cfg, { request: async () => ({}) });
    const { tools } = await client.listTools();
    expect(tools.length).toBe(94);
    expect(tools[0].inputSchema.type).toBe("object");
  });

  it("does not expose the Users auth endpoints as tools", async () => {
    const client = await connect(cfg, { request: async () => ({}) });
    const { tools } = await client.listTools();
    expect(tools.some((t) => t.name.startsWith("rb209_users"))).toBe(false);
  });

  it("refuses to call a Users endpoint even by name", async () => {
    const client = await connect(cfg, { request: async () => ({}) });
    const res = await client.callTool({ name: "rb209_users_logout", arguments: {} });
    expect(res.isError).toBe(true);
    expect((res.content as any)[0].text).toContain("Unknown tool");
  });

  it("returns compact JSON, not pretty-printed", async () => {
    const client = await connect(cfg, { request: async () => [{ soilTypeId: 0, soilType: "Sandy" }] });
    const res = await client.callTool({ name: "rb209_soil_types", arguments: {} });
    expect((res.content as any)[0].text).toBe('[{"soilTypeId":0,"soilType":"Sandy"}]');
  });

  it("filters tools by enabled group", async () => {
    const client = await connect({ ...cfg, enabledGroups: ["Soil"] }, { request: async () => ({}) });
    const { tools } = await client.listTools();
    expect(tools.length).toBeGreaterThan(0);
    expect(tools.every((t) => t.name.startsWith("rb209_soil"))).toBe(true);
  });

  it("routes a tool call through the client and returns JSON text", async () => {
    const calls: any[] = [];
    const client = await connect(cfg, { request: async (req) => { calls.push(req); return [{ soilTypeId: 0 }]; } });
    const res = await client.callTool({ name: "rb209_soil_types", arguments: {} });
    expect(calls[0].path).toBe("/api/Soil/SoilTypes");
    expect(JSON.parse((res.content as any)[0].text)).toEqual([{ soilTypeId: 0 }]);
  });

  it("returns an error content block for an unknown tool", async () => {
    const client = await connect(cfg, { request: async () => ({}) });
    const res = await client.callTool({ name: "rb209_nope", arguments: {} });
    expect(res.isError).toBe(true);
  });

  it("surfaces a RateLimitError as readable isError text", async () => {
    const client = await connect(cfg, { request: async () => { throw new RateLimitError("RB209 rate limit reached; retry after 42s", 42); } });
    const res = await client.callTool({ name: "rb209_soil_types", arguments: {} });
    expect(res.isError).toBe(true);
    expect((res.content as any)[0].text).toContain("rate limit");
  });

  it("surfaces a TimeoutError with its own message, not the generic wrapper", async () => {
    const client = await connect(cfg, { request: async () => { throw new TimeoutError("RB209 /api/Soil/SoilTypes timed out after 30s"); } });
    const res = await client.callTool({ name: "rb209_soil_types", arguments: {} });
    expect(res.isError).toBe(true);
    expect((res.content as any)[0].text).toBe("RB209 /api/Soil/SoilTypes timed out after 30s");
  });

  it("surfaces a generic request failure as isError text", async () => {
    const client = await connect(cfg, { request: async () => { throw new Error("boom"); } });
    const res = await client.callTool({ name: "rb209_soil_types", arguments: {} });
    expect(res.isError).toBe(true);
    expect((res.content as any)[0].text).toContain("boom");
  });
});
