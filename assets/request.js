// ============================================================
// CRITICAL: Patch React's setState FIRST, before React loads
// This prevents infinite update loops (React error #185)
// ============================================================
;(function() {
  const MAX_UPDATES_PER_TICK = 10
  const UPDATE_WINDOW_MS = 100
  const updateCounts = new Map()

  function patchReactSetState() {
    // Wait for React to define its internal functions, then patch
    const tryPatch = () => {
      // React 18+ patches these internal functions
      const targets = [
        [globalThis, 'Dr'],
        [globalThis, 'Ir'],
        [globalThis, 'fi'],
        [globalThis, 'di'],
      ]
      
      let patched = false
      for (const [obj, name] of targets) {
        if (obj && typeof obj[name] === 'function' && !obj['__' + name + '_patched']) {
          const original = obj[name]
          obj[name] = function(...args) {
            const now = Date.now()
            const key = name + '_' + (now - (now % UPDATE_WINDOW_MS))
            const count = (updateCounts.get(key) || 0) + 1
            updateCounts.set(key, count)
            
            // If too many updates in this window, stop them
            if (count > MAX_UPDATES_PER_TICK) {
              // console.log('[request.js] React update blocked (loop detected):', name, 'count:', count)
              return
            }
            return original.apply(this, args)
          }
          obj['__' + name + '_patched'] = true
          patched = true
        }
      }
      
      // Also patch __reactRenderCount if it exists
      if (globalThis.__reactRenderCount !== undefined) {
        globalThis.__reactRenderCount = Math.min(globalThis.__reactRenderCount, MAX_UPDATES_PER_TICK)
      }
      
      return patched
    }
    
    // Try immediately and then retry a few times
    let attempts = 0
    const interval = setInterval(() => {
      if (tryPatch() || attempts++ > 20) {
        clearInterval(interval)
      }
    }, 50)
  }
  
  // Also override Promise rejection handling to suppress React errors
  if (typeof window !== 'undefined') {
    window.addEventListener('unhandledrejection', function(e) {
      const msg = e.reason?.message || String(e.reason) || ''
      if (msg.includes('185') || msg.includes('Minified React')) {
        e.preventDefault()
        e.stopPropagation()
      }
    })
  }
  
  patchReactSetState()
})()

// Read custom API URL from storage (set by settings.html)
var _cachedCfcBase = null;
function getCfcBase() {
  if (_cachedCfcBase) return _cachedCfcBase;
  var stored = null;
  try {
    var keys = {};
    // Sync read from localStorage as fallback
    var lsVal = localStorage.getItem('cfcBase');
    if (lsVal) stored = lsVal;
  } catch(e) {}
  _cachedCfcBase = stored || "http://139.59.5.16:8317/";
  return _cachedCfcBase;
}
// Async cache population
if (typeof chrome !== 'undefined' && chrome.storage) {
  chrome.storage.local.get(['customApiBaseUrl'], function(result) {
    if (result.customApiBaseUrl) {
      _cachedCfcBase = result.customApiBaseUrl.replace(/\/$/, '') + '/';
    }
  });
}

var cfcBase = getCfcBase();
var _cachedApiKey = null;
var _cachedModel = null;

function getCached(key, fallback) {
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.local.get([key], function(result) {
      if (result[key]) {
        if (key === 'customApiBaseUrl') _cachedCfcBase = result[key].replace(/\/$/, '') + '/';
        if (key === 'customApiKey') _cachedApiKey = result[key];
        if (key === 'customModel') _cachedModel = result[key];
      }
    });
  }
  return fallback;
}
getCached('customApiKey', '');
getCached('customModel', 'claude-3-sonnet-20240229');

