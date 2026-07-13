"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Run } from "@/lib/types";

export default function RunPage() {
  const { id } = useParams<{ id: string }>();
  const [run, setRun] = useState<Run | null>(null);

  useEffect(() => {
    fetch(`/api/runs/${id}`)
      .then((r) => r.json())
      .then(setRun);
  }, [id]);

  if (!run) return <p className="muted">Loading…</p>;

  const passed = run.results.filter((r) => r.passed).length;
  const avgLatency =
    run.results.length === 0
      ? 0
      : Math.round(
          run.results.reduce((sum, r) => sum + r.latencyMs, 0) /
            run.results.length
        );

  return (
    <>
      <p className="muted">
        <Link href={`/suites/${run.suiteId}`}>← {run.suiteName}</Link>
      </p>
      <h1>Run results</h1>
      <p className="muted">
        {run.model} · {new Date(run.startedAt).toLocaleString()}
      </p>

      <div className="row" style={{ gap: 32, margin: "20px 0" }}>
        <div>
          <div className="stat">
            {passed}/{run.results.length}
          </div>
          <div className="muted">cases passed</div>
        </div>
        <div>
          <div className="stat">{Math.round(run.passRate * 100)}%</div>
          <div className="muted">pass rate</div>
        </div>
        <div>
          <div className="stat">{avgLatency}ms</div>
          <div className="muted">avg latency</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Case</th>
            <th>Result</th>
            <th>Output</th>
            <th>Latency</th>
          </tr>
        </thead>
        <tbody>
          {run.results.map((r) => (
            <tr key={r.caseId}>
              <td>
                <strong>{r.caseName}</strong>
                <div className="muted">
                  {r.scorer} · expected: {r.expected.slice(0, 80)}
                </div>
              </td>
              <td>
                <span className={`badge ${r.passed ? "pass" : "fail"}`}>
                  {r.passed ? "PASS" : "FAIL"}
                </span>
                {r.scorer === "llm-judge" && (
                  <div className="muted">score {r.score.toFixed(2)}</div>
                )}
              </td>
              <td style={{ maxWidth: 420 }}>
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
              <td>{r.latencyMs}ms</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
