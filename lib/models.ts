// Model adapters. Add providers by implementing ModelAdapter and registering
// them in PROVIDERS below — see OpenAIAdapter for a ~30-line example.

export interface Completion {
  text: string;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
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
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const text = (data.content ?? [])
      .map((block) => block.text ?? "")
      .join("");

    return {
      text,
      latencyMs: Date.now() - start,
      inputTokens: data.usage?.input_tokens,
      outputTokens: data.usage?.output_tokens,
    };
  }
}

export class OpenAIAdapter implements ModelAdapter {
  constructor(public id: string) {}

  async complete(prompt: string, system?: string): Promise<Completion> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not set (see .env.example)");

    const start = Date.now();
    const messages = [
      ...(system ? [{ role: "system", content: system }] : []),
      { role: "user", content: prompt },
    ];
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ model: this.id, messages }),
    });

    if (!res.ok) {
      throw new Error(`OpenAI API ${res.status}: ${await res.text()}`);
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const text = data.choices?.[0]?.message?.content ?? "";

    return {
      text,
      latencyMs: Date.now() - start,
      inputTokens: data.usage?.prompt_tokens,
      outputTokens: data.usage?.completion_tokens,
    };
  }
}

type AdapterFactory = (id: string) => ModelAdapter;

/**
 * Extension point: implement ModelAdapter for a new provider and add one
 * entry here, e.g. google: (id) => new GoogleAdapter(id), or for a local
 * OpenAI-compatible endpoint (LM Studio/Ollama), reuse OpenAIAdapter with a
 * custom base URL.
 */
const PROVIDERS: Record<string, AdapterFactory> = {
  anthropic: (id) => new AnthropicAdapter(id),
  openai: (id) => new OpenAIAdapter(id),
};

/** Splits a canonical model id like "openai:gpt-4o" into provider + bare id.
 *  Unprefixed ids (legacy suites created before multi-provider support)
 *  default to "anthropic" so existing data keeps working. */
export function parseModelId(model: string): { provider: string; id: string } {
  const idx = model.indexOf(":");
  if (idx === -1) return { provider: "anthropic", id: model };
  return { provider: model.slice(0, idx), id: model.slice(idx + 1) };
}

export function getAdapter(model: string): ModelAdapter {
  const { provider, id } = parseModelId(model);
  const make = PROVIDERS[provider];
  if (!make) {
    throw new Error(
      `Unknown model provider "${provider}" (from "${model}"). Known providers: ${Object.keys(PROVIDERS).join(", ")}`
    );
  }
  return make(id);
}
