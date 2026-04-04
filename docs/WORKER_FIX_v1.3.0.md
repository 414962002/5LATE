# Worker Fix v1.3.0 — Single Word Translation Bug

## Problem

Single Cyrillic words translated to non-EN/RU languages returned a full phrase instead of the word.

**Example:**
- Input: `привет` → target: `es`
- Expected: `hola`
- Actual: `significado de la palabra hola`

## Root Cause

The worker prepended `"значение слова "` (Russian: "meaning of word") to all single Cyrillic words before sending to Google Translate. This context trick helps Google return the correct dictionary meaning when translating to English — but for other target languages, Google translated the prefix too, producing garbage output.

## Fix

The context trick is now only applied when `targetLang === "en"`.
For all other targets, the plain word is sent with `sourceLang = "ru"`.

```js
if (isSingleWord && hasCyrillic) {
  if (targetLang === "en") {
    query = "значение слова " + text; // context trick — EN only
    sourceLang = "ru";
  } else {
    query = text; // plain word for all other targets
    sourceLang = "ru";
  }
}
```

## Result

- `привет` → `es` → `hola` ✓
- `привет` → `fr` → `bonjour` ✓
- `привет` → `en` → `hello` ✓

## Deployment

- `WORKER_VERSION` bumped to `1.3.0`
- Deployed via `worker/deploy.ps1` from `worker/` directory
