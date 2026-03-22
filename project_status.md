# Claude Chrome Extension — Custom API Bypass

## Project Goal
Modify Claude Chrome Extension (v1.0.56) to:
1. Connect to custom LLM API at configurable URL (default: `http://139.59.5.16:8317`) instead of Anthropic's official API
2. Bypass OAuth/login authentication entirely — show chat UI directly without Anthropic login
3. Allow users to configure API URL, API key, default model, and available models via a settings page
4. Push modified extension to GitHub

**GitHub Repo:** https://github.com/chabhishek420/cluwd
**Extension ID:** `fcoeoabgfenejglbffodgkkbkcdhcgfn`

---

## What Has Been Implemented

### ✅ API Redirection
All API calls redirected from `https://api.anthropic.com` to the configured custom URL (default: `http://139.59.5.16:8317`).

**Files modified:** `assets/request.js`

**Flow:**
- Auth endpoints (profile, bootstrap, account, organizations, oauth/token) → return mock data (needed for UI to load)
- Real API endpoints (`/v1/messages`, `/v1/models`, `/v1/chat/completions`, `/v1/conversations`, etc.) → **forwarded to custom API** with `Authorization: Bearer` header
- Unmatched API calls from claude/anthropic hosts → forwarded to custom API
- **Previously all calls returned mock data** — this was a critical flaw, now fixed

### ✅ Fake Auth Token Injection
Fake tokens injected in 2 locations to bypass OAuth:
- `assets/request.js` (main intercept file) — stable token `fake_bypass_token_claude_chrome_bypass_2024`
- `assets/service-worker.ts-8lxIEjKA.js` (service worker) — stable token (previously had `Date.now()` which caused re-render loops — fixed)

Token format: `fake_bypass_token_claude_chrome_bypass_2024` (stable, no `Date.now()`)
Token expiry: 1 year from injection

### ✅ OAuth Flow Blocked
- `chrome.tabs.create` blocked for OAuth authorize URLs (`/oauth/authorize`, `claude.ai/login`, `claude.ai/signin`)
- `chrome.runtime.openOptionsPage` redirected to `options.html`

### ✅ Auth Header Injection
`Authorization: Bearer customApiKey` is now added to all API requests forwarded to the custom endpoint. The key is read from `chrome.storage.local` (set by settings.html).

### ✅ Model Override
`customModel` from settings is injected into POST request bodies for `/v1/messages` and `/v1/chat/completions`.

### ✅ Fake Tab & Message Intercepts
- `chrome.tabs.get` returns fake tab object to prevent "No tab with id" errors
- `chrome.runtime.sendMessage` returns `{ success: true }` to prevent message errors
- `chrome.storage.onChanged` rate-limited to prevent change-detection loops

### ✅ API Intercepts (split: mock for auth, forward for real calls)
| Endpoint | Behavior |
|---|---|
| `GET /api/oauth/profile` | Mock (UI needs this to load) |
| `GET /api/bootstrap` | Mock (UI needs feature flags) |
| `GET /api/oauth/account` | Mock |
| `GET /api/oauth/organizations` | Mock |
| `POST /oauth/token` | Mock |
| `POST /v1/messages` | **Forwarded to custom API** with `customModel` + `Authorization` header |
| `GET /v1/models` | **Forwarded to custom API** with `Authorization` header |
| `POST /v1/chat/completions` | **Forwarded to custom API** with `customModel` + `Authorization` header |
| `GET /v1/conversations` | **Forwarded to custom API** |
| `GET /conversations` | **Forwarded to custom API** |
| `GET /sessions` | **Forwarded to custom API** |
| `GET/POST /count_tokens` | **Forwarded to custom API** |

### ✅ Onboarding Bypass
All onboarding state keys set to completed on install:
- `has_seen_onboarding: true`
- `onboarding_completed: true`
- `first_run: false`
- `onboarding_dismissed: true`
- `showOnboarding: false`
- `EXTENSION_INSTALL_DATE` set
- `hasCompletedOnboarding: true`
- Fake profile, user, and organization data injected into storage

