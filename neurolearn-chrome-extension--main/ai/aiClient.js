/**
 * NEURO-READS — AI Client
 * 
 * Handles communication with the background service worker
 * for text simplification (to safely bypass CORS on target pages).
 */

// eslint-disable-next-line no-var
var NeuroReadsAI = (() => {
  'use strict';

  /**
   * Send text to the background script for AI simplification.
   * @param {string} text — The text to simplify.
   * @returns {Promise<string|null>} — The simplified text, or null on failure.
   */
  async function simplifyText(text) {
    return new Promise((resolve) => {
      console.log('[NEURO-READS AI] Sending text to background for simplification.', {
        length: text?.length || 0,
        preview: (text || '').slice(0, 120)
      });

      chrome.runtime.sendMessage({
        type: 'SIMPLIFY_TEXT',
        systemPrompt: NeuroReadsPrompts.SYSTEM_PROMPT,
        userPrompt: NeuroReadsPrompts.buildUserPrompt(text)
      }, (response) => {
        // Handle extension framework errors (e.g. background worker inactive)
        if (chrome.runtime.lastError) {
          console.error('[NEURO-READS AI] Extension message failed:', chrome.runtime.lastError.message);
          resolve(null);
          return;
        }
        
        // Handle API/logic errors returned from the background worker
        if (!response || !response.success) {
          console.error('[NEURO-READS AI] Simplification failed:', response?.error || 'Unknown error');
          console.debug('[NEURO-READS AI] Raw response payload:', response);
          resolve(null);
          return;
        }

        console.log('[NEURO-READS AI] Received simplified text from background.', {
          length: response.simplified?.length || 0,
          preview: (response.simplified || '').slice(0, 120)
        });

        resolve(response.simplified);
      });
    });
  }

  return {
    simplifyText
  };
})();
