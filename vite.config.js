import { randomUUID, createHmac } from 'node:crypto'
import { execSync } from 'node:child_process'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vite'
import {
  createAdeApiClient,
  getAdeSelectionLabels,
  getAdeSelectionResourceIds,
} from './adeApi.js'
import { createAdeUpcomingResolver } from './adeUpcomingResolver.js'
import { createPlanningRpcClient } from './planningRpc.js'

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
const LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000
const LOGIN_RATE_LIMIT_BLOCK_MS = 15 * 60 * 1000
const LOGIN_RATE_LIMIT_MAX_ATTEMPTS_PER_IP = 10
const LOGIN_RATE_LIMIT_MAX_ATTEMPTS_PER_USERNAME = 5
const MAX_PERSISTED_COOKIE_VALUE_LENGTH = 1024
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-only-insecure-secret'
const runtimeSessions = new Map()
const loginRateLimitByIp = new Map()
const loginRateLimitByUsername = new Map()

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function parseCookieHeader(header = '') {
  const cookies = {}

  for (const chunk of header.split(';')) {
    const [name, ...rest] = chunk.trim().split('=')
    if (!name) {
      continue
    }

    cookies[name] = rest.join('=')
  }

  return cookies
}

function serializeCookie(name, value, options = {}) {
  const parts = [`${name}=${value}`]

  if (options.path) {
    parts.push(`Path=${options.path}`)
  }

  if (options.httpOnly) {
    parts.push('HttpOnly')
  }

  if (options.sameSite) {
    parts.push(`SameSite=${options.sameSite}`)
  }

  if (options.maxAge !== undefined) {
    parts.push(`Max-Age=${options.maxAge}`)
  }

  return parts.join('; ')
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=UTF-8')
  res.end(JSON.stringify(payload))
}

async function readJsonBody(req) {
  let body = ''

  for await (const chunk of req) {
    body += chunk

    if (body.length > 100_000) {
      throw new Error('Request body is too large.')
    }
  }

  if (!body.trim()) {
    return {}
  }

  return JSON.parse(body)
}

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

function buildEntProxyTargetUrl(requestUrl) {
  const rewrittenPath = (requestUrl || '/').replace(/^\/__ent_proxy/, '') || '/'
  return new URL(rewrittenPath, ENT_ORIGIN).toString()
}

function getSessionLaunchCapabilities(session) {
  const canUseServerLaunch = Boolean(session?.jar?.hasCookie('sso-cas.univ-rennes.fr', 'TGC'))

  return {
    canUseServerLaunch,
    degraded: !canUseServerLaunch,
    degradedReason: canUseServerLaunch ? null : 'missing-cas-tgc',
  }
}

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

function pruneRuntimeSessions() {
  const now = Date.now()

  for (const [sessionId, session] of runtimeSessions.entries()) {
    if (!session?.createdAt || now - session.createdAt > SESSION_TTL_MS) {
      runtimeSessions.delete(sessionId)
    }
  }
}

