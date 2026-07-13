import { ScorerType } from "./types";
import { getAdapter } from "./models";

export interface ScoreResult {
  passed: boolean;
  /** 0..1 */
  score: number;
  reasoning?: string;
  /** Token usage for the grading call itself (llm-judge only). */
  judgeInputTokens?: number;
  judgeOutputTokens?: number;
}

export async function score(
  scorer: ScorerType,
  output: string,
  expected: string
): Promise<ScoreResult> {
  switch (scorer) {
    case "exact": {
      const passed = output.trim() === expected.trim();
      return { passed, score: passed ? 1 : 0 };
    }
    case "contains": {
      const passed = output.toLowerCase().includes(expected.toLowerCase());
      return { passed, score: passed ? 1 : 0 };
    }
    case "regex": {
      const passed = new RegExp(expected, "is").test(output);
      return { passed, score: passed ? 1 : 0 };
    }
    case "llm-judge":
      return llmJudge(output, expected);
  }
}

const JUDGE_PROMPT = (
  criteria: string,
  output: string
) => `You are grading the output of another language model against criteria.

<criteria>
${criteria}
</criteria>

<output>
${output}
</output>

Respond with ONLY a JSON object, no other text:
{"pass": true|false, "score": <0.0-1.0>, "reasoning": "<one sentence>"}`;

async function llmJudge(output: string, criteria: string): Promise<ScoreResult> {
  const judgeModel = process.env.JUDGE_MODEL || "claude-haiku-4-5-20251001";
  const judge = getAdapter(judgeModel);
  const { text, inputTokens, outputTokens } = await judge.complete(JUDGE_PROMPT(criteria, output));
  const tokens = { judgeInputTokens: inputTokens, judgeOutputTokens: outputTokens };

  // Be forgiving about judge output — models sometimes wrap JSON in prose/fences.
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    return { passed: false, score: 0, reasoning: `Judge returned unparseable output: ${text.slice(0, 200)}`, ...tokens };
  }
  try {
    const parsed = JSON.parse(match[0]) as {
      pass?: boolean;
      score?: number;
      reasoning?: string;
    };
    const scoreVal = typeof parsed.score === "number" ? Math.max(0, Math.min(1, parsed.score)) : parsed.pass ? 1 : 0;
    return {
      passed: Boolean(parsed.pass),
      score: scoreVal,
      reasoning: parsed.reasoning,
      ...tokens,
    };
  } catch {
    return { passed: false, score: 0, reasoning: `Judge returned invalid JSON: ${text.slice(0, 200)}`, ...tokens };
  }
}
