import express from 'express'
import cookieParser from 'cookie-parser'
import { createProxyMiddleware } from 'http-proxy-middleware'
import { randomUUID, createHmac } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  createAdeApiClient,
  getAdeSelectionLabels,
  getAdeSelectionResourceIds,
} from './adeApi.js'
import { createAdeUpcomingResolver } from './adeUpcomingResolver.js'
import { createPlanningRpcClient } from './planningRpc.js'
import {
  DEMO_ACCOUNT,
  DEMO_SESSION_MODE,
  applyDemoLayoutMutation,
  buildDemoAdeTreePayload,
  buildDemoAlertsPayload,
  buildDemoCalendarPayload,
  buildDemoGradesPayload,
  buildDemoLayoutData,
  buildDemoLayoutDocData,
  buildDemoMarketplaceEntries,
  buildDemoPlanningPayload,
  buildDemoPortletFragment,
  buildDemoPortletMetadata,
  buildDemoTimetablePayload,
  buildDemoUpcomingPayload,
  createInitialDemoState,
  isDemoCredentials,
  normalizeDemoState,
  searchDemoAdeTree,
} from './src/demoAccount.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const app = express()
const PORT = process.env.PORT || 3000

// ============================================================================
// ENT Auth Configs & Utilities (Copied directly from earlier vite.config.js)
// ============================================================================
const ENT_ORIGIN = 'https://services-numeriques.univ-rennes.fr'
const CAS_ORIGIN = 'https://sso-cas.univ-rennes.fr'
const ADE_ORIGIN = 'https://campus-app.univ-rennes.fr'
const MOODLE_ORIGIN = 'https://foad.univ-rennes.fr'
const MOODLE_SHIBBOLETH_LOGIN_URL = `${MOODLE_ORIGIN}/auth/shibboleth/index.php`
const NOTES9_ORIGIN = 'https://notes9.iutlan.univ-rennes1.fr'
const RENNES_WAYF_ENTITY_ID = 'urn:mace:cru.fr:federation:univ-rennes1.fr'
const DEFAULT_REFERER = `${ENT_ORIGIN}/f/services/normal/render.uP`
const LOCAL_SESSION_COOKIE = 'ent_front_session'
const SESSION_TTL_MS = 8 * 60 * 60 * 1000
const GRADES_CACHE_TTL_MS = 10 * 60 * 1000
const LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000
const LOGIN_RATE_LIMIT_BLOCK_MS = 15 * 60 * 1000
const LOGIN_RATE_LIMIT_MAX_ATTEMPTS_PER_IP = 10
const LOGIN_RATE_LIMIT_MAX_ATTEMPTS_PER_USERNAME = 5
const MAX_PERSISTED_COOKIE_VALUE_LENGTH = 1024
// SESSION_SECRET must be set in production env vars (Render.com → Environment).
// Without it, sessions will not survive server restarts.
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-only-insecure-secret'
const runtimeSessions = new Map()
const runtimeGradesCache = new Map()
const loginRateLimitByIp = new Map()
const loginRateLimitByUsername = new Map()

// Utility functions
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function getPublicOrigin(req) {
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim()
  const forwardedHost = String(req.headers['x-forwarded-host'] || '').split(',')[0].trim()
  const protocol = forwardedProto || req.protocol || 'http'
  const host = forwardedHost || req.get('host') || `localhost:${PORT}`

  return `${protocol}://${host}`
}

// Cookie Jar for session handling
class CookieJar {
  constructor() {
    this.store = new Map()
  }

  setFromResponse(response, url) {
    const setCookies = typeof response.headers.getSetCookie === 'function'
      ? response.headers.getSetCookie()
      : []

    for (const rawCookie of setCookies) {
      this.setCookie(rawCookie, url)
    }
  }

  setCookie(rawCookie, url) {
    const urlObject = new URL(url)
    const [nameValue, ...attributePairs] = rawCookie.split(';').map((part) => part.trim())
    const separatorIndex = nameValue.indexOf('=')

    if (separatorIndex === -1) {
      return
    }

    const name = nameValue.slice(0, separatorIndex)
    const value = nameValue.slice(separatorIndex + 1)
    let domain = urlObject.hostname
    let hostOnly = true
    let path = '/'
    let secure = false
    let expiresAt = null

    for (const attributePair of attributePairs) {
      const [rawKey, ...rawRest] = attributePair.split('=')
      const key = rawKey.toLowerCase()
      const attributeValue = rawRest.join('=')

      if (key === 'domain' && attributeValue) {
        domain = attributeValue.replace(/^\./, '').toLowerCase()
        hostOnly = false
      } else if (key === 'path' && attributeValue) {
        path = attributeValue
      } else if (key === 'secure') {
        secure = true
      } else if (key === 'max-age') {
        const parsedValue = Number(attributeValue)
        if (Number.isFinite(parsedValue)) {
          expiresAt = Date.now() + parsedValue * 1000
        }
      } else if (key === 'expires') {
        const parsedDate = Date.parse(attributeValue)
        if (!Number.isNaN(parsedDate)) {
          expiresAt = parsedDate
        }
      }
    }

    const cookieKey = `${domain}|${path}|${name}`

    if (expiresAt !== null && expiresAt <= Date.now()) {
      this.store.delete(cookieKey)
      return
    }

    this.store.set(cookieKey, {
      name,
      value,
      domain,
      path,
      hostOnly,
      secure,
      expiresAt,
    })
  }

  setFromProxySetCookie(rawSetCookies, url) {
    const setCookies = Array.isArray(rawSetCookies)
      ? rawSetCookies
      : rawSetCookies
        ? [rawSetCookies]
        : []

    for (const rawCookie of setCookies) {
      this.setCookie(rawCookie, url)
    }
  }

  getCookieHeader(url) {
    const urlObject = new URL(url)
    const matchingCookies = []

    for (const cookie of this.store.values()) {
      if (cookie.expiresAt !== null && cookie.expiresAt <= Date.now()) {
        continue
      }

      if (cookie.secure && urlObject.protocol !== 'https:') {
        continue
      }

      const domainMatches = cookie.hostOnly
        ? cookie.domain === urlObject.hostname
        : urlObject.hostname === cookie.domain || urlObject.hostname.endsWith(`.${cookie.domain}`)

      if (!domainMatches) {
        continue
      }

      if (!urlObject.pathname.startsWith(cookie.path)) {
        continue
      }

      matchingCookies.push(`${cookie.name}=${cookie.value}`)
    }

    return matchingCookies.join('; ')
  }

  getCookieNamesForHost(hostname) {
    return Array.from(this.store.values())
      .filter((cookie) => {
        if (cookie.expiresAt !== null && cookie.expiresAt <= Date.now()) {
          return false
        }

        return cookie.hostOnly
          ? cookie.domain === hostname
          : hostname === cookie.domain || hostname.endsWith(`.${cookie.domain}`)
      })
      .map((cookie) => cookie.name)
      .sort((left, right) => left.localeCompare(right))
  }

  hasCookie(hostname, cookieName) {
    return this.getCookieNamesForHost(hostname).includes(String(cookieName))
  }

  serialize() {
    return Array.from(this.store.entries())
  }

  static fromSerialized(entries) {
    const jar = new CookieJar()
    for (const [key, cookie] of entries ?? []) {
      jar.store.set(key, cookie)
    }
    return jar
  }
}

function resolveUrl(location, currentUrl) {
  return new URL(location, currentUrl).toString()
}

// ---------------------------------------------------------------------------
// Stateless cookie-based sessions (survives server restarts)
// ---------------------------------------------------------------------------
function encodeSession(data) {
  const payload = Buffer.from(JSON.stringify(data)).toString('base64url')
  const sig = createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

function decodeSession(cookieValue) {
  if (!cookieValue) return null
  const lastDot = cookieValue.lastIndexOf('.')
  if (lastDot === -1) return null
  const payload = cookieValue.slice(0, lastDot)
  const sig = cookieValue.slice(lastDot + 1)
  const expected = createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url')
  if (sig !== expected) return null
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'))
  } catch {
    return null
  }
}

function isPersistableSessionCookie([, cookie]) {
  if (!cookie || typeof cookie.value !== 'string') {
    return false
  }

  if (cookie.value.length > MAX_PERSISTED_COOKIE_VALUE_LENGTH) {
    return false
  }

  if (cookie.domain === 'sso-cas.univ-rennes.fr' && cookie.name === 'TGC') {
    return false
  }

  return true
}

function buildPersistedSessionJar(session) {
  if (!(session?.jar instanceof CookieJar)) {
    return []
  }

  return session.jar.serialize().filter(isPersistableSessionCookie)
}

function isDemoSession(session) {
  return session?.mode === DEMO_SESSION_MODE
}

function createDemoSession(overrides = {}) {
  return {
    id: overrides.id ?? randomUUID(),
    mode: DEMO_SESSION_MODE,
    user: overrides.user ?? DEMO_ACCOUNT.preferred_username,
    jar: overrides.jar instanceof CookieJar ? overrides.jar : new CookieJar(),
    demoState: normalizeDemoState(overrides.demoState ?? createInitialDemoState()),
    createdAt: overrides.createdAt ?? Date.now(),
    sessionSource: overrides.sessionSource ?? null,
  }
}

