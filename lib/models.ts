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

/**
 * Local chat-template end-of-turn markers (Gemma's <end_of_turn>, ChatML's
 * <|im_end|>, Llama's <|eot_id|>, etc.) that some local runtimes fail to
 * strip from the sampled text when the wrong stop sequence is configured for
 * the loaded model. Stripped defensively since a leaked marker isn't part of
 * the model's actual answer.
 */
const CHAT_TEMPLATE_MARKERS = /<end_of_turn>|<\|im_end\|>|<\|eot_id\|>|<\|endoftext\|>|<\/s>/gi;

function stripChatTemplateMarkers(text: string): string {
  return text.replace(CHAT_TEMPLATE_MARKERS, "").trimEnd();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retries a fetch on transient failures: 429 (rate limited) and 529
 * (Anthropic's "overloaded_error") get exponential backoff with jitter;
 * anything else (network error, other status) returns/throws immediately so
 * callers see real errors right away instead of after a delay. Eval runs are
 * synchronous but not latency-sensitive, so this budgets up to ~30s across 5
 * attempts — long enough to ride out a real overloaded_error window instead
 * of reporting a false FAIL, since those commonly clear within tens of
 * seconds rather than the few seconds a shorter retry budget would cover.
 */
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  { retries = 5 }: { retries?: number } = {}
): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, init);
    } catch (err) {
      if (attempt >= retries) throw err;
      await sleep(Math.min(500 * 2 ** attempt + Math.random() * 250, 16000));
      continue;
    }
    if ((res.status === 429 || res.status === 529) && attempt < retries) {
      const retryAfter = Number(res.headers.get("retry-after"));
      await sleep(retryAfter > 0 ? retryAfter * 1000 : Math.min(500 * 2 ** attempt + Math.random() * 250, 16000));
      continue;
    }
    return res;
  }
}

export class AnthropicAdapter implements ModelAdapter {
  constructor(public id: string) {}

  async complete(prompt: string, system?: string): Promise<Completion> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set (see .env.example)");

    const start = Date.now();
    const res = await fetchWithRetry("https://api.anthropic.com/v1/messages", {
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

/**
 * LM Studio's local server speaks the OpenAI chat-completions wire format
 * (see https://lmstudio.ai/docs/local-server), so this is the same request
 * shape as OpenAIAdapter but pointed at a local base URL and with no API key
 * required. `id` should match whatever model is loaded in LM Studio (visible
 * in its Developer/Local Server tab, or via `GET /v1/models`).
 */
export class LMStudioAdapter implements ModelAdapter {
  constructor(public id: string) {}

  async complete(prompt: string, system?: string): Promise<Completion> {
    const baseUrl = (process.env.LMSTUDIO_BASE_URL || "http://localhost:1234/v1").replace(/\/$/, "");

    const start = Date.now();
    const messages = [
      ...(system ? [{ role: "system", content: system }] : []),
      { role: "user", content: prompt },
    ];

    let res: Response;
    try {
      res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        // Explicit stop sequences so generation halts at the turn boundary
        // even if LM Studio picked the wrong prompt template for this model —
        // stripChatTemplateMarkers below is a second line of defense for any
        // marker that still leaks through into the sampled text.
        body: JSON.stringify({
          model: this.id,
          messages,
          stop: ["<end_of_turn>", "<|im_end|>", "<|eot_id|>"],
        }),
      });
    } catch (err) {
      throw new Error(
        `Could not reach LM Studio at ${baseUrl} — is the local server running? (${(err as Error).message})`
      );
    }

    if (!res.ok) {
      throw new Error(`LM Studio API ${res.status}: ${await res.text()}`);
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const text = stripChatTemplateMarkers(data.choices?.[0]?.message?.content ?? "");

    return {
      text,
      latencyMs: Date.now() - start,
      inputTokens: data.usage?.prompt_tokens,
      outputTokens: data.usage?.completion_tokens,
    };
  }
}

/**
 * Custom endpoint that speaks Anthropic's /v1/messages wire format with
 * bearer-token auth (the shape implied by ANTHROPIC_BASE_URL/ANTHROPIC_AUTH_TOKEN-
 * style config) — same request/response shape as AnthropicAdapter but with a
 * configurable base URL and a separate key so it never collides with a real
 * ANTHROPIC_API_KEY. Point METASPARK_BASE_URL at whatever endpoint you trust;
 * this harness does not hardcode or validate that host.
 */
export class MetaSparkAdapter implements ModelAdapter {
  constructor(public id: string) {}

  async complete(prompt: string, system?: string): Promise<Completion> {
    const apiKey = process.env.METASPARK_API_KEY;
    if (!apiKey) throw new Error("METASPARK_API_KEY is not set (see .env.example)");
    const baseUrl = (process.env.METASPARK_BASE_URL || "https://api.meta.ai").replace(/\/$/, "");

    const start = Date.now();
    let res: Response;
    try {
      res = await fetch(`${baseUrl}/v1/messages`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
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
    } catch (err) {
      throw new Error(
        `Could not reach Meta Spark endpoint at ${baseUrl} (${(err as Error).message})`
      );
    }

    if (!res.ok) {
      throw new Error(`Meta Spark API ${res.status}: ${await res.text()}`);
    }

    const data = (await res.json()) as {
      content?: { type: string; text?: string }[];
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const text = (data.content ?? []).map((block) => block.text ?? "").join("");

    return {
      text,
      latencyMs: Date.now() - start,
      inputTokens: data.usage?.input_tokens,
      outputTokens: data.usage?.output_tokens,
    };
  }
}

type AdapterFactory = (id: string) => ModelAdapter;

/**
 * Extension point: implement ModelAdapter for a new provider and add one
 * entry here, e.g. google: (id) => new GoogleAdapter(id).
 */
const PROVIDERS: Record<string, AdapterFactory> = {
  anthropic: (id) => new AnthropicAdapter(id),
  openai: (id) => new OpenAIAdapter(id),
  lmstudio: (id) => new LMStudioAdapter(id),
  metaspark: (id) => new MetaSparkAdapter(id),
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
