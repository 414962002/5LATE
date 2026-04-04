# Bug: Single Word Translation Returns Full Phrase in Target Language

## Problem

When translating a single Cyrillic word (e.g. `привет`) to a non-Russian/non-English language,
the output contains a full descriptive phrase instead of just the translation.

**Example:**
- Input: `привет`
- Target: `es` (Spanish)
- Expected: `hola`
- Actual: `significado de la palabra hola` ("meaning of the word hello")

- Target: `de` (German)
- Expected: `Hallo`
- Actual: `Bedeutung des Wortes Hallo` ("meaning of the word hello")

## Root Cause

In `worker.js`, single Cyrillic words are sent to Google Translate with a context prefix:

```js
query = "значение слова " + text;  // "meaning of the word привет"
sourceLang = "ru";
```

This was added to improve dictionary-quality translations for single Russian words.

Google translates the full phrase including the prefix into the target language.
The cleanup regex only strips Russian and English prefixes:

```js
translatedText = translatedText
  .replace(/^значение слова\s+/i, "")         // strips Russian prefix
  .replace(/^meaning of (the )?word\s+/i, "") // strips English prefix
  .replace(/^meaning of /i, "")
  .trim();
```

When target is Spanish, German, Japanese, etc. — Google returns the prefix translated
into that language, and the regex does not match it, so the full phrase is returned.

## Fix

Remove the context prefix trick for Cyrillic single words.
Send the word directly with `sl=ru` to force correct source language detection:

```js
if (isSingleWord) {
  if (hasCyrillic) {
    query = text;       // just the word, no prefix
    sourceLang = "ru";  // force source language
  } else if (hasLatin) {
    query = text;
    sourceLang = "en";
  }
}
```

Also remove the cleanup regex block entirely — it is no longer needed.

## Impact

Affects all target languages except Russian and English when translating single Cyrillic words.
Latin single words are not affected (no prefix was added for them).

## Status

Pending fix. Requires worker code change + version bump + manual deploy via `deploy.ps1`.
