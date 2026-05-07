import { describe, expect, it, vi } from "vitest";
import { runUiTarsLoop } from "@/agent/ui-tars-runner";
import type { OllamaClient, OllamaChatResponse } from "@/agent/ollama-client";
import type { UiTarsAction } from "@/agent/ui-tars-parser";

function makeOllamaResponse(content: string): OllamaChatResponse {
  return {
    model: "0000/ui-tars-1.5-7b",
    message: { role: "assistant", content },
    done: true,
  };
}

function makeMockClient(responses: string[]): OllamaClient {
  let call = 0;
  return {
    chat: vi.fn(async () => makeOllamaResponse(responses[Math.min(call++, responses.length - 1)])),
  } as unknown as OllamaClient;
}

const baseInput = {
  prompt: "click the button",
  model: "0000/ui-tars-1.5-7b",
  displayWidth: 1920,
  displayHeight: 1080,
  takeScreenshot: vi.fn(async () => "base64screenshotdata"),
  onAction: vi.fn(async () => "action done"),
  timeoutMs: 30_000,
  maxTurns: 10,
};

describe("runUiTarsLoop", () => {
  it("returns completed=true when model emits finished on first turn", async () => {
    const client = makeMockClient([
      "Thought: Task is done.\nAction: finished(content='successfully clicked the button')",
    ]);
    const result = await runUiTarsLoop({ ...baseInput, client, onAction: vi.fn(async () => "done") });
    expect(result.completed).toBe(true);
    expect(result.reason).toBe("finished");
    expect(result.iterations).toBe(1);
    expect(result.finalSummary).toBe("successfully clicked the button");
  });

  it("runs multiple turns until finished", async () => {
    const onAction = vi.fn(async () => "ok");
    const client = makeMockClient([
      "Thought: Click the menu first.\nAction: click(start_box=[100,50])",
      "Thought: Now type.\nAction: type(content='search query')",
      "Thought: Done.\nAction: finished(content='task complete')",
    ]);
    const result = await runUiTarsLoop({ ...baseInput, client, onAction });
    expect(result.completed).toBe(true);
    expect(result.iterations).toBe(3);
    // onAction called for click + type (not for finished)
    expect(onAction).toHaveBeenCalledTimes(2);
  });

  it("returns max_turns when loop hits maxTurns without finishing", async () => {
    const client = makeMockClient([
      "Thought: Keep clicking.\nAction: click(start_box=[500,500])",
    ]);
    const result = await runUiTarsLoop({
      ...baseInput,
      client,
      maxTurns: 3,
      onAction: vi.fn(async () => "ok"),
    });
    expect(result.completed).toBe(false);
    expect(result.reason).toBe("max_turns");
    expect(result.iterations).toBe(3);
  });

  it("returns timeout when time budget is exceeded", async () => {
    // Use a very short timeout so any call triggers it
    const client = {
      chat: vi.fn(async () => {
        // Simulate slight delay
        await new Promise(r => setTimeout(r, 5));
        return makeOllamaResponse("Thought: Clicking.\nAction: click(start_box=[500,500])");
      }),
    } as unknown as OllamaClient;

    const result = await runUiTarsLoop({
      ...baseInput,
      client,
      timeoutMs: 0,  // expires immediately
      maxTurns: 10,
      onAction: vi.fn(async () => "ok"),
    });
    expect(result.completed).toBe(false);
    expect(result.reason).toBe("timeout");
  });

  it("returns no_action_parsed when model returns garbage", async () => {
    const client = makeMockClient([
      "This is just some random text with no action format",
    ]);
    const result = await runUiTarsLoop({
      ...baseInput,
      client,
      onAction: vi.fn(async () => "ok"),
    });
    expect(result.completed).toBe(false);
    expect(result.reason).toBe("no_action_parsed");
    expect(result.iterations).toBe(0);
  });

  it("takes initial screenshot before first turn", async () => {
    const takeScreenshot = vi.fn(async () => "screenshotdata");
    const client = makeMockClient([
      "Thought: Done.\nAction: finished(content='done')",
    ]);
    await runUiTarsLoop({ ...baseInput, client, takeScreenshot });
    // Called at least once for initial screenshot
    expect(takeScreenshot).toHaveBeenCalled();
  });

  it("dispatches pixel coordinates to onAction", async () => {
    const onAction = vi.fn(async (_action: UiTarsAction, _coords: any) => "ok");
    const client = makeMockClient([
      "Thought: Click center.\nAction: click(start_box=[500,500])\nAction: finished(content='done')",
    ]);
    await runUiTarsLoop({
      ...baseInput,
      client,
      onAction,
      displayWidth: 1920,
      displayHeight: 1080,
    });
    // click action should have been dispatched with pixel coords [960, 540]
    expect(onAction).toHaveBeenCalledWith(
      expect.objectContaining({ type: "click" }),
      expect.objectContaining({ start: [960, 540] })
    );
  });
});
