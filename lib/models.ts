// Model adapters. Add providers by implementing ModelAdapter and routing in getAdapter().

export interface Completion {
  text: string;
  latencyMs: number;
}

export interface ModelAdapter {
  id: string;
  complete(prompt: string, system?: string): Promise<Completion>;
}

export class AnthropicAdapter implements ModelAdapter {
  constructor(public id: string) {}

  async complete(prompt: string, system?: string): Promise<Completion> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set (see .env.example)");

    const start = Date.now();
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: this.id,
        max_tokens: 1024,
        ...(system ? { system } : {}),
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      throw new Error(`Anthropic API ${res.status}: ${await res.text()}`);
    }

    const data = (await res.json()) as {
      content?: { type: string; text?: string }[];
    };
    const text = (data.content ?? [])
      .map((block) => block.text ?? "")
      .join("");

    return { text, latencyMs: Date.now() - start };
  }
}

/**
 * Extension point: route by prefix, e.g. "openai:gpt-4o" -> OpenAIAdapter,
 * "local:llama-3" -> an OpenAI-compatible adapter pointed at LM Studio/Ollama.
 */
export function getAdapter(model: string): ModelAdapter {
  return new AnthropicAdapter(model);
}
