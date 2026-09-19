// Quick Translate Sidebar Script
//
// 2026-09-13: Cloudflare Worker proxy removed from the translation path.
// It was added on the theory that Google blocks browser-origin requests more
// than server-to-server ones (see a_docs/CLOUDFLARE_SUMMARY.md). Weeks of
// production logs showed the opposite here: Cloudflare's shared IP got
// throttled/CAPTCHA'd more than this browser's own connection. Direct calls
// are now Tier 1; the Worker's one real feature (single-word disambiguation)
// is ported into buildGtxQuery() below. worker_for_cloudflare/worker.js is
// left deployed but unused, in case a real API-key-backed proxy is wanted later.

// Progress bar control
let progressTimer = null;

function startProgress() {
  console.log('startProgress() CALLED at:', performance.now());
  const bar = document.getElementById("progressBar");
  
  // Clear existing timer to prevent stacking
  if (progressTimer) {
    clearInterval(progressTimer);
  }
  
  let progress = 0;
  bar.style.width = "0%";
  console.log('Progress bar width set to 0%');
  
  progressTimer = setInterval(() => {
    progress += Math.random() * 10;
    if (progress > 90) progress = 90;
    bar.style.width = progress + "%";
  }, 120);
}

function finishProgress() {
  const bar = document.getElementById("progressBar");
  if (progressTimer) {
    clearInterval(progressTimer);
    progressTimer = null;
  }
  bar.style.width = "100%";
  
  setTimeout(() => {
    bar.style.width = "0%";
  }, 200);
}

// Detect if running in sidebar or tab
const urlParams = new URLSearchParams(window.location.search);
const isSidebar = !urlParams.has('mode') || urlParams.get('mode') !== 'tab';

// Set app title with version from manifest
const appVersion = browser.runtime.getManifest().version;

console.log('[TRANSLATE] Script loaded');
console.log('[TRANSLATE] Running in:', isSidebar ? 'SIDEBAR' : 'TAB');

// Typewriter effect for output textarea
let typewriterTimer = null;

// Auto-detect flag — true once user manually picks a lang button
let userPickedLang = false;

// RTL language set
const RTL_LANGS = new Set(['ar', 'he']);

// Apply text direction to output textarea
function applyDirection(el, targetLang) {
  const isRTL = RTL_LANGS.has(targetLang);
  el.dir = isRTL ? 'rtl' : 'ltr';
  el.classList.toggle('rtl', isRTL);
  el.classList.toggle('ltr', !isRTL);
}

function typewriterEffect(textarea, text) {
  if (typewriterTimer) {
    cancelAnimationFrame(typewriterTimer);
    typewriterTimer = null;
  }

  const charsPerFrame = Math.max(1, Math.floor(text.length / 400));
  textarea.value = '';
  textarea.classList.remove('stale');
  let i = 0;

  function step() {
    for (let c = 0; c < charsPerFrame && i < text.length; c++) {
      textarea.value += text[i];
      i++;
    }
    if (i % (charsPerFrame * 10) === 0) {
      autoResizeTextarea(textarea);
      const body = document.querySelector('.sidebar-body');
      body.scrollTop = body.scrollHeight;
    }
    if (i < text.length) {
      typewriterTimer = requestAnimationFrame(step);
    } else {
      typewriterTimer = null;
      autoResizeTextarea(textarea);
      const body = document.querySelector('.sidebar-body');
      body.scrollTop = body.scrollHeight;
      saveState();
    }
  }

  typewriterTimer = requestAnimationFrame(step);
}

// Auto-resize textarea based on content
function autoResizeTextarea(textarea) {
  // Reset height to 0 to get accurate scrollHeight
  textarea.style.height = '0';
  
  // Set new height based on content (add 2px buffer)
  textarea.style.height = (textarea.scrollHeight + 2) + 'px';
}

