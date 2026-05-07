import { execa } from "execa";
import { isShellCommandSafe } from "@/guards/shell-denylist";

export interface ExecShellInput {
  command: string;
  cwd?: string;
  timeout?: number;  // ms; default 30s
}

export interface ExecShellResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
  command: string;
  durationMs: number;
}

export class ExecShellError extends Error {
  constructor(message: string, public readonly reason: string) {
    super(message);
    this.name = "ExecShellError";
  }
}

export async function execShell(input: ExecShellInput): Promise<ExecShellResult> {
  const safety = isShellCommandSafe(input.command);
  if (!safety.safe) {
    throw new ExecShellError(`Command blocked by denylist: ${safety.reason}`, safety.reason!);
  }
  const timeout = input.timeout ?? 30_000;
  const start = Date.now();
  const sub = execa(input.command, {
    shell: "/bin/bash",
    cwd: input.cwd,
    timeout,
    reject: false,
    all: false,
  });
  const result = await sub;
  return {
    stdout: result.stdout?.toString() ?? "",
    stderr: result.stderr?.toString() ?? "",
    exitCode: result.exitCode ?? -1,
    timedOut: result.timedOut ?? false,
    command: input.command,
    durationMs: Date.now() - start,
  };
}
