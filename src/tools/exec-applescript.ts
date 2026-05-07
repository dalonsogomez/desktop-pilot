import { execa } from "execa";
import { AppleScriptGuard } from "@/guards/applescript-checks";

export interface ExecAppleScriptInput {
  script: string;
  guard: AppleScriptGuard;
  timeout?: number;
}

export interface ExecAppleScriptResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
  script: string;
  durationMs: number;
}

export class ExecAppleScriptError extends Error {
  constructor(message: string, public readonly reason: string) {
    super(message);
    this.name = "ExecAppleScriptError";
  }
}

export async function execAppleScript(input: ExecAppleScriptInput): Promise<ExecAppleScriptResult> {
  const check = input.guard.check(input.script);
  if (!check.safe) {
    throw new ExecAppleScriptError(`AppleScript blocked: ${check.reason} ${check.detail ?? ""}`, check.reason!);
  }
  const timeout = input.timeout ?? 30_000;
  const start = Date.now();
  const sub = execa("osascript", ["-e", input.script], {
    timeout,
    reject: false,
  });
  const result = await sub;
  return {
    stdout: result.stdout?.toString() ?? "",
    stderr: result.stderr?.toString() ?? "",
    exitCode: result.exitCode ?? -1,
    timedOut: result.timedOut ?? false,
    script: input.script,
    durationMs: Date.now() - start,
  };
}
