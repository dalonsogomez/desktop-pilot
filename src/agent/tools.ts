import type { Tool } from "@anthropic-ai/sdk/resources/messages.js";
import { execShell, ExecShellError } from "@/tools/exec-shell";
import { execAppleScript, ExecAppleScriptError } from "@/tools/exec-applescript";
import type { AppleScriptGuard } from "@/guards/applescript-checks";

export const SHELL_TOOL: Tool = {
  name: "exec_shell",
  description:
    "Execute a shell command on the user's macOS via /bin/bash. Returns stdout, stderr, and exit code. Dangerous patterns (rm -rf /, sudo, mkfs, fork bombs, system path writes) are blocked. Use for filesystem operations, git, npm, python, batch processing, listing files, etc. Prefer this over GUI clicking when possible.",
  input_schema: {
    type: "object",
    properties: {
      command: { type: "string", description: "The shell command to execute" },
      cwd: { type: "string", description: "Working directory (default: $HOME)" },
      timeout: { type: "number", description: "Timeout in milliseconds (default 30000, max 300000)" },
    },
    required: ["command"],
  },
};

export const APPLESCRIPT_TOOL: Tool = {
  name: "exec_applescript",
  description:
    "Execute an AppleScript via osascript. Allows scripting of allowlisted macOS apps (Finder, Mail, Safari, Notes, Calendar, Reminders, Pages, Numbers, Keynote, TextEdit, Preview, Photos, Music, Terminal, System Events). Use for deterministic app control: 'tell application Mail to send', 'tell application Pages to save document 1', etc. Cannot 'do shell script' or 'do JavaScript' (blocked).",
  input_schema: {
    type: "object",
    properties: {
      script: { type: "string", description: "The AppleScript code to execute" },
      timeout: { type: "number", description: "Timeout in milliseconds (default 30000)" },
    },
    required: ["script"],
  },
};

export const ALL_TOOLS: Tool[] = [SHELL_TOOL, APPLESCRIPT_TOOL];

export interface ToolDispatchContext {
  appleScriptGuard: AppleScriptGuard;
}

export async function dispatchTool(
  name: string,
  input: any,
  ctx: ToolDispatchContext
): Promise<string> {
  if (name === "exec_shell") {
    try {
      const result = await execShell({ command: input.command, cwd: input.cwd, timeout: input.timeout });
      return JSON.stringify({
        stdout: result.stdout,
        stderr: result.stderr,
        exit_code: result.exitCode,
        timed_out: result.timedOut,
        duration_ms: result.durationMs,
      });
    } catch (err) {
      if (err instanceof ExecShellError) {
        return JSON.stringify({ error: "blocked", reason: err.reason, message: err.message });
      }
      throw err;
    }
  }

  if (name === "exec_applescript") {
    try {
      const result = await execAppleScript({ script: input.script, guard: ctx.appleScriptGuard, timeout: input.timeout });
      return JSON.stringify({
        stdout: result.stdout,
        stderr: result.stderr,
        exit_code: result.exitCode,
        timed_out: result.timedOut,
        duration_ms: result.durationMs,
      });
    } catch (err) {
      if (err instanceof ExecAppleScriptError) {
        return JSON.stringify({ error: "blocked", reason: err.reason, message: err.message });
      }
      throw err;
    }
  }

  return JSON.stringify({ error: "unknown_tool", name });
}
