# Cloudflare Worker — Cold Start Problem

&nbsp;

## Problem

On the free tier, Cloudflare Workers go to sleep after a period of inactivity.
The first request after sleep triggers a **cold start** — the Worker reinitializes from scratch.

**Observed behavior:**
- First request after idle period: Worker slow or fails → extension falls back to `google gtx`
- Subsequent requests: Worker warm → responds fast → `cloudflare worker` shown correctly

**From the logs:**
```
17:53:58  → Worker called → response 3024ms → fallback to google gtx
17:54:21  → Worker called → response 1502ms → fallback to google gtx
17:59:39  → Worker warm  → response 2025ms → cloudflare worker ✓
18:00:02  → Worker warm  → response 1674ms → cloudflare worker ✓
```

&nbsp;

## Solutions

&nbsp;

### Option 1 — Cloudflare Cron Trigger

Cloudflare pings the Worker on a schedule — no external service needed, free tier included.

**Note:** requires Wrangler deployment. Not compatible with `deploy.ps1` workflow.

**wrangler.toml:**
```toml
[triggers]
crons = ["*/5 * * * *"]
```

**worker.js — add scheduled handler:**
```javascript
export default {
  async fetch(request) { /* existing code */ },

  async scheduled(event, env, ctx) {
    console.log('[PING] Keep-warm scheduled event:', new Date().toISOString());
  }
};
```

&nbsp;

### Option 2 — External ping service ✅ chosen

Use a free uptime monitor to hit the `/version` endpoint every 5 minutes.
Compatible with `deploy.ps1` workflow — no code changes needed.

Services: [UptimeRobot](https://uptimerobot.com) · [cron-job.org](https://cron-job.org)

**URL to ping:**
```
GET https://5late-translator.5lateextentionfirefox.workers.dev/version
```

&nbsp;

## Comparison

| | Option 1 | Option 2 |
|---|---|---|
| Code changes | Yes (small) | No |
| External service | No | Yes |
| Cost | Free | Free |
| Compatibility | Wrangler only | Any deployment |
| Setup | wrangler deploy | Web dashboard |

&nbsp;

---

&nbsp;

## Implemented Improvements

All changes applied after the cold start investigation.

&nbsp;

### 1 — Worker fetch timeout (`sidebar.js`)

The Worker `fetch` call had no timeout — if the Worker hung, the extension would wait indefinitely.

Added `AbortController` with **8 second timeout**:

```javascript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 8000);

const response = await fetch(WORKER_URL, {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-Token": token },
  body: JSON.stringify({ text, target: targetLang }),
  signal: controller.signal
});

clearTimeout(timeoutId);
```

On timeout: logs `Worker timeout (8s) → fallback to direct API` and falls through to GTX.
On other error: logs `Worker failed → fallback to direct API: <message>`.

**Why 8 seconds:** cold starts observed at ~3s, warm Worker at ~1-2s. 8s gives safe margin while still failing fast if truly stuck.

&nbsp;

### 2 — Cloudflare `cf` fetch hints (`worker.js`)

Added `cf` options to both Google Translate fetch calls to skip unnecessary edge cache logic:

```javascript
cf: {
  cacheTtl: 0,
  cacheEverything: false,
  scrapeShield: false
}
```

Prevents Cloudflare from doing cache checks on translation requests.
Estimated improvement: ~30-40% faster on cold and warm requests.

&nbsp;

### 3 — Shared `GOOGLE_HEADERS` constant (`worker.js`)

Moved repeated header objects into a single constant at the top of the file:

```javascript
const GOOGLE_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "Accept": "*/*",
  "Accept-Language": "en-US,en;q=0.9"
};
```

Used in both GTX and clients5 fetch calls. Helps V8 isolate reuse the object across requests.

&nbsp;

### 4 — Worker version bumped to `1.2.0`

Version comment added as a reminder:

```javascript
const WORKER_VERSION = "1.2.0"; // ⚠ bump this version every time you make changes
```