// Setup event listeners
function setupEventListeners() {
  console.log('[TRANSLATE] Setting up event listeners');
  
  // Disable form restoration for tabs only
  if (!isSidebar) {
    console.log('[TRANSLATE] Tab mode - disabling form restoration');
    document.getElementById('inputText').setAttribute('autocomplete', 'off');
    document.getElementById('outputText').setAttribute('autocomplete', 'off');
    
    // Clear any cached values
    document.getElementById('inputText').value = '';
    document.getElementById('outputText').value = '';
  }
  
  // Set button text based on sidebar or tab mode
  const clearStorageBtn = document.getElementById('clearStorageBtn');
  if (isSidebar) {
    clearStorageBtn.title = 'Clear saved translations from storage';
  } else {
    clearStorageBtn.title = 'Clear current session history';
  }
  
  const targetLang = document.getElementById('targetLang');
  const inputText = document.getElementById('inputText');
  const outputText = document.getElementById('outputText');
  
  console.log('[TRANSLATE] Elements found:', {
    clearStorageBtn: !!clearStorageBtn,
    targetLang: !!targetLang,
    inputText: !!inputText,
    outputText: !!outputText
  });
  
  if (clearStorageBtn) clearStorageBtn.addEventListener('click', clearStorage);
  
  // Setup lang buttons
  setupLangButtons();
  
  // Auto-translate on input (paste, typing, etc.) with auto-resize
  if (inputText) {
    let lastValue = "";
    let debounceTimer = null;
    let prevLength = 0;
    
    inputText.addEventListener('input', () => {
      // Auto-resize textarea first
      autoResizeTextarea(inputText);

      // Mark output as stale
      document.getElementById('outputText').classList.add('stale');
      
      const text = inputText.value.trim();
      const currentLength = inputText.value.length;
      const diff = currentLength - prevLength;
      prevLength = currentLength;
      
      if (!text) {
        // Clear timer if input is empty
        if (debounceTimer) {
          clearTimeout(debounceTimer);
          debounceTimer = null;
        }
        return;
      }
      
      // Detect instant large input (paste-like behavior)
      const isInstantLargeInput = diff > 50;
      
      if (isInstantLargeInput) {
        console.log('[TRANSLATE] Large input detected (paste-like), translating immediately');
        startProgress();
        setTimeout(() => {
          translateText();
        }, 0);
        return;
      }
      
      // Prevent duplicate triggers
      if (text === lastValue) return;
      lastValue = text;
      
      console.log('[TRANSLATE] Input detected:', text);
      
      // Clear existing timer
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      
      // Wait 1.5 seconds after user stops typing
      debounceTimer = setTimeout(() => {
        console.log('[TRANSLATE] Debounce complete, translating...');
        startProgress();
        setTimeout(() => {
          translateText();
        }, 0);
      }, 1500);
    });
    
    // Initial resize
    autoResizeTextarea(inputText);
  }
  
  // Allow Enter key in input to trigger translation (with Ctrl/Cmd)
  if (inputText) {
    inputText.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        translateText();
      }
    });
  }
  
  // Initialize translation direction display
  updateTranslationDirection();
  
  // Restore saved state
  restoreState();
  
  console.log('[TRANSLATE] Event listeners setup complete');
}

// Setup custom dropdown functionality
function setupLangButtons() {
  const hiddenInput = document.getElementById('targetLang');
  const buttons = document.querySelectorAll('.lang-btn');

  // Set initial active
  buttons.forEach(btn => {
    if (btn.getAttribute('data-value') === hiddenInput.value) {
      btn.classList.add('active');
    }
    btn.addEventListener('click', () => {
      const value = btn.getAttribute('data-value');
      hiddenInput.value = value;
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      userPickedLang = true; // user is now in full control
      updateTranslationDirection();
      // Re-translate if input has text
      if (document.getElementById('inputText').value.trim()) {
        startProgress();
        translateText();
      }
      console.log('[LANG] Language changed to:', value);
    });
  });
}


// Initialize immediately (don't wait for DOMContentLoaded)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupEventListeners);
} else {
  // DOM already loaded
  setupEventListeners();
}

// Pure auto-detect logic — no DOM writes, returns correct target value
function maybeAutoDetect(targetLang, inputText) {
  const cyrMatches = inputText.match(/[\u0400-\u04FF]/g) || [];
  const ratio = inputText.length > 0 ? cyrMatches.length / inputText.length : 0;
  if (!userPickedLang && ratio > 0.6 && targetLang === 'ru') {
    return 'en';
  }
  return targetLang;
}