function buildDemoRequestPayload(requestPath, session) {
  const normalizedPath = String(requestPath ?? '').trim()

  if (!normalizedPath.startsWith('/')) {
    return {
      ok: false,
      status: 400,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify({ error: 'Invalid demo request path.' }),
    }
  }

  const requestUrl = new URL(normalizedPath, 'https://demo.l-ent.local')

  if (requestUrl.pathname === '/api/v4-3/dlm/layout.json') {
    return {
      ok: true,
      status: 200,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify(buildDemoLayoutData(session.demoState)),
    }
  }

  if (requestUrl.pathname === '/api/layoutDoc') {
    return {
      ok: true,
      status: 200,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify(buildDemoLayoutDocData()),
    }
  }

  if (requestUrl.pathname === '/api/marketplace/entries.json') {
    return {
      ok: true,
      status: 200,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify(buildDemoMarketplaceEntries()),
    }
  }

  const portletFragmentMatch = requestUrl.pathname.match(/^\/api\/v4-3\/portlet\/([^/]+)\.html$/)
  if (portletFragmentMatch) {
    const fragment = buildDemoPortletFragment(decodeURIComponent(portletFragmentMatch[1]))
    return fragment == null
      ? {
          ok: false,
          status: 404,
          contentType: 'text/plain; charset=utf-8',
          body: 'Demo portlet not found.',
        }
      : {
          ok: true,
          status: 200,
          contentType: 'text/html; charset=utf-8',
          body: fragment,
        }
  }

  const portletMetadataMatch = requestUrl.pathname.match(/^\/api\/portlet\/([^/]+)\.json$/)
  if (portletMetadataMatch) {
    const metadata = buildDemoPortletMetadata(decodeURIComponent(portletMetadataMatch[1]))
    return metadata == null
      ? {
          ok: false,
          status: 404,
          contentType: 'application/json; charset=utf-8',
          body: JSON.stringify({ error: 'Demo portlet metadata not found.' }),
        }
      : {
          ok: true,
          status: 200,
          contentType: 'application/json; charset=utf-8',
          body: JSON.stringify(metadata),
        }
  }

  if (requestUrl.pathname === '/api/layout') {
    const mutation = applyDemoLayoutMutation(normalizedPath, session.demoState)

    if (mutation.handled) {
      session.demoState = mutation.demoState
      return {
        ok: true,
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify(mutation.payload ?? { ok: true }),
      }
    }
  }

  return {
    ok: false,
    status: 404,
    contentType: 'application/json; charset=utf-8',
    body: JSON.stringify({ error: `Demo path not implemented: ${normalizedPath}` }),
  }
}

function pruneRuntimeSessions() {
  const now = Date.now()

  for (const [sessionId, session] of runtimeSessions.entries()) {
    if (!session?.createdAt || now - session.createdAt > SESSION_TTL_MS) {
      runtimeSessions.delete(sessionId)
      runtimeGradesCache.delete(sessionId)
    }
  }
}

function pruneRuntimeGradesCache() {
  const now = Date.now()

  for (const [sessionId, entry] of runtimeGradesCache.entries()) {
    if (!entry?.cachedAt || now - entry.cachedAt > GRADES_CACHE_TTL_MS) {
      runtimeGradesCache.delete(sessionId)
    }
  }
}

function getCachedGrades(sessionId) {
  if (!sessionId) {
    return null
  }

  pruneRuntimeGradesCache()
  return runtimeGradesCache.get(sessionId)?.data ?? null
}

function setCachedGrades(sessionId, grades) {
  if (!sessionId) {
    return
  }

  pruneRuntimeGradesCache()
  runtimeGradesCache.set(sessionId, {
    cachedAt: Date.now(),
    data: grades,
  })
}

function clearCachedGrades(sessionId) {
  if (!sessionId) {
    return
  }

  runtimeGradesCache.delete(sessionId)
}

function setSessionCookie(res, session) {
  pruneRuntimeSessions()
  runtimeSessions.set(session.id, session)

  const data = {
    id: session.id,
    user: session.user,
    mode: session.mode ?? null,
    jar: buildPersistedSessionJar(session),
    demoState: isDemoSession(session) ? normalizeDemoState(session.demoState) : null,
    createdAt: session.createdAt,
  }
  res.cookie(LOCAL_SESSION_COOKIE, encodeSession(data), {
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
    secure: !!process.env.SESSION_SECRET,
    maxAge: SESSION_TTL_MS,
  })
}

function isRedirectStatus(statusCode) {
  return [301, 302, 303, 307, 308].includes(statusCode)
}

async function fetchWithJar(url, jar, options = {}) {
  const headers = new Headers(options.headers ?? {})
  const cookieHeader = jar.getCookieHeader(url)

  if (cookieHeader && !headers.has('cookie')) {
    headers.set('cookie', cookieHeader)
  }

  const response = await fetch(url, {
    ...options,
    headers,
    redirect: options.redirect ?? 'manual',
  })

  jar.setFromResponse(response, url)
  return response
}

async function followRedirectChain(startUrl, jar, options = {}) {
  const chain = []
  let currentUrl = startUrl
  let currentMethod = options.method ?? 'GET'
  let currentBody = options.body
  let currentHeaders = { ...(options.headers ?? {}) }
  let response = null

  for (let attempt = 0; attempt < 15; attempt += 1) {
    response = await fetchWithJar(currentUrl, jar, {
      ...options,
      method: currentMethod,
      body: currentBody,
      headers: currentHeaders,
      redirect: 'manual',
    })

    const location = response.headers.get('location')
    chain.push({
      status: response.status,
      url: currentUrl,
      location,
    })

    if (!isRedirectStatus(response.status) || !location) {
      return {
        chain,
        response,
        finalUrl: currentUrl,
      }
    }

    currentUrl = resolveUrl(location, currentUrl)

    if (response.status === 303 || ((response.status === 301 || response.status === 302) && currentMethod === 'POST')) {
      currentMethod = 'GET'
      currentBody = undefined
      const loweredHeaders = Object.fromEntries(
        Object.entries(currentHeaders).filter(([name]) => name.toLowerCase() !== 'content-type'),
      )
      currentHeaders = loweredHeaders
    }
  }

  throw new Error('Too many redirects while talking to CAS/ENT.')
}

function extractHiddenInputValue(html, inputName) {
  const escapedInputName = escapeRegExp(inputName)
  const patterns = [
    new RegExp(`<input[^>]*name=["']${escapedInputName}["'][^>]*value=["']([^"']*)["']`, 'i'),
    new RegExp(`<input[^>]*value=["']([^"']*)["'][^>]*name=["']${escapedInputName}["']`, 'i'),
  ]

  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match) {
      return match[1]
    }
  }

  return ''
}

function extractFormAction(html, pageUrl) {
  const match = html.match(/<form[^>]+action=["']([^"']+)["']/i)
  const action = match ? decodeHtmlEntities(match[1]) : pageUrl
  return resolveUrl(action, pageUrl)
}

function stripHtmlTags(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractCasError(html) {
  const candidates = [
    /<div[^>]*class=["'][^"']*(?:alert|errors?|messages?)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    /<p[^>]*class=["'][^"']*(?:alert|errors?|messages?)[^"']*["'][^>]*>([\s\S]*?)<\/p>/i,
  ]

  for (const candidate of candidates) {
    const match = html.match(candidate)
    if (match) {
      const message = stripHtmlTags(match[1])
      if (message) {
        return message
      }
    }
  }

  return ''
}

async function fetchEntLayout(jar) {
  const response = await fetchWithJar(`${ENT_ORIGIN}/api/v4-3/dlm/layout.json`, jar, {
    headers: {
      Accept: 'application/json',
      Referer: DEFAULT_REFERER,
    },
  })

  const text = await response.text()
  let data = null

  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = null
  }

  return {
    ok: response.ok,
    status: response.status,
    data,
    text,
  }
}

async function performEntLogin({ username, password }) {
  const jar = new CookieJar()
  const acceptHeader = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'

  const loginPageResult = await followRedirectChain(`${ENT_ORIGIN}/f/services/normal/render.uP`, jar, {
    headers: {
      Accept: acceptHeader,
    },
  })

  const loginPageHtml = await loginPageResult.response.text()
  const execution = extractHiddenInputValue(loginPageHtml, 'execution')

  if (!execution) {
    throw new Error('Could not extract the CAS login form.')
  }

  const actionUrl = extractFormAction(loginPageHtml, loginPageResult.finalUrl)
  const eventId = extractHiddenInputValue(loginPageHtml, '_eventId') || 'submit'
  const geolocation = extractHiddenInputValue(loginPageHtml, 'geolocation')
  const formBody = new URLSearchParams({
    username,
    password,
    execution,
    _eventId: eventId,
    geolocation,
  }).toString()

  const submitResponse = await fetchWithJar(actionUrl, jar, {
    method: 'POST',
    headers: {
      Accept: acceptHeader,
      'Content-Type': 'application/x-www-form-urlencoded',
      Origin: CAS_ORIGIN,
      Referer: loginPageResult.finalUrl,
    },
    body: formBody,
    redirect: 'manual',
  })

  if (!isRedirectStatus(submitResponse.status)) {
    const html = await submitResponse.text()
    const message = extractCasError(html)
    throw new Error(message || 'CAS login failed. Check your username and password.')
  }

  const location = submitResponse.headers.get('location')
  if (!location) {
    throw new Error('CAS login did not return a redirect target.')
  }

  const portalRedirectResult = await followRedirectChain(resolveUrl(location, actionUrl), jar, {
    headers: {
      Accept: acceptHeader,
    },
  })

  const layout = await fetchEntLayout(jar)

  if (!layout.ok || !layout.data || String(layout.data.authenticated) !== 'true') {
    throw new Error('CAS login completed, but the portal session was not established.')
  }

  return {
    jar,
    layout: layout.data,
    redirectChain: [...loginPageResult.chain, ...portalRedirectResult.chain],
  }
}

