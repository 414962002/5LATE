# Cloudflare Worker - Complete Workflow Guide

&nbsp;

## What is Cloudflare?

Cloudflare is a global network of servers that sits between your users and the internet. Think of it as a smart middleman that makes websites faster and more secure.

**Key features:**
- **Global Network**: 300+ data centers worldwide
- **Free Tier**: 100,000 requests per day at no cost
- **Fast**: Servers close to your users = faster responses
- **Secure**: Built-in DDoS protection and SSL/TLS encryption

**For this extension:**
- Cloudflare hosts your translation proxy server
- Users connect to the nearest Cloudflare server
- Much faster than connecting directly to Google Translate

&nbsp;

---

&nbsp;

## What is a Cloudflare Worker?

A Cloudflare Worker is a small piece of JavaScript code that runs on Cloudflare's servers (not on your computer or in the browser).

**Think of it as:**
- A mini-server that runs in the cloud
- A proxy between your extension and Google Translate
- A security guard that checks every request

**Why you need it:**
- Google blocks direct browser requests (429 errors)
- Worker acts as a trusted middleman
- Adds authentication and rate limiting
- Provides fallback if one API fails

**Architecture:**

```
Firefox Extension → Cloudflare Worker → Google Translate
     (client)          (your server)        (translation API)
```

&nbsp;

---

&nbsp;

## What Does worker.js Do?

`worker.js` is the code that runs on Cloudflare's servers. It handles every translation request.

**Main responsibilities:**

1. **Authentication** - Validates daily rotating tokens
2. **Rate Limiting** - Prevents abuse (100 requests/min per IP)
3. **Request Forwarding** - Sends text to Google Translate
4. **Fallback System** - Tries GTX, then clients5 if GTX fails
5. **Response Formatting** - Returns consistent JSON format
6. **CORS Headers** - Allows browser requests

**Request flow:**

```
1. Extension generates token: SHA-256(date + secret)
2. Extension sends: POST /translate with token + text
3. Worker validates token (rejects if invalid)
4. Worker checks rate limit (rejects if exceeded)
5. Worker forwards to Google Translate GTX
6. If GTX fails → Worker tries clients5
7. Worker returns translation to extension
```

**Security features:**

- Daily rotating tokens (changes at midnight UTC)
- Rate limiting per IP address
- No API keys stored (uses public Google endpoints)
- Token validation prevents unauthorized access

&nbsp;

---

&nbsp;

## What is deploy.ps1?

`deploy.ps1` is a PowerShell script that uploads your `worker.js` code to Cloudflare.

**What it does:**
- Uploads local `worker.js` to Cloudflare servers
- Downloads current live code for backup
- Uses Cloudflare REST API directly (no npm or Node.js needed)

**Why you need it:**
- Cloudflare's web editor is slow and clunky
- Local editing is faster (use your favorite editor)
- Easy to version control with Git
- Quick deployment workflow

**Alternative methods:**
- Cloudflare Dashboard (slow, web-based editor)
- Wrangler CLI (requires Node.js and npm)
- deploy.ps1 (fastest, PowerShell only)

&nbsp;

---

&nbsp;

## How to Use deploy.ps1

### Prerequisites

- PowerShell (built into Windows)
- Cloudflare account with Worker created
- API token with "Workers Scripts - Edit" permission
- `worker.js` file in the same folder

&nbsp;

### Step 1: Open PowerShell

Navigate to the worker folder:

```powershell
cd C:\Users\User\Desktop\server\translate-extension\worker
```

&nbsp;

### Step 2: Run the Script

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy.ps1
```

&nbsp;

### Step 3: Choose an Option

You'll see this menu:

```
Cloudflare Worker Manager
=========================

Choose action:
1 - Download Worker from Cloudflare
2 - Upload local worker.js to Cloudflare
3 - Exit

Enter 1, 2, or 3:
```

&nbsp;

### Option 1: Download Worker

Downloads the current live code from Cloudflare and saves it as a timestamped backup.

**When to use:**
- Before making changes (backup current version)
- To see what's currently deployed
- To compare local vs live code

**What happens:**
```
1. Script connects to Cloudflare API
2. Downloads worker code
3. Strips multipart boundaries (Cloudflare wraps code in form-data)
4. Saves clean JavaScript as: worker_backup_2026-04-04_15-30-00.js
```

**Example:**

```powershell
Enter 1, 2, or 3: 1

Downloading Worker...
Success! Saved as worker_backup_2026-04-04_15-30-00.js
```

&nbsp;

### Option 2: Upload Worker

Uploads your local `worker.js` to Cloudflare, making it live immediately.

**When to use:**
- After editing worker.js locally
- To deploy new features or bug fixes
- To update rate limits or configuration

**What happens:**
```
1. Script reads local worker.js
2. Wraps code in multipart form-data format
3. Sends PUT request to Cloudflare API
4. Cloudflare deploys code globally (takes ~5 seconds)
5. Changes are live immediately
```

**Example:**

```powershell
Enter 1, 2, or 3: 2

