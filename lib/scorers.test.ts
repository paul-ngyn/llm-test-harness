import { describe, it, expect, vi, beforeEach } from "vitest";
import { score } from "./scorers";
import { getAdapter } from "./models";

vi.mock("./models", () => ({
  getAdapter: vi.fn(),
}));

describe("score: exact", () => {
  it("passes on an exact match, trimmed", async () => {
    const r = await score("exact", "  Paris  ", "Paris");
    expect(r.passed).toBe(true);
    expect(r.score).toBe(1);
  });

  it("fails on a case mismatch", async () => {
    const r = await score("exact", "paris", "Paris");
    expect(r.passed).toBe(false);
    expect(r.score).toBe(0);
  });
});

describe("score: contains", () => {
  it("passes on a case-insensitive substring match", async () => {
    const r = await score("contains", "The capital is PARIS, obviously.", "paris");
    expect(r.passed).toBe(true);
  });

  it("fails when the substring is absent", async () => {
    const r = await score("contains", "The capital is Lyon.", "paris");
    expect(r.passed).toBe(false);
  });
});

describe("score: regex", () => {
  it("passes when the pattern matches", async () => {
    const r = await score("regex", "the answer is 7.5 exactly", "\\b7\\.5\\b");
    expect(r.passed).toBe(true);
  });

  it("fails when the pattern doesn't match", async () => {
    const r = await score("regex", "the answer is 8", "\\b7\\.5\\b");
    expect(r.passed).toBe(false);
  });
});

describe("score: llm-judge", () => {
  beforeEach(() => {
    vi.mocked(getAdapter).mockReset();
  });

  function mockJudge(text: string) {
    vi.mocked(getAdapter).mockReturnValue({
      id: "judge",
      complete: vi.fn().mockResolvedValue({ text, latencyMs: 10, inputTokens: 5, outputTokens: 7 }),
    });
  }

  it("parses a clean JSON verdict", async () => {
    mockJudge('{"pass": true, "score": 0.9, "reasoning": "Good."}');
    const r = await score("llm-judge", "some output", "some criteria");
    expect(r.passed).toBe(true);
    expect(r.score).toBe(0.9);
    expect(r.reasoning).toBe("Good.");
    expect(r.judgeInputTokens).toBe(5);
    expect(r.judgeOutputTokens).toBe(7);
  });

  it("extracts JSON wrapped in prose/fences", async () => {
    mockJudge('Sure, here you go:\n```json\n{"pass": false, "score": 0.2}\n```');
    const r = await score("llm-judge", "x", "y");
    expect(r.passed).toBe(false);
    expect(r.score).toBe(0.2);
  });

  it("falls back gracefully when the judge returns unparseable output", async () => {
    mockJudge("I refuse to grade this.");
    const r = await score("llm-judge", "x", "y");
    expect(r.passed).toBe(false);
    expect(r.score).toBe(0);
    expect(r.reasoning).toMatch(/unparseable/i);
  });

  it("falls back gracefully when the judge returns malformed JSON", async () => {
    mockJudge('{"pass": true, "score": }');
    const r = await score("llm-judge", "x", "y");
    expect(r.passed).toBe(false);
    expect(r.reasoning).toMatch(/invalid JSON/i);
  });

  it("clamps out-of-range scores into 0..1", async () => {
    mockJudge('{"pass": true, "score": 5}');
    const r = await score("llm-judge", "x", "y");
    expect(r.score).toBe(1);
  });
});
