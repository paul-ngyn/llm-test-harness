export function formatTokens(n?: number): string {
  return n == null ? "–" : n.toLocaleString();
}
