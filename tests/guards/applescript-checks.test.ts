import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AppleScriptGuard, AppleScriptDenyReason } from "@/guards/applescript-checks";

function makeGuard(allowedApps: string[]): AppleScriptGuard {
  const dir = mkdtempSync(join(tmpdir(), "dp-as-"));
  const file = join(dir, "applescript-allowlist.yaml");
  writeFileSync(file, `apps:\n${allowedApps.map(a => `  - ${a}`).join("\n")}\n`);
  return new AppleScriptGuard(file);
}

describe("AppleScriptGuard", () => {
  it("allows tell to whitelisted app", () => {
    const g = makeGuard(["Finder", "Safari"]);
    const result = g.check(`tell application "Finder" to make new folder`);
    expect(result.safe).toBe(true);
  });

  it("rejects tell to non-whitelisted app", () => {
    const g = makeGuard(["Finder"]);
    const result = g.check(`tell application "Mail" to send`);
    expect(result.safe).toBe(false);
    expect(result.reason).toBe(AppleScriptDenyReason.AppNotAllowed);
  });

  it("rejects do shell script", () => {
    const g = makeGuard(["Finder"]);
    const result = g.check(`do shell script "rm -rf /"`);
    expect(result.safe).toBe(false);
    expect(result.reason).toBe(AppleScriptDenyReason.DoShellScript);
  });

  it("rejects do shell script even mid-script", () => {
    const g = makeGuard(["Finder"]);
    const script = `tell application "Finder"\n  set x to do shell script "ls"\nend tell`;
    const result = g.check(script);
    expect(result.safe).toBe(false);
    expect(result.reason).toBe(AppleScriptDenyReason.DoShellScript);
  });

  it("rejects do JavaScript in Safari", () => {
    const g = makeGuard(["Safari"]);
    const script = `tell application "Safari" to do JavaScript "alert(1)" in document 1`;
    const result = g.check(script);
    expect(result.safe).toBe(false);
    expect(result.reason).toBe(AppleScriptDenyReason.DoJavaScript);
  });

  it("hardcoded denylist apps are rejected", () => {
    const g = makeGuard(["Keychain Access"]);
    const result = g.check(`tell application "Keychain Access" to ...`);
    expect(result.safe).toBe(false);
  });
});
