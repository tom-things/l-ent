import express from 'express'
import cookieParser from 'cookie-parser'
import { createProxyMiddleware } from 'http-proxy-middleware'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const app = express()
const PORT = process.env.PORT || 3000

// ============================================================================
// ENT Auth Configs & Utilities (Copied directly from earlier vite.config.js)
// ============================================================================
const ENT_ORIGIN = 'https://services-numeriques.univ-rennes.fr'
const CAS_ORIGIN = 'https://sso-cas.univ-rennes.fr'
const PLANNING_ORIGIN = 'https://planning.univ-rennes1.fr'
const PLANNING_SERVICE_URL = `${PLANNING_ORIGIN}/direct/myplanning.jsp`
const DEFAULT_REFERER = `${ENT_ORIGIN}/f/services/normal/render.uP`
const LOCAL_SESSION_COOKIE = 'ent_front_session'
const SESSION_TTL_MS = 8 * 60 * 60 * 1000

const sessions = new Map()

// Utility functions
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
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
  const action = match?.[1] ?? pageUrl
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

function getSessionFromRequest(req) {
  const sessionId = req.cookies[LOCAL_SESSION_COOKIE]

  if (!sessionId) {
    return null
  }

  const session = sessions.get(sessionId)
  if (!session) {
    return null
  }

  if (Date.now() - session.updatedAt > SESSION_TTL_MS) {
    sessions.delete(sessionId)
    return null
  }

  session.updatedAt = Date.now()
  return session
}

// ============================================================================
// ICAL PARSER
// ============================================================================

