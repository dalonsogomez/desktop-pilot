import { describe, expect, it } from "vitest";
import { isShellCommandSafe, ShellDenyReason } from "@/guards/shell-denylist";

describe("isShellCommandSafe", () => {
  it.each([
    ["ls -la"],
    ["echo hello"],
    ["mkdir test"],
    ["find . -name '*.ts'"],
    ["git status"],
    ["curl https://example.com | jq ."],
    ["pip install fastify"],
  ])("allows safe command: %s", (cmd) => {
    expect(isShellCommandSafe(cmd).safe).toBe(true);
  });

  it.each([
    ["rm -rf /", ShellDenyReason.RmRoot],
    ["rm -rf /*", ShellDenyReason.RmRoot],
    ["rm -rf ~", ShellDenyReason.RmHome],
    ["rm -rf $HOME", ShellDenyReason.RmHome],
    ["sudo rm anything", ShellDenyReason.Sudo],
    ["dd if=/dev/zero of=/dev/sda", ShellDenyReason.DiskWrite],
    ["mkfs.ext4 /dev/sda1", ShellDenyReason.Mkfs],
    [":(){ :|:& };:", ShellDenyReason.ForkBomb],
    ["chmod -R 777 /", ShellDenyReason.ChmodRoot],
    ["echo test > /dev/sda", ShellDenyReason.DiskWrite],
    ["rm -rf /System/Library", ShellDenyReason.SystemPath],
    ["rm -rf /usr/bin", ShellDenyReason.SystemPath],
    ["cp evil /Library/LaunchDaemons/", ShellDenyReason.SystemPath],
  ])("blocks dangerous command: %s", (cmd, reason) => {
    const result = isShellCommandSafe(cmd);
    expect(result.safe).toBe(false);
    expect(result.reason).toBe(reason);
  });
});