// Normalize Cyrillic language detection for short texts
function normalizeCyrillicDetection(text, detectedLang) {
  const cyrMatches = text.match(/[\u0400-\u04FF]/g) || [];
  const ratio = text.length > 0 ? cyrMatches.length / text.length : 0;

  if (ratio < 0.6) return detectedLang;

  const shortText = text.trim().length < 12;
  const cyrillicLangs = ['uk','be','bg','mk','sr','kk','ky','mn','tg','tt','ba','cv','os','ce','sah','ab','av','kbd','kv','mhr','mrj','myv','mdf','udm','chm'];

  if (shortText && cyrillicLangs.includes(detectedLang.toLowerCase())) {
    console.log(`[TRANSLATE] Short Cyrillic override: ${detectedLang} → ru`);
    return 'ru';
  }

  return detectedLang;
}

// Chunk text into smaller pieces for translation
function chunkText(text, maxChars = 3500) {
  // If text is small enough, return as-is
  if (text.length <= maxChars) {
    return [text];
  }
  
  const chunks = [];
  let currentChunk = '';
  
  // Split by sentences (period + space, newline, etc.)
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  
  for (const sentence of sentences) {
    // If single sentence is too long, split by words
    if (sentence.length > maxChars) {
      const words = sentence.split(' ');
      for (const word of words) {
        if ((currentChunk + word).length > maxChars) {
          chunks.push(currentChunk.trim());
          currentChunk = word + ' ';
        } else {
          currentChunk += word + ' ';
        }
      }
    } else {
      // Add sentence to current chunk
      if ((currentChunk + sentence).length > maxChars) {
        chunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        currentChunk += sentence;
      }
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

// Build the GTX query + source-lang hint for single-word lookups.
// Ported from the old Cloudflare Worker (worker_for_cloudflare/worker.js) —
// see a_docs/single_word_fix/. Google's auto-detect often mis-guesses short
// single words, so a lone word gets an explicit hint instead of sl=auto:
//   - Cyrillic word + target 'en' → "значение слова <word>" + sl=ru
//     (disambiguation trick — Google's dictionary entry is more accurate
//     framed this way; the prefix is stripped back off the result after)
//   - Cyrillic word + other target → plain word + sl=ru
//   - Latin word (any target)      → plain word + sl=en
//   - anything else (sentences, mixed text) → unchanged, sl stays 'auto'
function buildGtxQuery(text, targetLang) {
  const trimmed = text.trim();
  const isSingleWord = /^[\p{L}]{1,30}$/u.test(trimmed);
  const hasCyrillic = /[Ѐ-ӿ]/.test(text);
  const hasLatin = /^[A-Za-z]+$/.test(trimmed);

  if (!isSingleWord) {
    return { query: text, sl: 'auto', isSingleWord: false };
  }
  if (hasCyrillic) {
    return targetLang === 'en'
      ? { query: 'значение слова ' + text, sl: 'ru', isSingleWord: true }
      : { query: text, sl: 'ru', isSingleWord: true };
  }
  if (hasLatin) {
    return { query: text, sl: 'en', isSingleWord: true };
  }
  return { query: text, sl: 'auto', isSingleWord: true };
}

// Strip the disambiguation-trick prefix back off a single-word result.
function stripSingleWordPrefix(translatedText) {
  return translatedText
    .replace(/^значение слова\s+/i, '')
    .replace(/^meaning of (the )?word\s+/i, '')
    .replace(/^meaning of /i, '')
    .trim();
}

// Show/hide progress indicator
function showProgress(current, total) {
  const progressIndicator = document.getElementById('progressIndicator');
  const progressText = document.getElementById('progressText');
  
  if (current > 0 && total > 1) {
    progressText.textContent = `translating chunk ${current} of ${total}...`;
    progressIndicator.style.display = 'block';
  } else {
    progressIndicator.style.display = 'none';
  }
}

// Translate a single chunk via direct Google endpoints (no server proxy).
//
// 2-tier fallback: direct GTX -> direct clients5. GTX gets a single-word
// disambiguation hint via buildGtxQuery() (ported from the old Cloudflare
// Worker) instead of always sl=auto. Each tier logs "[TIER:xxx]
// start/success/fail" to the console so the whole attempt is visible
// end-to-end in Firefox devtools without cross-referencing the Network tab.
// `attempts` collects one reason per failed tier so the final error (if both
// fail) is a real summary, not just the last raw message.
async function translateChunk(text, sourceLang, targetLang) {
  const attempts = []; // { tier, detail }

  // TIER 1 — direct GTX
  try {
    const t0 = performance.now();
    console.log('[TIER:gtx] start');

    const { query, sl, isSingleWord } = buildGtxQuery(text, targetLang);

    // Add dt=md for better single-word translations (main dictionary meaning)
    // Add dt=bd for alternative meanings
    const gtxUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${targetLang}&dt=t&dt=md&dt=bd&q=${encodeURIComponent(query)}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(gtxUrl, {
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const ms = Math.round(performance.now() - t0);

      if (!response.ok) {
        console.warn(`[TIER:gtx] fail (${ms}ms) — status ${response.status}`);
        attempts.push({ tier: 'gtx', detail: `status ${response.status}` });
        throw new Error(`GTX failed with status ${response.status}`);
      }

      const result = await response.json();

      // Parse GTX endpoint response
      let translatedText = '';
      if (result && result[0]) {
        for (const part of result[0]) {
          if (part[0]) {
            translatedText += part[0];
          }
        }
      }

      // Clean up the disambiguation-trick prefix, if one was added
      if (isSingleWord) {
        translatedText = stripSingleWordPrefix(translatedText);
      }

      const detectedLang = result[2] ? result[2] : 'auto';

      console.log(`[TIER:gtx] success (${ms}ms)`);
      return { translatedText, detectedLang, service: 'google gtx' };

    } catch (error) {
      clearTimeout(timeoutId);
      const ms = Math.round(performance.now() - t0);
      if (error.name === 'AbortError') {
        console.warn(`[TIER:gtx] timeout (${ms}ms) — 10s exceeded`);
        attempts.push({ tier: 'gtx', detail: 'timeout 10s' });
      }
      throw error;
    }

  } catch (gtxError) {
    if (attempts[attempts.length - 1]?.tier !== 'gtx') {
      console.warn('[TIER:gtx] fail —', gtxError.message);
      attempts.push({ tier: 'gtx', detail: gtxError.message });
    }

    // GTX failed, try clients5 as fallback
    const t0 = performance.now();
    console.log('[TIER:clients5] start');

    const clients5Url = 'https://clients5.google.com/translate_a/t';

    const body = new URLSearchParams();
    body.append("client", "dict-chrome-ex");
    body.append("sl", sourceLang);
    body.append("tl", targetLang);
    body.append("q", text);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      // redirect: "manual" — Google sometimes redirects THIS endpoint to a
      // /sorry/ verification page when it flags the caller as abuse. Letting
      // fetch follow that redirect hits www.google.com, an origin the
      // extension has no host permission for, which Firefox reports as an
      // opaque "NetworkError when attempting to fetch resource." Intercepting
      // the redirect ourselves fails fast with a clear, specific reason
      // instead of that generic message.
      const response = await fetch(clients5Url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
        },
        body: body,
        redirect: "manual",
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const ms = Math.round(performance.now() - t0);

      if (response.type === "opaqueredirect") {
        console.warn(`[TIER:clients5] blocked (${ms}ms) — redirected to Google verification page`);
        attempts.push({ tier: 'clients5', detail: 'blocked (Google verification redirect)' });
        throw new Error('blocked (Google verification redirect)');
      }

      if (!response.ok) {
        console.warn(`[TIER:clients5] fail (${ms}ms) — status ${response.status}`);
        attempts.push({ tier: 'clients5', detail: `status ${response.status}` });
        throw new Error(`clients5 failed with status ${response.status}`);
      }

      const result = await response.json();

      // Parse clients5 endpoint response
      let translatedText = '';
      if (Array.isArray(result?.[0])) {
        translatedText = result[0].map(x => x[0]).join("");
      }

      const detectedLang = 'auto';

      console.log(`[TIER:clients5] success (${ms}ms)`);
      return { translatedText, detectedLang, service: 'google clients5' };

    } catch (error) {
      clearTimeout(timeoutId);
      const ms = Math.round(performance.now() - t0);

      if (error.name === 'AbortError') {
        console.warn(`[TIER:clients5] timeout (${ms}ms) — 10s exceeded`);
        attempts.push({ tier: 'clients5', detail: 'timeout 10s' });
      } else if (attempts[attempts.length - 1]?.tier !== 'clients5') {
        console.warn(`[TIER:clients5] fail (${ms}ms) — ${error.message}`);
        attempts.push({ tier: 'clients5', detail: error.message });
      }

      const summary = attempts.map(a => `${a.tier}: ${a.detail}`).join(' · ');
      console.error('[TRANSLATE] All tiers failed —', summary);
      throw new Error(`All translation routes failed — ${summary}`);
    }
  }
}

// Translate text using Google Translate API with chunking support
async function translateText() {
  const inputText = document.getElementById('inputText').value.trim();
  const targetLangEl = document.getElementById('targetLang');
  let targetLang = targetLangEl.value;
  const outputText = document.getElementById('outputText');

  if (!inputText) {
    return;
  }

  // Pure auto-detect — no DOM reads after this point
  const detectedTarget = maybeAutoDetect(targetLang, inputText);
  if (detectedTarget !== targetLang) {
    targetLang = detectedTarget;
    targetLangEl.value = targetLang;
    document.querySelectorAll('.lang-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-value') === targetLang);
    });
    updateTranslationDirection();
    console.log('[TRANSLATE] Auto-detect: Cyrillic input → target switched to EN');
  }

  // Track start time
  const startTime = performance.now();
  
  // Always use 'auto' for language detection
  const apiSourceLang = 'auto';
  
  console.log('[TRANSLATE] Starting translation...');
  console.log('[TRANSLATE] Input text length:', inputText.length);
  console.log('[TRANSLATE] Target lang:', targetLang);
  
  try {
    // Chunk the text
    const chunks = chunkText(inputText, 3500);
    const totalChunks = chunks.length;
    
    console.log('[TRANSLATE] Text split into', totalChunks, 'chunk(s)');
    
    let fullTranslation = '';
    let detectedLang = 'auto';
    let serviceName = '';

    // Translate each chunk
    for (let i = 0; i < chunks.length; i++) {
      // Show progress for multi-chunk translations
      if (totalChunks > 1) {
        showProgress(i + 1, totalChunks);
      }
      
      console.log(`[TRANSLATE] Translating chunk ${i + 1}/${totalChunks} (${chunks[i].length} chars)`);
      
      const result = await translateChunk(chunks[i], apiSourceLang, targetLang);
      
      if (!result.translatedText) {
        throw new Error(`Chunk ${i + 1} returned empty result`);
      }
      
      fullTranslation += result.translatedText;
      
      // Use detected language and service from first chunk
      if (i === 0) {
        detectedLang = result.detectedLang;
        serviceName = result.service || 'unknown';

        // Normalize Cyrillic detection for short texts
        detectedLang = normalizeCyrillicDetection(inputText, detectedLang);
      }
    }
    
    // Calculate character count
    const charCount = inputText.length;
    
    // Hide progress indicator
    showProgress(0, 0);
    
    // Finish progress bar
    finishProgress();
    
    // Guard against empty translation
    if (!fullTranslation) {
      throw new Error("Translation returned empty result");
    }
    
    // Calculate response time
    const endTime = performance.now();
    const responseTime = Math.round(endTime - startTime);
    
    console.log('[TRANSLATE] Response time:', responseTime, 'ms');
    console.log('[TRANSLATE] Final translated text length:', fullTranslation.length);

    // Copy to clipboard immediately
    navigator.clipboard.writeText(fullTranslation).then(() => {
      console.log('[TRANSLATE] Copied to clipboard');
    }).catch(err => {
      console.warn('[TRANSLATE] Clipboard write failed:', err);
    });

    // Set text direction for RTL languages
    applyDirection(outputText, targetLang);

    // Typewriter effect
    typewriterEffect(outputText, fullTranslation);
    
    console.log('[TRANSLATE] Detected language:', detectedLang);
    console.log('[TRANSLATE] Target language:', targetLang);
    console.log('[TRANSLATE] Service used:', serviceName);
    
    // Update header with workflow status
    updateWorkflowStatus(detectedLang.toUpperCase(), targetLang.toUpperCase(), true, responseTime, serviceName, charCount, fullTranslation.length, totalChunks);

  } catch (error) {
    console.error('[TRANSLATE] Error:', error);
    
    // Hide progress indicator
    showProgress(0, 0);
    
    // Finish progress bar (even on error)
    finishProgress();
    
    // Update header to show error
    updateWorkflowStatus(null, null, false);
    
    showStatus(`Translation failed: ${error.message}`, 'error');
    outputText.value = '';
    
    // Reset output textarea height
    autoResizeTextarea(outputText);
  }
}

