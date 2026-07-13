"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Suite } from "@/lib/types";

export default function Home() {
  const [suites, setSuites] = useState<Suite[]>([]);
  const [name, setName] = useState("");
  const [model, setModel] = useState("claude-sonnet-5");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = () =>
    fetch("/api/suites")
      .then((r) => r.json())
      .then(setSuites);

  useEffect(() => {
    refresh();
  }, []);

  async function createSuite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    await fetch("/api/suites", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, model, systemPrompt }),
    });
    setName("");
    setSystemPrompt("");
    setBusy(false);
    refresh();
  }

  return (
    <>
      <h1>Test Suites</h1>
      <p className="muted">
        Define prompts with expected behavior, run them against a model, and
        score the outputs.
      </p>

      {suites.map((s) => (
        <div className="card row spread" key={s.id}>
          <div>
            <Link className="title" href={`/suites/${s.id}`}>
              {s.name}
            </Link>
            <div className="muted">
              {s.model} · {s.cases.length} case{s.cases.length === 1 ? "" : "s"}
            </div>
          </div>
        </div>
      ))}
      {suites.length === 0 && (
        <p className="muted">No suites yet — create one below.</p>
      )}

      <h2>New suite</h2>
      <form className="panel" onSubmit={createSuite}>
        <label>
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Customer support tone checks"
            required
          />
        </label>
        <label>
          Model
        <select value={model} onChange={(e) => setModel(e.target.value)}>
        <option value="claude-fable-5">Claude Fable 5</option>
        <option value="claude-sonnet-5">Claude Sonnet 5</option>
        <option value="claude-opus-4-8">Claude Opus 4.8</option>
        <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5</option>
        </select>
        </label>
        <label>
          System prompt (optional)
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder="Sent with every test case"
          />
        </label>
        <div>
          <button disabled={busy}>Create suite</button>
        </div>
      </form>
    </>
  );
}
