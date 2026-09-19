# Translation Workflow — Actual State (v1.3.0)

## 1. Trigger

Four ways translation starts:

- **Paste** — input diff > 50 chars → translates immediately (`setTimeout 0`)
- **Typing** — debounce 1500ms after last keystroke → translates
- **Lang button click** — if input has text → translates immediately to new target
- **Ctrl+Enter** — translates immediately

On any input event → output textarea gets `.stale` class (text fades to grey).

---

## 2. Auto-detect (fresh/clear state only)

A flag `userPickedLang` tracks whether the user has manually clicked a lang button.

**Flow inside `translateText()`:**

```
DOM read → maybeAutoDetect() → targetLang variable → (optional) UI sync → API call
```

- `targetLangEl.value` read once into `targetLang`
- `maybeAutoDetect(targetLang, inputText)` called — pure function, no DOM access
  - calculates Cyrillic character ratio in input text
  - if `!userPickedLang` + ratio > 60% + target is `ru` → returns `'en'`
  - otherwise → returns `targetLang` unchanged
- if returned value differs → UI synced (button highlight, hidden input, header)
- from this point `targetLang` variable is the only source of truth — DOM never read again

**`userPickedLang` flag:**
- `false` on fresh start or after ✕ clear
- set to `true` when user clicks any lang button
- while `false` → auto-detect is active
- while `true` → auto-detect skipped, user is in full control

**Edge cases (intentional):**
- Cyrillic input + target already `en` → no change
- Cyrillic input + target `es`, `fr`, etc. → no change
- Mixed text (e.g. English with a few Russian words) → Cyrillic ratio low → no change
- Auto-detect only fires for predominantly Cyrillic text (>60%) with default `ru` target

---

## 3. Translation

- Text split into chunks (max 3500 chars)
- Each chunk sent to **Cloudflare Worker** via POST with daily rotating token (`X-Token` header)
- Worker timeout 8s → fallback to direct **GTX** endpoint
- GTX fails → fallback to **clients5** endpoint
- All chunk results joined into one string

---

## 4. After translation

- Full result copied to clipboard immediately via `navigator.clipboard`
- **Typewriter animation** starts on output textarea (`requestAnimationFrame`)
- Header updated: `detected → target • service vX.X.X • chars in / chars out • time`
- `saveState()` called only after typewriter finishes (output is complete before saving)

---

## 5. State management

- **Fresh open / Firefox restart** → `restoreState()` loads last saved `inputText`, `outputText`, `targetLang` from `browser.storage.local`
- **✕ button** → clears storage, resets all UI, target lang resets to `ru`, `userPickedLang` resets to `false`
- **Lang button click** → updates `targetLang`, sets `userPickedLang = true`, re-translates if input has text

---

## History of fixes

### Auto-swap removed (was broken)
`shouldAutoSwap()`, `containsCyrillic()`, `cyrillicRatio()` removed entirely. The old logic overrode user's chosen target based on script detection — caused EN text with `ru` target to translate EN→EN instead of EN→RU.

### Auto-detect v1 (had timing bug)
Inline block inside `translateText()` updated the DOM but `targetLang` variable was already captured before the block ran — stale value used for API call, RU→RU result.

### Auto-detect v2 — Cyrillic ratio bug
`maybeAutoDetect` used a simple presence check (`/[\u0400-\u04FF]/.test()`). Mixed texts like English with embedded Russian names (e.g. "Chekhov... Антон Павлович Чехов") triggered auto-detect incorrectly — ~3% Cyrillic was enough to fire it.

### Auto-detect v3 (current, correct)
Replaced presence check with ratio calculation. Auto-detect only fires when Cyrillic characters exceed 60% of total input length — same threshold already used in `normalizeCyrillicDetection`. Pure Russian text (~95% Cyrillic) triggers it, mixed texts don't.
