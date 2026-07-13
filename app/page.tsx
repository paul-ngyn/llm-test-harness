"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suite } from "@/lib/types";
import { MODEL_CATALOG, PROVIDER_LABELS, Provider } from "@/lib/modelCatalog";

interface TemplateSummary {
  id: string;
  name: string;
  description: string;
  caseCount: number;
}

const PROVIDERS = Array.from(new Set(MODEL_CATALOG.map((m) => m.provider))) as Provider[];

function ModelSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {PROVIDERS.map((provider) => (
        <optgroup key={provider} label={PROVIDER_LABELS[provider]}>
          {MODEL_CATALOG.filter((m) => m.provider === provider).map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

export default function Home() {
  const router = useRouter();
  const [suites, setSuites] = useState<Suite[]>([]);
  const [name, setName] = useState("");
  const [model, setModel] = useState(MODEL_CATALOG[0].id);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [busy, setBusy] = useState(false);

  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [templateModel, setTemplateModel] = useState<Record<string, string>>({});
  const [importingId, setImportingId] = useState<string | null>(null);
  const [importError, setImportError] = useState("");

  const [compareSelections, setCompareSelections] = useState<Record<string, string[]>>({});
  const [comparingId, setComparingId] = useState<string | null>(null);
  const [compareError, setCompareError] = useState("");

  const refresh = () =>
    fetch("/api/suites")
      .then((r) => r.json())
      .then(setSuites);

  useEffect(() => {
    refresh();
    fetch("/api/suites/templates")
      .then((r) => r.json())
      .then(setTemplates);
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

  async function importTemplate(templateId: string) {
    setImportingId(templateId);
    setImportError("");
    const res = await fetch("/api/suites/templates", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        templateId,
        model: templateModel[templateId] || MODEL_CATALOG[0].id,
      }),
    });
    const data = await res.json();
    setImportingId(null);
    if (!res.ok) {
      setImportError(data.error ?? "Import failed");
      return;
    }
    router.push(`/suites/${data.id}`);
  }

  function toggleCompareModel(templateId: string, modelId: string, checked: boolean) {
    setCompareSelections((prev) => {
      const current = prev[templateId] ?? [];
      const next = checked ? [...current, modelId] : current.filter((m) => m !== modelId);
      return { ...prev, [templateId]: next };
    });
  }

  async function compareTemplate(templateId: string) {
    setComparingId(templateId);
    setCompareError("");
    const res = await fetch("/api/compare", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        templateId,
        models: compareSelections[templateId] ?? [],
      }),
    });
    const data = await res.json();
    setComparingId(null);
    if (!res.ok) {
      setCompareError(data.error ?? "Comparison failed");
      return;
    }
    router.push(`/compare/${data.id}`);
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
        <p className="muted">No suites yet — create one below, or import a premade suite.</p>
      )}

      <h2>Premade suites</h2>
      <p className="muted">
        Import a ready-made suite for any model in the catalog — a fast way to
        smoke-test a new model or provider without writing cases by hand.
      </p>
      {importError && <p style={{ color: "var(--red)" }}>{importError}</p>}
      {compareError && <p style={{ color: "var(--red)" }}>{compareError}</p>}
      {templates.map((t) => {
        const selected = compareSelections[t.id] ?? [];
        return (
          <div className="card" key={t.id}>
            <div className="row spread">
              <div>
                <strong>{t.name}</strong>
                <div className="muted">
                  {t.description} · {t.caseCount} case{t.caseCount === 1 ? "" : "s"}
                </div>
              </div>
              <div className="row">
                <ModelSelect
                  value={templateModel[t.id] || MODEL_CATALOG[0].id}
                  onChange={(v) => setTemplateModel((prev) => ({ ...prev, [t.id]: v }))}
                />
                <button
                  onClick={() => importTemplate(t.id)}
                  disabled={importingId === t.id}
                >
                  {importingId === t.id ? "Importing…" : "Import"}
                </button>
              </div>
            </div>

            <div
              style={{
                marginTop: 12,
                paddingTop: 12,
                borderTop: "1px solid var(--border)",
              }}
            >
              <div className="muted" style={{ marginBottom: 6 }}>
                Run side by side and compare:
              </div>
              <div className="check-list">
                {MODEL_CATALOG.map((m) => (
                  <label key={m.id}>
                    <input
                      type="checkbox"
                      checked={selected.includes(m.id)}
                      onChange={(e) => toggleCompareModel(t.id, m.id, e.target.checked)}
                    />
                    {m.label}
                  </label>
                ))}
              </div>
              <button
                className="secondary"
                style={{ marginTop: 10 }}
                onClick={() => compareTemplate(t.id)}
                disabled={selected.length < 2 || comparingId === t.id}
              >
                {comparingId === t.id
                  ? "Running…"
                  : `Compare selected (${selected.length})`}
              </button>
            </div>
          </div>
        );
      })}

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
          <ModelSelect value={model} onChange={setModel} />
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
