# rb209-mcp

MCP server exposing the AHDB **RB209 (Nutrient Management Guide) Web API v2** —
all 97 endpoints as tools — plus a nutrient-planning skill.

## Requirements

You need your own AHDB RB209 Web API licence (register at
<https://rb209.ahdb.org.uk/Home/RequestAccess>). Each user supplies their own
credentials; they never leave your machine.

## Install (non-technical — Claude Desktop)

1. Download `rb209-mcp.mcpb` from the latest [Release](../../releases).
2. Double-click it; Claude Desktop opens the installer.
3. Enter your RB209 **email** and **password** in the settings form.
4. Done — the RB209 tools appear in your chat tool.

## Install (developers)

```bash
npm install && npm run build
RB209_EMAIL=you@example.com RB209_PASSWORD=secret node dist/index.js
```

Add to an MCP client config with `command: node`, `args: [".../dist/index.js"]`,
and `env: { RB209_EMAIL, RB209_PASSWORD }`.

## Configuration

| Env var | Required | Default | Purpose |
|---------|----------|---------|---------|
| `RB209_EMAIL` | yes | — | Your RB209 licence email |
| `RB209_PASSWORD` | yes | — | Your RB209 licence password |
| `RB209_BASE_URL` | no | `https://rb209api.ahdb.org.uk` | API base URL |
| `RB209_ENABLED_GROUPS` | no | all | Comma-separated tags to expose (e.g. `Recommendation,Soil`) |
| `RB209_SPEC_PATH` | no | vendored spec | Only set when running a manually-extracted bundle standalone (the .mcpb manifest wires it automatically) |

## Development

```bash
npm test          # unit tests (msw-mocked)
npm run test:watch
RB209_EMAIL=... RB209_PASSWORD=... npm test   # also runs the live integration test
```

Licensed API content © AHDB under the Open Government Licence v3.0.
