/**
 * dsh-provider-balance — host half（dsh-balance-card + dsh-chatgpt-login 合并版）。
 *
 * 1. DeepSeek 余额：`GET /ext/balance` 同源代理，按 llm-deepseek 适配器相同方式
 *    解析 API Key（设置 → 凭据 → 环境变量）并查询官方 `GET /user/balance`。
 * 2. ChatGPT 账号接入 DSH 的 LLM provider（openai-codex 路由，Codex 协议），
 *    并保持与本机 CodexManager 的账号同步：
 *    - CodexManager 同步（主路径）：监听 `~/.codex/auth.json`，检测到变化后把
 *      当前账号的 OAuth access token 镜像进 DSH 凭据（CHATGPT_ACCESS_TOKEN）
 *      与令牌库（~/.dsh/chatgpt-oauth.json），DSH 即跟随 CodexManager 切换账号。
 *    - 设备码授权流（备用路径，无 CodexManager 时）：auth.openai.com 官方流程。
 *    - 后台刷新：仅对设备码登录的令牌做 refresh（CodexManager 的令牌由它自己刷新）。
 *    - 额度探测：通过 pi-ai 的 Codex 客户端（WebSocket，可穿透 Cloudflare）
 *      发 1-token 探测请求判断 ChatGPT 额度是否可用。
 *
 * Routes (same-origin only):
 *   GET  /ext/balance              — DeepSeek 余额
 *   GET  /ext/chatgpt/status       — ChatGPT 登录状态（source/plan/expires）
 *   GET  /ext/chatgpt/quota        — ChatGPT 额度探测（90s 缓存）
 *   POST /ext/chatgpt/login/start  — 发起设备码授权（备用）
 *   GET  /ext/chatgpt/login/status — 轮询授权结果
 *   POST /ext/chatgpt/login/open-manager — 打开 CodexManager（主登录路径）
 *   POST /ext/chatgpt/logout       — 退出（仅清设备码登录的令牌）
 */
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import { dshHomePath } from '@deepseek-ai/dsh-home-paths'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import { spawn } from 'node:child_process'
import { existsSync, readFileSync, renameSync, watch, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { createModels } from '@earendil-works/pi-ai'
import { openaiCodexProvider } from '@earendil-works/pi-ai/providers/openai-codex'

export const name = 'dsh-provider-balance'
export const inject = ['webServer', 'credentials', 'settings']

export const STATUS_PATH = '/ext/chatgpt/status'
export const QUOTA_PATH = '/ext/chatgpt/quota'
export const LOGIN_START_PATH = '/ext/chatgpt/login/start'
export const LOGIN_STATUS_PATH = '/ext/chatgpt/login/status'
export const LOGOUT_PATH = '/ext/chatgpt/logout'
export const MANAGER_OPEN_PATH = '/ext/chatgpt/login/open-manager'

/** DeepSeek 余额路由（来自 dsh-balance-card）。 */
export const BALANCE_ROUTE_PATH = '/ext/balance'
export const DEFAULT_BASE_URL = 'https://api.deepseek.com'
export const DEFAULT_API_KEY_ENV = 'DEEPSEEK_API_KEY'
export const UPSTREAM_TIMEOUT_MS = 10_000

/** 凭据引用：access token 通过这个 ref 供 llm-pi-ai 适配器读取。 */
export const TOKEN_REF = 'CHATGPT_ACCESS_TOKEN'
export const PROVIDER_ROUTE = 'openai-codex'
export const PROVIDER_SETTINGS_NS = 'llm-pi-ai'

export const CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann'
export const AUTH_BASE = 'https://auth.openai.com'
export const DEVICE_USER_CODE_URL = `${AUTH_BASE}/api/accounts/deviceauth/usercode`
export const DEVICE_TOKEN_URL = `${AUTH_BASE}/api/accounts/deviceauth/token`
export const TOKEN_URL = `${AUTH_BASE}/oauth/token`
export const DEVICE_REDIRECT_URI = `${AUTH_BASE}/deviceauth/callback`
export const VERIFICATION_URL = `${AUTH_BASE}/codex/device`

export const CODEX_AUTH_FILE = join(homedir(), '.codex', 'auth.json')
/** CodexManager.app 安装路径（macOS）。登录主路径：打开 CodexManager，token 由它写回 auth.json 后自动同步。 */
export const CODEX_MANAGER_APP = '/Applications/CodexManager.app'
export const CHOOSE_ACCOUNT_URL = 'https://auth.openai.com/choose-an-account'
export const MAX_BODY_BYTES = 16 * 1024
export const REQUEST_TIMEOUT_MS = 15_000
export const REFRESH_AHEAD_MS = 6 * 60 * 60 * 1000
export const REFRESH_INTERVAL_MS = 30 * 60 * 1000
/** CodexManager 文件轮询兜底间隔（watch 可能漏掉原子替换）。 */
export const CODEX_WATCH_POLL_MS = 30 * 1000
export const QUOTA_CACHE_MS = 90 * 1000

/** 进行中的设备码授权（单实例登录）。 */
let deviceFlow = null
/** 手动授权切换后的临时覆盖：等待 CodexManager auth.json 真正变化。 */
let manualOverride = null
/** 最近一次观察到的 CodexManager access token。 */
let lastCodexAccess = null
/** 额度探测缓存。 */
let quotaCache = { at: 0, value: undefined }

export function apply(ctx) {
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact', path: BALANCE_ROUTE_PATH,
    handler: (req, res) => handleBalanceRequest(ctx, req, res),
  }), 'dsh-provider-balance: balance route')
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact', path: STATUS_PATH,
    handler: (req, res) => handleStatus(ctx, req, res),
  }), 'dsh-chatgpt-login: status route')
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact', path: QUOTA_PATH,
    handler: (req, res) => handleQuota(ctx, req, res),
  }), 'dsh-chatgpt-login: quota route')
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact', path: LOGIN_START_PATH,
    handler: (req, res) => handleLoginStart(ctx, req, res),
  }), 'dsh-chatgpt-login: login start route')
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact', path: LOGIN_STATUS_PATH,
    handler: (req, res) => handleLoginStatus(ctx, req, res),
  }), 'dsh-chatgpt-login: login status route')
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact', path: LOGOUT_PATH,
    handler: (req, res) => handleLogout(ctx, req, res),
  }), 'dsh-chatgpt-login: logout route')
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact', path: MANAGER_OPEN_PATH,
    handler: (req, res) => handleOpenManager(ctx, req, res),
  }), 'dsh-chatgpt-login: open codex-manager route')

  // CodexManager 监听：watch 目录（捕获原子替换）+ 轮询兜底。
  ctx.effect(() => {
    let timer
    let debounce
    let watcher
    try {
      watcher = watch(join(homedir(), '.codex'), (event, filename) => {
        if (filename !== 'auth.json') return
        clearTimeout(debounce)
        debounce = setTimeout(() => {
          syncFromCodexManager(ctx).catch((error) => ctx.logger.warn(`dsh-chatgpt-login: codex sync failed: ${error}`))
        }, 800)
      })
    } catch {
      watcher = undefined
    }
    timer = setInterval(() => {
      syncFromCodexManager(ctx).catch((error) => ctx.logger.warn(`dsh-chatgpt-login: codex poll failed: ${error}`))
    }, CODEX_WATCH_POLL_MS)
    return () => {
      clearTimeout(debounce)
      clearInterval(timer)
      try { watcher?.close() } catch { /* already closed */ }
    }
  }, 'dsh-chatgpt-login: codex manager watch')

  // 后台刷新循环（仅设备码登录的令牌）+ 启动自愈。
  ctx.effect(() => {
    const timer = setInterval(() => {
      refreshTokens(ctx).catch((error) => ctx.logger.warn(`dsh-chatgpt-login: refresh failed: ${error}`))
    }, REFRESH_INTERVAL_MS)
    return () => clearInterval(timer)
  }, 'dsh-chatgpt-login: refresh loop')
  ctx.effect(() => {
    (async () => {
      await syncFromCodexManager(ctx)
      await ensureProviderRoute(ctx)
    })().catch((error) => ctx.logger.warn(`dsh-chatgpt-login: self-heal failed: ${error}`))
  }, 'dsh-chatgpt-login: activation self-heal')
}