function getSessionFromRequest(req) {
  pruneRuntimeSessions()

  const cookies = parseCookieHeader(req.headers.cookie)
  const data = decodeSession(cookies[LOCAL_SESSION_COOKIE])
  if (!data) {
    return null
  }

  const runtimeSession = runtimeSessions.get(data.id)
  if (runtimeSession) {
    runtimeSession.sessionSource = 'runtime'
    return runtimeSession
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

function buildMoodleWayfRequest(page, acceptHeader) {
  const actionUrl = extractFormAction(page.html, page.url)
  return {
    actionUrl,
    headers: {
      Accept: acceptHeader,
      'Content-Type': 'application/x-www-form-urlencoded',
      Origin: new URL(actionUrl).origin,
      Referer: page.url,
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
      }, acceptHeader)
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
      reason: 'missing-cas-tgc',
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

function normalizeLoginIdentifier(username) {
  return String(username ?? '').trim().toLowerCase()
}

function getLoginRequesterIp(req) {
  const forwardedFor = String(req.headers['x-forwarded-for'] ?? '').split(',')[0]?.trim()
  return forwardedFor || String(req.socket?.remoteAddress || 'unknown')
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

function setSessionCookie(res, session) {
  pruneRuntimeSessions()
  runtimeSessions.set(session.id, session)

  const data = {
    id: session.id,
    user: session.user,
    jar: buildPersistedSessionJar(session),
    createdAt: session.createdAt,
  }

  res.setHeader(
    'Set-Cookie',
    serializeCookie(LOCAL_SESSION_COOKIE, encodeSession(data), {
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
      secure: !!process.env.SESSION_SECRET,
      maxAge: SESSION_TTL_MS / 1000,
    }),
  )
}

function clearLocalSessionCookie(res) {
  res.setHeader(
    'Set-Cookie',
    serializeCookie(LOCAL_SESSION_COOKIE, '', {
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
      maxAge: 0,
    }),
  )
}

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
  const meta = html.match(/<meta[^>]+http-equiv=["']?refresh["']?[^>]+content=["'][^"']*url=([^\s"'>]+)/i)
    || html.match(/<meta[^>]+content=["'][^;]*;\s*url=([^\s"'>]+)[^>]*http-equiv=["']?refresh["']?/i)
  if (meta) {
    return resolveUrl(meta[1].replace(/["']/g, ''), pageUrl)
  }

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

function createEntDevAuthPlugin() {
  const attachMiddlewares = (middlewares) => {
    middlewares.use('/__ent_auth/session', async (req, res, next) => {
      if (req.method !== 'GET') {
        next()
        return
      }

      try {
        res.setHeader('Cache-Control', 'no-store')
        const session = getSessionFromRequest(req)

        if (!session) {
          sendJson(res, 200, {
            authenticated: false,
            user: null,
            sessionSource: null,
            degraded: false,
            degradedReason: null,
            canUseServerLaunch: false,
          })
          return
        }

        const layout = await fetchEntLayout(session.jar)

        if (!layout.ok || !layout.data || String(layout.data.authenticated) !== 'true') {
          clearLocalSessionCookie(res)
          sendJson(res, 200, {
            authenticated: false,
            user: null,
            sessionSource: null,
            degraded: false,
            degradedReason: null,
            canUseServerLaunch: false,
          })
          return
        }

        session.user = layout.data.user
        setSessionCookie(res, session)
        const launchCapabilities = getSessionLaunchCapabilities(session)

        sendJson(res, 200, {
          authenticated: true,
          user: layout.data.user,
          sessionSource: session.sessionSource ?? null,
          cookieNames: session.jar.getCookieNamesForHost('services-numeriques.univ-rennes.fr'),
          casCookieNames: session.jar.getCookieNamesForHost('sso-cas.univ-rennes.fr'),
          ...launchCapabilities,
        })
      } catch (error) {
        sendJson(res, 500, {
          error: error instanceof Error ? error.message : String(error),
        })
      }
    })

    middlewares.use('/__ent_auth/login', async (req, res, next) => {
      if (req.method !== 'POST') {
        next()
        return
      }

      let username = ''

      try {
        const body = await readJsonBody(req)
        username = String(body.username ?? '').trim()
        const password = String(body.password ?? '')

        if (!username || !password) {
          sendJson(res, 400, {
            error: 'Username and password are required.',
          })
          return
        }

        const activeRateLimit = getActiveLoginRateLimit(req, username)
        if (activeRateLimit) {
          res.setHeader('Retry-After', String(activeRateLimit.retryAfterSeconds))
          sendJson(res, 429, {
            error: 'Too many login attempts. Please try again later.',
          })
          return
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

        // Warm the ADE session cache while the credentials are only available in
        // this request, without storing them on the app session.
        try {
          await authenticateToAde(result.jar, { username, password }, {
            cacheScope: getPlanningCacheScope(session),
          })
        } catch (adeError) {
          console.warn('ADE session bootstrap failed during login:', adeError)
        }

        setSessionCookie(res, session)
        sendJson(res, 200, {
          authenticated: true,
          user: result.layout.user,
        })
      } catch (error) {
        const rateLimit = recordLoginFailure(req, username)
        if (rateLimit) {
          res.setHeader('Retry-After', String(rateLimit.retryAfterSeconds))
          sendJson(res, 429, {
            error: 'Too many login attempts. Please try again later.',
          })
          return
        }

        sendJson(res, 401, {
          error: error instanceof Error ? error.message : String(error),
        })
      }
    })

    middlewares.use('/__ent_auth/account', async (req, res, next) => {
      if (req.method !== 'GET') {
        next()
        return
      }

      try {
        const session = getSessionFromRequest(req)

        if (!session) {
          sendJson(res, 200, {
            authenticated: false,
            account: null,
          })
          return
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
            sendJson(res, 200, {
              authenticated: true,
              account: payload,
            })
            return
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

        sendJson(res, 200, {
          authenticated: true,
          account: data,
        })
      } catch (error) {
        sendJson(res, 500, {
          error: error instanceof Error ? error.message : String(error),
        })
      }
    })

    middlewares.use('/__ent_auth/planning', async (req, res, next) => {
      if (req.method !== 'GET') {
        next()
        return
      }

      try {
        const session = getSessionFromRequest(req)

        if (!session) {
          sendJson(res, 200, { authenticated: false, events: null })
          return
        }

        const url = new URL(req.url, 'http://localhost')
        const targetDate = String(url.searchParams.get('date') || new Date().toISOString().slice(0, 10))
        const requestedResourceId = String(url.searchParams.get('resourceId') || '')
        const timetable = await fetchPlanningTimetableFromRpc(session.jar, targetDate, requestedResourceId, {
          cacheScope: getPlanningCacheScope(session),
        })

        setSessionCookie(res, session)
        sendJson(res, 200, {
          authenticated: true,
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
        sendJson(res, 500, {
          error: error instanceof Error ? error.message : String(error),
        })
      }
    })

    middlewares.use('/__ent_auth/launch', async (req, res, next) => {
      if (req.method !== 'GET') {
        next()
        return
      }

      const parsedUrl = new URL(req.url, 'http://localhost')
      const targetUrl = parsedUrl.searchParams.get('url')
      const debug = parsedUrl.searchParams.get('debug') === '1'

      if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
        res.statusCode = 302
        res.setHeader('Location', '/')
        res.end()
        return
      }

      const session = getSessionFromRequest(req)
      if (!session) {
        res.statusCode = 302
        res.setHeader('Location', targetUrl)
        res.end()
        return
      }

      if (isMoodleLaunchTarget(targetUrl)) {
        try {
          const relay = await prepareMoodleLaunchRelay(session)

          if (debug) {
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({
              finalUrl: relay.finalUrl,
              chain: relay.chain,
              useServerLaunch: true,
              reason: relay.reason,
              canUseServerLaunch: relay.canUseServerLaunch,
              degraded: relay.degraded,
              degradedReason: relay.degradedReason,
            }))
            return
          }

          res.statusCode = 200
          res.setHeader('Cache-Control', 'no-store')
          res.setHeader('Content-Type', 'text/html; charset=utf-8')
          res.end(buildAutoSubmitPage({
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
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({
                  finalUrl: bootstrap.actionUrl,
                  chain: [],
                  useServerLaunch: true,
                  reason: 'browser-cas-bootstrap',
                }))
                return
              }

              res.statusCode = 200
              res.setHeader('Cache-Control', 'no-store')
              res.setHeader('Content-Type', 'text/html; charset=utf-8')
              res.end(buildAutoSubmitPage({
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
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({
                  finalUrl: targetUrl,
                  chain: [],
                  useServerLaunch: false,
                  reason: 'moodle-launch-error',
                  error: bootstrapError instanceof Error ? bootstrapError.message : String(bootstrapError),
                  relayError: error instanceof Error ? error.message : String(error),
                }))
                return
              }
            }
          } else if (debug) {
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({
              finalUrl: targetUrl,
              chain: [],
              useServerLaunch: false,
              reason: 'moodle-launch-error',
              error: error instanceof Error ? error.message : String(error),
            }))
            return
          }

          res.statusCode = 302
          res.setHeader('Location', targetUrl)
          res.end()
          return
        }
      }

      const launchCapabilities = getSessionLaunchCapabilities(session)
      if (!launchCapabilities.canUseServerLaunch) {
        if (debug) {
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({
            finalUrl: targetUrl,
            chain: [],
            ...launchCapabilities,
          }))
          return
        }

        res.statusCode = 302
        res.setHeader('Location', targetUrl)
        res.end()
        return
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
            if (debug) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ finalUrl: currentUrl, chain })); return }
            res.statusCode = 302
            res.setHeader('Location', currentUrl)
            res.end()
            return
          }

          if (!location) {
            if (debug) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ finalUrl: currentUrl, chain })); return }
            res.statusCode = 302
            res.setHeader('Location', currentUrl)
            res.end()
            return
          }

          const nextUrl = resolveUrl(location, currentUrl)
          const currentHost = new URL(currentUrl).hostname
          const nextHost = new URL(nextUrl).hostname

          if (currentHost.includes('sso-cas') && !nextHost.includes('sso-cas')) {
            if (nextHost === targetHost) {
              // Simple CAS flow: CAS redirects directly to the target → exit with ticket
              if (debug) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ finalUrl: nextUrl, chain })); return }
              res.statusCode = 302
              res.setHeader('Location', nextUrl)
              res.end()
              return
            }
            // SAML/Shibboleth flow detected (CAS → intermediate IdP, not target).
            // Server-side auth can't work here because SAML session cookies
            // are bound to the SP domain and can't be transferred to the browser.
            // Redirect the browser directly — it will complete the full auth flow itself.
            if (debug) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ finalUrl: targetUrl, chain, saml: true })); return }
            res.statusCode = 302
            res.setHeader('Location', targetUrl)
            res.end()
            return
          }

          currentUrl = nextUrl
        }

        if (debug) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ finalUrl: targetUrl, chain, error: 'too many redirects' })); return }
        res.statusCode = 302
        res.setHeader('Location', targetUrl)
        res.end()
      } catch (err) {
        if (debug) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: String(err), chain })); return }
        res.statusCode = 302
        res.setHeader('Location', targetUrl)
        res.end()
      }
    })

    middlewares.use('/__ent_auth/launch-preview', async (req, res, next) => {
      if (req.method !== 'GET') {
        next()
        return
      }

      const url = new URL(req.url, 'http://localhost')
      const targetUrl = url.searchParams.get('url') || ''

      if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
        sendJson(res, 400, {
          finalUrl: String(targetUrl ?? ''),
          chain: [],
          useServerLaunch: false,
          reason: 'invalid-target-url',
        })
        return
      }

      try {
        const session = getSessionFromRequest(req)
        const preview = await previewServerLaunch(targetUrl, session)
        sendJson(res, 200, preview)
      } catch (error) {
        sendJson(res, 500, {
          finalUrl: targetUrl,
          chain: [],
          useServerLaunch: false,
          reason: 'preview-error',
          error: error instanceof Error ? error.message : String(error),
        })
      }
    })

    middlewares.use('/__ent_auth/grades', async (req, res, next) => {
      if (req.method !== 'GET') {
        next()
        return
      }

      try {
        const session = getSessionFromRequest(req)

        if (!session) {
          sendJson(res, 200, { authenticated: false, grades: null })
          return
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

        // Debug: log Notes9 response to help diagnose grade fetching issues
        const hasReleve = typeof gradesData === 'object' && gradesData !== null && 'relevé' in gradesData
        console.log(`[grades] Notes9 response: status=${dataResponse.status}, hasRelevé=${hasReleve}, keys=${typeof gradesData === 'object' && gradesData !== null ? Object.keys(gradesData).join(',') : typeof gradesData}`)

        sendJson(res, 200, {
          authenticated: true,
          grades: gradesData,
        })
      } catch (error) {
        sendJson(res, 500, {
          error: error instanceof Error ? error.message : String(error),
        })
      }
    })

    middlewares.use('/__ent_auth/student-pic', async (req, res, next) => {
      if (req.method !== 'GET') {
        next()
        return
      }

      try {
        const wantsMeta = new URL(req.url, 'http://localhost').searchParams.get('meta') === '1'
        const session = getSessionFromRequest(req)

        if (!session) {
          sendJson(res, 200, {
            authenticated: false,
            available: false,
            source: 'notes9',
            previewUrl: null,
          })
          return
        }

        const picture = await fetchNotes9StudentPic(session.jar)
        const isImage = isNotes9StudentPicImage(picture)
        res.setHeader('Cache-Control', 'no-store')

        if (wantsMeta) {
          sendJson(res, 200, {
            authenticated: true,
            available: picture.ok && isImage,
            source: 'notes9',
            contentType: picture.contentType,
            size: picture.size,
            status: picture.status,
            previewUrl: picture.ok && isImage ? '/__ent_auth/student-pic' : null,
          })
          return
        }

        if (!picture.ok || !isImage) {
          sendJson(res, 404, {
            available: false,
            source: 'notes9',
            contentType: picture.contentType,
            status: picture.status,
          })
          return
        }

        res.statusCode = 200
        res.setHeader('Cache-Control', 'no-store')
        res.setHeader('Content-Type', picture.contentType)
        res.setHeader('Content-Length', String(picture.size))
        res.end(picture.buffer)
      } catch (error) {
        sendJson(res, 500, {
          error: error instanceof Error ? error.message : String(error),
        })
      }
    })

    // ==== ADE Schedule API ====

    middlewares.use('/__ent_auth/ade/status', async (req, res, next) => {
      if (req.method !== 'GET') { next(); return }

      try {
        // Status is a public health-check — try without auth first.
        const result = await fetchAdeApi('/timetable/getAdeStatus', null)
        sendJson(res, 200, { ok: result.ok, status: result.status, data: result.data })
      } catch (error) {
        sendJson(res, 502, { ok: false, error: error instanceof Error ? error.message : String(error) })
      }
    })

    middlewares.use('/__ent_auth/ade/calendar', async (req, res, next) => {
      if (req.method !== 'GET') { next(); return }

      try {
        const entSession = getSessionFromRequest(req)
        if (!entSession) { sendJson(res, 200, { authenticated: false, calendar: null }); return }

        const url = new URL(req.url, 'http://localhost')
        const targetDate = url.searchParams.get('date')?.trim() || null
        const requestedResourceId = String(url.searchParams.get('resourceId') || '')
        const calendar = await fetchPlanningCalendarMetadataFromRpc(entSession.jar, {
          targetDate,
          resourceId: requestedResourceId,
          cacheScope: getPlanningCacheScope(entSession),
        })

        setSessionCookie(res, entSession)
        sendJson(res, 200, {
          authenticated: true,
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
        sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) })
      }
    })

    middlewares.use('/__ent_auth/ade/tree', async (req, res, next) => {
      if (req.method !== 'GET') { next(); return }

      try {
        const entSession = getSessionFromRequest(req)
        if (!entSession) { sendJson(res, 200, { authenticated: false, tree: null }); return }

        const url = new URL(req.url, 'http://localhost')
        const requestedTreeId = url.searchParams.get('etabsVets') || ''
        const tree = await fetchPlanningTreeFromRpc(entSession.jar, requestedTreeId, {
          cacheScope: getPlanningCacheScope(entSession),
        })

        setSessionCookie(res, entSession)
        sendJson(res, 200, {
          authenticated: true,
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
        sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) })
      }
    })

    middlewares.use('/__ent_auth/ade/search', async (req, res, next) => {
      if (req.method !== 'GET') { next(); return }

      try {
        const entSession = getSessionFromRequest(req)
        if (!entSession) { sendJson(res, 200, { authenticated: false, results: null }); return }

        const url = new URL(req.url, 'http://localhost')
        const query = url.searchParams.get('q') || ''
        if (!query.trim()) { sendJson(res, 400, { error: 'Query parameter "q" is required.' }); return }

        const authResult = await authenticateToAde(entSession.jar, entSession.credentials, {
          cacheScope: getPlanningCacheScope(entSession),
        })
        const result = await fetchAdeApi(`/timetable/vetSearch?q=${encodeURIComponent(query)}`, authResult.session)

        sendJson(res, 200, { authenticated: true, results: result.data, debug: { apiStatus: result.status, apiOk: result.ok, ...authResult } })
      } catch (error) {
        sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) })
      }
    })

    middlewares.use('/__ent_auth/ade/timetable', async (req, res, next) => {
      if (req.method !== 'GET') { next(); return }

      try {
        const entSession = getSessionFromRequest(req)
        if (!entSession) { sendJson(res, 200, { authenticated: false, timetable: null }); return }

        const url = new URL(req.url, 'http://localhost')
        const requestedDate = String(url.searchParams.get('date') || new Date().toISOString().slice(0, 10))
        const requestedResourceId = String(url.searchParams.get('resourceId') || '')
        const timetable = await fetchPlanningTimetableFromRpc(entSession.jar, requestedDate, requestedResourceId, {
          cacheScope: getPlanningCacheScope(entSession),
        })

        setSessionCookie(res, entSession)
        sendJson(res, 200, {
          authenticated: true,
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
        sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) })
      }
    })

    middlewares.use('/__ent_auth/ade/upcoming', async (req, res, next) => {
      if (req.method !== 'POST') { next(); return }

      try {
        const entSession = getSessionFromRequest(req)
        if (!entSession) {
          sendJson(res, 200, { authenticated: false, upcoming: null })
          return
        }

        const body = await readJsonBody(req)
        const requestedDate = typeof body.date === 'string' && body.date.trim()
          ? body.date.trim()
          : new Date().toISOString().slice(0, 10)
        const lookaheadDays = Math.max(
          1,
          Math.min(21, Number.parseInt(String(body.lookaheadDays ?? '14'), 10) || 14),
        )
        const selection = body.selection && typeof body.selection === 'object'
          ? body.selection
          : null
        const upcoming = await resolveAdeUpcoming(entSession.jar, entSession.credentials, {
          date: requestedDate,
          lookaheadDays,
          resourceIds: getAdeSelectionResourceIds(selection),
          selectionLabels: getAdeSelectionLabels(selection),
          cacheScope: getPlanningCacheScope(entSession),
        })

        setSessionCookie(res, entSession)
        sendJson(res, 200, {
          authenticated: true,
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
        sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) })
      }
    })

    middlewares.use('/__ent_auth/ade/alerts', async (req, res, next) => {
      if (req.method !== 'GET') { next(); return }

      try {
        const entSession = getSessionFromRequest(req)
        if (!entSession) { sendJson(res, 200, { authenticated: false, alerts: null }); return }

        const authResult = await authenticateToAde(entSession.jar, entSession.credentials, {
          cacheScope: getPlanningCacheScope(entSession),
        })
        const url = new URL(req.url, 'http://localhost')
        const etabsVets = url.searchParams.get('etabsVets') || ''
        const apiPath = etabsVets
          ? `/timetable/getADEGlobalAlerts?etabsVets=${encodeURIComponent(etabsVets)}`
          : '/timetable/getADEGlobalAlerts'
        const result = await fetchAdeApi(apiPath, authResult.session)

        sendJson(res, 200, { authenticated: true, alerts: result.data, debug: { apiStatus: result.status, apiOk: result.ok, ...authResult } })
      } catch (error) {
        sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) })
      }
    })

    middlewares.use('/__ent_auth/logout', (req, res, next) => {
      if (req.method !== 'POST') {
        next()
        return
      }

      const session = getSessionFromRequest(req)
      if (session?.id) {
        runtimeSessions.delete(session.id)
      }

      clearLocalSessionCookie(res)
      sendJson(res, 200, {
        authenticated: false,
      })
    })
  }

  return {
    name: 'ent-dev-auth',
    configureServer(server) {
      attachMiddlewares(server.middlewares)
    },
    configurePreviewServer(server) {
      attachMiddlewares(server.middlewares)
    },
    applyProxyOverrides(proxyReq, req) {
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
    applyProxyResponse(proxyRes, req) {
      const session = getSessionFromRequest(req)
      if (session) {
        const targetUrl = buildEntProxyTargetUrl(req.url)
        session.jar.setFromProxySetCookie(proxyRes.headers['set-cookie'], targetUrl)
      }

      delete proxyRes.headers['set-cookie']
    },
  }
}

