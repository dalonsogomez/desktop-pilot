import { describe, expect, it, vi } from "vitest";
import { runAgentLoop } from "@/agent/runner";

describe("runAgentLoop", () => {
  it("invokes the model client and stops on tool_use_finished", async () => {
    const mockClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: "text", text: "done" }],
          stop_reason: "end_turn",
        }),
      },
    };
    const result = await runAgentLoop({
      prompt: "say done",
      client: mockClient as any,
      tools: [],
      onAction: vi.fn(),
      timeoutMs: 5000,
    });
    expect(result.completed).toBe(true);
    expect(mockClient.messages.create).toHaveBeenCalled();
  });
});
