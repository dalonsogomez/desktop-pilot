import { describe, expect, it } from "vitest";
import { execShell, ExecShellError } from "@/tools/exec-shell";

describe("execShell", () => {
  it("runs simple commands and captures stdout", async () => {
    const result = await execShell({ command: "echo hello" });
    expect(result.stdout.trim()).toBe("hello");
    expect(result.exitCode).toBe(0);
  });

  it("captures stderr separately", async () => {
    const result = await execShell({ command: "echo err 1>&2" });
    expect(result.stderr.trim()).toBe("err");
  });

  it("returns non-zero exit code without throwing", async () => {
    const result = await execShell({ command: "exit 3" });
    expect(result.exitCode).toBe(3);
  });

  it("rejects denied commands before execution", async () => {
    await expect(execShell({ command: "rm -rf /" })).rejects.toThrow(ExecShellError);
  });

  it("kills process on timeout", async () => {
    const result = await execShell({ command: "sleep 5", timeout: 500 });
    expect(result.timedOut).toBe(true);
    expect(result.exitCode).not.toBe(0);
  });

  it("respects cwd", async () => {
    const result = await execShell({ command: "pwd", cwd: "/tmp" });
    expect(result.stdout.trim()).toMatch(/\/(tmp|private\/tmp)$/);
  });
});