// ── 令牌存储 ──────────────────────────────────────────────────────────────

export function tokenStorePath() {
  return dshHomePath('chatgpt-oauth.json')
}

export function readTokenStore() {
  try {
    const parsed = JSON.parse(readFileSync(tokenStorePath(), 'utf8'))
    if (parsed && typeof parsed.access === 'string' && typeof parsed.refresh === 'string') {
      return parsed
    }
  } catch {
    // missing or unreadable — treated as logged out
  }
  return undefined
}

export function writeTokenStore(store) {
  const path = tokenStorePath()
  const tmp = `${path}.tmp`
  writeFileSync(tmp, JSON.stringify(store, null, 2), { mode: 0o600 })
  renameSync(tmp, path)
}

export function clearTokenStore() {
  try {
    renameSync(tokenStorePath(), `${tokenStorePath()}.bak`)
  } catch {
    // absent is fine
  }
}

// ── CodexManager 同步 ─────────────────────────────────────────────────────

function decodeJwtPayload(token) {
  try {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'))
  } catch {
    return undefined
  }
}

/** 从 ~/.codex/auth.json 读取当前账号，镜像进 DSH。 */
export async function syncFromCodexManager(ctx) {
  let auth
  try {
    auth = JSON.parse(readFileSync(CODEX_AUTH_FILE, 'utf8'))
  } catch {
    return // auth.json 不存在/不可读 —— 保持现状，不主动登出
  }
  const access = auth?.tokens?.access_token
  const refresh = auth?.tokens?.refresh_token
  if (typeof access !== 'string' || access.length < 20) return
  if (manualOverride) {
    if (access === manualOverride.codexAccess) return
    // CodexManager 已经写入了新的令牌/账号，结束手动覆盖并恢复同步。
    manualOverride = null
  }
  lastCodexAccess = access
  const payload = decodeJwtPayload(access)
  if (!payload) return
  const claim = payload['https://api.openai.com/auth']
  const exp = typeof payload.exp === 'number' ? payload.exp * 1000 : Date.now() + 10 * 60 * 1000
  const idPayload = typeof auth.tokens.id_token === 'string' ? decodeJwtPayload(auth.tokens.id_token) : undefined
  const email = idPayload?.email ?? payload['https://api.openai.com/profile']?.email
  const store = {
    access,
    refresh: typeof refresh === 'string' ? refresh : '',
    expires: exp,
    accountId: claim?.user_id,
    chatgptAccountId: claim?.chatgpt_account_id,
    email,
    plan: claim?.chatgpt_plan_type,
    source: 'codex-manager',
    syncedAt: Date.now(),
  }
  const previous = readTokenStore()
  const same = previous && previous.source === 'codex-manager'
    && previous.access === store.access
    && previous.accountId === store.accountId
  writeTokenStore(store)
  if (!same || !previous) {
    await ensureProviderRoute(ctx)
    ctx.logger.info(`dsh-chatgpt-login: synced CodexManager account ${store.accountId ?? '(unknown)'} (${store.plan ?? 'plan unknown'})`)
  }
}

