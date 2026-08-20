import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { loadSpec } from "./openapi/loadSpec.js";
import { buildToolDefs, type ToolDef } from "./openapi/toToolSchema.js";
import { buildRequest } from "./executor.js";
import { RateLimitError, type Rb209Client } from "./http/client.js";
import type { Rb209Config } from "./config.js";

export function createServer(
  config: Rb209Config,
  client: Pick<Rb209Client, "request">,
): { server: Server; toolCount: number } {
  const doc = loadSpec();
  let defs: ToolDef[] = buildToolDefs(doc);
  if (config.enabledGroups) {
    const groups = new Set(config.enabledGroups);
    defs = defs.filter((d) => groups.has(d.operation.tag));
  }
  const byName = new Map(defs.map((d) => [d.name, d]));

  const server = new Server(
    { name: "rb209-mcp", version: "0.2.2" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: defs.map((d) => ({
      name: d.name,
      description: d.description,
      inputSchema: d.inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const def = byName.get(req.params.name);
    if (!def) {
      return { isError: true, content: [{ type: "text", text: `Unknown tool: ${req.params.name}` }] };
    }
    try {
      const args = (req.params.arguments ?? {}) as Record<string, unknown>;
      const data = await client.request(buildRequest(def.operation, args));
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    } catch (e) {
      const msg = e instanceof RateLimitError
        ? e.message
        : `RB209 request failed: ${(e as Error).message}`;
      return { isError: true, content: [{ type: "text", text: msg }] };
    }
  });

  return { server, toolCount: defs.length };
}
