// Client-safe catalog of selectable models. No API keys or fetch calls here —
// this can be imported from client components. Actual provider logic lives in models.ts.

export type Provider = "anthropic" | "gemini" | "openai" | "lmstudio" | "metaspark";

export interface ModelInfo {
  /** Canonical id, "<provider>:<model name>". Passed straight to lib/models.ts#getAdapter. */
  id: string;
  label: string;
  provider: Provider;
}

export const PROVIDER_LABELS: Record<Provider, string> = {
  anthropic: "Anthropic",
  gemini: "Google Gemini",
  openai: "OpenAI",
  lmstudio: "LM Studio (local)",
  metaspark: "Meta Spark (custom endpoint)",
};

// Model names change often — adjust these to whatever's current for your account.
// LM Studio ids must match the model loaded in its local server (LM Studio's
// Developer/Local Server tab, or `curl http://localhost:1234/v1/models`) —
// edit/add entries below to match what you have loaded.
export const MODEL_CATALOG: ModelInfo[] = [
  { id: "anthropic:claude-fable-5", label: "Claude Fable 5", provider: "anthropic" },
  { id: "anthropic:claude-sonnet-5", label: "Claude Sonnet 5", provider: "anthropic" },
  { id: "anthropic:claude-opus-4-8", label: "Claude Opus 4.8", provider: "anthropic" },
  { id: "anthropic:claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", provider: "anthropic" },
  { id: "openai:gpt-4.1", label: "GPT-4.1", provider: "openai" },
  { id: "openai:gpt-4o", label: "GPT-4o", provider: "openai" },
  { id: "openai:gpt-4o-mini", label: "GPT-4o Mini", provider: "openai" },
  { id: "openai:o3-mini", label: "o3-mini", provider: "openai" },
  { id: "gemini:gemini-2.5-pro", label: "Gemini 2.5 Pro", provider: "gemini" },
  { id: "gemini:gemini-2.5-flash", label: "Gemini 2.5 Flash", provider: "gemini" },
  { id: "lmstudio:qwen3-4b-toolcalling-codex", label: "Qwen3 4B Toolcalling Codex (LM Studio)", provider: "lmstudio" },
  { id: "metaspark:muse-spark-1.1", label: "Meta Spark 1.1", provider: "metaspark" },
];
