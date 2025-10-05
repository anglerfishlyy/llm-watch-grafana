/**
 * @fileoverview Simple token estimation utility
 * @module tokenUtils
 */

/**
 * Estimate token count for text
 * This is a simple approximation based on word count.
 * For production use, consider using a proper tokenizer like tiktoken.
 * 
 * @param {string} text - Text to estimate tokens for
 * @returns {number} Estimated token count
 * 
 * @example
 * calculateTokens('Hello world') // returns ~3
 * calculateTokens('') // returns 0
 */
export function calculateTokens(text) {
  if (!text || typeof text !== 'string') return 0;
  
  // Simple heuristic: ~1.3 tokens per word on average for English
  const words = text.trim().split(/\s+/).filter(w => w.length > 0);
  return Math.ceil(words.length * 1.3);
}