// Copy result to clipboard
function copyResult() {
  const outputText = document.getElementById('outputText');
  const copyBtn = document.getElementById('copyBtn');
  
  if (!outputText.value) {
    showStatus('No translation to copy', 'error');
    return;
  }
  
  // Copy to clipboard
  outputText.select();
  document.execCommand('copy');
  
  // Show feedback
  const originalText = copyBtn.textContent;
  copyBtn.textContent = 'Copied!';
  
  setTimeout(() => {
    copyBtn.textContent = originalText;
  }, 2000);
}

// Auto-copy result to clipboard (reliable Firefox method without stealing focus)
function autoCopyResult(text) {
  // Save current focus
  const activeElement = document.activeElement;
  
  const textarea = document.getElementById('outputText');
  
  textarea.select();
  textarea.setSelectionRange(0, 99999);
  
  const success = document.execCommand('copy');
  
  if (success) {
    console.log('[TRANSLATE] Copied to clipboard');
  } else {
    console.log('[TRANSLATE] Copy failed');
  }
  
  // Restore focus to the element that had it before
  if (activeElement && activeElement !== textarea) {
    activeElement.focus();
    
    if (activeElement.id === 'inputText') {
      const cursorPos = activeElement.value.length;
      activeElement.setSelectionRange(cursorPos, cursorPos);
    }
  }
}

