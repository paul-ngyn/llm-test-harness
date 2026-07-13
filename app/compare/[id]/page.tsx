"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Comparison } from "@/lib/types";
import { formatTokens } from "@/lib/format";

export default function ComparePage() {
  const { id } = useParams<{ id: string }>();
  const [comparison, setComparison] = useState<Comparison | null>(null);

  useEffect(() => {
    fetch(`/api/compare/${id}`)
      .then((r) => r.json())
      .then(setComparison);
  }, [id]);

  if (!comparison) return <p className="muted">Loading…</p>;

  const summaries = comparison.modelResults.map((mr) => {
    const avgLatency =
      mr.results.length === 0
        ? 0
        : Math.round(
            mr.results.reduce((sum, r) => sum + r.latencyMs, 0) / mr.results.length
          );
    const passed = mr.results.filter((r) => r.passed).length;
    const totalInputTokens = mr.results.reduce(
      (sum, r) => sum + (r.inputTokens ?? 0) + (r.judgeInputTokens ?? 0),
      0
    );
    const totalOutputTokens = mr.results.reduce(
      (sum, r) => sum + (r.outputTokens ?? 0) + (r.judgeOutputTokens ?? 0),
      0
    );
    return { ...mr, avgLatency, passed, totalInputTokens, totalOutputTokens };
  });

  const bestPassRate = Math.max(...summaries.map((s) => s.passRate));
  const bestLatency = Math.min(
    ...summaries.filter((s) => s.passRate === bestPassRate).map((s) => s.avgLatency)
  );

  return (
    <>
      <p className="muted">
        <Link href="/">← Back</Link>
      </p>
      <h1>{comparison.name}</h1>
      <p className="muted">
        {comparison.cases.length} case{comparison.cases.length === 1 ? "" : "s"} ·{" "}
        {comparison.models.length} models compared ·{" "}
        {new Date(comparison.startedAt).toLocaleString()}
      </p>

      <h2>Summary</h2>
      <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
        {summaries.map((s) => {
          const isBest = s.passRate === bestPassRate && s.avgLatency === bestLatency;
          return (
            <div className="card" key={s.model} style={{ minWidth: 200, flex: "1 1 200px" }}>
              <div className="row spread">
                <strong>{s.model}</strong>
                {isBest && <span className="badge pass">BEST</span>}
              </div>
              <div className="stat">{Math.round(s.passRate * 100)}%</div>
              <div className="muted">
                {s.passed}/{s.results.length} passed · avg {s.avgLatency}ms
              </div>
              <div className="muted">
                {formatTokens(s.totalInputTokens)} in / {formatTokens(s.totalOutputTokens)} out
              </div>
            </div>
          );
        })}
      </div>

      <h2>Case-by-case</h2>
      {comparison.cases.map((c) => (
        <div className="card" key={c.id}>
          <strong>{c.name}</strong>
          <div className="muted">
            {c.scorer} · expected: {c.expected.slice(0, 100)}
          </div>
          <pre className="output">{c.prompt}</pre>
          <table style={{ marginTop: 10 }}>
            <thead>
              <tr>
                <th>Model</th>
                <th>Result</th>
                <th>Output</th>
                <th>Tokens</th>
                <th>Latency</th>
              </tr>
            </thead>
            <tbody>
              {comparison.modelResults.map((mr) => {
                const r = mr.results.find((res) => res.caseId === c.id);
                if (!r) return null;
                return (
                  <tr key={mr.model}>
                    <td>{mr.model}</td>
                    <td>
                      <span className={`badge ${r.passed ? "pass" : "fail"}`}>
                        {r.passed ? "PASS" : "FAIL"}
                      </span>
                      {c.scorer === "llm-judge" && (
                        <div className="muted">score {r.score.toFixed(2)}</div>
                      )}
                    </td>
                    <td style={{ maxWidth: 380 }}>
                      {r.error ? (
                        <span style={{ color: "var(--red)" }}>{r.error}</span>
                      ) : (
                        <pre className="output">{r.output}</pre>
                      )}
                      {r.judgeReasoning && (
                        <div className="muted" style={{ marginTop: 4 }}>
                          Judge: {r.judgeReasoning}
                        </div>
                      )}
                    </td>
                    <td>
                      {formatTokens(r.inputTokens)} in / {formatTokens(r.outputTokens)} out
                      {(r.judgeInputTokens != null || r.judgeOutputTokens != null) && (
                        <div className="muted">
                          judge: {formatTokens(r.judgeInputTokens)} / {formatTokens(r.judgeOutputTokens)}
                        </div>
                      )}
                    </td>
                    <td>{r.latencyMs}ms</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </>
  );
}
