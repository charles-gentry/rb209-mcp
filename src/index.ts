#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { AuthManager } from "./http/authManager.js";
import { Rb209Client } from "./http/client.js";
import { createServer } from "./server.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const auth = new AuthManager(config);
  const client = new Rb209Client(config.baseUrl, auth);
  const { server, toolCount } = createServer(config, client);
  console.error(`rb209-mcp: ${toolCount} tools ready`);
  await server.connect(new StdioServerTransport());
}

main().catch((err) => {
  console.error("rb209-mcp fatal:", err);
  process.exit(1);
});
