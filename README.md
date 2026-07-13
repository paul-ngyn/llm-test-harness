# LLM Eval Harness

A lightweight evaluation harness for LLM outputs. Define test suites (prompt + expected behavior), run them against a model, and score the results with exact match, substring, regex, or an LLM-as-judge.

Built with Next.js 15 (App Router), TypeScript, and React — no database required to get started.

![screenshot placeholder](docs/screenshot.png)

## Why

Prompt changes are code changes, but most teams ship them without tests. This project is a minimal take on the eval loop: write down what "good" looks like as test cases, run them on demand, and see pass rates and latency per case.

## Features

- **Test suites** — group cases per feature/prompt, with an optional shared system prompt
- **Four scorers**
  - `exact` — output equals expected (trimmed)
  - `contains` — case-insensitive substring
  - `regex` — expected is a pattern the output must match
  - `llm-judge` — expected is grading criteria; a judge model returns pass/score/reasoning as JSON
- **Run history** — pass rate, per-case latency, judge reasoning, and raw outputs for every run
- **Pluggable model adapters** — Anthropic today; the `ModelAdapter` interface makes OpenAI or a local LM Studio/Ollama endpoint a ~30-line addition

## Quickstart

```bash
npm install
cp .env.example .env.local   # add your ANTHROPIC_API_KEY
npm run dev
```

Open http://localhost:3000. A demo suite with all three scorer types is seeded in `data/db.json` — hit **Run suite** to try it.

## Architecture

```
app/               Next.js App Router
  api/suites/      CRUD + POST /api/suites/[id]/run  (executes the suite)
  api/runs/        run history + results
  suites/[id]/     suite detail: cases, add/delete, run
  runs/[id]/       results table: pass/fail, output, latency, judge reasoning
lib/
  types.ts         Suite / TestCase / Run / CaseResult
  models.ts        ModelAdapter interface + AnthropicAdapter
  scorers.ts       exact | contains | regex | llm-judge
  runner.ts        executes a suite, aggregates pass rate, persists the run
  storage.ts       JSON-file store (swap for SQLite/Supabase in one file)
data/db.json       storage + seeded demo suite
```

Design notes:

- **Everything flows through `storage.ts`** so the JSON file can be replaced with a real database without touching routes or UI.
- **The judge is just another adapter** — `llm-judge` calls `getAdapter(JUDGE_MODEL)`, so a cheaper model grades outputs (default: Claude Haiku).
- **Runs are synchronous** for simplicity; the run route is the seam where a job queue would go for large suites.

## Roadmap

- [ ] OpenAI + local (LM Studio/Ollama) adapters, and side-by-side model comparison per suite
- [ ] CLI mode + GitHub Action for prompt regression testing in CI
- [ ] Cost tracking (token counts per run)
- [ ] Concurrency + retries in the runner


