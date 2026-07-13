import { randomUUID } from "crypto";
import { Suite, Run, CaseResult } from "./types";
import { getAdapter } from "./models";
import { score } from "./scorers";
import { saveRun } from "./storage";

/** Runs every case in a suite sequentially and persists the result. */
export async function runSuite(suite: Suite): Promise<Run> {
  const adapter = getAdapter(suite.model);
  const results: CaseResult[] = [];

  for (const testCase of suite.cases) {
    const base = {
      caseId: testCase.id,
      caseName: testCase.name,
      prompt: testCase.prompt,
      expected: testCase.expected,
      scorer: testCase.scorer,
    };
    try {
      const { text, latencyMs } = await adapter.complete(
        testCase.prompt,
        suite.systemPrompt
      );
      const graded = await score(testCase.scorer, text, testCase.expected);
      results.push({
        ...base,
        output: text,
        passed: graded.passed,
        score: graded.score,
        judgeReasoning: graded.reasoning,
        latencyMs,
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
