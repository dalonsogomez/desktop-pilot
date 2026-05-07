import { describe, expect, it, vi, beforeAll } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { dispatchTool } from "@/agent/tools";
import { AppleScriptGuard } from "@/guards/applescript-checks";

let guard: AppleScriptGuard;

beforeAll(() => {
  const dir = mkdtempSync(join(tmpdir(), "dp-agent-tools-"));
  const file = join(dir, "applescript-allowlist.yaml");
  writeFileSync(file, `apps:\n  - Finder\n  - System Events\n`);
  guard = new AppleScriptGuard(file);
});

describe("dispatchTool", () => {
  it("exec_shell happy path returns stdout in JSON", async () => {
    const result = await dispatchTool("exec_shell", { command: "echo hello" }, { appleScriptGuard: guard });
    const parsed = JSON.parse(result);
    expect(parsed.stdout.trim()).toBe("hello");
    expect(parsed.exit_code).toBe(0);
  });

  it("exec_shell denylist returns {error:'blocked'}", async () => {
    const result = await dispatchTool("exec_shell", { command: "rm -rf /" }, { appleScriptGuard: guard });
    const parsed = JSON.parse(result);
    expect(parsed.error).toBe("blocked");
    expect(parsed.reason).toBeDefined();
  });

  it("exec_applescript happy path returns stdout", async () => {
    const result = await dispatchTool(
      "exec_applescript",
      { script: "return 1 + 1" },
      { appleScriptGuard: guard }
    );
    const parsed = JSON.parse(result);
    expect(parsed.stdout.trim()).toBe("2");
    expect(parsed.exit_code).toBe(0);
  });

  it("unknown tool name returns {error:'unknown_tool'}", async () => {
    const result = await dispatchTool("nonexistent_tool", {}, { appleScriptGuard: guard });
    const parsed = JSON.parse(result);
    expect(parsed.error).toBe("unknown_tool");
    expect(parsed.name).toBe("nonexistent_tool");
  });
});
