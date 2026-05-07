import { describe, expect, it, vi, afterEach } from "vitest";
import { OllamaClient, type OllamaChatResponse } from "@/agent/ollama-client";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("OllamaClient.chat", () => {
  it("returns parsed response on successful 200", async () => {
    const mockResponse: OllamaChatResponse = {
      model: "0000/ui-tars-1.5-7b",
      message: { role: "assistant", content: "Thought: click\nAction: click(start_box=[500,500])" },
      done: true,
      total_duration: 1000,
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const client = new OllamaClient("http://localhost:11434");
    const result = await client.chat({
      model: "0000/ui-tars-1.5-7b",
      messages: [{ role: "user", content: "hello" }],
    });

    expect(result.model).toBe("0000/ui-tars-1.5-7b");
    expect(result.done).toBe(true);
    expect(result.message.role).toBe("assistant");
    expect(result.message.content).toContain("click");
  });

  it("uses stream: false in request body", async () => {
    const mockResponse: OllamaChatResponse = {
      model: "test",
      message: { role: "assistant", content: "ok" },
      done: true,
    };

    let capturedBody: any;
    vi.spyOn(globalThis, "fetch").mockImplementationOnce(async (_url, init) => {
      capturedBody = JSON.parse((init as RequestInit).body as string);
      return { ok: true, json: async () => mockResponse } as Response;
    });

    const client = new OllamaClient();
    await client.chat({
      model: "test",
      messages: [{ role: "user", content: "ping" }],
    });

    expect(capturedBody.stream).toBe(false);
  });

  it("throws with status message on non-2xx response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: async () => "model not found",
    } as Response);

    const client = new OllamaClient();
    await expect(
      client.chat({ model: "nonexistent", messages: [{ role: "user", content: "hi" }] })
    ).rejects.toThrow("Ollama error 404: model not found");
  });

  it("throws with 500 status message", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => "internal server error",
    } as Response);

    const client = new OllamaClient("http://localhost:11434");
    await expect(
      client.chat({ model: "test", messages: [] })
    ).rejects.toThrow("Ollama error 500");
  });

  it("passes images array when provided", async () => {
    const mockResponse: OllamaChatResponse = {
      model: "test",
      message: { role: "assistant", content: "I see the screen" },
      done: true,
    };

    let capturedBody: any;
    vi.spyOn(globalThis, "fetch").mockImplementationOnce(async (_url, init) => {
      capturedBody = JSON.parse((init as RequestInit).body as string);
      return { ok: true, json: async () => mockResponse } as Response;
    });

    const client = new OllamaClient();
    await client.chat({
      model: "test",
      messages: [{ role: "user", content: "look at this", images: ["base64data=="] }],
    });

    expect(capturedBody.messages[0].images).toEqual(["base64data=="]);
  });

  it("uses default base URL when none provided", async () => {
    let capturedUrl: string = "";
    vi.spyOn(globalThis, "fetch").mockImplementationOnce(async (url) => {
      capturedUrl = url as string;
      return { ok: true, json: async () => ({ model: "t", message: { role: "assistant", content: "" }, done: true }) } as Response;
    });

    const client = new OllamaClient();
    await client.chat({ model: "t", messages: [] });

    expect(capturedUrl).toBe("http://localhost:11434/api/chat");
  });
});
