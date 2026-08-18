/**
 * dsh-balance-card — host half.
 *
 * Serves `GET /ext/balance` on the Host webserver: a same-origin proxy that
 * resolves the DeepSeek API key exactly like the `llm-deepseek` adapter does
 * (settings `llm-deepseek` section → credentials → environment) and queries
 * the official `GET /user/balance` endpoint, so the browser never touches the
 * secret. The client half renders the balance card in Settings.
 */
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'

export const name = 'dsh-balance-card'
export const inject = ['webServer']

export const ROUTE_PATH = '/ext/balance'
export const DEFAULT_BASE_URL = 'https://api.deepseek.com'
export const DEFAULT_API_KEY_ENV = 'DEEPSEEK_API_KEY'
/** How long the upstream balance request may take before the route answers a network error. */
export const UPSTREAM_TIMEOUT_MS = 10_000

/** Plugin entry: register the balance route for the life of the fiber. */
export function apply(ctx) {
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: ROUTE_PATH,
    handler: (req, res) => handleBalanceRequest(ctx, req, res),
  }), 'dsh-balance-card: balance route')
}

/**
 * Resolve the connection facts the same way the DeepSeek adapter does:
 * `llm-deepseek` settings section wins, then the environment, then defaults.
 * A missing or unreadable settings namespace silently falls back.
 */
function resolveConnectionFacts(ctx) {
  let apiKeyEnv = DEFAULT_API_KEY_ENV
  let baseURL = process.env.DEEPSEEK_BASE_URL ?? DEFAULT_BASE_URL
  try {
    // Optional seams: fetched via ctx.get so they need no hard inject.
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

/** Resolve the live API key through the credential seam, then the environment. */
async function resolveApiKey(ctx, apiKeyEnv) {
  const ref = credentialRef(apiKeyEnv)
  const credential = await ctx.get('credentials')?.resolve(ref)
  if (credential?.value) return credential.value
  const ambient = process.env[apiKeyEnv]
  if (ambient) return ambient
  return undefined
}

async function handleBalanceRequest(ctx, req, res) {
  // Same-origin fence: a browser Origin that is not our own server is refused.
  // Requests without an Origin (curl, other local tools) stay allowed.
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
