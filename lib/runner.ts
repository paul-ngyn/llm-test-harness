import { randomUUID } from "crypto";
import { Suite, Run, CaseResult, TestCase, Comparison } from "./types";
import { getAdapter } from "./models";
import { score } from "./scorers";
import { saveRun, saveComparison } from "./storage";

/** Runs a fixed case set against a single model. Shared by runSuite and runComparison. */
async function runCases(
  model: string,
  systemPrompt: string | undefined,
  cases: TestCase[]
): Promise<{ results: CaseResult[]; passRate: number }> {
  const adapter = getAdapter(model);
  const results: CaseResult[] = [];

  for (const testCase of cases) {
    const base = {
      caseId: testCase.id,
      caseName: testCase.name,
      prompt: testCase.prompt,
      expected: testCase.expected,
      scorer: testCase.scorer,
    };
    try {
      const { text, latencyMs, inputTokens, outputTokens } = await adapter.complete(
        testCase.prompt,
        systemPrompt
      );
      const graded = await score(testCase.scorer, text, testCase.expected);
      results.push({
        ...base,
        output: text,
        passed: graded.passed,
        score: graded.score,
        judgeReasoning: graded.reasoning,
        latencyMs,
        inputTokens,
        outputTokens,
        judgeInputTokens: graded.judgeInputTokens,
        judgeOutputTokens: graded.judgeOutputTokens,
      });
    } catch (err) {
      results.push({
        ...base,
        output: "",
        passed: false,
        score: 0,
        latencyMs: 0,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const passRate =
    results.length === 0
      ? 0
      : results.filter((r) => r.passed).length / results.length;

  return { results, passRate };
}

/** Runs every case in a suite sequentially and persists the result. */
export async function runSuite(suite: Suite): Promise<Run> {
  const { results, passRate } = await runCases(
    suite.model,
    suite.systemPrompt,
    suite.cases
  );

  const run: Run = {
    id: randomUUID(),
    suiteId: suite.id,
    suiteName: suite.name,
    model: suite.model,
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    results,
    passRate,
  };

  return saveRun(run);
}

/**
 * Runs the same case set against multiple models in parallel and persists
 * the side-by-side result for later comparison.
 */
export async function runComparison(
  name: string,
  systemPrompt: string | undefined,
  cases: TestCase[],
  models: string[]
): Promise<Comparison> {
  const startedAt = new Date().toISOString();

  const modelResults = await Promise.all(
    models.map(async (model) => {
      const { results, passRate } = await runCases(model, systemPrompt, cases);
      return { model, results, passRate };
    })
  );

  const comparison: Comparison = {
    id: randomUUID(),
    name,
    systemPrompt,
    cases,
    models,
    modelResults,
    startedAt,
    finishedAt: new Date().toISOString(),
  };

  return saveComparison(comparison);
}
