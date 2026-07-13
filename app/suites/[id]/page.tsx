"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Suite, Run, ScorerType } from "@/lib/types";

const SCORERS: { value: ScorerType; label: string; hint: string }[] = [
  { value: "exact", label: "Exact match", hint: "Output must equal expected text (trimmed)" },
  { value: "contains", label: "Contains", hint: "Output must contain expected text (case-insensitive)" },
  { value: "regex", label: "Regex", hint: "Expected is a regular expression the output must match" },
  { value: "llm-judge", label: "LLM judge", hint: "Expected is grading criteria; a judge model scores the output" },
];

export default function SuitePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [suite, setSuite] = useState<Suite | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  // new-case form
  const [caseName, setCaseName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [expected, setExpected] = useState("");
  const [scorer, setScorer] = useState<ScorerType>("contains");

  const refresh = useCallback(async () => {
    const [s, r] = await Promise.all([
      fetch(`/api/suites/${id}`).then((res) => res.json()),
      fetch(`/api/runs?suiteId=${id}`).then((res) => res.json()),
    ]);
    setSuite(s);
    setRuns(r.reverse());
  }, [id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!suite) return <p className="muted">Loading…</p>;

  async function addCase(e: React.FormEvent) {
    e.preventDefault();
    await fetch(`/api/suites/${id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        cases: [
          ...suite!.cases,
          { name: caseName, prompt, expected, scorer },
        ],
      }),
    });
    setCaseName("");
    setPrompt("");
    setExpected("");
    refresh();
  }

  async function removeCase(caseId: string) {
    await fetch(`/api/suites/${id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        cases: suite!.cases.filter((c) => c.id !== caseId),
      }),
    });
    refresh();
  }

  async function runSuite() {
    setRunning(true);
    setError("");
    const res = await fetch(`/api/suites/${id}/run`, { method: "POST" });
    const data = await res.json();
    setRunning(false);
    if (!res.ok) {
      setError(data.error ?? "Run failed");
      return;
    }
    router.push(`/runs/${data.id}`);
  }

  return (
    <>
      <div className="row spread">
        <div>
          <h1>{suite.name}</h1>
          <div className="muted">
            {suite.model}
            {suite.systemPrompt ? " · has system prompt" : ""}
          </div>
        </div>
        <button onClick={runSuite} disabled={running || suite.cases.length === 0}>
          {running ? "Running…" : `Run suite (${suite.cases.length})`}
        </button>
      </div>
      {error && <p style={{ color: "var(--red)" }}>{error}</p>}

      <h2>Test cases</h2>
      {suite.cases.map((c) => (
        <div className="card" key={c.id}>
          <div className="row spread">
            <strong>{c.name}</strong>
            <div className="row">
              <span className="muted">{c.scorer}</span>
              <button className="danger" onClick={() => removeCase(c.id)}>
                Delete
              </button>
            </div>
          </div>
          <pre className="output">{c.prompt}</pre>
          <div className="muted" style={{ marginTop: 6 }}>
            Expected: {c.expected}
          </div>
        </div>
      ))}
      {suite.cases.length === 0 && (
        <p className="muted">No cases yet — add one below.</p>
      )}

      <h2>Add case</h2>
      <form className="panel" onSubmit={addCase}>
        <label>
          Name
          <input
            value={caseName}
            onChange={(e) => setCaseName(e.target.value)}
            required
          />
        </label>
        <label>
          Prompt
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            required
          />
        </label>
        <label>
          Scorer
          <select
            value={scorer}
            onChange={(e) => setScorer(e.target.value as ScorerType)}
          >
            {SCORERS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <span className="muted">
            {SCORERS.find((s) => s.value === scorer)?.hint}
          </span>
        </label>
        <label>
          Expected
          <textarea
            value={expected}
            onChange={(e) => setExpected(e.target.value)}
            required
          />
        </label>
        <div>
          <button>Add case</button>
        </div>
      </form>

      <h2>Past runs</h2>
      {runs.map((r) => (
        <div className="card row spread" key={r.id}>
          <Link className="title" href={`/runs/${r.id}`}>
            {new Date(r.startedAt).toLocaleString()}
          </Link>
          <span className={`badge ${r.passRate === 1 ? "pass" : "fail"}`}>
            {Math.round(r.passRate * 100)}% pass
          </span>
        </div>
      ))}
      {runs.length === 0 && <p className="muted">No runs yet.</p>}
    </>
  );
}
