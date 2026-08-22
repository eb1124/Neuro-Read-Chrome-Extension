/**
 * NEURO-READS — Background Service Worker
 * 
 * Sets default preferences on install and relays messages between
 * popup and content scripts.
 */

const DEFAULT_PREFERENCES = {
  aiSimplification: false,
  openDyslexicFont: false,
  largerText: false,
  creamBackground: false
};

// Set default preferences on first install
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.storage.local.set({ preferences: DEFAULT_PREFERENCES }, () => {
      console.log('[NEURO-READS] Default preferences saved.');
    });
  }
});

// Relay preference changes from popup to active tab content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[NEURO-READS SW] Background received message.', {
    type: message?.type,
    fromTabId: sender.tab?.id,
    fromUrl: sender.tab?.url
  });

  if (message.type === 'PREFERENCES_UPDATED') {
    // Forward to active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'APPLY_PREFERENCES',
          preferences: message.preferences
        }).catch(() => {
          // Content script may not be loaded yet — that's OK
        });
      }
    });
    sendResponse({ success: true });
    return true; // Keep channel open
  }

  // Handle AI simplification requests from the content script
  if (message.type === 'SIMPLIFY_TEXT') {
    console.log('[NEURO-READS SW] Handling SIMPLIFY_TEXT request from content script.');
    handleSimplifyText(message, sendResponse);
    return true; // CRITICAL: Must return true synchronously to keep channel open for async response
  }
});

/**
 * Executes the AI API call from the background context to bypass 
 * strict CSP/CORS policies on modern webpages.
 */
async function handleSimplifyText(message, sendResponse) {
  // Get API key from storage
  const storage = await chrome.storage.local.get('apiKey');
  const HF_API_KEY = storage.apiKey || '';

  if (!HF_API_KEY) {
    console.error('[NEURO-READS SW] No Hugging Face API key configured.');
    sendResponse({ success: false, error: 'No API key configured. Please set your Hugging Face API key in the extension popup.' });
    return;
  }

  // Use Hugging Face Inference Router with OpenAI-compatible chat/completions endpoint
  const HF_API_URL = 'https://router.huggingface.co/v1/chat/completions';

  try {
    console.log('[NEURO-READS SW] Calling AI API.', {
      url: HF_API_URL,
      model: 'Qwen/Qwen2.5-72B-Instruct',
      systemPromptLength: message.systemPrompt?.length || 0,
      userPromptLength: message.userPrompt?.length || 0
    });

    const response = await fetch(HF_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HF_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'Qwen/Qwen2.5-72B-Instruct',
        messages: [
          { role: 'system', content: message.systemPrompt },
          { role: 'user', content: message.userPrompt }
        ],
        max_tokens: 1024,
        temperature: 0.3,
        top_p: 0.9
      })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[NEURO-READS SW] API error (HTTP ${response.status}):`, errorBody);
      sendResponse({ success: false, error: `HTTP ${response.status}` });
      return;
    }

    const data = await response.json();
    console.log('[NEURO-READS SW] API response received.', {
      hasChoices: !!data.choices,
      isArray: Array.isArray(data)
    });

    let simplified = null;

    // OpenAI-compatible format from HF Router
    if (data.choices && data.choices.length > 0) {
      simplified = data.choices[0].message?.content?.trim() || null;
    }
    // Fallback: classic HF text generation format
    else if (Array.isArray(data) && data.length > 0 && typeof data[0].generated_text === 'string') {
      simplified = data[0].generated_text.trim();
    }

    if (simplified) {
      console.log('[NEURO-READS SW] Parsed simplified text from API response.', {
        length: simplified.length
      });
      sendResponse({ success: true, simplified });
    } else {
      console.warn('[NEURO-READS SW] Could not extract simplified text from API response.', data);
      sendResponse({ success: false, error: 'Unable to parse AI response' });
    }
  } catch (error) {
    console.error('[NEURO-READS SW] Request failed:', error);
    sendResponse({ success: false, error: error.message });
  }
}