// Build a "<icon-span> rest-of-line" header row without innerHTML. The icon
// gets its own <span style="font-style:normal"> (the header font is italic;
// the icon should stay upright) — built via createElement/textContent
// instead of a template string, so nothing passes through HTML parsing.
function setIconLine(el, icon, restOfLine) {
  const iconSpan = document.createElement('span');
  iconSpan.style.fontStyle = 'normal';
  iconSpan.textContent = icon;
  el.replaceChildren(iconSpan, document.createTextNode(restOfLine));
}

// Update translation direction display in header
function updateTranslationDirection() {
  const targetLangValue = document.getElementById('targetLang').value;
  const line1 = document.getElementById('headerLine1');
  const line2 = document.getElementById('headerLine2');
  const code = targetLangValue.split('-')[0].toLowerCase();

  // The two spaces after the arrow below are real U+00A0 (non-breaking space)
  // characters, so this renders identically to the old "&nbsp;&nbsp;" without
  // needing innerHTML/HTML-entity parsing.
  line1.textContent = `auto-detect →  ${code}`;
  line2.textContent = 'ready to translate';

  updateStorageSize();
}

// Update workflow status in header
function updateWorkflowStatus(detectedLang, targetLang, success, responseTime, serviceName, charCount, outputCharCount, totalChunks) {
  const line1 = document.getElementById('headerLine1');
  const line2 = document.getElementById('headerLine2');

  if (success && detectedLang && targetLang) {
    const formattedChars = charCount.toString();
    const responseTimeSec = (responseTime / 1000).toFixed(2) + " sec";
    const isFallback = serviceName === 'google clients5'; // gtx is primary, clients5 is the fallback
    const icon = isFallback ? '⚠' : '✓';

    setIconLine(line1, '✓', ` ${detectedLang.toLowerCase()} →  ${targetLang.toLowerCase()}`);

    // Build line2: icon · service · chars · chunks · time · size
    let infoParts = [];

    infoParts.push(serviceName || 'unknown');

    infoParts.push(`${formattedChars} / ${outputCharCount} chars`);

    if (totalChunks > 1) {
      infoParts.push(`${totalChunks} chunks`);
    }

    infoParts.push(responseTimeSec);

    // Append storage size inline
    const sizeEl = document.getElementById('storageSize');
    if (sizeEl && sizeEl.textContent && sizeEl.textContent !== '0 kb') {
      infoParts.push(sizeEl.textContent);
    }

    setIconLine(line2, icon, `  ${infoParts.join(' • ')}`);

  } else if (success === false) {
    line1.textContent = 'translation failed';
    line2.textContent = 'check connection';
  } else {
    updateTranslationDirection();
  }
  
  updateStorageSize();
}