### ✅ CSP Fixes
- `theme-initializer.js` loaded via `<script src>` (not inline) to satisfy CSP
- Updated in: `sidepanel.html`, `options.html`, `newtab.html`, `pairing.html`

### ✅ React Error #185 Fix (MutationObserver + Before-Load Injection)
**Approach** in `theme-initializer.js`:
- `theme-initializer.js` loads as a **regular script** BEFORE all module scripts (critical timing)
- MutationObserver watches for React module scripts (`index-*.js`, `sidepanel-*.js`)
- When found, injects a blocking `<script>` **BEFORE** the React module
- Blocking script patches `Dr`, `Ir`, `di`, `fi`, `Ci`, `Bi` before React can capture them
- `unhandledrejection` handler suppresses React #185 promises
- `requestAnimationFrame` + setTimeout retries for late-loading scripts

**Also fixed:**
- `request.js` now uses stable fake token (no `Date.now()`)
- `service-worker.ts-8lxIEjKA.js` now uses stable fake token (was previously using `Date.now()` — this was a bug)
- `chrome.storage.onChanged` rate-limited to prevent change-detection loops

**Status:** ⚠️ Unknown — not yet tested

### ✅ Settings Page (settings.html)
New standalone HTML page (no React bundle dependency):
- **Location:** Extension root `settings.html`
- **Access:** Right-click extension → Options (opens settings.html)
- **Fields:**
  - API Base URL (default: `http://139.59.5.16:8317`)
  - API Key (optional)
  - Default Model (default: `claude-3-sonnet-20240229`)
  - Available Models (textarea, one per line)
- **Storage keys:** `customApiBaseUrl`, `customApiKey`, `customModel`, `customModels`
- **Buttons:** Save Settings, Reset to Defaults, Open Claude Sidepanel
- **No React bundle imports** — pure HTML/CSS/JS with chrome.storage API

### ✅ request.js Dynamic Config
- Reads `customApiBaseUrl` from `chrome.storage.local` (async populate)
- Falls back to hardcoded default
- `getOptions()` returns dynamic `cfcBase` and `apiBaseIncludes`

### ✅ options.html Fallback
- After 1.5s, if React root has no children, shows a link to `settings.html`
- Ensures users can always access settings even if React crashes

### ✅ GitHub Push
- Repo: `https://github.com/chabhishek420/cluwd`
- All changes committed and pushed
- Latest commit: `ea9662d` — "Add settings UI, fix React error #185 with before-load patch"

---

## What's Failing

### 🔴 React Error #185 — Maximum Update Depth Exceeded

**What it looks like:**
```
Error: Minified React error #185; visit https://react.dev/errors/185
    at Dr (index-DiHrZgA3.js:10:31992)
    at Ir (index-DiHrZgA3.js:10:31517)
    at di (index-DiHrZgA3.js:10:63454)
    at fi (index-DiHrZgA3.js:10:63466)
    at sidepanel-u6UTZc3K.js:6:183053
[request.js] Unhandled rejection: Error: Minified React error #185...
```

**Root Cause:** React's `Dr` (setState) is being called in a tight loop — the component re-renders, triggers another state update, which re-renders, forever. The loop happens in `sidepanel-u6UTZc3K.js` (the React app entry point) at position 183053.

**Why previous fixes failed:**
1. **Interval patching** (`request.js`): By the time `request.js` loads as a module and sets up its `setInterval` to patch `Dr`/`Ir`, React has already imported them into its own closure. Patching `globalThis.Dr` after React has captured the reference has zero effect.
2. **`globalThis.__mockApiState`**: Setting stable mock data didn't help because the loop isn't caused by changing data — it's caused by the React app's internal component trying to sync state in a way that triggers another state update.

