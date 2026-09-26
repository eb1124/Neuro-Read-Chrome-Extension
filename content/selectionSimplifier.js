/**
 * NEURO-READS — Selection Simplifier
 *
 * Lets the user highlight any text on a page, click a floating "Simplify"
 * button that appears next to the selection, and see the simplified
 * version rendered directly on top of that paragraph — sized and
 * positioned to match it — in a large, dyslexia-friendly font. The
 * underlying page DOM is never modified; the result is an overlay.
 */

// eslint-disable-next-line no-var
var NeuroReadsSelectionSimplifier = (() => {
  'use strict';

  const STYLE_ID = 'neuroreads-selection-style';
  const BUTTON_ID = 'neuroreads-selection-button';
  const CARD_ID = 'neuroreads-selection-card';
  const MIN_SELECTION_LENGTH = 3;

  // Block-level tags checked (nearest match wins) to find the paragraph
  // that should be covered by the simplified-text overlay.
  const CONTAINER_SELECTOR = [
    'p', 'li', 'blockquote', 'figcaption', 'summary',
    'td', 'th', 'dd', 'dt', 'caption',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'article', 'section', 'div'
  ].join(',');

  let enabled = false;
  let pendingText = '';
  let pendingContainer = null;
  let activeContainer = null; // container currently covered by the loading/result/error card

  /* ── Styles ── */

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const fontUrl = chrome.runtime.getURL('assets/fonts/OpenDyslexic-Regular.woff2');

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      @font-face {
        font-family: 'OpenDyslexic';
        src: url('${fontUrl}') format('woff2');
        font-weight: normal;
        font-style: normal;
        font-display: swap;
      }

      #${BUTTON_ID} {
        position: fixed;
        z-index: 2147483647;
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 7px 14px;
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
        color: #fff;
        border: none;
        border-radius: 999px;
        font-family: 'Inter', system-ui, sans-serif;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        box-shadow: 0 6px 20px rgba(99, 102, 241, 0.4);
        animation: neuroreads-pop-in 0.12s ease-out;
      }
      #${BUTTON_ID}:hover { filter: brightness(1.08); }

      #${CARD_ID} {
        position: fixed;
        z-index: 2147483647;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        background: #FDFBF5;
        color: #1f1f1f;
        border-radius: 10px;
        border: 2px solid #6366f1;
        box-shadow: 0 12px 40px rgba(0,0,0,0.3);
        font-family: 'Inter', system-ui, sans-serif;
        overflow: hidden;
        animation: neuroreads-pop-in 0.15s ease-out;
      }
      #${CARD_ID} .neuroreads-card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 14px;
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
        color: #fff;
        font-family: 'Inter', system-ui, sans-serif;
        font-size: 13px;
        font-weight: 700;
        flex-shrink: 0;
      }
      #${CARD_ID} .neuroreads-card-close {
        background: none;
        border: none;
        color: #fff;
        font-size: 20px;
        line-height: 1;
        cursor: pointer;
        padding: 2px 6px;
        opacity: 0.85;
      }
      #${CARD_ID} .neuroreads-card-close:hover { opacity: 1; }
      #${CARD_ID} .neuroreads-card-body {
        padding: 18px 20px;
        overflow-y: auto;
        white-space: pre-wrap;
        font-family: 'OpenDyslexic', 'Comic Sans MS', Arial, sans-serif;
        font-size: 19px;
        line-height: 1.7;
        letter-spacing: 0.3px;
        color: #1f1f1f;
      }
      #${CARD_ID} .neuroreads-card-body.neuroreads-error {
        color: #b91c1c;
        font-family: 'Inter', system-ui, sans-serif;
        font-size: 16px;
      }
      #${CARD_ID} .neuroreads-card-loading {
        display: flex;
        align-items: center;
        gap: 12px;
        color: #444;
        font-family: 'Inter', system-ui, sans-serif;
        font-size: 16px;
      }
      #${CARD_ID} .neuroreads-spinner-lg {
        width: 18px; height: 18px;
        border: 3px solid rgba(99,102,241,0.25);
        border-top-color: #6366f1;
        border-radius: 50%;
        animation: neuroreads-spin 0.7s linear infinite;
        flex-shrink: 0;
      }

      @keyframes neuroreads-spin { to { transform: rotate(360deg); } }
      @keyframes neuroreads-pop-in {
        from { opacity: 0; transform: scale(0.98); }
        to { opacity: 1; transform: scale(1); }
      }
    `;
    document.head.appendChild(style);
  }

  function removeStyles() {
    document.getElementById(STYLE_ID)?.remove();
  }

  /* ── Helpers ── */

  function isOwnElement(node) {
    if (!node) return false;
    const el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    return !!el?.closest(`#${BUTTON_ID}, #${CARD_ID}`);
  }

  function clampToViewport(left, top, width, height) {
    const margin = 8;
    const maxLeft = window.innerWidth - width - margin;
    const maxTop = window.innerHeight - height - margin;
    return {
      left: Math.min(Math.max(left, margin), Math.max(maxLeft, margin)),
      top: Math.min(Math.max(top, margin), Math.max(maxTop, margin))
    };
  }

  /**
   * Find the nearest block-level ancestor of a selection node — this is
   * the paragraph (or list item, cell, heading, etc.) that the simplified
   * overlay should visually replace.
   */
  function getBlockContainer(node) {
    if (!node) return null;
    const el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    return el?.closest(CONTAINER_SELECTOR) || el;
  }

  /* ── Floating Button ── */

  function removeButton() {
    document.getElementById(BUTTON_ID)?.remove();
  }

  function showButton(rect) {
    removeButton();

    const button = document.createElement('button');
    button.id = BUTTON_ID;
    button.type = 'button';
    button.innerHTML = `✨ Simplify`;

    const { left, top } = clampToViewport(rect.left, rect.bottom + 8, 110, 36);
    button.style.left = `${left}px`;
    button.style.top = `${top}px`;

    button.addEventListener('mousedown', (e) => {
      // Prevent the click from collapsing the current text selection.
      e.preventDefault();
    });
    button.addEventListener('click', onSimplifyClick);

    document.body.appendChild(button);
  }

  /* ── Overlay Card (covers the source paragraph) ── */

  function removeCard() {
    document.getElementById(CARD_ID)?.remove();
    activeContainer = null;
  }

  /**
   * Size and position the card to exactly cover its target container
   * element (the paragraph being simplified).
   */
  function positionCardOverContainer(card, container) {
    const rect = container.getBoundingClientRect();
    const { left, top } = clampToViewport(rect.left, rect.top, rect.width, rect.height);

    card.style.left = `${left}px`;
    card.style.top = `${top}px`;
    card.style.width = `${Math.min(rect.width, window.innerWidth - 16)}px`;
    card.style.minHeight = `${rect.height}px`;
    card.style.maxHeight = `${window.innerHeight - top - 8}px`;
  }

  function buildCardShell(container, headerHTML, bodyHTML) {
    removeCard();

    const card = document.createElement('div');
    card.id = CARD_ID;
    card.innerHTML = `
      <div class="neuroreads-card-header">
        ${headerHTML}
        <button class="neuroreads-card-close" type="button" aria-label="Close">×</button>
      </div>
      ${bodyHTML}
    `;
    card.querySelector('.neuroreads-card-close').addEventListener('click', removeCard);

    document.body.appendChild(card);
    activeContainer = container;
    positionCardOverContainer(card, container);
    return card;
  }

  function showLoadingCard(container) {
    removeButton();
    buildCardShell(
      container,
      `<span>✨ Simplifying…</span>`,
      `<div class="neuroreads-card-body neuroreads-card-loading">
         <div class="neuroreads-spinner-lg"></div>
         <span>Talking to AI…</span>
       </div>`
    );
  }

  function showResultCard(container, text) {
    const card = buildCardShell(
      container,
      `<span>✨ Simplified</span>`,
      `<div class="neuroreads-card-body"></div>`
    );
    card.querySelector('.neuroreads-card-body').textContent = text;
  }

  function showErrorCard(container, message) {
    const card = buildCardShell(
      container,
      `<span>⚠️ Couldn't simplify</span>`,
      `<div class="neuroreads-card-body neuroreads-error"></div>`
    );
    card.querySelector('.neuroreads-card-body').textContent = message;
  }

  /* ── Simplify Flow ── */

  async function onSimplifyClick() {
    const text = pendingText;
    const container = pendingContainer;
    if (!text || !container) return;

    showLoadingCard(container);

    try {
      const chunks = NeuroReadsTextProcessor.chunkText(text);
      const parts = [];

      for (const chunk of chunks) {
        const simplified = await NeuroReadsAI.simplifyText(chunk);
        if (!simplified) {
          showErrorCard(container, 'No response from the AI. Check your Hugging Face API key in the extension popup.');
          return;
        }
        parts.push(NeuroReadsTextProcessor.sanitize(simplified));
      }

      showResultCard(container, parts.join(' '));
    } catch (error) {
      console.error('[NEURO-READS] Selection simplification failed:', error);
      const isContextInvalidated = /context invalidated/i.test(error?.message || '');
      showErrorCard(
        container,
        isContextInvalidated
          ? 'The extension was updated or reloaded. Please refresh this page and try again.'
          : `Something went wrong: ${error?.message || 'unknown error'}`
      );
    }
  }

  /* ── Selection Handling ── */

  function handleSelectionChange(e) {
    // Ignore mouseup/keyup events that originate from our own floating
    // button or card — otherwise clicking "Simplify" re-renders (and thus
    // removes) the button mid-click, which cancels the click event entirely.
    if (e && isOwnElement(e.target)) return;

    const selection = window.getSelection();

    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      removeButton();
      return;
    }

    const anchorNode = selection.anchorNode;
    if (isOwnElement(anchorNode)) return;

    const text = selection.toString().trim();
    if (text.length < MIN_SELECTION_LENGTH) {
      removeButton();
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      removeButton();
      return;
    }

    pendingText = text;
    pendingContainer = getBlockContainer(range.commonAncestorContainer);

    showButton(rect);
  }

  function handleOutsideMouseDown(e) {
    if (isOwnElement(e.target)) return;
    removeCard();
    // The button is intentionally left alone here — a genuine new selection
    // (or its collapse) is handled by the subsequent selectionchange/mouseup.
  }

  function handleScrollOrResize() {
    removeButton();

    // Keep the overlay glued to its paragraph instead of just closing it,
    // so scrolling while reading the simplified text doesn't lose it.
    const card = document.getElementById(CARD_ID);
    if (card && activeContainer) {
      positionCardOverContainer(card, activeContainer);
    }
  }

  /* ── Public API ── */

  function enable() {
    if (enabled) return;
    enabled = true;

    injectStyles();
    document.addEventListener('mouseup', handleSelectionChange);
    document.addEventListener('keyup', handleSelectionChange);
    document.addEventListener('mousedown', handleOutsideMouseDown, true);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
  }

  function disable() {
    if (!enabled) return;
    enabled = false;

    document.removeEventListener('mouseup', handleSelectionChange);
    document.removeEventListener('keyup', handleSelectionChange);
    document.removeEventListener('mousedown', handleOutsideMouseDown, true);
    window.removeEventListener('scroll', handleScrollOrResize, true);
    window.removeEventListener('resize', handleScrollOrResize);

    removeButton();
    removeCard();
    removeStyles();
  }

  return {
    enable,
    disable
  };
})();