// ── OAuth 设备码流（备用登录） ───────────────────────────────────────────

async function startDeviceAuth() {
  const response = await fetch(DEVICE_USER_CODE_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ client_id: CLIENT_ID }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`设备码申请失败（HTTP ${response.status}）`)
  const json = await response.json()
  return {
    deviceAuthId: json.device_auth_id,
    userCode: json.user_code,
    intervalSeconds: Number(json.interval) || 5,
  }
}

async function pollDeviceAuth(device) {
  const response = await fetch(DEVICE_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ device_auth_id: device.deviceAuthId, user_code: device.userCode }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (response.ok) {
    const json = await response.json()
    if (json.authorization_code && json.code_verifier) {
      return { status: 'approved', code: json.authorization_code, verifier: json.code_verifier }
    }
    return { status: 'pending' }
  }
  if (response.status === 403 || response.status === 404) return { status: 'pending' }
  let errorCode
  try {
    errorCode = JSON.parse(await response.text())?.error?.code
  } catch { /* keep undefined */ }
  if (errorCode === 'deviceauth_authorization_pending') return { status: 'pending' }
  return { status: 'failed', message: `设备码状态查询失败（HTTP ${response.status}）` }
}

async function exchangeTokens(code, verifier) {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      code,
      code_verifier: verifier,
      redirect_uri: DEVICE_REDIRECT_URI,
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`令牌交换失败（HTTP ${response.status}）：${text.slice(0, 200)}`)
  }
  const json = await response.json()
  if (!json.access_token || !json.refresh_token || typeof json.expires_in !== 'number') {
    throw new Error('令牌交换响应缺少字段')
  }
  const payload = decodeJwtPayload(json.access_token)
  const claim = payload?.['https://api.openai.com/auth']
  const idPayload = typeof json.id_token === 'string' ? decodeJwtPayload(json.id_token) : undefined
  return {
    access: json.access_token,
    refresh: json.refresh_token,
    expires: Date.now() + json.expires_in * 1000,
    accountId: claim?.user_id,
    email: json.email ?? idPayload?.email,
    plan: claim?.chatgpt_plan_type,
    source: 'oauth',
    syncedAt: Date.now(),
  }
}

