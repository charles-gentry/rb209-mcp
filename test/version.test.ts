import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { VERSION } from "../src/version.js";

const root = resolve(import.meta.dirname, "..");
const read = (f: string) => JSON.parse(readFileSync(resolve(root, f), "utf8"));

describe("version consistency", () => {
  it("package.json, manifest.json and src/version.ts agree", () => {
    // package.json is the source of truth; `npm run sync-version` stamps the
    // other two. This test is what stops a forgotten sync reaching a release.
    const pkg = read("package.json").version;
    expect(read("manifest.json").version).toBe(pkg);
    expect(VERSION).toBe(pkg);
  });

  it("the declared Node floor matches everywhere", () => {
    expect(read("package.json").engines.node).toBe(">=20");
    expect(read("manifest.json").compatibility.runtimes.node).toBe(">=20.0.0");
    const bundleScript = readFileSync(resolve(root, "scripts/build-bundle.ts"), "utf8");
    expect(bundleScript).toContain('target: "node20"');
  });
});
