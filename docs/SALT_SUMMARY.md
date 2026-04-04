# SECRET_SALT - Quick Guide

&nbsp;

## What is SECRET_SALT?

A shared secret password between your extension and Cloudflare Worker used to generate daily authentication tokens.

&nbsp;

---

&nbsp;

## Why Use It?

**Purpose:** Prevent unauthorized access to your Cloudflare Worker.

**How it works:**

```
1. Extension generates token: SHA-256(today's date + SECRET_SALT)
2. Extension sends token to Worker
3. Worker generates same token: SHA-256(today's date + SECRET_SALT)
4. Worker compares tokens → if match, allow request
5. Token changes automatically every day at midnight UTC
```

**Example:**

```javascript
// Today: 2026-04-04
// SECRET_SALT: "my-cat-loves-fish"

Extension: SHA-256("2026-04-04" + "my-cat-loves-fish") = "a7f3e9d2..."
Worker:    SHA-256("2026-04-04" + "my-cat-loves-fish") = "a7f3e9d2..."

Tokens match ✅ → Request allowed
```

&nbsp;

---

&nbsp;

## Security Level

**Basic protection, not military-grade:**

- ✅ Stops casual abuse
- ✅ Combined with rate limiting (100 req/min per IP)
- ❌ Salt is visible in extension code (anyone can extract it)
- ❌ Not a replacement for real API keys

**This is acceptable because:**

- Free service (no paid resources to protect)
- Rate limiting prevents abuse even if salt is known
- Cloudflare free tier can handle the load

&nbsp;

---

&nbsp;

## How to Set SECRET_SALT

### Step 1: Generate Random String

Choose any method:

**Option A - Random words:**

```
my-dog-loves-pizza-on-tuesday-2026
blue-elephant-dancing-under-moon
```

**Option B - Random characters:**

```
k9Lm3pQr7sWx2Yz5Aa8Bb1Cc4Dd6Ee0
```

**Option C - PowerShell:**

```powershell
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
```

&nbsp;

### Step 2: Set in Extension

**File:** `code_for_mozzilla/sidebar.js` (line 7)

```javascript
const SECRET_SALT = "your-random-secret-here";
```

&nbsp;

### Step 3: Set in Worker

**File:** `worker/worker.js` (line 15)

```javascript
const SECRET_SALT = "your-random-secret-here";  // ← SAME value as sidebar.js
```

&nbsp;

### Step 4: Deploy Worker

```powershell
cd worker
powershell -ExecutionPolicy Bypass -File .\deploy.ps1
# Choose option 2 (Upload)
```

&nbsp;

### Step 5: Reload Extension

```
1. Firefox → about:debugging#/runtime/this-firefox
2. Find your extension
3. Click "Reload"
```

&nbsp;

---

&nbsp;

## Important Rules

**MUST be the same in both files:**

for mozzilla extention:  

- ✅ Extension: `code_for_mozzilla/sidebar.js  `

for cloudflare worker:  

- ✅ Worker: `worker/worker.js  `

**If different:**

- Extension generates token with Salt A
- Worker expects token with Salt B
- Tokens don't match → All requests fail (401 Unauthorized)

**For GitHub:**

- Use placeholder: `"your-secret-salt-here-change-this"`
- Never commit real salt to public repos

&nbsp;

---

&nbsp;

## When to Change

**Change salt when:**

- First time setup (replace example)
- Every 6-12 months (security best practice)
- After accidentally committing to GitHub
- Suspect someone is abusing your worker

**After changing:**

1. Update both files (sidebar.js + worker.js)
2. Deploy worker
3. Reload extension
4. Old tokens stop working immediately

&nbsp;

---

&nbsp;

## Quick Example

```javascript
// 1. Generate salt
"X7j2K9m4P8q1R5t3W6y0Z8a2B5c7D9e"

// 2. Set in sidebar.js
const SECRET_SALT = "X7j2K9m4P8q1R5t3W6y0Z8a2B5c7D9e";

// 3. Set in worker.js (SAME VALUE)
const SECRET_SALT = "X7j2K9m4P8q1R5t3W6y0Z8a2B5c7D9e";

// 4. Deploy worker → Reload extension → Done ✅
```

&nbsp;

---

**Version:** 1.0.0
**Last Updated:** April 2026