// Update storage size display
async function updateStorageSize() {
  try {
    const sizeElement = document.getElementById('storageSize');
    if (!sizeElement) return;

    if (!isSidebar) {
      sizeElement.textContent = 'no persistent storage';
      return;
    }

    const result = await browser.storage.local.get('slateState');

    if (result.slateState) {
      const jsonString = JSON.stringify(result.slateState);
      const bytes = new Blob([jsonString]).size;

      let sizeText;
      if (bytes < 1024) {
        sizeText = `${bytes}\u00A0B`;
      } else {
        const kb = (bytes / 1024).toFixed(1);
        sizeText = `${kb}\u00A0kB`;
      }

      sizeElement.textContent = sizeText;
    } else {
      sizeElement.textContent = '0\u00A0kB';
    }
  } catch (error) {
    console.error('[STORAGE] Failed to calculate size:', error);
  }
}

// Show status message
function showStatus(message, type = 'info') {
  const statusMessage = document.getElementById('statusMessage');
  
  statusMessage.textContent = message;
  statusMessage.className = 'status-message ' + type;
  statusMessage.style.display = 'block';
  
  // Auto-hide after 3 seconds
  setTimeout(() => {
    statusMessage.style.display = 'none';
  }, 3000);
}

console.log('[TRANSLATE] Event listeners registered');

