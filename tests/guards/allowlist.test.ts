import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AllowlistGuard } from "@/guards/allowlist";

describe("AllowlistGuard", () => {
  it("allows apps in the allowlist", () => {
    const dir = mkdtempSync(join(tmpdir(), "dp-aw-"));
    const file = join(dir, "allowlist.yaml");
    writeFileSync(file, `apps:\n  - Finder\n  - Safari\n`);
    const g = new AllowlistGuard(file);
    expect(g.isAllowed("Finder")).toBe(true);
    expect(g.isAllowed("Safari")).toBe(true);
  });

  it("rejects apps not in the allowlist", () => {
    const dir = mkdtempSync(join(tmpdir(), "dp-aw-"));
    const file = join(dir, "allowlist.yaml");
    writeFileSync(file, `apps:\n  - Finder\n`);
    const g = new AllowlistGuard(file);
    expect(g.isAllowed("Mail")).toBe(false);
  });

  it("hardcoded denylist always wins", () => {
    const dir = mkdtempSync(join(tmpdir(), "dp-aw-"));
    const file = join(dir, "allowlist.yaml");
    writeFileSync(file, `apps:\n  - Keychain Access\n`);
    const g = new AllowlistGuard(file);
    expect(g.isAllowed("Keychain Access")).toBe(false);
  });
});
