import Anthropic from "@anthropic-ai/sdk";

export interface AgentLoopInput {
  prompt: string;
  client: Anthropic | { messages: { create: (...args: any[]) => Promise<any> } };
  tools: any[];
  onTool: (action: { name: string; input: unknown }) => Promise<string>;  // returns the tool result content
  timeoutMs: number;
  systemPrompt?: string;
  model?: string;
}

export interface AgentLoopResult {
  completed: boolean;
  reason: string;
  iterations: number;
}

export async function runAgentLoop(input: AgentLoopInput): Promise<AgentLoopResult> {
  const start = Date.now();
  let iterations = 0;
  let messages: any[] = [{ role: "user", content: input.prompt }];

  while (Date.now() - start < input.timeoutMs) {
    iterations++;
    const response = await input.client.messages.create({
      model: input.model ?? "claude-sonnet-4-6",
      max_tokens: 4096,
      system: input.systemPrompt,
      tools: input.tools,
      messages,
    });

    if (response.stop_reason === "end_turn") {
      return { completed: true, reason: "end_turn", iterations };
    }

    if (response.stop_reason === "tool_use") {
      const toolUses = response.content.filter((c: any) => c.type === "tool_use");
      const toolResults: any[] = [];
      for (const tu of toolUses) {
        const resultContent = await input.onTool({ name: tu.name, input: tu.input });
        toolResults.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: resultContent,
        });
      }
      messages.push({ role: "assistant", content: response.content });
      messages.push({ role: "user", content: toolResults });
      continue;
    }

    return { completed: false, reason: response.stop_reason ?? "unknown", iterations };
  }
  return { completed: false, reason: "timeout", iterations };
}