const entDevAuthPlugin = createEntDevAuthPlugin()

const gitHash = (() => {
  try { return execSync('git rev-parse --short HEAD').toString().trim() }
  catch { return 'dev' }
})()

export default defineConfig({
  define: {
    __BUILD_HASH__: JSON.stringify(gitHash),
  },
  plugins: [
    tailwindcss(),
    react(),
    entDevAuthPlugin,
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      workbox: {
        navigateFallbackDenylist: [/^\/__ent_auth/, /^\/__ent_proxy/],
      },
      manifest: {
        name: "l'ent",
        short_name: "l'ent",
        description: "l'ent réunit toutes vos données universitaires — cours, résultats, messagerie dans une interface lisible, rapide et agréable à utiliser.",
        theme_color: '#FCFBF8',
        background_color: '#FCFBF8',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
  server: {
    allowedHosts: true,
    proxy: {
      '/__ent_proxy': {
        target: ENT_ORIGIN,
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/__ent_proxy/, ''),
        configure(proxy) {
          proxy.on('proxyReq', (proxyReq, req) => {
            entDevAuthPlugin.applyProxyOverrides(proxyReq, req)
          })

          proxy.on('proxyRes', (proxyRes, req) => {
            entDevAuthPlugin.applyProxyResponse(proxyRes, req)
          })
        },
      },
    },
  },
})
