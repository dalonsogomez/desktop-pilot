export interface OllamaMessage {
  role: "system" | "user" | "assistant";
  content: string;
  images?: string[];  // base64-encoded PNG data, no data:image prefix
}

export interface OllamaChatRequest {
  model: string;
  messages: OllamaMessage[];
  stream?: false;
  options?: {
    temperature?: number;
    num_ctx?: number;
  };
}

export interface OllamaChatResponse {
  model: string;
  message: { role: string; content: string };
  done: boolean;
  total_duration?: number;
}

export class OllamaClient {
  constructor(private baseUrl = "http://localhost:11434") {}

  async chat(req: OllamaChatRequest): Promise<OllamaChatResponse> {
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...req, stream: false }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Ollama error ${res.status}: ${text}`);
    }
    return await res.json() as OllamaChatResponse;
  }
}