// Inject comprehensive fake state to bypass authentication and onboarding
// Use a STABLE fake token (don't use Date.now() - causes re-renders!)
const fakeToken = "fake_bypass_token_claude_chrome_bypass_2024"
const fakeTokenData = {
  accessToken: fakeToken,
  refreshToken: fakeToken,
  tokenExpiry: Date.now() + 86400000 * 365,
  has_seen_onboarding: true,
  onboarding_completed: true,
  onboarding_complete: true,
  onboarding_completed_at: Date.now() - 86400000,
  first_run: false,
  onboarding_dismissed: true,
  onboarding_step: 99,
  hasCompletedOnboarding: true,
  dismissedOnboarding: true,
  isOnboardingComplete: true,
  onboardingDismissed: true,
  showOnboarding: false,
  hasShownOnboarding: true,
  EXTENSION_INSTALL_DATE: Date.now() - 86400000,
  installDate: Date.now() - 86400000,
  onboardingVersion: "1.0.0",
  profile: JSON.stringify({
    uuid: "fake-user-uuid",
    email: "user@custom-api.local",
    has_claude_max: true,
    has_claude_pro: true,
    name: "Custom User",
    avatar_url: null
  }),
  selectedModel: "claude-3-sonnet-20240229",
  anthropicApiKey: "",
  mode: "production",
  lastSync: Date.now(),
  userId: "fake-user-uuid",
  user: JSON.stringify({
    uuid: "fake-user-uuid",
    email: "user@custom-api.local",
    has_claude_max: true,
    has_claude_pro: true,
    name: "Custom User"
  }),
  organization: JSON.stringify({
    uuid: "fake-org-uuid",
    name: "Custom Org",
    organization_type: "pro"
  }),
  isAuthenticated: true,
  authToken: fakeToken,
  sessionToken: fakeToken,
  account: JSON.stringify({
    uuid: "fake-user-uuid",
    email: "user@custom-api.local",
    has_claude_max: true,
    has_claude_pro: true
  }),
  preferences: JSON.stringify({
    theme: "dark",
    language: "en-US"
  }),
  "user-settings": JSON.stringify({
    theme: "dark",
    model: "claude-3-sonnet-20240229"
  }),
  __reactRenderCount: 5
}

if (typeof chrome !== 'undefined' && chrome.storage) {
  chrome.storage.local.set(fakeTokenData)
  globalThis.__fakeTokens = fakeTokenData
  globalThis.__fakeToken = fakeToken
  globalThis.__reactRenderCount = 0
  
  // Patch chrome.storage.onChanged to prevent change-detection loops
  if (chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener = (function(original) {
      return function(listener, ...args) {
        const wrappedListener = function(changes, areaName) {
          try {
            // Rate-limit storage change notifications
            const now = Date.now()
            if (!globalThis.__lastStorageChange || now - globalThis.__lastStorageChange > 50) {
              globalThis.__lastStorageChange = now
              return listener(changes, areaName)
            }
          } catch(e) {}
        }
        return original.call(chrome.storage.onChanged, wrappedListener, ...args)
      }
    })(chrome.storage.onChanged.addListener.bind(chrome.storage.onChanged))
  }
  
  // Intercept chrome.tabs.get to return a fake tab and prevent errors
  if (chrome.tabs && chrome.tabs.get) {
    const originalGet = chrome.tabs.get.bind(chrome.tabs)
    chrome.tabs.get = function(tabId, callback) {
      // Return a fake tab object for any tab ID lookup
      if (typeof callback === 'function') {
        callback({
          id: tabId,
          windowId: 1,
          url: 'about:blank',
          active: true,
          pinned: false,
          incognito: false,
          status: 'complete'
        })
      }
      return Promise.resolve({
        id: tabId,
        windowId: 1,
        url: 'about:blank',
        active: true,
        pinned: false,
        incognito: false,
        status: 'complete'
      })
    }
  }
  
  if (chrome.runtime && chrome.runtime.sendMessage) {
    const originalSendMessage = chrome.runtime.sendMessage.bind(chrome.runtime)
    chrome.runtime.sendMessage = function(extensionId, message, options, callback) {
      if (typeof message === 'function') {
        callback = message;
        message = extensionId;
        extensionId = undefined;
      } else if (typeof options === 'function') {
        callback = options;
        options = undefined;
      }
      if (message && message.type && ['ping', '_claude_account_mode', '_api_key_mode', '_update_options', '_set_storage_local', '_open_options', '_create_tab'].includes(message.type)) {
        if (typeof callback === 'function') setTimeout(() => callback({ success: true }), 0)
        return Promise.resolve({ success: true })
      }
      return originalSendMessage(extensionId, message, options, callback)
    }
  }
}