async function ensureNotes9Session(jar) {
  const doAuthUrl = `${NOTES9_ORIGIN}/services/doAuth.php?href=${encodeURIComponent(`${NOTES9_ORIGIN}/`)}`
  await followRedirectChain(doAuthUrl, jar, {
    headers: { Accept: 'text/html,application/xhtml+xml,*/*' },
  })
}

function isNotes9StudentPicImage(picture) {
  return picture.ok && /^image\//i.test(picture.contentType) && picture.size > 0
}

async function requestNotes9StudentPic(jar) {
  const pictureResponse = await fetchWithJar(`${NOTES9_ORIGIN}/services/data.php?q=getStudentPic`, jar, {
    headers: {
      Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      Referer: `${NOTES9_ORIGIN}/`,
    },
    redirect: 'follow',
  })

  const contentType = pictureResponse.headers.get('content-type') ?? 'application/octet-stream'
  const buffer = Buffer.from(await pictureResponse.arrayBuffer())

  return {
    ok: pictureResponse.ok,
    status: pictureResponse.status,
    contentType,
    size: buffer.length,
    buffer,
  }
}

async function fetchNotes9StudentPic(jar) {
  await ensureNotes9Session(jar)

  let picture = await requestNotes9StudentPic(jar)

  if (isNotes9StudentPicImage(picture)) {
    return picture
  }

  await ensureNotes9Session(jar)
  picture = await requestNotes9StudentPic(jar)

  return picture
}

function buildEntProxyTargetUrl(requestUrl) {
  const rewrittenPath = (requestUrl || '/').replace(/^\/__ent_proxy/, '') || '/'
  return new URL(rewrittenPath, ENT_ORIGIN).toString()
}

function getSessionLaunchCapabilities(session) {
  if (isDemoSession(session)) {
    return {
      canUseServerLaunch: false,
      degraded: false,
      degradedReason: null,
    }
  }

  const canUseServerLaunch = Boolean(session?.jar?.hasCookie('sso-cas.univ-rennes.fr', 'TGC'))

  return {
    canUseServerLaunch,
    degraded: !canUseServerLaunch,
    degradedReason: canUseServerLaunch ? null : 'missing-cas-tgc',
  }
}

function getSessionFromRequest(req) {
  pruneRuntimeSessions()

  const data = decodeSession(req.cookies[LOCAL_SESSION_COOKIE])
  if (!data) return null

  const runtimeSession = runtimeSessions.get(data.id)
  if (runtimeSession) {
    runtimeSession.sessionSource = 'runtime'
    return runtimeSession
  }

  if (data.mode === DEMO_SESSION_MODE) {
    return createDemoSession({
      id: data.id,
      user: data.user,
      demoState: data.demoState,
      createdAt: data.createdAt,
      sessionSource: 'cookie',
    })
  }

  return {
    id: data.id,
    user: data.user,
    jar: CookieJar.fromSerialized(data.jar),
    createdAt: data.createdAt,
    sessionSource: 'cookie',
  }
}

function getHostnameFromUrl(value) {
  try {
    return new URL(value).hostname
  } catch {
    return ''
  }
}

function escapeHtmlAttribute(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&#39;')
}

function isMoodleLaunchTarget(targetUrl) {
  return getHostnameFromUrl(targetUrl) === 'foad.univ-rennes.fr'
}

function isMoodleShibbolethPostTarget(targetUrl) {
  return getHostnameFromUrl(targetUrl) === 'foad.univ-rennes.fr'
    && /\/Shibboleth\.sso\//i.test(new URL(targetUrl).pathname)
}

function buildMoodleWayfRequest(pageUrl) {
  const actionUrl = extractFormAction(pageUrl.html, pageUrl.url)
  return {
    actionUrl,
    headers: {
      Accept: pageUrl.acceptHeader,
      'Content-Type': 'application/x-www-form-urlencoded',
      Origin: new URL(actionUrl).origin,
      Referer: pageUrl.url,
    },
    body: new URLSearchParams({
      user_idp: RENNES_WAYF_ENTITY_ID,
      Select: 'Sélection',
    }).toString(),
  }
}

function buildCasLoginRequest(html, pageUrl, credentials, acceptHeader) {
  const username = String(credentials?.username ?? '').trim()
  const password = String(credentials?.password ?? '')
  const execution = extractHiddenInputValue(html, 'execution')

  if (!execution) {
    return null
  }

  if (!username || !password) {
    throw new Error('Missing runtime credentials for Moodle launch.')
  }

  const actionUrl = extractFormAction(html, pageUrl)
  return {
    actionUrl,
    headers: {
      Accept: acceptHeader,
      'Content-Type': 'application/x-www-form-urlencoded',
      Origin: new URL(actionUrl).origin,
      Referer: pageUrl,
    },
    body: new URLSearchParams({
      username,
      password,
      execution,
      _eventId: extractHiddenInputValue(html, '_eventId') || 'submit',
      geolocation: extractHiddenInputValue(html, 'geolocation'),
    }).toString(),
  }
}

function parseFormFields(formBody) {
  return Object.fromEntries(new URLSearchParams(formBody))
}

