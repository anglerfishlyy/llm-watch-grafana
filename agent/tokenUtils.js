// Simple token estimator (for fallback when usage not provided)
export function calculateTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.split(/\s+/).length * 1.3);
}
