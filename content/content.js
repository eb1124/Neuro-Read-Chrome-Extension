/**
 * NEURO-READS — Content Script (Main Entry Point)
 * 
 * Runs on every page. Reads user preferences from chrome.storage.local,
 * applies the requested features, and watches for preference changes
 * and dynamically loaded content.
 */

(() => {
  'use strict';

  // Prevent double-initialization
  if (window.__neuroReadsInitialized) return;
  window.__neuroReadsInitialized = true;

  let currentPreferences = {
    aiSimplification: false,
    openDyslexicFont: false,
    largerText: false,
    creamBackground: false
  };

  /* ── Apply Preferences ── */

  function applyPreferences(prefs) {
    console.log('[NEURO-READS] Applying preferences in content script.', prefs);

    // OpenDyslexic Font
    if (prefs.openDyslexicFont) {
      NeuroReadsStyleInjector.enableOpenDyslexicFont();
    } else {
      NeuroReadsStyleInjector.disableOpenDyslexicFont();
    }

    // Cream Background
    if (prefs.creamBackground) {
      NeuroReadsStyleInjector.enableCreamBackground();
    } else {
      NeuroReadsStyleInjector.disableCreamBackground();
    }

    // Larger Text
    if (prefs.largerText) {
      NeuroReadsStyleInjector.enableLargerText();
    } else {
      NeuroReadsStyleInjector.disableLargerText();
    }

    // AI Simplification (selection-based)
    if (prefs.aiSimplification) {
      console.log('[NEURO-READS] Enabling selection-based AI text simplification.');
      NeuroReadsSelectionSimplifier.enable();
    } else {
      console.log('[NEURO-READS] Disabling selection-based AI text simplification.');
      NeuroReadsSelectionSimplifier.disable();
    }

    currentPreferences = { ...prefs };
    console.log('[NEURO-READS] Preferences applied:', prefs);
  }

  /* ── Initialize ── */

  function init() {
    chrome.storage.local.get('preferences', (result) => {
      const prefs = result.preferences || currentPreferences;
      applyPreferences(prefs);
    });
  }

  /* ── Listen for Preference Changes ── */

  // From popup via background relay
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'APPLY_PREFERENCES') {
      applyPreferences(message.preferences);
      sendResponse({ success: true });
    }
    return true;
  });

  // From storage changes (if another tab updates preferences)
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.preferences) {
      const newPrefs = changes.preferences.newValue;
      if (newPrefs) {
        applyPreferences(newPrefs);
      }
    }
  });

  /* ── Start ── */
  init();
})();
