/**
 * NEURO-READS — Text Processor Utilities
 * 
 * Chunking, filtering, and sanitization helpers for text processing.
 */

// eslint-disable-next-line no-var
var NeuroReadsTextProcessor = (() => {
  'use strict';

  const MIN_TEXT_LENGTH = 20;       // Skip very short strings
  const MAX_CHUNK_LENGTH = 1500;    // Max characters per API call

  /**
   * Determine if text is worth sending to the AI for simplification.
   * Skips whitespace-only, very short, or already simple text.
   */
  function isWorthSimplifying(text) {
    if (!text || typeof text !== 'string') return false;
    const trimmed = text.trim();
    if (trimmed.length < MIN_TEXT_LENGTH) return false;
    // Skip if text has no spaces (probably a single word or code)
    if (!trimmed.includes(' ')) return false;
    return true;
  }

  /**
   * Split long text into chunks that fit within the API limit.
   * Tries to split on sentence boundaries.
   */
  function chunkText(text, maxLen = MAX_CHUNK_LENGTH) {
    if (text.length <= maxLen) return [text];

    const chunks = [];
    let remaining = text;

    while (remaining.length > 0) {
      if (remaining.length <= maxLen) {
        chunks.push(remaining);
        break;
      }

      // Find the last sentence boundary within the limit
      let splitIndex = -1;
      const searchArea = remaining.substring(0, maxLen);

      // Try splitting at '. ', '! ', '? '
      for (const delim of ['. ', '! ', '? ']) {
        const idx = searchArea.lastIndexOf(delim);
        if (idx > splitIndex) splitIndex = idx + delim.length;
      }

      // Fallback: split at last space
      if (splitIndex <= 0) {
        splitIndex = searchArea.lastIndexOf(' ');
      }

      // Worst case: hard split
      if (splitIndex <= 0) {
        splitIndex = maxLen;
      }

      chunks.push(remaining.substring(0, splitIndex).trim());
      remaining = remaining.substring(splitIndex).trim();
    }

    return chunks;
  }

  /**
   * Clean up AI output — remove stray markdown markers, extra whitespace.
   */
  function sanitize(text) {
    if (!text) return '';
    return text
      .replace(/^```[\s\S]*?```$/gm, '')    // Remove code blocks
      .replace(/^\*\*?|(\*\*?)$/gm, '')      // Remove bold/italic markers
      .replace(/\n{3,}/g, '\n\n')            // Collapse excessive newlines
      .trim();
  }

  return {
    isWorthSimplifying,
    chunkText,
    sanitize,
    MIN_TEXT_LENGTH,
    MAX_CHUNK_LENGTH
  };
})();
