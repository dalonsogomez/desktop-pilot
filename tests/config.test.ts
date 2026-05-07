import { describe, expect, it } from "vitest";
import { loadConfig } from "@/config";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("loadConfig", () => {
  it("loads valid config and applies defaults", () => {
    const dir = mkdtempSync(join(tmpdir(), "dp-cfg-"));
    const file = join(dir, "config.yaml");
    writeFileSync(file, `port: 9991\ntimeBudgetSeconds: 300\n`);
    const cfg = loadConfig(file);
    expect(cfg.port).toBe(9991);
    expect(cfg.timeBudgetSeconds).toBe(300);
    expect(cfg.rateLimitPerSecond).toBe(3);
  });

  it("throws on missing file", () => {
    expect(() => loadConfig("/nonexistent/file.yaml")).toThrow(/not found/);
  });

  it("throws on invalid yaml", () => {
    const dir = mkdtempSync(join(tmpdir(), "dp-cfg-"));
    const file = join(dir, "bad.yaml");
    writeFileSync(file, `port: [not valid\n`);
    expect(() => loadConfig(file)).toThrow();
  });
});