Uploading worker.js to Cloudflare...
Worker deployed successfully!
Changes are now live on Cloudflare
```

&nbsp;

### Option 3: Exit

Closes the script.

&nbsp;

---

&nbsp;

## Common Workflows

### Workflow 1: Update Worker Code

**Scenario:** You want to change the rate limit from 100 to 200 requests per minute.

```
1. Open worker.js in your editor
2. Find: const RATE_LIMIT = 100;
3. Change to: const RATE_LIMIT = 200;
4. Save file
5. Run: powershell -ExecutionPolicy Bypass -File .\deploy.ps1
6. Choose option 2 (Upload)
7. Done! Changes are live
```

**Time:** ~30 seconds

&nbsp;

### Workflow 2: Backup Before Changes

**Scenario:** You want to make risky changes and need a backup.

```
1. Run: powershell -ExecutionPolicy Bypass -File .\deploy.ps1
2. Choose option 1 (Download)
3. Script saves: worker_backup_2026-04-04_15-30-00.js
4. Now edit worker.js safely
5. If something breaks, restore from backup
```

&nbsp;

### Workflow 3: Compare Local vs Live

**Scenario:** You forgot what's currently deployed.

```
1. Run deploy.ps1
2. Choose option 1 (Download)
3. Open worker_backup_2026-04-04_15-30-00.js
4. Compare with your local worker.js
5. See what's different
```

&nbsp;

### Workflow 4: Deploy New Feature

**Scenario:** You added a new endpoint to the worker.

```
1. Edit worker.js (add new code)
2. Test locally if possible
3. Run deploy.ps1
4. Choose option 2 (Upload)
5. Test live endpoint immediately
6. If broken, restore from backup
```

&nbsp;

---

&nbsp;

## Configuration

The script is configured at the top of `deploy.ps1`:

```powershell
$ACCOUNT_ID = "f412ed6dc77b6fedbcef5c14f3a0f830"
$API_TOKEN = "2wY0WOzZgN0iYfN3lRVI8sKQC8DVCvddHBlW3sy4"
$SCRIPT_NAME = "5late-translator"
```

**What these mean:**

- **ACCOUNT_ID**: Your Cloudflare account identifier (32-char hex string)
- **API_TOKEN**: Authentication token for API access (from Cloudflare dashboard)
- **SCRIPT_NAME**: Name of your worker (must match worker name in Cloudflare)

**How to find these:**

1. **Account ID**: 
   - Go to https://dash.cloudflare.com/
   - URL shows: `https://dash.cloudflare.com/<ACCOUNT_ID>/...`
   - Copy the 32-character hex string

2. **API Token**:
   - Dashboard → Manage Account → API Tokens
   - Create Token → Edit Cloudflare Workers
   - Copy token (only shown once!)

3. **Script Name**:
   - Dashboard → Workers & Pages
   - Your worker name (e.g., "5late-translator")

&nbsp;

---

&nbsp;

## How deploy.ps1 Works (Technical)

### Upload Process (Option 2)

```
1. Read worker.js as UTF-8 text
2. Build multipart/form-data body:
   - Part 1: metadata = {"main_module":"worker.js"}
   - Part 2: worker.js content as binary
3. Generate random boundary string
4. Send PUT request to Cloudflare API:
   PUT /accounts/{ACCOUNT_ID}/workers/scripts/{SCRIPT_NAME}
5. Cloudflare validates and deploys globally
```

**API endpoint:**

```
PUT https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/workers/scripts/{SCRIPT_NAME}
Headers:
  Authorization: Bearer {API_TOKEN}
  Content-Type: multipart/form-data; boundary={BOUNDARY}
Body:
  --{BOUNDARY}
  Content-Disposition: form-data; name="metadata"
  {"main_module":"worker.js"}
  --{BOUNDARY}
  Content-Disposition: form-data; name="worker.js"; filename="worker.js"
  Content-Type: application/javascript+module
  
  [worker.js content here]
  --{BOUNDARY}--
```

&nbsp;

### Download Process (Option 1)

```
1. Send GET request to Cloudflare API:
   GET /accounts/{ACCOUNT_ID}/workers/scripts/{SCRIPT_NAME}/content/v2
2. Cloudflare returns multipart response with boundaries
3. Script strips boundary headers and footers
4. Saves clean JavaScript code
```

**Why strip boundaries?**

Cloudflare wraps the code like this:

```
--098f3e916a97af94b38511d75bc6c67ab79db6eb
Content-Disposition: form-data; name="index.js"; filename="index.js"
Content-Type: application/javascript+module

// actual JS code here...

--098f3e916a97af94b38511d75bc6c67ab79db6eb--
```

These boundary lines are not valid JavaScript. The script removes them automatically so you get clean, ready-to-edit code.

&nbsp;

---

&nbsp;

## Verify Deployment

After uploading, verify the worker is live:

### Method 1: Browser Test

Open in browser:

```
https://5late-translator.5lateextentionfirefox.workers.dev/translate?text=hello&tl=ru
```

Expected response:

```json
{
  "translatedText": "привет",
  "detectedLang": "en",
  "source": "gtx",
  "service": "cloudflare worker"
}
```

