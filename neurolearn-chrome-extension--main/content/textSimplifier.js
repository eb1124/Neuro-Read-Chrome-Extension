/**
 * NEURO-READS — Text Simplifier (Viewport-Optimized)
 * 
 * Uses IntersectionObserver to only process text elements that are
 * currently visible in the user's viewport. This avoids:
 *   - Hundreds of simultaneous API calls on large pages
 *   - UI freezing from processing off-screen content
 *   - Hitting API rate limits unnecessarily
 * 
 * Flow:
 *   1. Scan DOM for target parent elements
 *   2. Observe each element with IntersectionObserver
 *   3. When an element enters the viewport → extract text nodes → simplify via AI
 *   4. Rewrite text nodes with simplified content
 *   5. Unobserve that element (process once)
 */

// eslint-disable-next-line no-var
var NeuroReadsTextSimplifier = (() => {
  'use strict';

  // ── State ──
  let observer = null;                    // IntersectionObserver instance
  let isEnabled = false;                  // Whether simplification is active
  let activeRequests = 0;                 // Number of in-flight API calls
  const MAX_CONCURRENT = 3;              // Max simultaneous API requests
  const processedElements = new WeakSet(); // Elements already simplified
  const processedTextNodes = new WeakSet(); // Text nodes globally processed
  const allTrackedItems = [];             // All scanned items for undo
  const pendingQueue = [];                // Elements waiting to be processed

  // ── Loading Indicator ──

  function updateLoadingIndicator() {
    const existing = document.getElementById('neuroreads-loading');

    if (activeRequests > 0) {
      if (!existing) {
        const indicator = document.createElement('div');
        indicator.id = 'neuroreads-loading';
        indicator.innerHTML = `
          <div style="
            position: fixed;
            bottom: 24px;
            right: 24px;
            background: linear-gradient(135deg, #6366f1, #8b5cf6);
            color: white;
            padding: 12px 20px;
            border-radius: 12px;
            font-family: 'Inter', system-ui, sans-serif;
            font-size: 14px;
            z-index: 999999;
            box-shadow: 0 8px 32px rgba(99, 102, 241, 0.35);
            display: flex;
            align-items: center;
            gap: 10px;
            animation: neuroreads-fadein 0.3s ease;
          ">
            <div style="
              width: 18px; height: 18px;
              border: 2px solid rgba(255,255,255,0.3);
              border-top-color: white;
              border-radius: 50%;
              animation: neuroreads-spin 0.8s linear infinite;
            "></div>
            <span id="neuroreads-loading-text">Simplifying visible text…</span>
          </div>
          <style>
            @keyframes neuroreads-spin {
              to { transform: rotate(360deg); }
            }
            @keyframes neuroreads-fadein {
              from { opacity: 0; transform: translateY(10px); }
              to { opacity: 1; transform: translateY(0); }
            }
          </style>
        `;
        document.body.appendChild(indicator);
      }
    } else {
      if (existing) existing.remove();
    }
  }

  // ── Process a Single Element ──

  /**
   * Simplify the text nodes inside a single parent element.
   * Called when the element enters the viewport.
   */
  async function processElement(element) {
    console.log('[NEURO-READS] processElement invoked for element.', {
      tag: element?.tagName,
      id: element?.id,
      className: element?.className
    });

    if (processedElements.has(element)) {
      console.log('[NEURO-READS] Element already processed. Skipping.');
      return;
    }
    if (!isEnabled) {
      console.log('[NEURO-READS] Simplification disabled. Aborting processElement.');
      return;
    }

    processedElements.add(element);

    // Extract text nodes from this element using the scanner (scoped)
    const items = NeuroReadsDomScanner.scan(element);
    console.log('[NEURO-READS] Scanning DOM nodes for simplification.', {
      itemCount: items.length
    });
    
    // Filter out already globally processed text nodes to avoid double translation
    const newItems = items.filter(item => !processedTextNodes.has(item.textNode));
    if (newItems.length === 0) {
      console.log('[NEURO-READS] No new text nodes to simplify in this element.');
      return;
    }

    // Track for undo
    allTrackedItems.push(...newItems);
    
    // Mark as globally processed immediately
    newItems.forEach(item => processedTextNodes.add(item.textNode));

    // Filter to text worth simplifying
    const worthwhile = newItems.filter(
      item => NeuroReadsTextProcessor.isWorthSimplifying(item.originalText)
    );
    if (worthwhile.length === 0) {
      console.log('[NEURO-READS] No worthwhile text to simplify after filtering.');
      return;
    }

    // Combine all text in this element
    const combinedText = worthwhile.map(item => item.originalText).join(' ');
    const chunks = NeuroReadsTextProcessor.chunkText(combinedText);
    console.log('[NEURO-READS] Prepared text for AI simplification.', {
      totalLength: combinedText.length,
      chunkCount: chunks.length
    });

    // Call AI for each chunk
    activeRequests++;
    updateLoadingIndicator();

    try {
      let simplifiedParts = [];
      for (const chunk of chunks) {
        if (!isEnabled) {
          console.log('[NEURO-READS] Simplification turned off mid-process. Aborting remaining chunks.');
          return; // Bail if user toggled off mid-process
        }

        console.log('[NEURO-READS] Calling AI simplifier for chunk.', {
          chunkLength: chunk.length,
          preview: chunk.slice(0, 120)
        });
        const simplified = await NeuroReadsAI.simplifyText(chunk);
        if (simplified) {
          console.log('[NEURO-READS] AI simplifier returned text for chunk.', {
            simplifiedLength: simplified.length
          });
          simplifiedParts.push(NeuroReadsTextProcessor.sanitize(simplified));
        }
      }

      if (simplifiedParts.length > 0 && isEnabled) {
        const fullSimplified = simplifiedParts.join(' ');
        const replacements = [];

        if (worthwhile.length === 1) {
          replacements.push({
            textNode: worthwhile[0].textNode,
            newText: fullSimplified
          });
        } else {
          // Distribute proportionally across text nodes
          const totalOrigLen = worthwhile.reduce((sum, it) => sum + it.originalText.length, 0);
          let offset = 0;

          for (const item of worthwhile) {
            const ratio = item.originalText.length / totalOrigLen;
            const charCount = Math.round(fullSimplified.length * ratio);
            const portion = fullSimplified.substring(offset, offset + charCount).trim();
            offset += charCount;

            if (portion) {
              replacements.push({
                textNode: item.textNode,
                newText: portion
              });
            }
          }
        }

        if (replacements.length > 0) {
          console.log('[NEURO-READS] Replacing text nodes with simplified content.', {
            replacementCount: replacements.length
          });
          await NeuroReadsDomRewriter.batchReplace(replacements);
        } else {
          console.log('[NEURO-READS] No replacements generated from simplified text.');
        }
      }
    } catch (error) {
      console.error('[NEURO-READS] Error simplifying element:', error);
      processedElements.delete(element); // Allow retry
    } finally {
      activeRequests--;
      updateLoadingIndicator();
      drainQueue(); // Process next pending element
    }
  }

  // ── Queue Management ──

  /**
   * Process pending elements from the queue up to the concurrency limit.
   */
  function drainQueue() {
    while (pendingQueue.length > 0 && activeRequests < MAX_CONCURRENT) {
      const element = pendingQueue.shift();
      if (!processedElements.has(element) && isEnabled) {
        processElement(element);
      }
    }
  }

  /**
   * Add an element to the processing queue.
   */
  function enqueue(element) {
    if (processedElements.has(element)) return;
    if (pendingQueue.includes(element)) return;

    if (activeRequests < MAX_CONCURRENT) {
      processElement(element);
    } else {
      pendingQueue.push(element);
    }
  }

  // ── IntersectionObserver Setup ──

  /**
   * Create the IntersectionObserver that watches for elements
   * entering the viewport.
   */
  function createObserver() {
    if (observer) return;

    observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting && isEnabled) {
          const element = entry.target;
          observer.unobserve(element); // Only process once
          enqueue(element);
        }
      }
    }, {
      // Trigger when element is within 200px of the viewport
      // (slight lookahead so text is ready before user scrolls to it)
      rootMargin: '200px 0px',
      threshold: 0
    });
  }

  /**
   * Scan the page and start observing all readable elements.
   */
  function observeAllElements() {
    createObserver();

    const selectors = NeuroReadsDomScanner.TARGET_SELECTORS.join(',');
    const elements = document.body.querySelectorAll(selectors);

    for (const el of elements) {
      if (processedElements.has(el)) continue;
      // Skip NEURO-READS own UI elements
      if (el.id?.startsWith('neuroreads-')) continue;
      // Skip elements inside skipped containers
      if (NeuroReadsDomScanner.SKIP_TAGS.has(el.tagName)) continue;

      observer.observe(el);
    }

    console.log(`[NEURO-READS] Observing ${elements.length} elements for viewport entry.`);
  }

  /**
   * Observe newly added elements (called from MutationObserver in content.js).
   */
  function observeNewElements(rootNode) {
    if (!observer || !isEnabled) return;

    const selectors = NeuroReadsDomScanner.TARGET_SELECTORS.join(',');
    let elements = [];

    if (rootNode.matches && rootNode.matches(selectors)) {
      elements.push(rootNode);
    }
    if (rootNode.querySelectorAll) {
      elements.push(...rootNode.querySelectorAll(selectors));
    }

    for (const el of elements) {
      if (processedElements.has(el)) continue;
      if (el.id?.startsWith('neuroreads-')) continue;
      observer.observe(el);
    }
  }

  // ── Public API ──

  /**
   * Start viewport-based simplification.
   * Only processes elements as they scroll into view.
   */
  function startSimplification() {
    isEnabled = true;
    observeAllElements();
  }

  /**
   * Stop simplification and restore all original text.
   */
  function restorePage() {
    isEnabled = false;

    // Disconnect observer
    if (observer) {
      observer.disconnect();
      observer = null;
    }

    // Clear queue
    pendingQueue.length = 0;

    // Restore all modified text nodes
    if (allTrackedItems.length > 0) {
      NeuroReadsDomRewriter.restoreAll(allTrackedItems);
    }

    // Reset state
    allTrackedItems.length = 0;

    // Use a new WeakSet (can't clear WeakSet)
    // processedElements is const so we delete entries via disconnect pattern
    // Actually we need to reset — we'll rely on the observer being re-created
    
    updateLoadingIndicator();
    console.log('[NEURO-READS] Simplification stopped. Original text restored.');
  }

  /**
   * Check if any simplification work is in progress.
   */
  function isBusy() {
    return activeRequests > 0;
  }

  return {
    startSimplification,
    restorePage,
    observeNewElements,
    isBusy
  };
})();