// Save state to browser storage
async function saveState() {
  // Tabs don't save state - only sidebar persists
  if (!isSidebar) {
    console.log('[STORAGE] Tab mode - state not saved');
    return;
  }
  
  try {
    const state = {
      inputText: document.getElementById('inputText').value,
      outputText: document.getElementById('outputText').value,
      targetLang: document.getElementById('targetLang').value,
      timestamp: Date.now()
    };
    
    await browser.storage.local.set({ slateState: state });
    console.log('[STORAGE] Sidebar state saved:', state);
  } catch (error) {
    console.error('[STORAGE] Failed to save state:', error);
  }
}

// Restore state from browser storage
async function restoreState() {
  // Tabs don't restore state - only sidebar persists
  if (!isSidebar) {
    console.log('[STORAGE] Tab mode - starting fresh');
    return;
  }
  
  try {
    const result = await browser.storage.local.get('slateState');
    
    if (result.slateState) {
      const state = result.slateState;
      console.log('[STORAGE] Sidebar state restored:', state);
      
      // Restore input/output text
      if (state.inputText) {
        document.getElementById('inputText').value = state.inputText;
        autoResizeTextarea(document.getElementById('inputText'));
      }
      if (state.outputText) {
        document.getElementById('outputText').value = state.outputText;
        autoResizeTextarea(document.getElementById('outputText'));
      }
      
      // Restore target language selection
      if (state.targetLang) {
        const hiddenInput = document.getElementById('targetLang');
        hiddenInput.value = state.targetLang;

        document.querySelectorAll('.lang-btn').forEach(btn => {
          btn.classList.toggle('active', btn.getAttribute('data-value') === state.targetLang);
        });
      }
      
      // Update header
      updateTranslationDirection();
    } else {
      console.log('[STORAGE] No saved state found');
    }
  } catch (error) {
    console.error('[STORAGE] Failed to restore state:', error);
  }
}

// Clear storage and reset UI
async function clearStorage() {
  try {
    // Cancel any running typewriter
    if (typewriterTimer) {
      cancelAnimationFrame(typewriterTimer);
      typewriterTimer = null;
    }
    // Reset auto-detect flag
    userPickedLang = false;
    // Only sidebar clears persistent storage
    if (isSidebar) {
      await browser.storage.local.remove('slateState');
      console.log('[STORAGE] Sidebar state cleared');
    } else {
      console.log('[STORAGE] Tab mode - clearing UI only');
    }
    
    // Reset UI to defaults (both sidebar and tabs)
    document.getElementById('inputText').value = '';
    const outputEl = document.getElementById('outputText');
    outputEl.value = '';
    outputEl.dir = 'ltr';
    outputEl.classList.remove('rtl');
    outputEl.classList.add('ltr');
    document.getElementById('targetLang').value = 'ru';
    document.querySelectorAll('.lang-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-value') === 'ru');
    });
    
    // Reset textarea heights
    autoResizeTextarea(document.getElementById('inputText'));
    autoResizeTextarea(document.getElementById('outputText'));
    
    // Update header
    updateTranslationDirection();
    
    updateStorageSize();
    
    // Show brief confirmation
    const btn = document.getElementById('clearStorageBtn');
    btn.style.opacity = '1';
    setTimeout(() => {
      btn.style.opacity = '0.6';
    }, 1500);
  } catch (error) {
    console.error('[STORAGE] Failed to clear state:', error);
  }
}
