import type { Tool } from "@anthropic-ai/sdk/resources/messages.js";
import type { ToolUnion } from "@anthropic-ai/sdk/resources/messages.js";
import { readFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { v4 as uuid } from "uuid";
import { execShell, ExecShellError } from "@/tools/exec-shell";
import { execAppleScript, ExecAppleScriptError } from "@/tools/exec-applescript";
import type { AppleScriptGuard } from "@/guards/applescript-checks";
import type { GuiActorController } from "@/recorder/gui-actor-controller";

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

export const COMPUTER_TOOL: ToolUnion = {
  type: "computer_20250124" as const,
  name: "computer",
  display_width_px: 1920,
  display_height_px: 1080,
  display_number: 0,
} as any;  // SDK types may need cast for computer_use beta

export const ALL_TOOLS: ToolUnion[] = [COMPUTER_TOOL, SHELL_TOOL as ToolUnion, APPLESCRIPT_TOOL as ToolUnion];

export interface ToolDispatchContext {
  appleScriptGuard: AppleScriptGuard;
  guiActor: GuiActorController;
  screenshotsDir?: string;  // where to save screenshots; default tmp
}

export async function dispatchTool(
  name: string,
  input: any,
  ctx: ToolDispatchContext
): Promise<string> {
  if (name === "computer") {
    const action = (input as any).action as string;
    const coord = (input as any).coordinate as [number, number] | undefined;

    switch (action) {
      case "screenshot": {
        const dir = ctx.screenshotsDir ?? tmpdir();
        await mkdir(dir, { recursive: true });
        const path = join(dir, `screenshot-${uuid()}.png`);
        await ctx.guiActor.send(`screenshot ${path}`);
        const data = await readFile(path);
        const base64 = data.toString("base64");
        return JSON.stringify({
          type: "image",
          source: { type: "base64", media_type: "image/png", data: base64 },
        });
      }
      case "left_click":
        await ctx.guiActor.send(`click left ${coord![0]} ${coord![1]}`);
        return "clicked";
      case "right_click":
        await ctx.guiActor.send(`click right ${coord![0]} ${coord![1]}`);
        return "right clicked";
      case "middle_click":
        await ctx.guiActor.send(`click middle ${coord![0]} ${coord![1]}`);
        return "middle clicked";
      case "double_click":
        await ctx.guiActor.send(`click double ${coord![0]} ${coord![1]}`);
        return "double clicked";
      case "triple_click":
        await ctx.guiActor.send(`click triple ${coord![0]} ${coord![1]}`);
        return "triple clicked";
      case "mouse_move":
        await ctx.guiActor.send(`move ${coord![0]} ${coord![1]}`);
        return "moved";
      case "left_click_drag": {
        const start = (input as any).start_coordinate as [number, number];
        const end   = (input as any).coordinate as [number, number];
        await ctx.guiActor.send(`drag ${start[0]} ${start[1]} ${end[0]} ${end[1]}`);
        return "dragged";
      }
      case "type": {
        const text = (input as any).text as string;
        await ctx.guiActor.send(`type ${text}`);
        return "typed";
      }
      case "key": {
        const text = (input as any).text as string;  // e.g. "cmd+c"
        await ctx.guiActor.send(`hotkey ${text}`);
        return "key sent";
      }
      case "scroll": {
        const direction = (input as any).scroll_direction as string;
        const amount    = (input as any).scroll_amount as number;
        const c = (input as any).coordinate as [number, number] | undefined;
        const x = c?.[0] ?? 0;
        const y = c?.[1] ?? 0;
        await ctx.guiActor.send(`scroll ${x} ${y} ${direction} ${amount}`);
        return "scrolled";
      }
      case "cursor_position": {
        const out = await ctx.guiActor.send("cursor");
        const parts = out.split(" ");
        return JSON.stringify({ x: parseInt(parts[1] ?? "0"), y: parseInt(parts[2] ?? "0") });
      }
      default:
        return JSON.stringify({ error: "unknown_computer_action", action });
    }
  }

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
