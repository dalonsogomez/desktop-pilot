import { describe, expect, it } from "vitest";
import { parseUiTarsOutput, denormalizeCoords } from "@/agent/ui-tars-parser";

describe("parseUiTarsOutput", () => {
  it("parses a single click action", () => {
    const text = `Thought: I need to click on the search bar.\nAction: click(start_box=[450,200])`;
    const result = parseUiTarsOutput(text);
    expect(result.thought).toBe("I need to click on the search bar.");
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].type).toBe("click");
    expect(result.actions[0].startBox).toEqual([450, 200]);
  });

  it("parses multiple actions in one turn", () => {
    const text = `Thought: First click the menu, then type the search query.\nAction: click(start_box=[100,50])\nAction: type(content='hello world')`;
    const result = parseUiTarsOutput(text);
    expect(result.thought).toBe("First click the menu, then type the search query.");
    expect(result.actions).toHaveLength(2);
    expect(result.actions[0].type).toBe("click");
    expect(result.actions[0].startBox).toEqual([100, 50]);
    expect(result.actions[1].type).toBe("type");
    expect(result.actions[1].content).toBe("hello world");
  });

  it("parses drag with start_box and end_box", () => {
    const text = `Thought: Drag the file to the folder.\nAction: drag(start_box=[100,200], end_box=[500,300])`;
    const result = parseUiTarsOutput(text);
    expect(result.actions).toHaveLength(1);
    const action = result.actions[0];
    expect(action.type).toBe("drag");
    expect(action.startBox).toEqual([100, 200]);
    expect(action.endBox).toEqual([500, 300]);
  });

  it("parses type with content containing escaped single quotes", () => {
    const text = `Thought: Type text with a quote.\nAction: type(content='it\\'s working')`;
    const result = parseUiTarsOutput(text);
    expect(result.actions[0].type).toBe("type");
    expect(result.actions[0].content).toBe("it's working");
  });

  it("parses finished with summary text", () => {
    const text = `Thought: Task is done.\nAction: finished(content='opened the browser successfully')`;
    const result = parseUiTarsOutput(text);
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].type).toBe("finished");
    expect(result.actions[0].content).toBe("opened the browser successfully");
  });

  it("parses hotkey with multi-key string", () => {
    const text = `Thought: Press copy shortcut.\nAction: hotkey(key='cmd c')`;
    const result = parseUiTarsOutput(text);
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].type).toBe("hotkey");
    expect(result.actions[0].key).toBe("cmd c");
  });

  it("parses left_double click", () => {
    const text = `Thought: Double-click to open.\nAction: left_double(start_box=[300,400])`;
    const result = parseUiTarsOutput(text);
    expect(result.actions[0].type).toBe("left_double");
    expect(result.actions[0].startBox).toEqual([300, 400]);
  });

  it("parses right_single click", () => {
    const text = `Thought: Right-click for context menu.\nAction: right_single(start_box=[200,150])`;
    const result = parseUiTarsOutput(text);
    expect(result.actions[0].type).toBe("right_single");
    expect(result.actions[0].startBox).toEqual([200, 150]);
  });

  it("parses scroll with direction", () => {
    const text = `Thought: Scroll down to see more.\nAction: scroll(start_box=[500,500], direction='down')`;
    const result = parseUiTarsOutput(text);
    expect(result.actions[0].type).toBe("scroll");
    expect(result.actions[0].startBox).toEqual([500, 500]);
    expect(result.actions[0].direction).toBe("down");
  });

  it("parses wait action", () => {
    const text = `Thought: Wait for the page to load.\nAction: wait()`;
    const result = parseUiTarsOutput(text);
    expect(result.actions[0].type).toBe("wait");
  });

  it("returns empty thought when no Thought: prefix", () => {
    const text = `Action: click(start_box=[100,100])`;
    const result = parseUiTarsOutput(text);
    expect(result.thought).toBe("");
    expect(result.actions).toHaveLength(1);
  });

  it("returns empty actions on garbage input", () => {
    const result = parseUiTarsOutput("This is not valid UI-TARS output at all");
    expect(result.actions).toHaveLength(0);
  });

  it("throws on unknown action type", () => {
    const text = `Thought: Do something.\nAction: teleport(start_box=[0,0])`;
    expect(() => parseUiTarsOutput(text)).toThrow("Unknown UI-TARS action: teleport");
  });
});

describe("denormalizeCoords", () => {
  it("maps [500,500] at 1920x1080 to [960,540]", () => {
    expect(denormalizeCoords([500, 500], 1920, 1080)).toEqual([960, 540]);
  });

  it("maps [0,0] to [0,0]", () => {
    expect(denormalizeCoords([0, 0], 1920, 1080)).toEqual([0, 0]);
  });

  it("maps [1000,1000] to [1920,1080]", () => {
    expect(denormalizeCoords([1000, 1000], 1920, 1080)).toEqual([1920, 1080]);
  });

  it("rounds fractional pixel coordinates", () => {
    // 333 * 1920 / 1000 = 639.36 => rounds to 639
    expect(denormalizeCoords([333, 333], 1920, 1080)[0]).toBe(639);
  });

  it("works with non-standard display sizes", () => {
    expect(denormalizeCoords([500, 500], 2560, 1440)).toEqual([1280, 720]);
  });
});
