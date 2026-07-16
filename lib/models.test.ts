import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AnthropicAdapter, LMStudioAdapter, parseModelId, getAdapter } from "./models";

function fakeResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

describe("parseModelId", () => {
  it("splits a canonical provider:id string", () => {
    expect(parseModelId("openai:gpt-4o")).toEqual({ provider: "openai", id: "gpt-4o" });
  });

  it("defaults unprefixed legacy ids to anthropic", () => {
    expect(parseModelId("claude-sonnet-5")).toEqual({ provider: "anthropic", id: "claude-sonnet-5" });
  });
});

describe("AnthropicAdapter retry/backoff on transient errors", () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.ANTHROPIC_API_KEY;
  const overloaded = () =>
    fakeResponse(529, { type: "error", error: { type: "overloaded_error", message: "Overloaded" } });

  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    vi.useFakeTimers();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.ANTHROPIC_API_KEY = originalKey;
    vi.useRealTimers();
  });

  it("retries through repeated 529s and succeeds once they clear", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(overloaded())
      .mockResolvedValueOnce(overloaded())
      .mockResolvedValueOnce(
        fakeResponse(200, {
          content: [{ type: "text", text: "Paris" }],
          usage: { input_tokens: 3, output_tokens: 1 },
        })
      );
    global.fetch = fetchMock as unknown as typeof fetch;

    const adapter = new AnthropicAdapter("claude-sonnet-5");
    const promise = adapter.complete("What is the capital of France?");
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.text).toBe("Paris");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("gives up and throws once the retry budget is exhausted", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => overloaded());
    global.fetch = fetchMock as unknown as typeof fetch;

    const adapter = new AnthropicAdapter("claude-sonnet-5");
    const settled = adapter.complete("hi").then(
      () => ({ ok: true as const }),
      (err: unknown) => ({ ok: false as const, err })
    );
    await vi.runAllTimersAsync();
    const outcome = await settled;

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect((outcome.err as Error).message).toMatch(/Anthropic API 529/);
    }
    // 1 initial attempt + 5 retries
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  it("does not retry on a non-transient error status", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      fakeResponse(401, { type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } })
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const adapter = new AnthropicAdapter("claude-sonnet-5");
    await expect(adapter.complete("hi")).rejects.toThrow(/Anthropic API 401/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("LMStudioAdapter", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("strips a leaked chat-template marker from the response text", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      fakeResponse(200, {
        choices: [{ message: { content: "Paris<end_of_turn>" } }],
        usage: { prompt_tokens: 10, completion_tokens: 2 },
      })
    ) as unknown as typeof fetch;

    const adapter = new LMStudioAdapter("qwen3-4b-toolcalling-codex");
    const result = await adapter.complete("What is the capital of France?");

    expect(result.text).toBe("Paris");
  });
});

describe("getAdapter provider concurrency limit", () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.ANTHROPIC_API_KEY;

  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "test-key";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.ANTHROPIC_API_KEY = originalKey;
  });

  it("never runs more concurrent requests per provider than the configured limit", async () => {
    let active = 0;
    let maxActive = 0;
    global.fetch = vi.fn().mockImplementation(async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active--;
      return fakeResponse(200, { content: [{ type: "text", text: "ok" }], usage: {} });
    }) as unknown as typeof fetch;

    const adapter = getAdapter("anthropic:claude-sonnet-5");
    await Promise.all(Array.from({ length: 6 }, () => adapter.complete("hi")));

    // Default PROVIDER_CONCURRENCY_LIMIT is 2.
    expect(maxActive).toBeLessThanOrEqual(2);
  });
});