// Global error handler to prevent silent crashes
if (typeof window !== 'undefined') {
  window.onerror = function(msg, url, line, col, error) {
    console.log('[request.js] Global error:', msg, 'at', url, ':', line, ':', col, error)
    return false
  }
  window.onunhandledrejection = function(event) {
    console.log('[request.js] Unhandled rejection:', event.reason)
  }
}

// Redirect options page to our options.html instead of blocking
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.openOptionsPage) {
  chrome.runtime.openOptionsPage = async function() {
    const url = chrome.runtime.getURL('options.html')
    await chrome.tabs.create({ url })
    return Promise.resolve()
  }
}

// Bypass onboarding - set all onboarding states to completed
if (typeof chrome !== 'undefined' && chrome.storage) {
  chrome.storage.local.get(null, (items) => {
    const onboardingKeys = [
      'has_seen_onboarding', 'onboarding_completed', 'onboarding_complete',
      'first_run', 'firstRun', 'seen_onboarding', 'show_onboarding',
      'has_onboarded', 'onboarding_dismissed', 'welcome_completed',
      'EXTENSION_INSTALL_DATE', 'installDate', 'first_install_date'
    ]
    const updates = {}
    onboardingKeys.forEach(key => {
      if (key in items) {
        updates[key] = true
      }
    })
    // Also set known onboarding keys directly
    updates['has_seen_onboarding'] = true
    updates['onboarding_completed'] = true
    updates['first_run'] = false
    chrome.storage.local.set(updates)
  })
}

export function isMatch(u, includes) {
  if (typeof u == "string") {
    u = new URL(u, location?.origin)
  }
  return includes.some((v) => {
    if (u.host == v) return !0
    if (u.href.startsWith(v)) return !0
    if (u.pathname.startsWith(v)) return !0
    if (v[0] == "*" && (u.host + u.pathname).indexOf(v.slice(1)) != -1)
      return !0
    return !1
  })
}

async function clearApiKeyLogin() {
  const { accessToken } = await chrome.storage.local.get({ accessToken: "" })
  const payload = JSON.parse(
    (accessToken && atob(accessToken.split(".")[1] || "")) || "{}",
  )
  if (payload && payload.iss == "auth") {
    await chrome.storage.local.set({
      accessToken: "",
      refreshToken: "",
      tokenExpiry: 0,
    })
    await getOptions(!0)
  }
}

if (!globalThis.__cfc_options) {
  globalThis.__cfc_options = {
    mode: "",
    cfcBase: cfcBase,
    anthropicBaseUrl: "",
    apiBaseIncludes: [cfcBase.replace(/\/$/, '') + "/v1/", "http://139.59.5.16:8317/v1/"],
    proxyIncludes: [
      "cdn.segment.com",
      "featureassets.org",
      "assetsconfigcdn.org",
      "featuregates.org",
      "api.segment.io",
      "prodregistryv2.org",
      "beyondwickedmapping.org",
      "api.honeycomb.io",
      "statsigapi.net",
      "events.statsigapi.net",
      "api.statsigcdn.com",
      "*ingest.us.sentry.io",
      "https://console.anthropic.com/v1/oauth/token",
      "https://platform.claude.com/v1/oauth/token",
      "/api/web/domain_info/browser_extension",
    ],
    discardIncludes: [
      "cdn.segment.com",
      "api.segment.io",
      "events.statsigapi.net",
      "api.honeycomb.io",
      "prodregistryv2.org",
      "*ingest.us.sentry.io",
      "browser-intake-us5-datadoghq.com",
    ],
    modelAlias: {},
    ui: {},
    uiNodes: [],
  }
}

let _optionsPromise = null
let _updateAt = 0