async function refreshTokenPair(refresh) {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refresh,
      client_id: CLIENT_ID,
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!response.ok) return undefined
  const json = await response.json()
  if (!json.access_token || !json.refresh_token || typeof json.expires_in !== 'number') return undefined
  return {
    access: json.access_token,
    refresh: json.refresh_token,
    expires: Date.now() + json.expires_in * 1000,
  }
}

// ── 与 DSH 的接线 ─────────────────────────────────────────────────────────

/** 旧版插件遗留的会话令牌 ref，启动时清理。 */
const LEGACY_TOKEN_REF = 'CHATGPT_SESSION_TOKEN'

async function ensureProviderRoute(ctx, retry = 0) {
  const store = readTokenStore()
  const credentials = ctx.get('credentials')
  const settings = ctx.get('settings')
  const ref = credentialRef(TOKEN_REF)
  const ns = settingsNamespace(PROVIDER_SETTINGS_NS)
  if (credentials) {
    await credentials.unset(credentialRef(LEGACY_TOKEN_REF)).catch(() => {})
  }
  if (store) {
    if (credentials) {
      await credentials.set(ref, store.access).catch((error) => ctx.logger.warn(`dsh-chatgpt-login: credential write failed: ${error}`))
    }
    if (settings) {
      try {
        await settings.update(ns, { providers: { [PROVIDER_ROUTE]: { apiKeyEnv: TOKEN_REF } } })
      } catch (error) {
        if (retry < 10) {
          await new Promise((resolve) => setTimeout(resolve, 3000))
          return ensureProviderRoute(ctx, retry + 1)
        }
        ctx.logger.warn(`dsh-chatgpt-login: provider config write failed: ${error}`)
      }
    }
  } else {
    if (credentials) {
      await credentials.unset(ref).catch(() => {})
    }
    if (settings) {
      await settings.mutate(ns, [{ op: 'unset', path: ['providers', PROVIDER_ROUTE] }]).catch(() => {})
    }
  }
}

async function refreshTokens(ctx) {
  const store = readTokenStore()
  if (!store || store.source === 'codex-manager') return // CodexManager 自己刷新
  if (Date.now() + REFRESH_AHEAD_MS < store.expires) return
  const next = await refreshTokenPair(store.refresh)
  if (!next) return
  writeTokenStore({ ...store, ...next })
  const credentials = ctx.get('credentials')
  if (credentials) {
    await credentials.set(credentialRef(TOKEN_REF), next.access).catch(() => {})
  }
}

// ── 额度探测 ──────────────────────────────────────────────────────────────