**React Error #185 means:** The app tried to call `setState` more than 50 times in a row (React's built-in safety limit). This is triggered by:
- A component with `useEffect` that calls `setState` unconditionally, which causes another effect, which calls `setState again
- Or: `chrome.storage.onChanged` firing in a loop, each firing triggers React re-render, which fires storage changes
- Or: The app checking auth state repeatedly and finding it "not authenticated", triggering auth flow, which updates state, which checks auth again

**Likely cause in this extension:** The app's auth/authentication check component is running in a loop because:
- The fake token is set in `chrome.storage.local`
- But the React app's auth state manager might also be reading from a different source (another storage key, or the token format doesn't match what it expects)
- Each failed auth check → component re-renders → another check → loop

**The `sidepanel-u6UTZc3K.js:6:183053` is the entry point.** The component at that position is the one looping.

---

## Debug Log

### Console Log Pattern (What Works)
```
✅ [request.js] Intercepting: http://139.59.5.16:8317/api/bootstrap/features/claude_in_chrome GET
✅ [request.js] Intercepting: http://139.59.5.16:8317/api/oauth/profile GET
✅ chrome.tabs.create blocked for OAuth URL: http://139.59.5.16:8317/oauth/authorize?...
✅ [request.js] Intercepting: https://api.segment.io/v1/batch POST  (discarded)
```

**Only two API calls** are being made to the custom endpoint — bootstrap and profile. No `/v1/messages` calls because the chat UI never renders.

### Console Log Pattern (What Fails)
```
❌ Uncaught (in promise) — index-DiHrZgA3.js:10:31992
❌ [request.js] Unhandled rejection: Error: Minified React error #185...
❌ Dr @ index-DiHrZgA3.js:10
❌ Ir @ index-DiHrZgA3.js:10
❌ di @ index-DiHrZgA3.js:10
❌ fi @ index-DiHrZgA3.js:10
❌ (anonymous) @ sidepanel-u6UTZc3K.js:6:183053
```

The loop fires continuously — every ~10-50ms, multiple errors. Chrome DevTools shows the sidepanel tab consuming high CPU.

### What the User Sees on Screen
- On fresh install: Onboarding screen (brief) → **blank screen**
- On reload: **blank screen** (or crash)
- Extension icon click → sidepanel opens → **blank screen**
- Console floods with React #185 errors

### Key Files Involved
| File | Role |
|---|---|
| `assets/theme-initializer.js` | Theme detection + React loop fix (blocking injection) |
| `assets/request.js` | API interception, fake auth, fake API responses, Chrome API overrides |
| `assets/service-worker.ts-8lxIEjKA.js` | Service worker — token injection on install |
| `assets/SavedPromptsService-Bz6yvo9U.js` | Token injection in prompts service |
| `assets/sidepanel-u6UTZc3K.js` | React app entry point — **loop originates here at line 183053** |
| `assets/index-DiHrZgA3.js` | React runtime (minified) — `Dr`/`Ir`/`di`/`fi` live here |
| `sidepanel.html` | HTML shell — loads theme-initializer, request.js, then sidepanel bundle |
| `settings.html` | Standalone settings page (no React) |

---

## Next Steps (Priority Order)

### 🔴 P0 — Fix React Error #185 (Critical Blocker)

The extension is unusable without this fix. The UI must render for any other work to matter.

#### Current Fix (MutationObserver + Before-Load)
The fix in `theme-initializer.js` injects a blocking script before React loads. **Needs testing.**

#### Additional Fixes Applied This Session
- `service-worker.ts-8lxIEjKA.js`: Changed token from `Date.now()` to stable string (prevents re-render loops from service worker restarts)
- `request.js`: Fixed catch-all operator precedence bug (was silently returning mock data for all API calls instead of forwarding)

#### If Current Fix Fails
- Examine `sidepanel-u6UTZc3K.js` around position 183053
- The loop is likely in the auth component — ensure ALL auth-related storage keys match what the React app expects
- Try intercepting `chrome.storage.onChanged` more aggressively

### ✅ P1 — Verify Custom API Integration (partially done — now forwarding, not mocking)
API requests are now forwarded to the custom endpoint with proper headers and model. Still needs testing:
1. Settings page → configure `http://139.59.5.16:8317` → Save
2. Open sidepanel → type a message
3. Verify `/v1/messages` is called and SSE streaming works
4. Check if the custom API responds correctly

