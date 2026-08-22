/**
 * NEURO-READS — Popup Script
 * 
 * Manages toggle states and syncs with chrome.storage.local.
 * Sends preference updates to the background service worker.
 */

(() => {
  'use strict';

  // Map toggle IDs to preference keys
  const TOGGLE_MAP = {
    'toggle-ai': 'aiSimplification',
    'toggle-font': 'openDyslexicFont',
    'toggle-text': 'largerText',
    'toggle-bg': 'creamBackground'
  };

  // Card IDs corresponding to toggles
  const CARD_MAP = {
    'toggle-ai': 'card-ai',
    'toggle-font': 'card-font',
    'toggle-text': 'card-text',
    'toggle-bg': 'card-bg'
  };

  /**
   * Load saved preferences and update toggle states.
   */
  function loadPreferences() {
    chrome.storage.local.get(['preferences', 'apiKey'], (result) => {
      const prefs = result.preferences || {};

      for (const [toggleId, prefKey] of Object.entries(TOGGLE_MAP)) {
        const toggle = document.getElementById(toggleId);
        if (toggle) {
          toggle.checked = !!prefs[prefKey];
          updateCardState(toggleId, toggle.checked);
        }
      }

      // Load API key
      const apiKeyInput = document.getElementById('api-key');
      if (apiKeyInput) {
        apiKeyInput.value = result.apiKey || '';
      }
    });
  }

  /**
   * Update the visual state of the card (active class).
   */
  function updateCardState(toggleId, isChecked) {
    const cardId = CARD_MAP[toggleId];
    const card = document.getElementById(cardId);
    if (card) {
      card.classList.toggle('active', isChecked);
    }
  }

  /**
   * Save preferences and notify the content script.
   */
  function savePreferences() {
    const prefs = {};
    for (const [toggleId, prefKey] of Object.entries(TOGGLE_MAP)) {
      const toggle = document.getElementById(toggleId);
      prefs[prefKey] = toggle ? toggle.checked : false;
    }

    // Get API key
    const apiKeyInput = document.getElementById('api-key');
    const apiKey = apiKeyInput ? apiKeyInput.value.trim() : '';

    // Save to storage
    chrome.storage.local.set({ preferences: prefs, apiKey: apiKey }, () => {
      console.log('[NEURO-READS Popup] Preferences and API key saved:', { prefs, apiKey: apiKey ? '***' : '' });
    });

    // Notify background to relay to active tab
    chrome.runtime.sendMessage({
      type: 'PREFERENCES_UPDATED',
      preferences: prefs
    }).catch(() => {
      // Background might not be ready — preferences will be picked up on next page load
    });
  }

  /**
   * Bind change listeners to all toggles and API key input.
   */
  function bindToggles() {
    for (const [toggleId] of Object.entries(TOGGLE_MAP)) {
      const toggle = document.getElementById(toggleId);
      if (toggle) {
        toggle.addEventListener('change', () => {
          updateCardState(toggleId, toggle.checked);
          savePreferences();
        });
      }
    }

    // Bind API key input
    const apiKeyInput = document.getElementById('api-key');
    if (apiKeyInput) {
      apiKeyInput.addEventListener('input', savePreferences);
    }
  }

  // Initialize
  document.addEventListener('DOMContentLoaded', () => {
    loadPreferences();
    bindToggles();
  });
})();