function parseIcalEvents(icalText) {
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

function unescapeIcal(value) {
  return value
    .replace(/\\n/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
    .trim()
}

// ============================================================================
// EXPRESS MIDDLEWARE AND ROUTES
// ============================================================================

app.use(cookieParser())
app.use(express.json()) // Automatically parse incoming JSON requests for auth endpoints

// 1. Auth Status Endpoint
app.get('/__ent_auth/session', async (req, res) => {
  try {
    const session = getSessionFromRequest(req)

    if (!session) {
      return res.status(200).json({
        authenticated: false,
        user: null,
      })
    }

    const layout = await fetchEntLayout(session.jar)

    if (!layout.ok || !layout.data || String(layout.data.authenticated) !== 'true') {
      sessions.delete(session.id)
      res.clearCookie(LOCAL_SESSION_COOKIE)
      return res.status(200).json({
        authenticated: false,
        user: null,
      })
    }

    session.user = layout.data.user

    res.status(200).json({
      authenticated: true,
      user: layout.data.user,
      cookieNames: session.jar.getCookieNamesForHost('services-numeriques.univ-rennes.fr'),
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

    const result = await performEntLogin({ username, password })
    const sessionId = randomUUID()

    sessions.set(sessionId, {
      id: sessionId,
      user: result.layout.user,
      updatedAt: Date.now(),
      jar: result.jar,
    })

    // Secure=false in production IF not terminating TLS directly, but Render provides TLS.
    // For universal support, we use standard cookie settings.
    res.cookie(LOCAL_SESSION_COOKIE, sessionId, {
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
      maxAge: SESSION_TTL_MS, 
    })

    res.status(200).json({
      authenticated: true,
      user: result.layout.user,
    })
  } catch (error) {
    res.status(401).json({
      error: error instanceof Error ? error.message : String(error),
    })
  }
})

// 3. Account Info Endpoint
app.get('/__ent_auth/account', async (req, res) => {
  try {
    const session = getSessionFromRequest(req)

    if (!session) {
      return res.status(200).json({
        authenticated: false,
        account: null,
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
        return res.status(200).json({
          authenticated: true,
          account: payload,
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

    res.status(200).json({
      authenticated: true,
      account: data,
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

    // 1. Establish a planning session via CAS
    const casLoginUrl = `${CAS_ORIGIN}/login?service=${encodeURIComponent(PLANNING_SERVICE_URL)}`
    const casResult = await followRedirectChain(casLoginUrl, session.jar, {
      headers: { Accept: 'text/html,application/xhtml+xml,*/*' },
    })
    await casResult.response.text()

    // 2. Load GWT nocache.js to find the strong name (permutation)
    let strongName = ''
    const nocacheUrl = `${PLANNING_ORIGIN}/direct/gwtdirectplanning/gwtdirectplanning.nocache.js`
    const nocacheResponse = await fetchWithJar(nocacheUrl, session.jar, {
      headers: { Accept: '*/*' },
      redirect: 'follow',
    })
    const nocacheJs = await nocacheResponse.text()

    const strongNameMatch = nocacheJs.match(/='([A-F0-9]{32})'/i)
      || nocacheJs.match(/\$strongName\s*=\s*'([A-F0-9]{32})'/i)
      || nocacheJs.match(/'([A-F0-9]{32})'/i)
    if (strongNameMatch) {
      strongName = strongNameMatch[1]
    }

    // 3. Fetch serialization policy
    let policyText = ''
    if (strongName) {
      const policyUrl = `${PLANNING_ORIGIN}/direct/gwtdirectplanning/${strongName}.gwt.rpc`
      const policyResponse = await fetchWithJar(policyUrl, session.jar, {
        headers: { Accept: '*/*' },
        redirect: 'follow',
      })
      policyText = await policyResponse.text()
    }

    // 4. Probe the GWT RPC endpoint
    const rpcUrl = `${PLANNING_ORIGIN}/direct/gwtdirectplanning/MyPlanningClientServiceProxy`
    const moduleBase = `${PLANNING_ORIGIN}/direct/gwtdirectplanning/`
    const rpcHeaders = {
      'Content-Type': 'text/x-gwt-rpc; charset=utf-8',
      'X-GWT-Module-Base': moduleBase,
      ...(strongName ? { 'X-GWT-Permutation': strongName } : {}),
    }

    const probePayload = `7|0|4|${moduleBase}|${strongName}|com.adesoft.gwt.directplan.client.rpc.MyPlanningClientServiceProxy|method|1|2|3|4|0|`
    const rpcResponse = await fetchWithJar(rpcUrl, session.jar, {
      method: 'POST',
      headers: rpcHeaders,
      body: probePayload,
      redirect: 'follow',
    })
    const rpcText = await rpcResponse.text()

    // 5. Try the standard JSP interface to find resource IDs
    const stdUrl = `${PLANNING_ORIGIN}/jsp/standard/gui/interface.jsp`
    const stdResponse = await fetchWithJar(stdUrl, session.jar, {
      headers: { Accept: 'text/html,*/*' },
      redirect: 'follow',
    })
    const stdHtml = await stdResponse.text()

    const projectMatch = stdHtml.match(/projectId[=:]\s*["']?(\d+)/i)
      || stdHtml.match(/idProject[=:]\s*["']?(\d+)/i)
    const resourceMatches = stdHtml.match(/resources?[=:]\s*["']?([\d,]+)/gi) ?? []
    const dataMatches = stdHtml.match(/data=([a-f0-9]+)/gi) ?? []
    const checkMatches = stdHtml.match(/check\(\s*(\d+)/gi) ?? []

    // If we found resource IDs, try iCal
    let icalText = ''
    const today = new Date()
    const firstDate = new Date(today)
    firstDate.setDate(firstDate.getDate() - firstDate.getDay() + 1)
    const lastDate = new Date(firstDate)
    lastDate.setDate(lastDate.getDate() + 27)
    const formatDate = (d) => d.toISOString().split('T')[0]

    if (checkMatches.length > 0) {
      const resourceIds = checkMatches.map((m) => m.match(/\d+/)?.[0]).filter(Boolean)
      const projectId = projectMatch ? projectMatch[1] : '3'
      const calUrl = `${PLANNING_ORIGIN}/jsp/custom/modules/plannings/anonymous_cal.jsp?resources=${resourceIds.join(',')}&projectId=${projectId}&calType=ical&firstDate=${formatDate(firstDate)}&lastDate=${formatDate(lastDate)}`

      const calResponse = await fetchWithJar(calUrl, session.jar, {
        headers: { Accept: 'text/calendar, */*' },
        redirect: 'follow',
      })
      icalText = await calResponse.text()
    }

    if (icalText && icalText.includes('BEGIN:VCALENDAR')) {
      return res.status(200).json({
        authenticated: true,
        events: parseIcalEvents(icalText),
      })
    }

    // Return debug info
    res.status(200).json({
      authenticated: true,
      events: [],
      debug: {
        finalUrl: casResult.finalUrl,
        strongName: strongName || null,
        policyLength: policyText.length,
        rpcStatus: rpcResponse.status,
        rpcResponse: rpcText.slice(0, 1000),
        stdInterfaceStatus: stdResponse.status,
        stdSnippet: stdHtml.slice(0, 1500),
        projectMatch: projectMatch?.[0] ?? null,
        resourceMatches,
        dataMatches,
        checkMatches,
        planningCookies: session.jar.getCookieNamesForHost('planning.univ-rennes1.fr'),
      },
    })
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
    })
  }
})

// 5. Logout Endpoint
app.post('/__ent_auth/logout', (req, res) => {
  const session = getSessionFromRequest(req)
  if (session) {
    sessions.delete(session.id)
  }

  res.clearCookie(LOCAL_SESSION_COOKIE)
  res.status(200).json({
    authenticated: false,
  })
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
    proxyReq: (proxyReq, req, res) => {
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
      }

      delete proxyRes.headers['set-cookie']
    }
  }
}))

// ============================================================================
// STATIC FILE SERVING (REACT FRONTEND)
// ============================================================================
// Serve the built static files
app.use(express.static(path.join(__dirname, 'dist')))

// Support for client-side routing (React Router)
app.get(/^.*$/, (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'))
})

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`)
})
