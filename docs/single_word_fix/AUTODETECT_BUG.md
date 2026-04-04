# Auto-detect Bug — targetLang read before switch

## Symptom

User types Cyrillic on fresh state. Console shows:

```
[TRANSLATE] Auto-detect: Cyrillic input → target switched to EN
[TRANSLATE] Target lang: ru   ← should be en
[TRANSLATE] Target language: ru
```

Result: `каша` → `каша` (RU→RU, same text back)

## Root cause

In `translateText()`, `targetLang` is read from the DOM at the **top** of the function — before the auto-detect block runs:

```js
async function translateText() {
  const inputText = ...
  const targetLang = document.getElementById('targetLang').value  // reads 'ru' here

  // auto-detect runs here, updates DOM to 'en'
  // but targetLang variable is already 'ru' — too late

  // translation uses targetLang = 'ru'  ← wrong
}
```

The DOM gets updated correctly (button highlight switches to `en`, hidden input set to `en`) but the local variable `targetLang` was already captured as `'ru'` and is used for the actual API call.

## Fix

Move the `targetLang` read to **after** the auto-detect block:

```js
async function translateText() {
  const inputText = ...

  // auto-detect runs here, may update DOM

  const targetLang = document.getElementById('targetLang').value  // reads correct value now
}
```

## Status

Not yet fixed.
