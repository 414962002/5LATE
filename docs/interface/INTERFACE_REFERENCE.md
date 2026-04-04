# 5LATE — Interface Reference

Full description of all UI elements, states, and behaviors.

---

## Layout Overview

```
┌─────────────────────────────────────────┐
│  HEADER                                 │  ← sidebar-header (gradient bg)
│  ready to translate              ✕      │  ← headerLine2 + clearStorageBtn
├─────────────────────────────────────────┤
│  (progress bar — 1px line)              │  ← progressBar
├─────────────────────────────────────────┤
│  auto-detect → ru   ru en es fr de …    │  ← language-selector-block
│                     it ja zh ar hi he   │
├─────────────────────────────────────────┤
│                                         │
│  [  input textarea                  ]   │  ← inputText
│                                         │
│  [  output textarea (readonly)      ]   │  ← outputText
│                                         │
│  (chunk progress — hidden by default)   │
│  (status message — hidden by default)   │
└─────────────────────────────────────────┘
```

---

## 1. Header (`sidebar-header`)

Background: `linear-gradient(135deg, #be4444 → #827cc7)`
Single row, height 20px.

```
┌─────────────────────────────────────────┐
│  ready to translate              ✕      │
└─────────────────────────────────────────┘
```

### `headerLine2`

Left side of the header row. Shows service and status info.

States:

| State                        | Display                                                                       |
| ---------------------------- | ----------------------------------------------------------------------------- |
| Default                      | `ready to translate`                                                        |
| After translation (worker)   | `✓  cloudflare worker v1.3.0 • 489 / 512 chars • 0.37 sec`               |
| After translation (fallback) | `⚠  google gtx • 489 / 512 chars • 0.43 sec`                             |
| Multi-chunk                  | `✓  cloudflare worker v1.3.0 • 7200 / 7450 chars • 3 chunks • 1.20 sec` |
| Error                        | `check connection`                                                          |

Icons:

- `✓` — Cloudflare Worker handled the request successfully
- `⚠` — Worker failed, direct Google API fallback was used

Parts of the after-translation string (dot-separated):

- service name + version (e.g. `cloudflare worker v1.3.0`)
- input / output char count (e.g. `489 / 512 chars`)
- chunk count — only shown if text was split (e.g. `3 chunks`)
- response time (e.g. `0.37 sec`)
- storage size — appended if data is saved (e.g. `1.2 kB`)

### `clearStorageBtn` — `✕`

Right side of the header row. Small button, opacity 0.6, full opacity on hover.

On click:

- Cancels any running typewriter animation
- Clears `browser.storage.local` (sidebar mode only)
- Resets input textarea to empty
- Resets output textarea to empty
- Resets target lang to `ru`, highlights `ru` button
- Resets `userPickedLang` flag to `false` (auto-detect re-enabled)
- Updates header to default state
- Briefly flashes to full opacity for 1.5s as confirmation

---

## 2. Progress Bar (`progressBar`)

1px horizontal line directly below the header. Color: `#827cc7`.

- Hidden (width 0%) at rest
- Animates from 0% → 90% randomly during translation request
- Jumps to 100% when response arrives, then resets to 0% after 200ms

---

## 3. Language Selector Block (`language-selector-block`)

```
auto-detect → ru    ru  en  es  fr  de  it  ja  zh  ar  hi  he
```

Left side: `headerLine1` — shows current translation direction.
Right side: `lang-buttons` — 11 target language buttons.

### `headerLine1` (`.status-left`)

States:

| State             | Display                |
| ----------------- | ---------------------- |
| Default           | `auto-detect → ru`  |
| After translation | `✓ en →  ru`       |
| Error             | `translation failed` |

### Lang buttons

11 available targets: `ru` `en` `es` `fr` `de` `it` `ja` `zh` `ar` `hi` `he`

