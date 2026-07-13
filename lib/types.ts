export type ScorerType = "exact" | "contains" | "regex" | "llm-judge";

export interface TestCase {
  id: string;
  name: string;
  prompt: string;
  /** Expected text (exact/contains), pattern (regex), or grading criteria (llm-judge) */
  expected: string;
  scorer: ScorerType;
}

export interface Suite {
  id: string;
  name: string;
  description?: string;
  /** Anthropic model id, e.g. "claude-sonnet-5" */
  model: string;
  systemPrompt?: string;
  cases: TestCase[];
  createdAt: string;
}

export interface CaseResult {
  caseId: string;
  caseName: string;
  prompt: string;
  expected: string;
  scorer: ScorerType;
  output: string;
  passed: boolean;
  /** 0..1 */
  score: number;
  judgeReasoning?: string;
  latencyMs: number;
  error?: string;
}

export interface Run {
  id: string;
  suiteId: string;
  suiteName: string;
  model: string;
  startedAt: string;
  finishedAt?: string;
  results: CaseResult[];
  /** 0..1 */
  passRate: number;
}
