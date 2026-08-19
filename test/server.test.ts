import { describe, it, expect } from "vitest";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { loadSpec } from "../src/openapi/loadSpec.js";
import { createServer } from "../src/server.js";
import type { Rb209Config } from "../src/config.js";

const cfg: Rb209Config = {
  baseUrl: "https://api.test",
  email: "a@b.com",
  password: "pw",
  enabledGroups: null,
};

// Access the registered handlers via the server's request handler map.
// The SDK wraps each registered handler so that, on invocation, it re-validates
// the *entire* incoming request (including the `method` literal) against the
// request schema before dispatching to the app-supplied callback. Tests only
// care about `params`, so inject the expected `method` value here rather than
// requiring every call site to repeat it.
function handlerFor(server: any, schema: any) {
  const method = schema.shape.method.value;
  const raw = server["_requestHandlers"].get(method);
  return (request: any, extra: any) => raw({ method, ...request }, extra);
}

describe("createServer", () => {
  it("lists all 97 tools", async () => {
    const stub = { request: async () => ({}) };
    const { server } = createServer(cfg, stub);
    const res = await handlerFor(server, ListToolsRequestSchema)({ params: {} }, {});
    expect(res.tools.length).toBe(97);
    expect(res.tools[0].inputSchema.type).toBe("object");
  });

  it("filters tools by enabled group", async () => {
    const stub = { request: async () => ({}) };
    const { server } = createServer({ ...cfg, enabledGroups: ["Soil"] }, stub);
    const res = await handlerFor(server, ListToolsRequestSchema)({ params: {} }, {});
    expect(res.tools.length).toBeGreaterThan(0);
    expect(res.tools.every((t: any) => t.name.startsWith("rb209_soil"))).toBe(true);
  });

  it("routes a tool call through the client and returns JSON text", async () => {
    const calls: any[] = [];
    const stub = { request: async (req: any) => { calls.push(req); return [{ soilTypeId: 0 }]; } };
    const { server } = createServer(cfg, stub);
    const res = await handlerFor(server, CallToolRequestSchema)(
      { params: { name: "rb209_soil_soil_types", arguments: {} } }, {});
    expect(calls[0].path).toBe("/api/Soil/SoilTypes");
    expect(JSON.parse(res.content[0].text)).toEqual([{ soilTypeId: 0 }]);
  });

  it("returns an error content block for an unknown tool", async () => {
    const stub = { request: async () => ({}) };
    const { server } = createServer(cfg, stub);
    const res = await handlerFor(server, CallToolRequestSchema)(
      { params: { name: "rb209_nope", arguments: {} } }, {});
    expect(res.isError).toBe(true);
  });
});
