// Client-safe catalog of selectable models. No API keys or fetch calls here —
// this can be imported from client components. Actual provider logic lives in models.ts.

export type Provider = "anthropic" | "openai";

export interface ModelInfo {
  /** Canonical id, "<provider>:<model name>". Passed straight to lib/models.ts#getAdapter. */
  id: string;
  label: string;
  provider: Provider;
}

export const PROVIDER_LABELS: Record<Provider, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
};

// Model names change often — adjust these to whatever's current for your account.
export const MODEL_CATALOG: ModelInfo[] = [
  { id: "anthropic:claude-fable-5", label: "Claude Fable 5", provider: "anthropic" },
  { id: "anthropic:claude-sonnet-5", label: "Claude Sonnet 5", provider: "anthropic" },
  { id: "anthropic:claude-opus-4-8", label: "Claude Opus 4.8", provider: "anthropic" },
  { id: "anthropic:claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", provider: "anthropic" },
  { id: "openai:gpt-4.1", label: "GPT-4.1", provider: "openai" },
  { id: "openai:gpt-4o", label: "GPT-4o", provider: "openai" },
  { id: "openai:gpt-4o-mini", label: "GPT-4o Mini", provider: "openai" },
  { id: "openai:o3-mini", label: "o3-mini", provider: "openai" },
];