/** 读取 ChatGPT 官方 Codex 额度窗口（非生成请求，不消耗额度）。 */
async function fetchChatGptUsage(store) {
  const accountId = store.chatgptAccountId
  if (!accountId) throw new Error('缺少 ChatGPT account id')
  const response = await fetch('https://chatgpt.com/backend-api/wham/usage', {
    headers: {
      Authorization: `Bearer ${store.access}`,
      'chatgpt-account-id': accountId,
      originator: 'codex_cli_rs',
      'User-Agent': 'codex_cli_rs/0.1.0',
      accept: 'application/json',
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!response.ok) {
    // 区分「会话失效」与其它上游错误，让 UI 提示重新登录而非「额度未知」。
    const body = await response.json().catch(() => null)
    const code = body?.error?.code
    const invalidated = code === 'token_invalidated' || code === 'refresh_token_invalidated'
      || /invalidated|session has ended/i.test(body?.error?.message ?? '')
    if (invalidated) throw new UsageInvalidatedError(body?.error?.message)
    throw new Error(`额度接口返回 HTTP ${response.status}`)
  }
  const json = await response.json()
  const primary = json?.rate_limit?.primary_window
  const secondary = json?.rate_limit?.secondary_window
  return {
    status: json?.rate_limit?.limit_reached ? 'limited' : (json?.rate_limit?.allowed ? 'available' : 'unknown'),
    usedPercent: typeof primary?.used_percent === 'number' ? primary.used_percent : undefined,
    primaryWindowSeconds: primary?.limit_window_seconds,
    resetAfterSeconds: primary?.reset_after_seconds,
    resetAt: primary?.reset_at ? primary.reset_at * 1000 : undefined,
    secondaryUsedPercent: typeof secondary?.used_percent === 'number' ? secondary.used_percent : undefined,
    credits: json?.credits ? {
      balance: json.credits.balance,
      unlimited: json.credits.unlimited,
      hasCredits: json.credits.has_credits,
    } : undefined,
    message: json?.rate_limit?.limit_reached ? 'ChatGPT 额度已达到上限' : undefined,
  }
}

/** 备用：用 pi-ai 的 Codex 客户端发 1-token 探测请求（仅在额度接口不可用时）。 */
async function probeChatGptQuota(store) {
  const credential = {
    type: 'oauth',
    access: store.access,
    refresh: store.refresh,
    expires: store.expires,
    accountId: store.accountId ?? 'unknown',
  }
  const models = createModels({ credentials: {
    read: async (id) => (id === 'openai-codex' ? credential : undefined),
    list: async () => [{ providerId: 'openai-codex', type: 'oauth' }],
    modify: async (id, fn) => fn(credential),
    delete: async () => {},
  } })
  models.setProvider(openaiCodexProvider())
  const model = models.getModel('openai-codex', 'gpt-5.4-mini')
  const stream = models.stream(model, { messages: [{ role: 'user', content: 'hi' }] }, {
    maxOutputTokens: 1,
    signal: AbortSignal.timeout(25_000),
  })
  for await (const chunk of stream) {
    if (chunk.type === 'done') return { status: 'available' }
    if (chunk.type === 'error') {
      const message = String(chunk.error?.errorMessage ?? chunk.error?.message ?? '')
      if (/usage limit|limit|quota|rate/i.test(message)) {
        return { status: 'limited', message: message.slice(0, 200) }
      }
      return { status: 'unknown', message: message.slice(0, 200) }
    }
  }
  return { status: 'unknown', message: '无响应' }
}

/** 会话失效：token 在 OpenAI 侧被作废（需重新登录）。 */
class UsageInvalidatedError extends Error {
  constructor(message) {
    super(message ?? '登录已失效')
    this.name = 'UsageInvalidatedError'
  }
}

async function getQuota(store) {
  if (quotaCache.value && Date.now() - quotaCache.at < QUOTA_CACHE_MS) {
    return { ...quotaCache.value, cached: true }
  }
  let value
  try {
    value = await fetchChatGptUsage(store)
  } catch (error) {
    if (error instanceof UsageInvalidatedError) {
      value = { status: 'invalidated', message: error.message || '登录已失效，请用 CodexManager 重新登录' }
    } else {
      try {
        value = await probeChatGptQuota(store)
      } catch {
        value = {}
      }
      value.message = value.message ?? (error instanceof Error ? `额度详情暂不可用：${error.message}` : '额度详情暂不可用')
    }
  }
  quotaCache = { at: Date.now(), value }
  return { ...value, cached: false }
}

// ── HTTP handlers ─────────────────────────────────────────────────────────

function originAllowed(ctx, req) {
  const origin = req.headers.origin
  if (origin === undefined) return true
  return origin === `http://${ctx.webServer.host}:${ctx.webServer.port}`
}

/**
 * DeepSeek 余额（来自 dsh-balance-card）。
 * 解析连接事实：llm-deepseek 设置节优先，其次环境变量，最后默认值。
 */
function resolveConnectionFacts(ctx) {
  let apiKeyEnv = DEFAULT_API_KEY_ENV
  let baseURL = process.env.DEEPSEEK_BASE_URL ?? DEFAULT_BASE_URL
  try {
    const section = ctx.get('settings')?.get(settingsNamespace('llm-deepseek'))
    if (section !== null && typeof section === 'object') {
      if (typeof section.apiKeyEnv === 'string' && section.apiKeyEnv !== '') {
        apiKeyEnv = section.apiKeyEnv
      }
      if (typeof section.baseURL === 'string' && section.baseURL !== '') {
        baseURL = section.baseURL
      }
    }
  } catch {
    // namespace absent or not served — keep the defaults
  }
  return { apiKeyEnv, baseURL }
}

async function resolveApiKey(ctx, apiKeyEnv) {
  const ref = credentialRef(apiKeyEnv)
  const credential = await ctx.get('credentials')?.resolve(ref)
  if (credential?.value) return credential.value
  const ambient = process.env[apiKeyEnv]
  if (ambient) return ambient
  return undefined
}

async function handleBalanceRequest(ctx, req, res) {
  const origin = req.headers.origin
  const expectedOrigin = `http://${ctx.webServer.host}:${ctx.webServer.port}`
  if (origin !== undefined && origin !== expectedOrigin) {
    respond(res, 403, { ok: false, code: 'forbidden', message: 'Cross-origin request refused.' })
    return
  }
  try {
    const { apiKeyEnv, baseURL } = resolveConnectionFacts(ctx)
    const apiKey = await resolveApiKey(ctx, apiKeyEnv)
    if (!apiKey) {
      respond(res, 200, {
        ok: false,
        code: 'missing-key',
        message: `未找到 API Key（${apiKeyEnv}）。请在 设置 → 模型 中配置后重试。`,
      })
      return
    }
    let response
    try {
      response = await fetch(`${baseURL}/user/balance`, {
        headers: { authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      })
    } catch (error) {
      respond(res, 200, {
        ok: false,
        code: 'network',
        message: `无法连接余额接口：${error instanceof Error ? error.message : String(error)}`,
      })
      return
    }
    const data = await response.json().catch(() => null)
    if (!response.ok) {
      respond(res, 200, {
        ok: false,
        code: 'upstream',
        status: response.status,
        message: `余额接口返回 ${response.status}`,
        data,
      })
      return
    }
    respond(res, 200, { ok: true, data })
  } catch (error) {
    respond(res, 500, {
      ok: false,
      code: 'internal',
      message: error instanceof Error ? error.message : String(error),
    })
  }
}

function respond(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(payload),
  })
  res.end(payload)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(new Error('body too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {})
      } catch (error) {
        reject(error)
      }
    })
    req.on('error', reject)
  })
}

