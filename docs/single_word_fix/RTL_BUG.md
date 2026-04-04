# RTL Bug — Arabic and Hebrew text appears left-to-right

## Expected behavior

When target lang is `ar` or `he`, output textarea should render text right-to-left — typewriter characters appear from the right side.

## Actual behavior

Text appears left-to-right regardless of target language. Arabic and Hebrew characters render correctly but alignment and direction are wrong.

## Root cause

The code sets only the `dir` HTML attribute:

```js
outputText.dir = isRTL ? 'rtl' : 'ltr';
```

This is not enough in Firefox. The browser CSS cascade can override the `dir` attribute with the inherited `direction` CSS property. Our global CSS has:

```css
body {
  /* no direction set, defaults to ltr */
}

#outputText {
  text-align: left;
}
```

The `text-align: left` on `#outputText` overrides the visual alignment even when `dir="rtl"` is set. Firefox respects the CSS property over the HTML attribute in this case.

## Fix

Set all three together — attribute + CSS direction + CSS text-align:

```js
const isRTL = ['ar', 'he'].includes(targetLang);
outputText.dir = isRTL ? 'rtl' : 'ltr';
outputText.style.direction = isRTL ? 'rtl' : 'ltr';
outputText.style.textAlign = isRTL ? 'right' : 'left';
```

And reset all three in `clearStorage()`:

```js
outputEl.dir = 'ltr';
outputEl.style.direction = 'ltr';
outputEl.style.textAlign = 'left';
```

## Why all three are needed

| Property | Controls |
|----------|----------|
| `dir` attribute | HTML-level text direction, affects cursor and bidi algorithm |
| `style.direction` | CSS-level direction, overrides inherited values |
| `style.textAlign` | Visual alignment — without this text still appears left-aligned even if direction is rtl |

## Status

Not yet fixed.
