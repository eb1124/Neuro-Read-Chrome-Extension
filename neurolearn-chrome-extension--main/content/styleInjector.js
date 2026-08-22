/**
 * NEURO-READS — Style Injector
 * 
 * Dynamically injects and removes CSS styles for:
 *   - OpenDyslexic font
 *   - Cream background
 *   - Larger text with improved spacing
 */

// eslint-disable-next-line no-var
var NeuroReadsStyleInjector = (() => {
  'use strict';

  const STYLE_ID_PREFIX = 'neuroreads-style-';
  const HTML_CLASS_PREFIX = 'neuroreads-';

  // Selectors for readable text elements
  const TEXT_SELECTORS = [
    'p', 'li', 'article', 'blockquote',
    'h1', 'h2', 'h3', 'h4',
    'td', 'th', 'figcaption', 'summary',
    'span', 'div', 'section'
  ].join(', ');

  /**
   * Inject a <style> block with a unique ID. Replaces if already exists.
   */
  function injectStyle(id, css) {
    const fullId = STYLE_ID_PREFIX + id;
    let styleEl = document.getElementById(fullId);
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = fullId;
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = css;
  }

  /**
   * Remove a previously injected style block.
   */
  function removeStyle(id) {
    const fullId = STYLE_ID_PREFIX + id;
    const styleEl = document.getElementById(fullId);
    if (styleEl) styleEl.remove();
    // Also remove the corresponding class from <html>
    document.documentElement.classList.remove(HTML_CLASS_PREFIX + id);
  }

  /* ── OpenDyslexic Font ── */

  function enableOpenDyslexicFont() {
    const fontUrl = chrome.runtime.getURL('assets/fonts/OpenDyslexic-Regular.woff2');
    const css = `
      @font-face {
        font-family: 'OpenDyslexic';
        src: url('${fontUrl}') format('woff2');
        font-weight: normal;
        font-style: normal;
        font-display: swap;
      }

      html.${HTML_CLASS_PREFIX}font ${TEXT_SELECTORS} {
        font-family: 'OpenDyslexic', 'Comic Sans MS', 'Arial', sans-serif !important;
      }
    `;
    injectStyle('font', css);
    document.documentElement.classList.add(HTML_CLASS_PREFIX + 'font');
  }

  function disableOpenDyslexicFont() {
    removeStyle('font');
  }

  /* ── Cream Background ── */

  function enableCreamBackground() {
    const css = `
      html.${HTML_CLASS_PREFIX}background,
      html.${HTML_CLASS_PREFIX}background body {
        background-color: #F2F0E9 !important;
      }

      html.${HTML_CLASS_PREFIX}background ${TEXT_SELECTORS} {
        background-color: transparent !important;
        color: #2D2D2D !important;
      }

      html.${HTML_CLASS_PREFIX}background a {
        color: #1A5276 !important;
      }
    `;
    injectStyle('background', css);
    document.documentElement.classList.add(HTML_CLASS_PREFIX + 'background');
  }

  function disableCreamBackground() {
    removeStyle('background');
  }

  /* ── Larger Text & Spacing ── */

  function enableLargerText() {
    const css = `
      /* Gentle font-size increase — adds ~5px without breaking layout */
      html.${HTML_CLASS_PREFIX}largertext p,
      html.${HTML_CLASS_PREFIX}largertext li,
      html.${HTML_CLASS_PREFIX}largertext td,
      html.${HTML_CLASS_PREFIX}largertext th,
      html.${HTML_CLASS_PREFIX}largertext blockquote,
      html.${HTML_CLASS_PREFIX}largertext figcaption,
      html.${HTML_CLASS_PREFIX}largertext summary {
        font-size: calc(1em + 5px) !important;
      }

      html.${HTML_CLASS_PREFIX}largertext h1 {
        font-size: calc(1em + 4px) !important;
      }
      html.${HTML_CLASS_PREFIX}largertext h2 {
        font-size: calc(1em + 4px) !important;
      }
      html.${HTML_CLASS_PREFIX}largertext h3 {
        font-size: calc(1em + 3px) !important;
      }
      html.${HTML_CLASS_PREFIX}largertext h4 {
        font-size: calc(1em + 3px) !important;
      }
    `;
    injectStyle('largertext', css);
    document.documentElement.classList.add(HTML_CLASS_PREFIX + 'largertext');
  }

  function disableLargerText() {
    removeStyle('largertext');
  }

  /* ── Public API ── */

  return {
    enableOpenDyslexicFont,
    disableOpenDyslexicFont,
    enableCreamBackground,
    disableCreamBackground,
    enableLargerText,
    disableLargerText
  };
})();
