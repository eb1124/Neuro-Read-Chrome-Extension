/**
 * NEURO-READS — DOM Scanner
 * 
 * Uses TreeWalker to safely find text nodes within readable elements,
 * skipping UI, code, and interactive elements.
 */

// eslint-disable-next-line no-var
var NeuroReadsDomScanner = (() => {
  'use strict';

  // Elements whose text content we want to process
  const TARGET_SELECTORS = [
    'p', 'li', 'article', 'blockquote',
    'h1', 'h2', 'h3', 'h4',
    'td', 'th', 'figcaption', 'summary', 'details'
  ];

  // Elements we must never modify
  const SKIP_TAGS = new Set([
    'CODE', 'PRE', 'NAV', 'BUTTON', 'INPUT', 'TEXTAREA',
    'SCRIPT', 'STYLE', 'SVG', 'CANVAS', 'NOSCRIPT',
    'SELECT', 'OPTION', 'LABEL', 'IFRAME', 'OBJECT'
  ]);

  /**
   * Check if an element or any of its ancestors is in the skip list.
   */
  function isInsideSkippedElement(node) {
    let current = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    while (current && current !== document.body) {
      if (SKIP_TAGS.has(current.tagName)) return true;
      // Also skip elements with contenteditable
      if (current.isContentEditable) return true;
      current = current.parentElement;
    }
    return false;
  }

  /**
   * Scan the DOM and return an array of objects:
   *   { textNode: Text, parentElement: Element, originalText: string }
   * 
   * Only returns text nodes that are direct children of target elements.
   */
  function scan(root = document.body) {
    const results = [];
    const seenTextNodes = new WeakSet();

    // Find all target elements including the root itself if it matches
    const elements = Array.from(root.querySelectorAll(TARGET_SELECTORS.join(',')));
    if (root.matches && root.matches(TARGET_SELECTORS.join(','))) {
      elements.unshift(root);
    }

    for (const element of elements) {
      if (isInsideSkippedElement(element)) continue;

      // Use TreeWalker to find text nodes within this element
      const walker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: (node) => {
            // Skip whitespace-only nodes
            if (!node.textContent.trim()) return NodeFilter.FILTER_REJECT;
            // Skip if inside a skipped child element
            if (isInsideSkippedElement(node)) return NodeFilter.FILTER_REJECT;
            // Avoid duplicate text nodes from overlapping selections
            if (seenTextNodes.has(node)) return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
          }
        }
      );

      let textNode;
      while ((textNode = walker.nextNode())) {
        seenTextNodes.add(textNode);
        results.push({
          textNode,
          parentElement: element,
          originalText: textNode.textContent
        });
      }
    }

    return results;
  }

  return {
    scan,
    TARGET_SELECTORS,
    SKIP_TAGS
  };
})();
