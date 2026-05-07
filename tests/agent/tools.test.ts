import { describe, expect, it, vi, beforeAll } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { dispatchTool, type ToolDispatchContext } from "@/agent/tools";
import { AppleScriptGuard } from "@/guards/applescript-checks";
import type { GuiActorController } from "@/recorder/gui-actor-controller";

let guard: AppleScriptGuard;
let ctx: ToolDispatchContext;

/** Build a fake GuiActorController whose send() always resolves "OK" */
function makeFakeGuiActor(responses: Record<string, string> = {}): GuiActorController {
  const sent: string[] = [];
  return {
    start: vi.fn(),
    stop: vi.fn(),
    send: vi.fn(async (cmd: string) => {
      sent.push(cmd);
      // Allow test-specific responses, else default "OK"
      for (const prefix of Object.keys(responses)) {
        if (cmd.startsWith(prefix)) return responses[prefix];
      }
      return "OK";
    }),
    _sent: sent,
  } as any;
}

beforeAll(() => {
  const dir = mkdtempSync(join(tmpdir(), "dp-agent-tools-"));
  const file = join(dir, "applescript-allowlist.yaml");
  writeFileSync(file, `apps:\n  - Finder\n  - System Events\n`);
  guard = new AppleScriptGuard(file);
  ctx = { appleScriptGuard: guard, guiActor: makeFakeGuiActor() };
});

describe("dispatchTool", () => {
  it("exec_shell happy path returns stdout in JSON", async () => {
    const result = await dispatchTool("exec_shell", { command: "echo hello" }, ctx);
    const parsed = JSON.parse(result);
    expect(parsed.stdout.trim()).toBe("hello");
    expect(parsed.exit_code).toBe(0);
  });

  it("exec_shell denylist returns {error:'blocked'}", async () => {
    const result = await dispatchTool("exec_shell", { command: "rm -rf /" }, ctx);
    const parsed = JSON.parse(result);
    expect(parsed.error).toBe("blocked");
    expect(parsed.reason).toBeDefined();
  });

  it("exec_applescript happy path returns stdout", async () => {
    const result = await dispatchTool(
      "exec_applescript",
      { script: "return 1 + 1" },
      ctx
    );
    const parsed = JSON.parse(result);
    expect(parsed.stdout.trim()).toBe("2");
    expect(parsed.exit_code).toBe(0);
  });

  it("unknown tool name returns {error:'unknown_tool'}", async () => {
    const result = await dispatchTool("nonexistent_tool", {}, ctx);
    const parsed = JSON.parse(result);
    expect(parsed.error).toBe("unknown_tool");
    expect(parsed.name).toBe("nonexistent_tool");
  });
});

describe("dispatchTool — computer actions", () => {
  it("left_click sends correct gui-actor command", async () => {
    const guiActor = makeFakeGuiActor();
    const localCtx: ToolDispatchContext = { appleScriptGuard: guard, guiActor };
    const result = await dispatchTool("computer", { action: "left_click", coordinate: [100, 200] }, localCtx);
    expect(result).toBe("clicked");
    expect(guiActor.send).toHaveBeenCalledWith("click left 100 200");
  });

  it("right_click sends correct gui-actor command", async () => {
    const guiActor = makeFakeGuiActor();
    const localCtx: ToolDispatchContext = { appleScriptGuard: guard, guiActor };
    const result = await dispatchTool("computer", { action: "right_click", coordinate: [50, 75] }, localCtx);
    expect(result).toBe("right clicked");
    expect(guiActor.send).toHaveBeenCalledWith("click right 50 75");
  });

  it("double_click sends correct gui-actor command", async () => {
    const guiActor = makeFakeGuiActor();
    const localCtx: ToolDispatchContext = { appleScriptGuard: guard, guiActor };
    const result = await dispatchTool("computer", { action: "double_click", coordinate: [300, 400] }, localCtx);
    expect(result).toBe("double clicked");
    expect(guiActor.send).toHaveBeenCalledWith("click double 300 400");
  });

  it("triple_click sends correct gui-actor command", async () => {
    const guiActor = makeFakeGuiActor();
    const localCtx: ToolDispatchContext = { appleScriptGuard: guard, guiActor };
    const result = await dispatchTool("computer", { action: "triple_click", coordinate: [10, 20] }, localCtx);
    expect(result).toBe("triple clicked");
    expect(guiActor.send).toHaveBeenCalledWith("click triple 10 20");
  });

  it("mouse_move sends move command", async () => {
    const guiActor = makeFakeGuiActor();
    const localCtx: ToolDispatchContext = { appleScriptGuard: guard, guiActor };
    const result = await dispatchTool("computer", { action: "mouse_move", coordinate: [640, 480] }, localCtx);
    expect(result).toBe("moved");
    expect(guiActor.send).toHaveBeenCalledWith("move 640 480");
  });

  it("left_click_drag sends drag command", async () => {
    const guiActor = makeFakeGuiActor();
    const localCtx: ToolDispatchContext = { appleScriptGuard: guard, guiActor };
    const result = await dispatchTool(
      "computer",
      { action: "left_click_drag", start_coordinate: [10, 20], coordinate: [100, 200] },
      localCtx
    );
    expect(result).toBe("dragged");
    expect(guiActor.send).toHaveBeenCalledWith("drag 10 20 100 200");
  });

  it("type sends type command", async () => {
    const guiActor = makeFakeGuiActor();
    const localCtx: ToolDispatchContext = { appleScriptGuard: guard, guiActor };
    const result = await dispatchTool("computer", { action: "type", text: "hello world" }, localCtx);
    expect(result).toBe("typed");
    expect(guiActor.send).toHaveBeenCalledWith("type hello world");
  });

  it("key sends hotkey command", async () => {
    const guiActor = makeFakeGuiActor();
    const localCtx: ToolDispatchContext = { appleScriptGuard: guard, guiActor };
    const result = await dispatchTool("computer", { action: "key", text: "cmd+c" }, localCtx);
    expect(result).toBe("key sent");
    expect(guiActor.send).toHaveBeenCalledWith("hotkey cmd+c");
  });

  it("scroll sends scroll command", async () => {
    const guiActor = makeFakeGuiActor();
    const localCtx: ToolDispatchContext = { appleScriptGuard: guard, guiActor };
    const result = await dispatchTool(
      "computer",
      { action: "scroll", coordinate: [500, 500], scroll_direction: "down", scroll_amount: 3 },
      localCtx
    );
    expect(result).toBe("scrolled");
    expect(guiActor.send).toHaveBeenCalledWith("scroll 500 500 down 3");
  });

  it("cursor_position parses response coordinates", async () => {
    const guiActor = makeFakeGuiActor({ cursor: "OK 720 540" });
    const localCtx: ToolDispatchContext = { appleScriptGuard: guard, guiActor };
    const result = await dispatchTool("computer", { action: "cursor_position" }, localCtx);
    const parsed = JSON.parse(result);
    expect(parsed.x).toBe(720);
    expect(parsed.y).toBe(540);
  });

  it("unknown computer action returns error JSON", async () => {
    const guiActor = makeFakeGuiActor();
    const localCtx: ToolDispatchContext = { appleScriptGuard: guard, guiActor };
    const result = await dispatchTool("computer", { action: "teleport" }, localCtx);
    const parsed = JSON.parse(result);
    expect(parsed.error).toBe("unknown_computer_action");
    expect(parsed.action).toBe("teleport");
  });
});