### 🟡 P2 — Test Conversations Persistence
- Save a conversation
- Reload extension
- Verify conversation is restored from custom API

### 🟡 P2 — Add "Test Connection" Button
In `settings.html`, add a button that makes a test `POST /v1/messages` call and shows whether the API responds correctly.

### 🟢 P3 — Build/Publish
- Once working, publish updated `.zip` for distribution
- Update `CHANGELOG` with what changed
- Tag a release on GitHub

---

## Extension Loading Order
```
1. service-worker-loader.js (service worker entry)
   → service-worker.ts-8lxIEjKA.js (injects fake token on install/load)
2. sidepanel.html (or options.html)
   → theme-initializer.js (blocking — theme + loop fix injection) ← BEFORE React
   → request.js (module — API intercepts, Chrome API overrides)
   → sidepanel-u6UTZc3K.js (module — React app entry point)
     → index-DiHrZgA3.js (React runtime — `Dr`/`Ir`/`di`/`fi` defined here)
     → sidepanel bundle chunks (React components)
```

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────────┐
│ Chrome Sidepanel                                       │
│ ┌─────────────────────────────────────────────────┐  │
│ │ sidepanel.html                                   │  │
│ │  ├─ theme-initializer.js (REGULAR SCRIPT)       │  │
│ │  │    └─ MutationObserver → inject blocking     │  │
│ │  │       script before React module loads        │  │
│ │  │                                               │  │
│ │  ├─ request.js (MODULE SCRIPT)                  │  │
│ │  │    ├─ chrome.storage.local.set(fakeToken)   │  │
│ │  │    ├─ chrome.storage.onChanged (rate-limit)  │  │
│ │  │    ├─ chrome.tabs.get (fake tab)             │  │
│ │  │    ├─ chrome.runtime.sendMessage (mock)     │  │
│  │  │    └─ globalThis.fetch = intercept(...)     │  │
│  │  │         ├─ /api/oauth/* → mock (auth only)  │  │
│  │  │         ├─ /api/bootstrap → mock             │  │
│  │  │         ├─ /v1/messages → FORWARD (custom API + auth header + model) │
│  │  │         ├─ /v1/models → FORWARD (custom API + auth header) │
│  │  │         └─ /v1/chat/completions → FORWARD  │  │
│ │  │                                               │  │
│ │  └─ sidepanel-u6UTZc3K.js (React app)         │  │
│ │       └─ index-DiHrZgA3.js (React runtime)      │  │
│ │            └─ Dr / Ir / di / fi — SHOULD BE    │  │
│ │               PATCHED BY blocking script        │  │
│ └─────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Chrome Service Worker                                 │
│  └─ service-worker.ts-8lxIEjKA.js                    │
│       ├─ chrome.runtime.onInstalled → inject token   │
│       └─ chrome.runtime.onStartup → inject token     │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Settings Page (settings.html)                          │
│  ├─ Pure HTML/CSS/JS (no React)                      │
│  ├─ Saves customApiBaseUrl, customApiKey, etc.     │
│  └─ request.js reads these from chrome.storage.local │
└─────────────────────────────────────────────────────────┘
```

---

## Last Tested By
- User (manual Chrome DevTools console testing)
- Last zip: `claude-extension-fixed.zip` (10MB)
- Last commit: `ea9662d` pushed to `https://github.com/chabhishek420/cluwd`
