/**
 * Basic token utility:
 * - use response.usage fields when available (different providers use different field names)
 * - fallback to a rough estimator (word count)
 */

function estimateTokensFromText(text) {
  if (!text) return 0;
  // rough: average 1 token ~ 0.75 words -> more conservative: 1 word ≈ 1 token
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.length;
}

function parseUsage(usage, prompt, completionText) {
  // Try common usage fields seen across providers
  const tokens_in = usage?.prompt_tokens ?? usage?.input_tokens ?? usage?.input_token_count ?? null;
  const tokens_out = usage?.completion_tokens ?? usage?.output_tokens ?? usage?.output_token_count ?? null;

  return {
    tokens_in: tokens_in ?? estimateTokensFromText(prompt),
    tokens_out: tokens_out ?? estimateTokensFromText(completionText),
  };
}

module.exports = { estimateTokensFromText, parseUsage };