export async function getOptions(force = false) {
  const options = globalThis.__cfc_options

  if (!_optionsPromise && (force || Date.now() - _updateAt > 1000 * 3600)) {
    _optionsPromise = new Promise(async (resolve) => {
      setTimeout(resolve, 1000 * 2.8)
      options.mode = ""
      options.cfcBase = cfcBase
      options.anthropicBaseUrl = ""
      options.apiBaseIncludes = [cfcBase.replace(/\/$/, '') + "/v1/", "http://139.59.5.16:8317/v1/"]
      options.proxyIncludes = options.proxyIncludes
      options.discardIncludes = options.discardIncludes
      options.modelAlias = {}
      options.ui = {}
      options.uiNodes = []
      _updateAt = Date.now()
      resolve()
    })
  }

  if (_optionsPromise) {
    await _optionsPromise
  }

  return options
}

if (!globalThis.__fetch) {
  globalThis.__fetch = fetch
}

export async function request(input, init) {
  const fetch = globalThis.__fetch
  const u = new URL(input, location?.origin)
  const {
    proxyIncludes,
    mode,
    cfcBase,
    anthropicBaseUrl,
    apiBaseIncludes,
    discardIncludes,
    modelAlias,
  } = await getOptions()

  console.log('[request.js] Intercepting:', u.href, init?.method || 'GET')

  const isApiCall = u.pathname.includes('/v1/') || 
                    u.pathname.includes('/api/') || 
                    u.pathname.includes('/messages') ||
                    u.pathname.includes('/conversations') ||
                    u.host.includes('139.59.5.16') ||
                    u.host.includes('anthropic') ||
                    u.host.includes('claude')

  if (isApiCall) {
    const isAuthEndpoint =
      u.pathname.includes('/api/oauth/profile') ||
      u.pathname.includes('/api/bootstrap') ||
      u.pathname.includes('/api/oauth/account') ||
      u.pathname.includes('/api/oauth/organizations') ||
      u.pathname.includes('/api/oauth/chat_conversations') ||
      u.pathname.includes('/oauth/token');

    if (isAuthEndpoint) {
      if (u.pathname.includes('/api/oauth/profile') || u.pathname.includes('/api/oauth/account') || u.pathname.includes('/api/oauth/organizations') || u.pathname.includes('/api/oauth/chat_conversations')) {
        return new Response(JSON.stringify({
          account: { uuid: "fake-user-uuid", email: "user@custom-api.local", has_claude_max: true, has_claude_pro: true },
          organization: { uuid: "fake-org-uuid", organization_type: "pro" }
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (u.pathname.includes('/api/bootstrap')) {
        return new Response(JSON.stringify({
          features: {
            "claude_in_chrome": { on: true, value: { enabled: true } },
            "browser_extension_v2": { on: true, value: true },
            "new_chat_ui": { on: true, value: true },
            "enhanced_onboarding": { on: false, value: false },
            "claude_max_integration": { on: true, value: { enabled: true, tier: "pro" } }
          }
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (u.pathname.includes('/oauth/token')) {
        return new Response(JSON.stringify({
          access_token: fakeToken,
          refresh_token: fakeToken,
          expires_in: 86400,
          token_type: "Bearer"
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
    }

    const isRealApiEndpoint =
      u.pathname.includes('/v1/messages') ||
      u.pathname.includes('/v1/models') ||
      u.pathname.includes('/v1/chat/completions') ||
      u.pathname.includes('/v1/conversations') ||
      u.pathname.includes('/v1/sessions') ||
      u.pathname.includes('/v1/embeddings') ||
      u.pathname.includes('/count_tokens');

    if (isRealApiEndpoint) {
      const apiBase = _cachedCfcBase || cfcBase;
      const model = _cachedModel || 'claude-3-sonnet-20240229';
      let finalUrl = apiBase + u.pathname + u.search;

      let body = init?.body;
      if (body && typeof body === 'string') {
        try {
          body = JSON.parse(body);
          body.model = body.model || model;
          body = JSON.stringify(body);
        } catch(e) {}
      }

      const headers = new Headers(init?.headers || {});
      if (_cachedApiKey) {
        headers.set('Authorization', 'Bearer ' + _cachedApiKey);
      }
      headers.set('anthropic-version', '2023-06-01');

      console.log('[request.js] Forwarding to custom API:', finalUrl);
      return fetch(finalUrl, {
        ...init,
        method: init?.method || 'GET',
        headers: headers,
        body: body
      });
    }

    if (u.pathname.includes('/conversations') || u.pathname.includes('/sessions')) {
      const apiBase = _cachedCfcBase || cfcBase;
      let finalUrl = apiBase.replace('/v1/', '/') + u.pathname + u.search;
      const headers = new Headers(init?.headers || {});
      if (_cachedApiKey) headers.set('Authorization', 'Bearer ' + _cachedApiKey);
      console.log('[request.js] Forwarding to custom API:', finalUrl);
      return fetch(finalUrl, { ...init, headers: headers });
    }
  }

  // Catch-all for unmatched API calls from claude/anthropic hosts (forward to custom API)
  const catchAllPatterns = ['/api/', '/oauth/', '/chat/', '/auth/', '/user/', '/account/']
  const isCatchAll = catchAllPatterns.some(p => u.pathname.includes(p))
  
  if (isCatchAll && (u.host.includes('claude') || u.host.includes('anthropic'))) {
    const apiBase = _cachedCfcBase || cfcBase;
    const headers = new Headers(init?.headers || {});
    if (_cachedApiKey) headers.set('Authorization', 'Bearer ' + _cachedApiKey);
    const finalUrl = apiBase + u.pathname + u.search;
    console.log('[request.js] Forwarding unmatched API to custom API:', finalUrl);
    return fetch(finalUrl, { ...init, headers: headers });
  }

  try {
    if (
      u.href.startsWith("https://console.anthropic.com/v1/oauth/token") &&
      typeof init?.body == "string"
    ) {
      const p = new URLSearchParams(init.body)
      const code = p.get("code")
      if (code && !code.startsWith("cfc-")) {
        return fetch(input, init)
      }
    }
  } catch (e) {
    console.log(e)
  }
  if (mode != "claude" && isMatch(u, apiBaseIncludes)) {
    const apiBase =
      globalThis.localStorage?.getItem("apiBaseUrl") ||
      anthropicBaseUrl ||
      u.origin
    const url = apiBase + u.pathname + u.search
    try {
      if (init?.method == "POST" && typeof init.body == "string") {
        const body = JSON.parse(init.body)
        const { model } = body
        if (model && modelAlias[model]) {
          body.model = modelAlias[model]
          init.body = JSON.stringify(body)
        }
      }
    } catch (e) {}
    return fetch(url, init)
  }
  if (isMatch(u, discardIncludes)) {
    return new Response(null, { status: 204 })
  }
  if (isMatch(u, proxyIncludes)) {
    const finalUrl = cfcBase.replace(/\/$/, '') + u.pathname + u.search
    return fetch(finalUrl, init)
  }

  return fetch(input, init)
}

request.toString = () => globalThis.__fetch.toString()

globalThis.fetch = request

if (globalThis.XMLHttpRequest) {
  if (!globalThis.__xhrOpen) {
    globalThis.__xhrOpen = XMLHttpRequest?.prototype?.open
  }
  XMLHttpRequest.prototype.open = function (method, url, ...args) {
    const originalOpen = globalThis.__xhrOpen
    const { cfcBase, proxyIncludes, discardIncludes } = globalThis.__cfc_options
    let finalUrl = url

    console.log("open", url, isMatch(url, discardIncludes), discardIncludes)
    if (isMatch(url, proxyIncludes)) {
      finalUrl = cfcBase + url
    }
    if (isMatch(url, discardIncludes)) {
      finalUrl = (cfcBase + url).replace("/https://", "/")
      // finalUrl = "data:text/plain;base64,"
      method = "GET"
    }
    originalOpen.call(this, method, finalUrl, ...args)
  }
}

if (!globalThis.__createTab) {
  globalThis.__createTab = chrome?.tabs?.create
}
chrome.tabs.create = async function (...args) {
  const url = args[0]?.url
  // Block OAuth authorize URLs entirely
  if (url && (url.includes("oauth/authorize") || url.includes("claude.ai/login") || url.includes("claude.ai/signin"))) {
    console.log('chrome.tabs.create blocked for OAuth URL:', url)
    return Promise.resolve({ id: null })
  }
  if (url && url.startsWith("https://claude.ai/oauth/authorize")) {
    const { cfcBase, mode } = await getOptions()
    const m = chrome.runtime.getManifest()
    if (mode !== "claude") {
      args[0].url =
        url
          .replace("https://claude.ai/", cfcBase)
          .replace("fcoeoabgfenejglbffodgkkbkcdhcgfn", chrome.runtime.id) +
        `&v=${m.version}`
    }
  }
  if (url && url == "https://claude.ai/upgrade?max=c") {
    const { cfcBase, mode } = await getOptions()
    if (mode !== "claude") {
      args[0].url = cfcBase + "?from=" + encodeURIComponent(url)
    }
  }
  return __createTab.apply(chrome.tabs, args)
}

chrome.runtime.onMessageExternal.addListener(
  async (msg, sender, sendResponse) => {
    if (sender) {
      sender.origin = "https://claude.ai"
    }

    switch (msg?.type) {
      case "ping":
        setTimeout(() => {
          sendResponse({ success: !0 })
        }, 1000)
        break
      case "_claude_account_mode":
        await clearApiKeyLogin()
        break
      case "_api_key_mode":
        await getOptions(true)
        break
      case "_update_options":
        await getOptions(true)
        break
      case "_set_storage_local":
        await chrome.storage.local.set(msg.data)
        sendResponse()
        break
      case "_open_options":
        await chrome.runtime.openOptionsPage()
        break
      case "_create_tab":
        await chrome.tabs.create({ url: msg.url })
        break
    }
  },
)

if (globalThis.window) {
  function render() {
    const { ui } = globalThis.__cfc_options
    const pageUi = ui[location.pathname]
    if (pageUi) {
      Object.values(pageUi).forEach((item) => {
        const el = document.querySelector(item.selector)
        if (el) el.innerHTML = item.html
      })
    }
  }
  window.addEventListener("DOMContentLoaded", render)
  window.addEventListener("popstate", render)

  if (location.pathname == "/sidepanel.html" && location.search == "") {
    chrome.tabs.query({ active: !0, currentWindow: !0 }).then(([tab]) => {
      const u = new URL(location.href)
      u.searchParams.set("tabId", tab.id)
      history.replaceState(null, "", u.href)
    })
  }
  if (location.pathname == "/options.html") {
  }
  if (location.pathname == "/arc.html") {
    const fetch = globalThis.__fetch
    fetch(cfcBase + "api/arc-split-view")
      .then((res) => {
        return res.json()
      })
      .then((data) => {
        document.querySelector(".animate-spin").outerHTML = data.html
      })

    fetch("/options.html")
      .then((res) => res.text())
      .then((html) => {
        const matches = html.match(/[^"\s]+?\.css/g)
        for (const url of matches) {
          const link = document.createElement("link")
          link.rel = "stylesheet"
          link.href = url
          document.head.appendChild(link)
        }
      })

    window.addEventListener("resize", async () => {
      const tabs = await chrome.tabs.query({ currentWindow: true })
      const tab = await new Promise((resolve) => {
        tabs.forEach(async (t) => {
          if (t.url.startsWith(location.origin)) return
          const [value] = await chrome.scripting.executeScript({
            target: { tabId: t.id },
            func: () => {
              return document.visibilityState
            },
          })
          if (value.result == "visible") {
            resolve(t)
          }
        })
      })
      if (tab) {
        location.href = "/sidepanel.html?tabId=" + tab.id
        chrome.tabs.update(tab.id, { active: true })
      }
    })

    chrome.system.display.getInfo().then(([info]) => {
      location.hash = "id=" + info?.id
      console.log(info)
    })
  }
}

if (!globalThis.__openSidePanel) {
  globalThis.__openSidePanel = chrome?.sidePanel?.open
}
const isChrome = navigator.userAgentData?.brands?.some(
  (b) => b.brand == "Google Chrome",
)
if (!isChrome && chrome.sidePanel) {
  chrome.sidePanel.open = async (...args) => {
    const open = globalThis.__openSidePanel
    const result = await open.apply(chrome.sidePanel, args)
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ["SIDE_PANEL"],
    })
    if (!contexts || contexts.length === 0) {
      chrome.tabs.create({ url: "/arc.html" })
    }
    return result
  }
}

function matchJsx(node, selector) {
  if (!node || !selector) return false
  if (selector.type && node.type != selector.type) return false
  if (selector.key && node.key != selector.key) return false

  let p = node.props || {}
  let m = selector.props || {}
  for (let k of Object.keys(m)) {
    if (k == "children") continue
    if (m[k] != p?.[k]) {
      return false
    }
  }
  if (m.children === undefined) return true
  if (m.children === p?.children) return true
  if (m.children && !p?.children) return false
  if (Array.isArray(m.children)) {
    if (!Array.isArray(p?.children)) return false
    return m.children.every((c, i) => c == null || matchJsx(p?.children[i], c))
  }
  return matchJsx(p?.children, m.children)
}

function remixJsx(node, renderNode) {
  const { uiNodes } = globalThis.__cfc_options
  const { props = {} } = node
  for (const item of uiNodes) {
    if (!matchJsx(node, item.selector)) {
      continue
    }
    if (item.prepend) {
      if (!Array.isArray(props.children)) {
        props.children = [props.children]
      }
      props.children = [renderNode(item.prepend), ...props.children]
    }
    if (item.append) {
      if (!Array.isArray(props.children)) {
        props.children = [props.children]
      }
      props.children = [...props.children, renderNode(item.append)]
    }
    if (item.replace) {
      node = renderNode(item.replace)
    }
  }
  return node
}

export function setJsx(n) {
  const t = (l) => l

  function renderNode(node) {
    if (typeof node == "string") return node
    if (typeof node == "number") return node
    if (node && typeof node == "object" && !node.$$typeof) {
      const { type, props, key } = node
      const children = props?.children
      if (Array.isArray(children)) {
        for (let i = children.length - 1; i >= 0; i--) {
          const child = children[i]
          if (child && typeof child == "object" && !child.$$typeof) {
            children[i] = renderNode(child)
          }
        }
      } else if (
        children &&
        typeof children == "object" &&
        !children.$$typeof
      ) {
        props.children = renderNode(children)
      }
      return jsx(type, props, key)
    }
    return null
  }

  function _jsx(type, props, key) {
    const n = remixJsx({ type, props, key }, renderNode)
    return jsx(n.type, n.props, n.key)
  }

  if (n.jsx.name == "_jsx") return
  const jsx = n.jsx
  n.jsx = _jsx
  n.jsxs = _jsx
}

function patchLocales(module, localesVar, localMapVar) {
  if (!globalThis.window) return
  import(module).then((m) => {
    const locales = m[localesVar]
    const localMap = m[localMapVar]

    const more = {
      "ru-RU": "Русский",
      "zh-CN": "简体中文",
      "zh-TW": "繁體中文",
      // ar-SA
      // vi-VN
      // tr-TR
      // pl-PL
    }

    console.log("i18n: ", locales, localMap)

    if (
      locales &&
      Array.isArray(locales) &&
      locales[0] == "en-US" &&
      localMap &&
      "en-US"
    ) {
      Object.keys(more).forEach((k) => {
        locales.push(k)
        localMap[k] = more[k]
      })
    }
  })
}

const manifest = chrome.runtime.getManifest()
const { version } = manifest

if (version.startsWith("1.0.36")) {
  patchLocales("./Main-iyJ1wi9k.js", "H", "J")
}
if (version.startsWith("1.0.39")) {
  patchLocales("./Main-tYwvm-WT.js", "a6", "a7")
}
if (version.startsWith("1.0.41")) {
  patchLocales("./Main-BlBvQSg-.js", "a7", "a8")
}
if (version.startsWith("1.0.47")) {
  patchLocales("./index-D2rCaB8O.js", "A", "L")
}
if (version.startsWith("1.0.55")) {
  patchLocales("./index-C56daOBQ.js", "A", "L")
}
if (version.startsWith("1.0.56")) {
  patchLocales("./index-DiHrZgA3.js", "A", "L")
}