async function prepareMoodleLaunchRelay(session) {
  const acceptHeader = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
  const launchCapabilities = getSessionLaunchCapabilities(session)
  const chain = []
  let currentUrl = MOODLE_SHIBBOLETH_LOGIN_URL
  let currentMethod = 'GET'
  let currentBody = undefined
  let currentHeaders = { Accept: acceptHeader }

  for (let attempt = 0; attempt < 15; attempt += 1) {
    const response = await fetchWithJar(currentUrl, session.jar, {
      method: currentMethod,
      body: currentBody,
      headers: currentHeaders,
      redirect: 'manual',
    })

    const location = response.headers.get('location')
    chain.push({
      status: response.status,
      url: currentUrl,
      location,
    })

    if (isRedirectStatus(response.status) && location) {
      currentUrl = resolveUrl(location, currentUrl)

      if (response.status === 303 || ((response.status === 301 || response.status === 302) && currentMethod === 'POST')) {
        currentMethod = 'GET'
        currentBody = undefined
        currentHeaders = { Accept: acceptHeader }
      }

      continue
    }

    const html = await response.text()
    const htmlRedirect = extractHtmlRedirect(html, currentUrl)
    if (htmlRedirect) {
      currentUrl = htmlRedirect
      currentMethod = 'GET'
      currentBody = undefined
      currentHeaders = { Accept: acceptHeader }
      continue
    }

    const autoSubmitForm = extractAutoSubmitForm(html, currentUrl)
    if (autoSubmitForm) {
      if (isMoodleShibbolethPostTarget(autoSubmitForm.action)) {
        return {
          finalUrl: autoSubmitForm.action,
          actionUrl: autoSubmitForm.action,
          fields: parseFormFields(autoSubmitForm.body),
          chain,
          useServerLaunch: true,
          reason: 'server-saml-relay',
          ...launchCapabilities,
        }
      }

      currentUrl = autoSubmitForm.action
      currentMethod = 'POST'
      currentBody = autoSubmitForm.body
      currentHeaders = {
        Accept: acceptHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
        Origin: new URL(autoSubmitForm.action).origin,
        Referer: currentUrl,
      }
      continue
    }

    if (/name=["']user_idp["']/i.test(html)) {
      const wayfRequest = buildMoodleWayfRequest({
        html,
        url: currentUrl,
        acceptHeader,
      })
      currentUrl = wayfRequest.actionUrl
      currentMethod = 'POST'
      currentBody = wayfRequest.body
      currentHeaders = wayfRequest.headers
      continue
    }

    const casLoginRequest = buildCasLoginRequest(html, currentUrl, session.credentials, acceptHeader)
    if (casLoginRequest && getHostnameFromUrl(casLoginRequest.actionUrl).includes('sso-cas')) {
      currentUrl = casLoginRequest.actionUrl
      currentMethod = 'POST'
      currentBody = casLoginRequest.body
      currentHeaders = casLoginRequest.headers
      continue
    }

    throw new Error('Unable to prepare the Moodle SSO handoff.')
  }

  throw new Error('Too many steps while preparing Moodle launch.')
}

async function prepareMoodleBrowserBootstrap(credentials) {
  const username = String(credentials?.username ?? '').trim()
  const password = String(credentials?.password ?? '')

  if (!username || !password) {
    throw new Error('Missing runtime credentials for Moodle launch.')
  }

  const browserJar = new CookieJar()
  const acceptHeader = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'

  const wayfPageResult = await followRedirectChain(MOODLE_SHIBBOLETH_LOGIN_URL, browserJar, {
    headers: { Accept: acceptHeader },
  })
  const wayfPageHtml = await wayfPageResult.response.text()
  const wayfActionUrl = extractFormAction(wayfPageHtml, wayfPageResult.finalUrl)
  const wayfBody = new URLSearchParams({
    user_idp: RENNES_WAYF_ENTITY_ID,
    Select: 'Sélection',
  }).toString()

  const wayfSubmitResponse = await fetchWithJar(wayfActionUrl, browserJar, {
    method: 'POST',
    headers: {
      Accept: acceptHeader,
      'Content-Type': 'application/x-www-form-urlencoded',
      Origin: new URL(wayfActionUrl).origin,
      Referer: wayfPageResult.finalUrl,
    },
    body: wayfBody,
    redirect: 'manual',
  })

  if (!isRedirectStatus(wayfSubmitResponse.status)) {
    throw new Error('Unable to prepare the Moodle identity-provider handoff.')
  }

  const wayfLocation = wayfSubmitResponse.headers.get('location')
  if (!wayfLocation) {
    throw new Error('Moodle WAYF handoff did not return a redirect target.')
  }

  const browserWarmupUrl = resolveUrl(wayfLocation, wayfActionUrl)
  const casLoginResult = await followRedirectChain(browserWarmupUrl, browserJar, {
    headers: { Accept: acceptHeader },
  })
  const casLoginHtml = await casLoginResult.response.text()
  const execution = extractHiddenInputValue(casLoginHtml, 'execution')

  if (!execution) {
    throw new Error('Unable to prepare the Rennes CAS login form for Moodle.')
  }

  return {
    warmupUrl: browserWarmupUrl,
    actionUrl: extractFormAction(casLoginHtml, casLoginResult.finalUrl),
    fields: {
      username,
      password,
      execution,
      _eventId: extractHiddenInputValue(casLoginHtml, '_eventId') || 'submit',
      geolocation: extractHiddenInputValue(casLoginHtml, 'geolocation'),
    },
  }
}

function buildAutoSubmitPage({ title, heading, body, actionUrl, fields, warmupUrl = '' }) {
  const hiddenFields = Object.entries(fields).map(([name, value]) => (
    `<input type="hidden" name="${escapeHtmlAttribute(name)}" value="${escapeHtmlAttribute(value)}" />`
  )).join('')
  const serializedWarmupUrl = JSON.stringify(String(warmupUrl ?? ''))
  const warmupFrame = warmupUrl
    ? '<iframe id="warmup" title="" aria-hidden="true" tabindex="-1" style="display:none"></iframe>'
    : ''

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="Cache-Control" content="no-store" />
  <title>${escapeHtmlAttribute(title)}</title>
  <style>
    body { margin: 0; font-family: system-ui, sans-serif; background: #f7f8fb; color: #18212f; }
    main { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
    section { width: min(420px, 100%); background: #fff; border-radius: 18px; padding: 28px; box-shadow: 0 18px 50px rgba(24, 33, 47, 0.12); }
    h1 { margin: 0 0 12px; font-size: 1.15rem; }
    p { margin: 0; line-height: 1.55; color: #48566a; }
    button { margin-top: 18px; border: 0; border-radius: 999px; padding: 12px 18px; background: #0d6efd; color: #fff; font: inherit; cursor: pointer; }
  </style>
</head>
<body>
  <main>
    <section>
      <h1>${escapeHtmlAttribute(heading)}</h1>
      <p>${escapeHtmlAttribute(body)}</p>
      <form id="handoff" method="post" action="${escapeHtmlAttribute(actionUrl)}">
        ${hiddenFields}
        <noscript><button type="submit">Continuer</button></noscript>
      </form>
      ${warmupFrame}
    </section>
  </main>
  <script>
    window.addEventListener('load', function () {
      const form = document.getElementById('handoff')
      if (!form) return

      const warmupUrl = ${serializedWarmupUrl}
      if (!warmupUrl) {
        form.submit()
        return
      }

      const iframe = document.getElementById('warmup')
      let submitted = false
      const submitForm = function () {
        if (submitted) return
        submitted = true
        form.submit()
      }

      if (!iframe) {
        submitForm()
        return
      }

      iframe.addEventListener('load', function () {
        window.setTimeout(submitForm, 120)
      }, { once: true })

      iframe.src = warmupUrl
      window.setTimeout(submitForm, 4000)
    })
  </script>
</body>
</html>`
}

async function previewServerLaunch(targetUrl, session) {
  if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
    return {
      finalUrl: String(targetUrl ?? ''),
      chain: [],
      useServerLaunch: false,
      reason: 'invalid-target-url',
    }
  }

  if (!session) {
    return {
      finalUrl: targetUrl,
      chain: [],
      useServerLaunch: false,
      reason: 'missing-session',
    }
  }

  const launchCapabilities = getSessionLaunchCapabilities(session)
  if (isMoodleLaunchTarget(targetUrl)) {
    if (launchCapabilities.canUseServerLaunch || (session?.credentials?.username && session?.credentials?.password)) {
      return {
        finalUrl: targetUrl,
        chain: [],
        useServerLaunch: true,
        reason: 'server-saml-relay',
        ...launchCapabilities,
      }
    }

    return {
      finalUrl: targetUrl,
      chain: [],
      useServerLaunch: false,
      reason: 'missing-launch-credentials',
      ...launchCapabilities,
    }
  }

  if (!launchCapabilities.canUseServerLaunch) {
    return {
      finalUrl: targetUrl,
      chain: [],
      useServerLaunch: false,
      reason: isDemoSession(session) ? 'demo-session' : 'missing-cas-tgc',
      ...launchCapabilities,
    }
  }

  const chain = []
  let currentUrl = targetUrl
  const targetHost = getHostnameFromUrl(targetUrl)

  try {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const response = await fetchWithJar(currentUrl, session.jar, {
        redirect: 'manual',
        headers: {
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      })

      const location = response.headers.get('location')
      chain.push({ status: response.status, url: currentUrl, location })

      const currentHost = getHostnameFromUrl(currentUrl)
      if (isRedirectStatus(response.status) && location) {
        const nextUrl = resolveUrl(location, currentUrl)
        const nextHost = getHostnameFromUrl(nextUrl)

        if (!currentHost.includes('sso-cas') && nextHost.includes('sso-cas')) {
          return {
            finalUrl: nextUrl,
            chain,
            useServerLaunch: true,
            reason: 'cas-login',
            ...launchCapabilities,
          }
        }

        if (currentHost.includes('sso-cas') && !nextHost.includes('sso-cas')) {
          if (nextHost === targetHost) {
            return {
              finalUrl: nextUrl,
              chain,
              useServerLaunch: true,
              reason: 'cas-ticket',
              ...launchCapabilities,
            }
          }

          return {
            finalUrl: targetUrl,
            chain,
            useServerLaunch: false,
            saml: true,
            reason: 'saml-browser-handoff',
            ...launchCapabilities,
          }
        }

        currentUrl = nextUrl
        continue
      }

      const html = await response.text()
      const htmlRedirect = extractHtmlRedirect(html, currentUrl)
      if (htmlRedirect) {
        const nextHost = getHostnameFromUrl(htmlRedirect)

        if (!currentHost.includes('sso-cas') && nextHost.includes('sso-cas')) {
          return {
            finalUrl: htmlRedirect,
            chain,
            useServerLaunch: true,
            reason: 'cas-html-redirect',
            ...launchCapabilities,
          }
        }

        currentUrl = htmlRedirect
        continue
      }

      const autoSubmitForm = extractAutoSubmitForm(html, currentUrl)
      if (autoSubmitForm) {
        const actionHost = getHostnameFromUrl(autoSubmitForm.action)

        if (actionHost.includes('sso-cas')) {
          return {
            finalUrl: autoSubmitForm.action,
            chain,
            useServerLaunch: true,
            reason: 'cas-form',
            ...launchCapabilities,
          }
        }

        return {
          finalUrl: currentUrl,
          chain,
          useServerLaunch: false,
          reason: 'browser-form-handoff',
          ...launchCapabilities,
        }
      }

      return {
        finalUrl: currentUrl,
        chain,
        useServerLaunch: false,
        reason: 'direct-browser-launch',
        ...launchCapabilities,
      }
    }

    return {
      finalUrl: currentUrl,
      chain,
      useServerLaunch: false,
      reason: 'too-many-redirects',
      error: 'too-many-redirects',
      ...launchCapabilities,
    }
  } catch (error) {
    return {
      finalUrl: targetUrl,
      chain,
      useServerLaunch: false,
      reason: 'preview-error',
      error: error instanceof Error ? error.message : String(error),
      ...launchCapabilities,
    }
  }
}

function getPlanningCacheScope(session) {
  if (!session?.id) {
    return null
  }

  return `session:${session.id}`
}

function clearSensitiveSessionCaches(session) {
  const sessionId = session?.id ?? null
  const cacheScope = getPlanningCacheScope(session)

  clearCachedGrades(sessionId)
  clearAdeCaches(cacheScope)
  clearPlanningCaches(cacheScope)
}

function normalizeLoginIdentifier(username) {
  return String(username ?? '').trim().toLowerCase()
}

function getLoginRequesterIp(req) {
  return String(req.ip || req.socket?.remoteAddress || 'unknown')
}

function pruneLoginRateLimitStore(store) {
  const now = Date.now()

  for (const [key, entry] of store.entries()) {
    if (!entry) {
      store.delete(key)
      continue
    }

    if (entry.blockedUntil && entry.blockedUntil > now) {
      continue
    }

    if (!entry.firstFailureAt || now - entry.firstFailureAt > LOGIN_RATE_LIMIT_WINDOW_MS) {
      store.delete(key)
    }
  }
}

function getRateLimitStatus(store, key) {
  if (!key) {
    return null
  }

  pruneLoginRateLimitStore(store)
  const entry = store.get(key)

  if (!entry?.blockedUntil) {
    return null
  }

  const retryAfterMs = entry.blockedUntil - Date.now()
  if (retryAfterMs <= 0) {
    store.delete(key)
    return null
  }

  return {
    retryAfterMs,
    retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
  }
}

function recordRateLimitFailure(store, key, maxAttempts) {
  if (!key) {
    return null
  }

  pruneLoginRateLimitStore(store)

  const now = Date.now()
  const currentEntry = store.get(key)
  const resetWindow = !currentEntry?.firstFailureAt || now - currentEntry.firstFailureAt > LOGIN_RATE_LIMIT_WINDOW_MS
  const nextEntry = resetWindow
    ? { count: 1, firstFailureAt: now, blockedUntil: 0 }
    : {
        count: Number(currentEntry.count ?? 0) + 1,
        firstFailureAt: currentEntry.firstFailureAt,
        blockedUntil: currentEntry.blockedUntil ?? 0,
      }

  if (nextEntry.count >= maxAttempts) {
    nextEntry.blockedUntil = now + LOGIN_RATE_LIMIT_BLOCK_MS
  }

  store.set(key, nextEntry)
  return getRateLimitStatus(store, key)
}

function clearRateLimitEntry(store, key) {
  if (!key) {
    return
  }

  store.delete(key)
}

function getActiveLoginRateLimit(req, username) {
  const ipKey = getLoginRequesterIp(req)
  const usernameKey = normalizeLoginIdentifier(username)
  const statuses = [
    getRateLimitStatus(loginRateLimitByIp, ipKey),
    getRateLimitStatus(loginRateLimitByUsername, usernameKey),
  ].filter(Boolean)

  if (statuses.length === 0) {
    return null
  }

  return statuses.reduce((currentMax, status) => (
    !currentMax || status.retryAfterMs > currentMax.retryAfterMs ? status : currentMax
  ), null)
}

function recordLoginFailure(req, username) {
  const ipKey = getLoginRequesterIp(req)
  const usernameKey = normalizeLoginIdentifier(username)
  const statuses = [
    recordRateLimitFailure(loginRateLimitByIp, ipKey, LOGIN_RATE_LIMIT_MAX_ATTEMPTS_PER_IP),
    recordRateLimitFailure(loginRateLimitByUsername, usernameKey, LOGIN_RATE_LIMIT_MAX_ATTEMPTS_PER_USERNAME),
  ].filter(Boolean)

  if (statuses.length === 0) {
    return null
  }

  return statuses.reduce((currentMax, status) => (
    !currentMax || status.retryAfterMs > currentMax.retryAfterMs ? status : currentMax
  ), null)
}

function clearLoginRateLimit(req, username) {
  clearRateLimitEntry(loginRateLimitByIp, getLoginRequesterIp(req))
  clearRateLimitEntry(loginRateLimitByUsername, normalizeLoginIdentifier(username))
}

// ============================================================================
// ICAL PARSER
// ============================================================================

function _parseIcalEvents(icalText) {
  const events = []
  const blocks = icalText.split('BEGIN:VEVENT')

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i].split('END:VEVENT')[0]
    const event = {}

    const lines = block.replace(/\r\n /g, '').replace(/\r\n\t/g, '').split(/\r?\n/)

    for (const line of lines) {
      const separatorIndex = line.indexOf(':')
      if (separatorIndex === -1) continue

      const rawKey = line.slice(0, separatorIndex)
      const value = line.slice(separatorIndex + 1)
      const key = rawKey.split(';')[0].trim()

      switch (key) {
        case 'DTSTART':
          event.start = parseIcalDate(value)
          break
        case 'DTEND':
          event.end = parseIcalDate(value)
          break
        case 'SUMMARY':
          event.summary = unescapeIcal(value)
          break
        case 'LOCATION':
          event.location = unescapeIcal(value)
          break
        case 'DESCRIPTION':
          event.description = unescapeIcal(value)
          break
        case 'UID':
          event.uid = value.trim()
          break
        case 'CATEGORIES':
          event.categories = value.trim()
          break
      }
    }

    if (event.start) {
      events.push(event)
    }
  }

  return events.sort((a, b) => (a.start || '').localeCompare(b.start || ''))
}

function parseIcalDate(value) {
  const clean = value.trim().replace('Z', '')
  if (clean.length >= 15) {
    return `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}T${clean.slice(9, 11)}:${clean.slice(11, 13)}:${clean.slice(13, 15)}Z`
  }
  if (clean.length >= 8) {
    return `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}`
  }
  return value.trim()
}

function extractHtmlRedirect(html, pageUrl) {
  // <meta http-equiv="refresh" content="0; url=...">
  const meta = html.match(/<meta[^>]+http-equiv=["']?refresh["']?[^>]+content=["'][^"']*url=([^\s"'>]+)/i)
    || html.match(/<meta[^>]+content=["'][^;]*;\s*url=([^\s"'>]+)[^>]*http-equiv=["']?refresh["']?/i)
  if (meta) {
    return resolveUrl(meta[1].replace(/["']/g, ''), pageUrl)
  }

  // window.location = '...', window.location.href = '...', location.href = '...'
  const js = html.match(/(?:window\.)?location(?:\.href)?\s*=\s*["']([^"']+)["']/i)
    || html.match(/location\.replace\s*\(\s*["']([^"']+)["']\s*\)/i)
  if (js) {
    return resolveUrl(js[1], pageUrl)
  }

  return null
}

function decodeHtmlEntities(text) {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}

function extractAutoSubmitForm(html, pageUrl) {
  if (!/\.submit\s*\(\s*\)/i.test(html)) return null

  const formMatch = html.match(/<form[^>]*\baction=["']([^"']+)["'][^>]*>/i)
  if (!formMatch) return null

  const action = resolveUrl(decodeHtmlEntities(formMatch[1]), pageUrl)
  const fields = new URLSearchParams()
  const inputRegex = /<input[^>]*\btype=["']hidden["'][^>]*\/?>/gi
  let inputMatch
  while ((inputMatch = inputRegex.exec(html)) !== null) {
    const tag = inputMatch[0]
    const name = tag.match(/\bname=["']([^"']+)["']/)
    const value = tag.match(/\bvalue=["']([^"']*?)["']/)
    if (name) {
      fields.set(decodeHtmlEntities(name[1]), value ? decodeHtmlEntities(value[1]) : '')
    }
  }

  return { action, body: fields.toString() }
}

function unescapeIcal(value) {
  return value
    .replace(/\\n/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
    .trim()
}

const {
  clearPlanningCaches,
  fetchPlanningCalendarMetadataFromRpc,
  fetchPlanningTimetableFromRpc,
  fetchPlanningTreeFromRpc,
} = createPlanningRpcClient({
  casOrigin: CAS_ORIGIN,
  fetchWithJar,
  followRedirectChain,
})

const {
  authenticateToAde,
  clearAdeCaches,
  fetchAdeApi,
  fetchAdeUpcomingFromApi,
} = createAdeApiClient({
  adeOrigin: ADE_ORIGIN,
  casOrigin: CAS_ORIGIN,
  followRedirectChain,
})

const {
  resolveAdeUpcoming,
} = createAdeUpcomingResolver({
  fetchAdeUpcomingFromApi,
  fetchPlanningTreeFromRpc,
  fetchPlanningTimetableFromRpc,
})

// ============================================================================
// EXPRESS MIDDLEWARE AND ROUTES
// ============================================================================

app.use(cookieParser())
app.use(express.json()) // Automatically parse incoming JSON requests for auth endpoints

app.use((req, res, next) => {
  if (req.path.startsWith('/__ent_auth') || req.path.startsWith('/__ent_proxy')) {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive')
  }

  next()
})

// 1. Auth Status Endpoint
app.get('/__ent_auth/session', async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store')
    const session = getSessionFromRequest(req)

    if (!session) {
      return res.status(200).json({
        authenticated: false,
        user: null,
        sessionMode: null,
        sessionSource: null,
        degraded: false,
        degradedReason: null,
        canUseServerLaunch: false,
      })
    }

    if (isDemoSession(session)) {
      setSessionCookie(res, session)
      return res.status(200).json({
        authenticated: true,
        user: session.user,
        sessionMode: DEMO_SESSION_MODE,
        sessionSource: session.sessionSource ?? null,
        ...getSessionLaunchCapabilities(session),
      })
    }

    const layout = await fetchEntLayout(session.jar)

    if (!layout.ok || !layout.data || String(layout.data.authenticated) !== 'true') {
      clearSensitiveSessionCaches(session)
      res.clearCookie(LOCAL_SESSION_COOKIE)
      return res.status(200).json({
        authenticated: false,
        user: null,
        sessionMode: null,
        sessionSource: null,
        degraded: false,
        degradedReason: null,
        canUseServerLaunch: false,
      })
    }

    session.user = layout.data.user
    setSessionCookie(res, session)
    const launchCapabilities = getSessionLaunchCapabilities(session)

    res.status(200).json({
      authenticated: true,
      user: layout.data.user,
      sessionMode: session.mode ?? null,
      sessionSource: session.sessionSource ?? null,
      cookieNames: session.jar.getCookieNamesForHost('services-numeriques.univ-rennes.fr'),
      casCookieNames: session.jar.getCookieNamesForHost('sso-cas.univ-rennes.fr'),
      ...launchCapabilities,
    })
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
    })
  }
})

// 2. Login Endpoint
app.post('/__ent_auth/login', async (req, res) => {
  try {
    const username = String(req.body.username ?? '').trim()
    const password = String(req.body.password ?? '')

    if (!username || !password) {
      return res.status(400).json({
        error: 'Username and password are required.',
      })
    }

    const activeRateLimit = getActiveLoginRateLimit(req, username)
    if (activeRateLimit) {
      res.setHeader('Retry-After', String(activeRateLimit.retryAfterSeconds))
      return res.status(429).json({
        error: 'Too many login attempts. Please try again later.',
      })
    }

    if (isDemoCredentials(username, password)) {
      const session = createDemoSession()
      clearLoginRateLimit(req, username)
      setSessionCookie(res, session)

      return res.status(200).json({
        authenticated: true,
        user: session.user,
        sessionMode: DEMO_SESSION_MODE,
      })
    }

    const result = await performEntLogin({ username, password })
    clearLoginRateLimit(req, username)
    const session = {
      id: randomUUID(),
      user: result.layout.user,
      jar: result.jar,
      credentials: { username, password },
      createdAt: Date.now(),
    }

    // Prime the ADE session cache while we still have the fresh login credentials,
    // but never persist those credentials on the long-lived app session.
    try {
      await authenticateToAde(result.jar, { username, password }, {
        cacheScope: getPlanningCacheScope(session),
      })
    } catch (adeError) {
      console.warn('ADE session bootstrap failed during login:', adeError)
    }

    setSessionCookie(res, session)

    res.status(200).json({
      authenticated: true,
      user: result.layout.user,
      sessionMode: session.mode ?? null,
    })
  } catch (error) {
    const rateLimit = recordLoginFailure(req, req.body?.username)
    if (rateLimit) {
      res.setHeader('Retry-After', String(rateLimit.retryAfterSeconds))
      return res.status(429).json({
        error: 'Too many login attempts. Please try again later.',
      })
    }

    res.status(401).json({
      error: error instanceof Error ? error.message : String(error),
    })
  }
})

// 3. Account Info Endpoint
app.get('/__ent_auth/account', async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store')
    const session = getSessionFromRequest(req)

    if (!session) {
      return res.status(200).json({
        authenticated: false,
        account: null,
        sessionMode: null,
      })
    }

    if (isDemoSession(session)) {
      setSessionCookie(res, session)
      return res.status(200).json({
        authenticated: true,
        account: DEMO_ACCOUNT,
        sessionMode: DEMO_SESSION_MODE,
      })
    }

    const response = await fetchWithJar(`${ENT_ORIGIN}/api/v5-1/userinfo`, session.jar, {
      headers: {
        Accept: 'application/jwt, application/json, */*',
        Referer: DEFAULT_REFERER,
      },
      redirect: 'follow',
    })

    const text = await response.text()

    // The endpoint returns a JWT — decode the payload
    const parts = text.split('.')
    if (parts.length === 3) {
      try {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'))
        setSessionCookie(res, session)
        return res.status(200).json({
          authenticated: true,
          account: payload,
          sessionMode: session.mode ?? null,
        })
      } catch {
        // Fall through to raw text response
      }
    }

    // If not a JWT, try to parse as JSON
    let data = text
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      // keep as text
    }

    setSessionCookie(res, session)
    res.status(200).json({
      authenticated: true,
      account: data,
      sessionMode: session.mode ?? null,
    })
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
    })
  }
})

// 4. Planning Endpoint
app.get('/__ent_auth/planning', async (req, res) => {
  try {
    const session = getSessionFromRequest(req)

    if (!session) {
      return res.status(200).json({ authenticated: false, events: null })
    }

    const targetDate = String(req.query.date ?? new Date().toISOString().slice(0, 10))
    const requestedResourceId = String(req.query.resourceId ?? '')

    if (isDemoSession(session)) {
      const timetable = buildDemoPlanningPayload({
        date: targetDate,
        resourceId: requestedResourceId,
      })

      setSessionCookie(res, session)
      return res.status(200).json({
        authenticated: true,
        sessionMode: DEMO_SESSION_MODE,
        events: timetable.events,
        weekLabel: timetable.weekLabel,
        dayLabels: timetable.dayLabels,
        resolvedWeek: timetable.resolvedWeek,
        outOfRange: timetable.outOfRange,
        debug: {
          source: 'demo',
        },
      })
    }

    const timetable = await fetchPlanningTimetableFromRpc(session.jar, targetDate, requestedResourceId, {
      cacheScope: getPlanningCacheScope(session),
    })

    setSessionCookie(res, session)
    res.status(200).json({
      authenticated: true,
      sessionMode: session.mode ?? null,
      events: timetable.events,
      weekLabel: timetable.weekLabel,
      dayLabels: timetable.dayLabels,
      resolvedWeek: timetable.resolvedWeek,
      outOfRange: timetable.outOfRange,
      debug: {
        finalUrl: timetable.finalUrl,
        planningIdentifier: timetable.planningIdentifier,
        resourceId: timetable.resourceId,
        currentResourceId: timetable.currentResourceId,
        displayConfigurationId: timetable.displayConfigurationId,
        weekIndex: timetable.weekIndex,
        calendarWeekIndex: timetable.calendarWeekIndex,
        requestedDateMatched: timetable.requestedDateMatched,
        outOfRange: timetable.outOfRange,
        cache: timetable.cache,
        planningCookies: session.jar.getCookieNamesForHost('planning.univ-rennes1.fr'),
      },
    })
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
    })
  }
})

// 5. CAS Launch Endpoint — resolves CAS SSO for external app links
app.get('/__ent_auth/launch-preview', async (req, res) => {
  const targetUrl = req.query.url

  if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
    return res.status(400).json({
      finalUrl: String(targetUrl ?? ''),
      chain: [],
      useServerLaunch: false,
      reason: 'invalid-target-url',
    })
  }

  const session = getSessionFromRequest(req)
  const preview = await previewServerLaunch(targetUrl, session)
  return res.status(200).json(preview)
})

app.get('/__ent_auth/launch', async (req, res) => {
  const targetUrl = req.query.url
  const debug = req.query.debug === '1'

  if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
    return res.redirect('/')
  }

  const session = getSessionFromRequest(req)
  if (!session) {
    return res.redirect(targetUrl)
  }

  if (isMoodleLaunchTarget(targetUrl)) {
    try {
      const relay = await prepareMoodleLaunchRelay(session)

      if (debug) {
        return res.json({
          finalUrl: relay.finalUrl,
          chain: relay.chain,
          useServerLaunch: true,
          reason: relay.reason,
          canUseServerLaunch: relay.canUseServerLaunch,
          degraded: relay.degraded,
          degradedReason: relay.degradedReason,
        })
      }

      res.setHeader('Cache-Control', 'no-store')
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.status(200).send(buildAutoSubmitPage({
        title: 'Connexion Moodle',
        heading: 'Connexion a Moodle en cours',
        body: 'Ouverture de votre session universitaire pour Moodle...',
        actionUrl: relay.actionUrl,
        fields: relay.fields,
      }))
      return
    } catch (error) {
      if (session?.credentials?.username && session?.credentials?.password) {
        try {
          const bootstrap = await prepareMoodleBrowserBootstrap(session.credentials)

          if (debug) {
            return res.json({
              finalUrl: bootstrap.actionUrl,
              chain: [],
              useServerLaunch: true,
              reason: 'browser-cas-bootstrap',
            })
          }

          res.setHeader('Cache-Control', 'no-store')
          res.setHeader('Content-Type', 'text/html; charset=utf-8')
          res.status(200).send(buildAutoSubmitPage({
            title: 'Connexion Moodle',
            heading: 'Connexion a Moodle en cours',
            body: 'Ouverture de votre session universitaire pour Moodle...',
            actionUrl: bootstrap.actionUrl,
            fields: bootstrap.fields,
            warmupUrl: bootstrap.warmupUrl,
          }))
          return
        } catch (bootstrapError) {
          if (debug) {
            return res.json({
              finalUrl: targetUrl,
              chain: [],
              useServerLaunch: false,
              reason: 'moodle-launch-error',
              error: bootstrapError instanceof Error ? bootstrapError.message : String(bootstrapError),
              relayError: error instanceof Error ? error.message : String(error),
            })
          }
        }
      } else if (debug) {
        return res.json({
          finalUrl: targetUrl,
          chain: [],
          useServerLaunch: false,
          reason: 'moodle-launch-error',
          error: error instanceof Error ? error.message : String(error),
        })
      }

      return res.redirect(targetUrl)
    }
  }

  const launchCapabilities = getSessionLaunchCapabilities(session)
  if (!launchCapabilities.canUseServerLaunch) {
    if (debug) {
      return res.json({
        finalUrl: targetUrl,
        chain: [],
        ...launchCapabilities,
      })
    }

    return res.redirect(targetUrl)
  }

  const chain = []
  const targetHost = new URL(targetUrl).hostname

  try {
    let currentUrl = targetUrl

    for (let attempt = 0; attempt < 15; attempt += 1) {
      const response = await fetchWithJar(currentUrl, session.jar, {
        redirect: 'manual',
        headers: {
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      })

      const location = response.headers.get('location')
      chain.push({ status: response.status, url: currentUrl, location })

      if (!isRedirectStatus(response.status)) {
        const html = await response.text()
        const htmlRedirect = extractHtmlRedirect(html, currentUrl)
        if (htmlRedirect) {
          currentUrl = htmlRedirect
          continue
        }
        if (debug) return res.json({ finalUrl: currentUrl, chain })
        return res.redirect(currentUrl)
      }

      if (!location) {
        if (debug) return res.json({ finalUrl: currentUrl, chain })
        return res.redirect(currentUrl)
      }

      const nextUrl = resolveUrl(location, currentUrl)
      const currentHost = new URL(currentUrl).hostname
      const nextHost = new URL(nextUrl).hostname

      if (currentHost.includes('sso-cas') && !nextHost.includes('sso-cas')) {
        if (nextHost === targetHost) {
          // Simple CAS flow: CAS redirects directly to the target → exit with ticket
          if (debug) return res.json({ finalUrl: nextUrl, chain })
          return res.redirect(nextUrl)
        }
        // SAML/Shibboleth flow detected (CAS → intermediate IdP, not target).
        // Server-side auth can't work here because SAML session cookies
        // are bound to the SP domain and can't be transferred to the browser.
        // Redirect the browser directly — it will complete the full auth flow itself.
        if (debug) return res.json({ finalUrl: targetUrl, chain, saml: true })
        return res.redirect(targetUrl)
      }

      currentUrl = nextUrl
    }

    if (debug) return res.json({ finalUrl: targetUrl, chain, error: 'too many redirects' })
    res.redirect(targetUrl)
  } catch (err) {
    if (debug) return res.json({ error: String(err), chain })
    res.redirect(targetUrl)
  }
})

// 6. Grades Endpoint (IUT Lannion — notes9)
app.get('/__ent_auth/grades', async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store')
    const session = getSessionFromRequest(req)

    if (!session) {
      return res.status(200).json({ authenticated: false, grades: null })
    }

    if (isDemoSession(session)) {
      const gradesData = buildDemoGradesPayload()
      setCachedGrades(session.id, gradesData)
      setSessionCookie(res, session)
      return res.status(200).json({
        authenticated: true,
        sessionMode: DEMO_SESSION_MODE,
        grades: gradesData,
      })
    }

    const cachedGrades = getCachedGrades(session.id)
    if (cachedGrades) {
      setSessionCookie(res, session)
      return res.status(200).json({
        authenticated: true,
        sessionMode: session.mode ?? null,
        grades: cachedGrades,
      })
    }

    await ensureNotes9Session(session.jar)

    // Fetch all grades data in one request (auth + semesters + first relevé)
    const dataUrl = `${NOTES9_ORIGIN}/services/data.php?q=dataPremi%C3%A8reConnexion`
    const dataResponse = await fetchWithJar(dataUrl, session.jar, {
      headers: { Accept: 'application/json, */*', Referer: `${NOTES9_ORIGIN}/` },
      redirect: 'follow',
    })
    const dataText = await dataResponse.text()
    let gradesData = null
    try { gradesData = JSON.parse(dataText) } catch { gradesData = dataText }

    setCachedGrades(session.id, gradesData)
    setSessionCookie(res, session)
    res.status(200).json({
      authenticated: true,
      sessionMode: session.mode ?? null,
      grades: gradesData,
    })
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
    })
  }
})

app.get('/__ent_auth/student-pic', async (req, res) => {
  try {
    const wantsMeta = req.query.meta === '1'
    const session = getSessionFromRequest(req)

    if (!session) {
      if (wantsMeta) {
        return res.status(200).json({
          authenticated: false,
          available: false,
          source: 'notes9',
          previewUrl: null,
        })
      }

      return res.status(401).json({
        error: 'Authentication required.',
      })
    }

    if (isDemoSession(session)) {
      setSessionCookie(res, session)
      if (wantsMeta) {
        return res.status(200).json({
          authenticated: true,
          sessionMode: DEMO_SESSION_MODE,
          available: false,
          source: 'demo',
          previewUrl: null,
        })
      }

      return res.status(404).json({
        available: false,
        source: 'demo',
      })
    }

    const picture = await fetchNotes9StudentPic(session.jar)
    const isImage = isNotes9StudentPicImage(picture)

    setSessionCookie(res, session)
    res.setHeader('Cache-Control', 'no-store')

    if (wantsMeta) {
      return res.status(200).json({
        authenticated: true,
        sessionMode: session.mode ?? null,
        available: picture.ok && isImage,
        source: 'notes9',
        contentType: picture.contentType,
        size: picture.size,
        status: picture.status,
        previewUrl: picture.ok && isImage ? '/__ent_auth/student-pic' : null,
      })
    }

    if (!picture.ok || !isImage) {
      return res.status(404).json({
        available: false,
        source: 'notes9',
        contentType: picture.contentType,
        status: picture.status,
      })
    }

    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('Content-Type', picture.contentType)
    res.setHeader('Content-Length', String(picture.size))
    res.status(200).end(picture.buffer)
  } catch (error) {
    if (req.query.meta === '1') {
      return res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
      })
    }

    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
    })
  }
})

// ============================================================================
// ADE SCHEDULE API ENDPOINTS
// ============================================================================

// 7. ADE Status
app.get('/__ent_auth/ade/status', async (req, res) => {
  try {
    const result = await fetchAdeApi('/timetable/getAdeStatus', null)
    res.status(200).json({ ok: result.ok, status: result.status, data: result.data })
  } catch (error) {
    res.status(502).json({ ok: false, error: error instanceof Error ? error.message : String(error) })
  }
})

// 8. ADE Calendar Metadata
app.get('/__ent_auth/ade/calendar', async (req, res) => {
  try {
    const entSession = getSessionFromRequest(req)
    if (!entSession) return res.status(200).json({ authenticated: false, calendar: null })

    const targetDate = typeof req.query.date === 'string' && req.query.date.trim()
      ? req.query.date.trim()
      : null
    const requestedResourceId = String(req.query.resourceId ?? '')

    if (isDemoSession(entSession)) {
      const calendar = buildDemoCalendarPayload({
        date: targetDate,
        resourceId: requestedResourceId,
      })

      setSessionCookie(res, entSession)
      return res.status(200).json({
        authenticated: true,
        sessionMode: DEMO_SESSION_MODE,
        calendar,
        debug: {
          source: 'demo',
        },
      })
    }

    const calendar = await fetchPlanningCalendarMetadataFromRpc(entSession.jar, {
      targetDate,
      resourceId: requestedResourceId,
      cacheScope: getPlanningCacheScope(entSession),
    })

    setSessionCookie(res, entSession)
    res.status(200).json({
      authenticated: true,
      sessionMode: entSession.mode ?? null,
      calendar: {
        source: 'planning.univ-rennes1.fr',
        resourceId: calendar.resourceId,
        currentResourceId: calendar.currentResourceId,
        requestedResourceId: calendar.requestedResourceId,
        targetDate: calendar.targetDate,
        targetDateMatched: calendar.targetDateMatched,
        outOfRange: calendar.outOfRange,
        matchedWeek: calendar.matchedWeek,
        currentWeek: calendar.currentWeek,
        firstWeek: calendar.firstWeek,
        lastWeek: calendar.lastWeek,
        weekCount: calendar.weekCount,
        weeks: calendar.weeks,
      },
      debug: {
        finalUrl: calendar.finalUrl,
        planningIdentifier: calendar.planningIdentifier,
        displayConfigurationId: calendar.displayConfigurationId,
        cache: calendar.cache,
      },
    })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) })
  }
})

// 9. ADE VET Tree
app.get('/__ent_auth/ade/tree', async (req, res) => {
  try {
    const entSession = getSessionFromRequest(req)
    if (!entSession) return res.status(200).json({ authenticated: false, tree: null })

    const requestedTreeId = String(req.query.etabsVets ?? '')

    if (isDemoSession(entSession)) {
      const tree = buildDemoAdeTreePayload(requestedTreeId)
      setSessionCookie(res, entSession)
      return res.status(200).json({
        authenticated: true,
        sessionMode: DEMO_SESSION_MODE,
        tree,
        debug: {
          source: 'demo',
        },
      })
    }

    const tree = await fetchPlanningTreeFromRpc(entSession.jar, requestedTreeId, {
      cacheScope: getPlanningCacheScope(entSession),
    })

    setSessionCookie(res, entSession)
    res.status(200).json({
      authenticated: true,
      sessionMode: entSession.mode ?? null,
      tree: {
        source: 'planning.univ-rennes1.fr',
        root: tree.root,
        currentResourceId: tree.currentResourceId,
        focusResourceId: tree.focusResourceId,
        currentPathIds: tree.currentPathIds,
      },
      debug: {
        finalUrl: tree.finalUrl,
        planningIdentifier: tree.planningIdentifier,
        cache: tree.cache,
      },
    })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) })
  }
})

// 10. ADE Search
app.get('/__ent_auth/ade/search', async (req, res) => {
  try {
    const entSession = getSessionFromRequest(req)
    if (!entSession) return res.status(200).json({ authenticated: false, results: null })

    const query = req.query.q || ''
    if (!query.trim()) return res.status(400).json({ error: 'Query parameter "q" is required.' })

    if (isDemoSession(entSession)) {
      setSessionCookie(res, entSession)
      return res.status(200).json({
        authenticated: true,
        sessionMode: DEMO_SESSION_MODE,
        results: searchDemoAdeTree(query),
        debug: {
          source: 'demo',
        },
      })
    }

    const authResult = await authenticateToAde(entSession.jar, entSession.credentials, {
      cacheScope: getPlanningCacheScope(entSession),
    })
    const result = await fetchAdeApi(`/timetable/vetSearch?q=${encodeURIComponent(query)}`, authResult.session)

    setSessionCookie(res, entSession)
    res.status(200).json({
      authenticated: true,
      sessionMode: entSession.mode ?? null,
      results: result.data,
      debug: {
        apiStatus: result.status,
        apiOk: result.ok,
        sessionSource: entSession.sessionSource ?? null,
        ...authResult,
      },
    })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) })
  }
})

// 11. ADE Timetable
app.get('/__ent_auth/ade/timetable', async (req, res) => {
  try {
    const entSession = getSessionFromRequest(req)
    if (!entSession) return res.status(200).json({ authenticated: false, timetable: null })

    const requestedDate = String(req.query.date ?? new Date().toISOString().slice(0, 10))
    const requestedResourceId = String(req.query.resourceId ?? '')

    if (isDemoSession(entSession)) {
      const timetable = buildDemoTimetablePayload({
        date: requestedDate,
        resourceId: requestedResourceId,
      })

      setSessionCookie(res, entSession)
      return res.status(200).json({
        authenticated: true,
        sessionMode: DEMO_SESSION_MODE,
        timetable,
        debug: {
          source: 'demo',
        },
      })
    }

    const timetable = await fetchPlanningTimetableFromRpc(entSession.jar, requestedDate, requestedResourceId, {
      cacheScope: getPlanningCacheScope(entSession),
    })

    setSessionCookie(res, entSession)
    res.status(200).json({
      authenticated: true,
      sessionMode: entSession.mode ?? null,
      timetable: {
        source: 'planning.univ-rennes1.fr',
        date: requestedDate,
        resourceId: timetable.resourceId,
        weekLabel: timetable.weekLabel,
        resolvedWeek: timetable.resolvedWeek,
        outOfRange: timetable.outOfRange,
        dayLabels: timetable.dayLabels,
        events: timetable.events,
      },
      debug: {
        finalUrl: timetable.finalUrl,
        planningIdentifier: timetable.planningIdentifier,
        resourceId: timetable.resourceId,
        currentResourceId: timetable.currentResourceId,
        displayConfigurationId: timetable.displayConfigurationId,
        weekIndex: timetable.weekIndex,
        calendarWeekIndex: timetable.calendarWeekIndex,
        requestedDateMatched: timetable.requestedDateMatched,
        outOfRange: timetable.outOfRange,
        cache: timetable.cache,
      },
    })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) })
  }
})

// 12. ADE Upcoming Courses
app.post('/__ent_auth/ade/upcoming', async (req, res) => {
  try {
    const entSession = getSessionFromRequest(req)
    if (!entSession) {
      return res.status(200).json({
        authenticated: false,
        upcoming: null,
      })
    }

    const requestedDate = typeof req.body?.date === 'string' && req.body.date.trim()
      ? req.body.date.trim()
      : new Date().toISOString().slice(0, 10)
    const lookaheadDays = Math.max(
      1,
      Math.min(21, Number.parseInt(String(req.body?.lookaheadDays ?? '14'), 10) || 14),
    )
    const selection = req.body?.selection && typeof req.body.selection === 'object'
      ? req.body.selection
      : null

    if (isDemoSession(entSession)) {
      const upcoming = buildDemoUpcomingPayload({
        date: requestedDate,
        lookaheadDays,
        selection,
      })

      setSessionCookie(res, entSession)
      return res.status(200).json({
        authenticated: true,
        sessionMode: DEMO_SESSION_MODE,
        upcoming,
        debug: {
          source: 'demo',
        },
      })
    }

    const resourceIds = getAdeSelectionResourceIds(selection)
    const selectionLabels = getAdeSelectionLabels(selection)
    const upcoming = await resolveAdeUpcoming(entSession.jar, entSession.credentials, {
      date: requestedDate,
      lookaheadDays,
      resourceIds,
      selectionLabels,
      cacheScope: getPlanningCacheScope(entSession),
    })

    setSessionCookie(res, entSession)
    res.status(200).json({
      authenticated: true,
      sessionMode: entSession.mode ?? null,
      upcoming: {
        source: upcoming.source,
        date: requestedDate,
        lookaheadDays,
        complete: upcoming.complete,
        resourceIds: upcoming.resourceIds,
        selectionLabels: upcoming.selectionLabels,
        events: upcoming.events,
        nextEvent: upcoming.nextEvent,
      },
      debug: {
        apiStatus: upcoming.apiStatus,
        authMode: upcoming.authMode,
        cache: upcoming.cache,
        sessionCache: upcoming.sessionCache,
        fallback: upcoming.fallback,
      },
    })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) })
  }
})

// 13. ADE Global Alerts
app.get('/__ent_auth/ade/alerts', async (req, res) => {
  try {
    const entSession = getSessionFromRequest(req)
    if (!entSession) return res.status(200).json({ authenticated: false, alerts: null })

    if (isDemoSession(entSession)) {
      setSessionCookie(res, entSession)
      return res.status(200).json({
        authenticated: true,
        sessionMode: DEMO_SESSION_MODE,
        alerts: buildDemoAlertsPayload(),
        debug: {
          source: 'demo',
        },
      })
    }

    const authResult = await authenticateToAde(entSession.jar, entSession.credentials, {
      cacheScope: getPlanningCacheScope(entSession),
    })
    const etabsVets = req.query.etabsVets || ''
    const apiPath = etabsVets
      ? `/timetable/getADEGlobalAlerts?etabsVets=${encodeURIComponent(etabsVets)}`
      : '/timetable/getADEGlobalAlerts'
    const result = await fetchAdeApi(apiPath, authResult.session)

    setSessionCookie(res, entSession)
    res.status(200).json({ authenticated: true, sessionMode: entSession.mode ?? null, alerts: result.data, debug: { apiStatus: result.status, apiOk: result.ok, ...authResult } })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) })
  }
})

// 14. Logout Endpoint
app.post('/__ent_auth/logout', (req, res) => {
  const session = getSessionFromRequest(req)
  if (session?.id) {
    runtimeSessions.delete(session.id)
    clearSensitiveSessionCaches(session)
  }

  res.clearCookie(LOCAL_SESSION_COOKIE)
  res.status(200).json({
    authenticated: false,
  })
})

app.all('/__ent_auth/demo/request', express.text({ type: '*/*' }), (req, res) => {
  const session = getSessionFromRequest(req)

  if (!isDemoSession(session)) {
    return res.status(403).json({
      error: 'Demo session required.',
    })
  }

  const requestPath = String(req.query.path ?? '').trim()
  const payload = buildDemoRequestPayload(requestPath, session)

  setSessionCookie(res, session)
  res.status(payload.status)
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Content-Type', payload.contentType)
  return res.send(payload.body)
})

// ============================================================================
// PROXY MIDDLEWARE
// ============================================================================
app.use('/__ent_proxy', createProxyMiddleware({
  target: ENT_ORIGIN,
  changeOrigin: true,
  secure: true,
  pathRewrite: { '^/__ent_proxy': '' },
  on: {
    proxyReq: (proxyReq, req) => {
      const manualCookie = req.headers['x-ent-cookie']
      if (typeof manualCookie === 'string' && manualCookie.trim()) {
        proxyReq.setHeader('cookie', manualCookie.trim())
      } else {
        const session = getSessionFromRequest(req)
        if (session) {
          const targetUrl = buildEntProxyTargetUrl(req.url)
          const cookieHeader = session.jar.getCookieHeader(targetUrl)
          if (cookieHeader) {
            proxyReq.setHeader('cookie', cookieHeader)
          }
        }
      }

      const manualReferer = req.headers['x-ent-referer']
      if (typeof manualReferer === 'string' && manualReferer.trim()) {
        proxyReq.setHeader('referer', manualReferer.trim())
      } else {
        proxyReq.setHeader('referer', DEFAULT_REFERER)
      }

      const extraHeaders = req.headers['x-ent-extra-headers']
      if (typeof extraHeaders === 'string' && extraHeaders.trim()) {
        try {
          const parsedHeaders = JSON.parse(extraHeaders)
          for (const [name, value] of Object.entries(parsedHeaders)) {
            if (value !== undefined && value !== null && value !== '') {
              proxyReq.setHeader(name, String(value))
            }
          }
        } catch {
          proxyReq.setHeader('x-ent-extra-headers-error', 'invalid-json')
        }
      }

      proxyReq.removeHeader('x-ent-cookie')
      proxyReq.removeHeader('x-ent-referer')
      proxyReq.removeHeader('x-ent-extra-headers')
    },
    proxyRes: (proxyRes, req, res) => {
      const session = getSessionFromRequest(req)
      if (session) {
        const targetUrl = buildEntProxyTargetUrl(req.url)
        session.jar.setFromProxySetCookie(proxyRes.headers['set-cookie'], targetUrl)
        setSessionCookie(res, session)
      }

      delete proxyRes.headers['set-cookie']
    }
  }
}))

// ============================================================================
// STATIC FILE SERVING (REACT FRONTEND)
// ============================================================================
app.get('/robots.txt', (req, res) => {
  const origin = getPublicOrigin(req)

  res.type('text/plain')
  res.send([
    'User-agent: *',
    'Allow: /',
    'Disallow: /__ent_auth/',
    'Disallow: /__ent_proxy/',
    `Sitemap: ${origin}/sitemap.xml`,
  ].join('\n'))
})

app.get('/sitemap.xml', (req, res) => {
  const origin = getPublicOrigin(req)

  res.type('application/xml')
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${origin}/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`)
})

function sendAppShell(req, res) {
  const canonicalUrl = new URL('/', getPublicOrigin(req)).toString()

  res.setHeader('Content-Language', 'fr')
  res.setHeader('Link', `<${canonicalUrl}>; rel="canonical"`)
  res.sendFile(path.join(__dirname, 'dist', 'index.html'))
}

app.get('/', sendAppShell)

// Serve the built static files
app.use(express.static(path.join(__dirname, 'dist')))

// Support for client-side routing (React Router)
app.get(/^.*$/, sendAppShell)

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`)
})
