import { OllamaClient } from "@/agent/ollama-client";
import { parseUiTarsOutput, denormalizeCoords, type UiTarsAction } from "@/agent/ui-tars-parser";

const UI_TARS_SYSTEM = `You are UI-TARS, a GUI agent. You see the user's screen and act on it via clicks, drags, typing, and hotkeys.

You output your reasoning followed by ONE OR MORE actions in this exact format:

Thought: <your reasoning about what to do>
Action: <action>(...)

Available actions:
- click(start_box=[x,y]) — single left click
- left_double(start_box=[x,y]) — double click
- right_single(start_box=[x,y]) — right click
- drag(start_box=[x1,y1], end_box=[x2,y2]) — drag from start to end
- hotkey(key='cmd c') — keyboard shortcut (space-separated keys, lowercase)
- type(content='text') — type literal text
- scroll(start_box=[x,y], direction='down') — scroll at point
- wait() — pause briefly
- finished(content='summary') — task done with summary

Coordinates use normalized [0..1000] range.

When the task is complete, emit Action: finished(content='<summary>') and stop.`;

export interface UiTarsLoopInput {
  prompt: string;
  client: OllamaClient;
  model: string;
  displayWidth: number;
  displayHeight: number;
  takeScreenshot: () => Promise<string>;  // returns base64 PNG
  onAction: (action: UiTarsAction, pixelCoords: { start?: [number, number]; end?: [number, number] }) => Promise<string>;  // returns brief result
  timeoutMs: number;
  maxTurns?: number;
}

export interface UiTarsLoopResult {
  completed: boolean;
  reason: string;
  iterations: number;
  finalSummary?: string;
}

export async function runUiTarsLoop(input: UiTarsLoopInput): Promise<UiTarsLoopResult> {
  const start = Date.now();
  const maxTurns = input.maxTurns ?? 50;
  let messages: { role: "system" | "user" | "assistant"; content: string; images?: string[] }[] = [
    { role: "system", content: UI_TARS_SYSTEM },
    { role: "user", content: `Task: ${input.prompt}\n\nHere is the current screenshot. What action(s) should I take next?`, images: [await input.takeScreenshot()] },
  ];

  for (let turn = 0; turn < maxTurns; turn++) {
    if (Date.now() - start > input.timeoutMs) {
      return { completed: false, reason: "timeout", iterations: turn };
    }
    const response = await input.client.chat({
      model: input.model,
      messages,
      options: { temperature: 0.0, num_ctx: 8192 },
    });
    const text = response.message.content;
    const parsed = parseUiTarsOutput(text);

    if (parsed.actions.length === 0) {
      return { completed: false, reason: "no_action_parsed", iterations: turn };
    }

    for (const action of parsed.actions) {
      if (action.type === "finished") {
        return { completed: true, reason: "finished", iterations: turn + 1, finalSummary: action.content };
      }
      const pixelCoords = {
        start: action.startBox ? denormalizeCoords(action.startBox, input.displayWidth, input.displayHeight) : undefined,
        end: action.endBox ? denormalizeCoords(action.endBox, input.displayWidth, input.displayHeight) : undefined,
      };
      await input.onAction(action, pixelCoords);
    }

    messages.push({ role: "assistant", content: text });
    const newScreenshot = await input.takeScreenshot();
    messages.push({
      role: "user",
      content: "Action(s) executed. Here is the new screen state. What next?",
      images: [newScreenshot],
    });
  }
  return { completed: false, reason: "max_turns", iterations: maxTurns };
}
