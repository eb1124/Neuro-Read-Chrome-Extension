/**
 * NEURO-READS — DOM Rewriter
 * 
 * Safely replaces text content of individual text nodes without
 * breaking the page's HTML structure. Supports undo (restore original).
 */

// eslint-disable-next-line no-var
var NeuroReadsDomRewriter = (() => {
  'use strict';

  // Store original text for undo — keyed by text node reference
  const originalTextMap = new WeakMap();
  const BATCH_SIZE = 10;
  const BATCH_DELAY_MS = 50;

  /**
   * Replace text in a single text node, storing the original for undo.
   */
  function replaceTextNode(textNode, newText) {
    if (!textNode || textNode.nodeType !== Node.TEXT_NODE) return;
    if (!newText || typeof newText !== 'string') return;

    // Store original if not already stored
    if (!originalTextMap.has(textNode)) {
      originalTextMap.set(textNode, textNode.textContent);
    }

    textNode.textContent = newText;
  }

  /**
   * Restore a single text node to its original content.
   */
  function restoreTextNode(textNode) {
    if (originalTextMap.has(textNode)) {
      textNode.textContent = originalTextMap.get(textNode);
      originalTextMap.delete(textNode);
    }
  }

  /**
   * Replace text in multiple nodes (array of { textNode, newText }).
   * Processes in batches to avoid blocking the UI thread.
   */
  function batchReplace(replacements) {
    return new Promise((resolve) => {
      let index = 0;

      function processBatch() {
        const end = Math.min(index + BATCH_SIZE, replacements.length);
        for (; index < end; index++) {
          const { textNode, newText } = replacements[index];
          replaceTextNode(textNode, newText);
        }

        if (index < replacements.length) {
          setTimeout(processBatch, BATCH_DELAY_MS);
        } else {
          resolve();
        }
      }

      processBatch();
    });
  }

  /**
   * Restore all text nodes that have been modified.
   * Accepts an array of { textNode } objects (same format as scanner output).
   */
  function restoreAll(scannedNodes) {
    for (const item of scannedNodes) {
      restoreTextNode(item.textNode);
    }
  }

  /**
   * Check if a text node has been modified.
   */
  function isModified(textNode) {
    return originalTextMap.has(textNode);
  }

  return {
    replaceTextNode,
    restoreTextNode,
    batchReplace,
    restoreAll,
    isModified
  };
})();
