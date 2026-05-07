import { describe, expect, it, beforeAll } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execAppleScript, ExecAppleScriptError } from "@/tools/exec-applescript";
import { AppleScriptGuard } from "@/guards/applescript-checks";

let guard: AppleScriptGuard;

beforeAll(() => {
  const dir = mkdtempSync(join(tmpdir(), "dp-as-tool-"));
  const file = join(dir, "applescript-allowlist.yaml");
  writeFileSync(file, `apps:\n  - System Events\n  - Finder\n`);
  guard = new AppleScriptGuard(file);
});

describe("execAppleScript", () => {
  it("runs a simple script and returns stdout", async () => {
    const result = await execAppleScript({ script: `return 1 + 2`, guard });
    expect(result.stdout.trim()).toBe("3");
    expect(result.exitCode).toBe(0);
  });

  it("rejects do shell script", async () => {
    await expect(
      execAppleScript({ script: `do shell script "ls"`, guard })
    ).rejects.toThrow(ExecAppleScriptError);
  });

  it("rejects tell to non-allowlisted app", async () => {
    await expect(
      execAppleScript({ script: `tell application "Mail" to send`, guard })
    ).rejects.toThrow(ExecAppleScriptError);
  });

  it("kills process on timeout", async () => {
    const result = await execAppleScript({
      script: `delay 5\nreturn "ok"`,
      guard,
      timeout: 500,
    });
    expect(result.timedOut).toBe(true);
  });
});
