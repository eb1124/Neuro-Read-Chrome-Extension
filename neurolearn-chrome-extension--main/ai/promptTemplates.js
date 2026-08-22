/**
 * NEURO-READS — Prompt Templates
 * 
 * Contains the system prompt used for AI-powered text simplification.
 */

// eslint-disable-next-line no-var
var NeuroReadsPrompts = (() => {
  'use strict';

  const SYSTEM_PROMPT = `You are an AI assistant designed to help dyslexic readers.

Rewrite the text using these rules:

* Use short sentences (max 12-15 words each)
* Replace difficult words with simpler words
* Avoid complex grammar
* Remove nested clauses
* Preserve the original meaning
* Do NOT add any explanations, notes, or commentary
* Return ONLY the simplified text`;

  const buildUserPrompt = (text) => {
    return `Simplify the following text for a dyslexic reader:\n\n${text}`;
  };

  return {
    SYSTEM_PROMPT,
    buildUserPrompt
  };
})();