async function handleStatus(ctx, req, res) {
  if (!originAllowed(ctx, req)) {
    respond(res, 403, { ok: false, code: 'forbidden', message: 'Cross-origin request refused.' })
    return
  }
  const store = readTokenStore()
  const credential = await ctx.get('credentials')?.resolve(credentialRef(TOKEN_REF)).catch(() => undefined)
  respond(res, 200, {
    ok: true,
    loggedIn: Boolean(store),
    configured: Boolean(credential?.value),
    source: store?.source ?? null,
    account: store?.email ?? undefined,
    accountId: store?.accountId ?? undefined,
    plan: store?.plan ?? undefined,
    expiresAt: store?.expires ?? undefined,
    syncedAt: store?.syncedAt ?? undefined,
    managerAvailable: codexManagerAvailable(),
  })
}

/** CodexManager 是否安装（macOS）。登录主路径依赖它写回 ~/.codex/auth.json。 */
function codexManagerAvailable() {
  return process.platform === 'darwin' && existsSync(CODEX_MANAGER_APP)
}

/** 打开 CodexManager（其登录走 auth.openai.com/choose-an-account），token 由同步监听接住。 */
async function handleOpenManager(ctx, req, res) {
  if (!originAllowed(ctx, req)) {
    respond(res, 403, { ok: false, code: 'forbidden', message: 'Cross-origin request refused.' })
    return
  }
  if (!codexManagerAvailable()) {
    respond(res, 200, { ok: false, opened: false, code: 'no-manager', message: '未检测到 CodexManager' })
    return
  }
  try {
    const child = spawn('open', ['-a', 'CodexManager'], { detached: true, stdio: 'ignore' })
    child.unref()
    respond(res, 200, { ok: true, opened: true, verifyUrl: CHOOSE_ACCOUNT_URL })
  } catch {
    respond(res, 200, { ok: false, opened: false, code: 'spawn-failed', message: '无法打开 CodexManager' })
  }
}