- Inactive: opacity 0.5
- Hover: opacity 0.8
- Active (selected): opacity 1.0, subtle white background `rgba(255,255,255,0.4)`
- Default active on fresh start: `ru`

On click:

- Sets clicked button as active
- Sets `userPickedLang = true` — disables auto-detect for the session
- Updates `headerLine1`
- If input has text → immediately re-translates to new target

---

## 4. Input Textarea (`inputText`)

- Placeholder: `…` (italic, 11px, color `#8c7f7f`)
- Auto-resizes height based on content
- No border, no border-radius
- Font: `system-ui` + Noto Sans fallbacks for CJK/Arabic/Devanagari

Translation triggers:

- **Paste** (diff > 50 chars) → translates immediately
- **Typing** → debounce 1500ms after last keystroke → translates
- **Ctrl+Enter** → translates immediately

On any input → output textarea gets `.stale` class (text fades to `#ccc`)

---

## 5. Output Textarea (`outputText`)

- Readonly
- No placeholder
- Auto-resizes height based on content
- Background: `#FFFB` (slightly transparent white)

States:

| State                     | Visual                                                 |
| ------------------------- | ------------------------------------------------------ |
| Empty                     | blank                                                  |
| Stale (new input started) | text color fades to `#ccc`                           |
| Translating               | typewriter animation fills text character by character |
| Complete                  | full translated text, normal color                     |

On translation complete:

- Full result copied to clipboard immediately via `navigator.clipboard`
- Typewriter animation starts (`requestAnimationFrame`, ~400 frames total)
- During animation — `.sidebar-body` scrolls to bottom every 10 frames, keeping last typed line always visible
- When animation finishes — scroll stays at bottom, last line remains readable
- `saveState()` called only after typewriter finishes

### RTL support

For `ar` and `he` targets — output textarea direction is set via `applyDirection(el, targetLang)` before animation starts.

Implementation uses CSS classes, not inline styles:

```css
#outputText.ltr { direction: ltr; text-align: left; }
#outputText.rtl { direction: rtl; text-align: right; unicode-bidi: plaintext; }
```

```js
const RTL_LANGS = new Set(['ar', 'he']);
// classList.toggle('rtl'/'ltr') + dir attribute set together
```

- Default class on load: `ltr`
- On `ar`/`he` target → class switches to `rtl`, `dir="rtl"` set
- Typewriter characters appear from the right side
- On ✕ clear → class resets to `ltr`, `dir="ltr"` restored

---

## 6. Auto-detect Logic

Controlled by `userPickedLang` flag.

```
userPickedLang = false  →  auto-detect active
userPickedLang = true   →  user is in control, no auto-detect
```

Rule (only when `userPickedLang === false`):

- Cyrillic ratio in input > 60% AND target is `ru` → switch target to `en`
- Otherwise → keep current target

Reset to `false` on: fresh open, Firefox restart, ✕ button click.
Set to `true` on: any lang button click.

---

## 7. Chunk Progress Indicator (`progressIndicator`)

Hidden by default. Shown only when text is split into multiple chunks (> 3500 chars each).

```
translating chunk 2 of 4...
```

Style: blue info box (`#DBEAFE` bg, `#1E40AF` text).

---

## 8. Status Message (`statusMessage`)

Hidden by default. Auto-hides after 3 seconds.

| Type    | Style | Example                                |
| ------- | ----- | -------------------------------------- |
| info    | blue  | `translating...`                     |
| success | green | —                                     |
| error   | red   | `translation failed: worker timeout` |

---

## 9. State Persistence

Sidebar mode only. Saved to `browser.storage.local` as `slateState`.

Saved fields:

- `inputText`
- `outputText`
- `targetLang`
- `timestamp`

Storage size shown in `headerLine2` after translation (e.g. `1.2 kB`).
Units: `B` for < 1024 bytes, `kB` for larger (SI standard, non-breaking space).

On fresh open → `restoreState()` loads and restores all fields including active lang button.