&nbsp;

### Method 2: PowerShell Test

```powershell
curl.exe "https://5late-translator.5lateextentionfirefox.workers.dev/translate?text=hello&tl=ru"
```

&nbsp;

### Method 3: Check Version Endpoint

If your worker has a version endpoint:

```
https://5late-translator.5lateextentionfirefox.workers.dev/version
```

Returns:

```json
{
  "version": "1.3.0",
  "date": "2026-04-04"
}
```

Compare with your local `worker.js` version to confirm deployment.

&nbsp;

---

&nbsp;

## Troubleshooting

### Error: "worker.js not found!"

**Cause:** Script can't find worker.js in current directory.

**Fix:**
```powershell
# Make sure you're in the worker folder
cd C:\Users\User\Desktop\server\translate-extension\worker

# Verify worker.js exists
dir worker.js
```

&nbsp;

### Error: "Upload failed! 401 Unauthorized"

**Cause:** Invalid or expired API token.

**Fix:**
1. Go to Cloudflare Dashboard → API Tokens
2. Verify token has "Workers Scripts - Edit" permission
3. Create new token if needed
4. Update `$API_TOKEN` in deploy.ps1

&nbsp;

### Error: "Upload failed! 404 Not Found"

**Cause:** Worker name doesn't exist or account ID is wrong.

**Fix:**
1. Verify worker exists in Cloudflare Dashboard
2. Check `$SCRIPT_NAME` matches exactly
3. Verify `$ACCOUNT_ID` is correct (32-char hex)

&nbsp;

### Error: "Download failed!"

**Cause:** Network issue or API rate limit.

**Fix:**
1. Check internet connection
2. Wait a few seconds and try again
3. Verify API token is valid

&nbsp;

### Worker Deployed But Not Working

**Cause:** Code has syntax errors or runtime errors.

**Fix:**
1. Check Cloudflare Dashboard → Workers → Logs
2. Look for JavaScript errors
3. Test locally if possible
4. Restore from backup and try again

&nbsp;

---

&nbsp;

## Security Best Practices

### Never Commit Secrets to Git

**Bad:**
```powershell
# deploy.ps1 with real credentials
$API_TOKEN = "2wY0WOzZgN0iYfN3lRVI8sKQC8DVCvddHBlW3sy4"
```

**Good:**
```powershell
# deploy.ps1 with placeholder
$API_TOKEN = "your_api_token_here"
```

Add real credentials only in your local copy, never commit them.

&nbsp;

### Use Environment Variables (Optional)

Instead of hardcoding in deploy.ps1:

```powershell
$API_TOKEN = $env:CLOUDFLARE_API_TOKEN
$ACCOUNT_ID = $env:CLOUDFLARE_ACCOUNT_ID
```

Set in PowerShell:

```powershell
$env:CLOUDFLARE_API_TOKEN = "your_token_here"
$env:CLOUDFLARE_ACCOUNT_ID = "your_account_id_here"
```

&nbsp;

### Rotate API Tokens Regularly

- Create new token every 3-6 months
- Delete old tokens from Cloudflare Dashboard
- Update deploy.ps1 with new token

&nbsp;

---

&nbsp;

## Alternatives to deploy.ps1

### Option 1: Cloudflare Dashboard (Web Editor)

**Pros:**
- No local setup needed
- Visual interface

**Cons:**
- Slow and clunky
- No syntax highlighting
- Can't use your favorite editor
- No version control

**How to use:**
1. Dashboard → Workers & Pages
2. Click your worker
3. Click "Edit Code"
4. Paste code
5. Click "Save and Deploy"

&nbsp;

### Option 2: Wrangler CLI (Official Tool)

**Pros:**
- Official Cloudflare tool
- More features (logs, secrets, etc.)
- Better for complex projects

**Cons:**
- Requires Node.js and npm
- More setup required
- Slower than deploy.ps1 for simple uploads

**How to use:**
```powershell
npm install -g wrangler
wrangler login
wrangler deploy
```

&nbsp;

### Option 3: deploy.ps1 (This Script)

**Pros:**
- Fast and simple
- No dependencies (PowerShell only)
- Perfect for quick edits
- Easy to understand

**Cons:**
- Windows only (PowerShell)
- No advanced features
- Manual configuration

**Best for:**
- Quick worker updates
- Simple projects
- Windows users
- Learning how Cloudflare API works

&nbsp;

---

&nbsp;

## Summary

**Cloudflare** = Global network that hosts your worker  
**Worker** = Your server-side code that proxies translation requests  
**worker.js** = The JavaScript code that runs on Cloudflare  
**deploy.ps1** = PowerShell script to upload worker.js to Cloudflare  

**Typical workflow:**
1. Edit worker.js locally
2. Run deploy.ps1
3. Choose option 2 (Upload)
4. Changes are live in ~5 seconds

**Free tier limits:**
- 100,000 requests per day
- 10ms CPU time per request
- More than enough for personal use

&nbsp;

---

**Version:** 1.0.0  
**Last Updated:** April 2026