async function handleQuota(ctx, req, res) {
  if (!originAllowed(ctx, req)) {
    respond(res, 403, { ok: false, code: 'forbidden', message: 'Cross-origin request refused.' })
    return
  }
  const store = readTokenStore()
  if (!store) {
    respond(res, 200, { ok: true, status: 'logged-out', message: '未登录' })
    return
  }
  try {
    const quota = await getQuota(store)
    respond(res, 200, {
      ok: true,
      status: quota.status,
      message: quota.message,
      cached: quota.cached,
      plan: store.plan,
      usedPercent: quota.usedPercent,
      primaryWindowSeconds: quota.primaryWindowSeconds,
      resetAfterSeconds: quota.resetAfterSeconds,
      resetAt: quota.resetAt,
      secondaryUsedPercent: quota.secondaryUsedPercent,
      credits: quota.credits,
    })
  } catch (error) {
    respond(res, 200, { ok: true, status: 'unknown', message: error instanceof Error ? error.message.slice(0, 200) : String(error) })
  }
}

async function handleLoginStart(ctx, req, res) {
  if (!originAllowed(ctx, req)) {
    respond(res, 403, { ok: false, code: 'forbidden', message: 'Cross-origin request refused.' })
    return
  }
  if (req.method !== 'POST') {
    respond(res, 405, { ok: false, code: 'method', message: 'POST only.' })
    return
  }
  try {
    const device = await startDeviceAuth()
    deviceFlow = { ...device, startedAt: Date.now(), state: 'pending' }
    respond(res, 200, {
      ok: true,
      state: 'pending',
      userCode: device.userCode,
      verificationUrl: VERIFICATION_URL,
      intervalSeconds: device.intervalSeconds,
    })
  } catch (error) {
    respond(res, 500, { ok: false, code: 'internal', message: error instanceof Error ? error.message : String(error) })
  }
}

async function handleLoginStatus(ctx, req, res) {
  if (!originAllowed(ctx, req)) {
    respond(res, 403, { ok: false, code: 'forbidden', message: 'Cross-origin request refused.' })
    return
  }
  if (req.method !== 'GET') {
    respond(res, 405, { ok: false, code: 'method', message: 'GET only.' })
    return
  }
  const flow = deviceFlow
  if (!flow || flow.state !== 'pending') {
    respond(res, 200, { ok: true, state: flow?.state ?? 'none', message: flow?.message })
    return
  }
  try {
    const result = await pollDeviceAuth(flow)
    if (result.status === 'approved') {
      const tokens = await exchangeTokens(result.code, result.verifier)
      manualOverride = { codexAccess: lastCodexAccess ?? readTokenStore()?.access }
      writeTokenStore(tokens)
      await ensureProviderRoute(ctx)
      flow.state = 'approved'
      respond(res, 200, { ok: true, state: 'approved', account: tokens.email ?? undefined })
    } else if (result.status === 'failed') {
      flow.state = 'failed'
      flow.message = result.message
      respond(res, 200, { ok: true, state: 'failed', message: result.message })
    } else {
      respond(res, 200, { ok: true, state: 'pending' })
    }
  } catch (error) {
    respond(res, 500, { ok: false, code: 'internal', message: error instanceof Error ? error.message : String(error) })
  }
}

async function handleLogout(ctx, req, res) {
  if (!originAllowed(ctx, req)) {
    respond(res, 403, { ok: false, code: 'forbidden', message: 'Cross-origin request refused.' })
    return
  }
  if (req.method !== 'POST') {
    respond(res, 405, { ok: false, code: 'method', message: 'POST only.' })
    return
  }
  clearTokenStore()
  deviceFlow = null
  manualOverride = null
  quotaCache = { at: 0, value: undefined }
  await ensureProviderRoute(ctx)
  respond(res, 200, { ok: true, loggedIn: false })
}
