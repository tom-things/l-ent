import { randomUUID } from 'node:crypto'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vite'

const ENT_ORIGIN = 'https://services-numeriques.univ-rennes.fr'
const CAS_ORIGIN = 'https://sso-cas.univ-rennes.fr'
const PLANNING_ORIGIN = 'https://planning.univ-rennes1.fr'
const PLANNING_SERVICE_URL = `${PLANNING_ORIGIN}/direct/myplanning.jsp`
const DEFAULT_REFERER = `${ENT_ORIGIN}/f/services/normal/render.uP`
const LOCAL_SESSION_COOKIE = 'ent_front_session'
const SESSION_TTL_MS = 8 * 60 * 60 * 1000

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

function getSessionFromRequest(req, sessions) {
  const cookies = parseCookieHeader(req.headers.cookie)
  const sessionId = cookies[LOCAL_SESSION_COOKIE]

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

function setLocalSessionCookie(res, sessionId) {
  res.setHeader(
    'Set-Cookie',
    serializeCookie(LOCAL_SESSION_COOKIE, sessionId, {
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
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

function unescapeIcal(value) {
  return value
    .replace(/\\n/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
    .trim()
}

async function establishPlanningSession(jar) {
  // 1. Get CAS service ticket and establish authenticated JSESSIONID
  const casLoginUrl = `${CAS_ORIGIN}/login?service=${encodeURIComponent(PLANNING_SERVICE_URL)}`
  const casResult = await followRedirectChain(casLoginUrl, jar, {
    headers: { Accept: 'text/html,application/xhtml+xml,*/*' },
  })
  await casResult.response.text()

  // 2. Get the GWT strong name (separate request, doesn't need ticket)
  const nocacheUrl = `${PLANNING_ORIGIN}/direct/gwtdirectplanning/gwtdirectplanning.nocache.js`
  const nocacheResponse = await fetchWithJar(nocacheUrl, jar, {
    headers: { Accept: '*/*' },
    redirect: 'follow',
  })
  const nocacheJs = await nocacheResponse.text()

  let strongName = ''
  const match = nocacheJs.match(/='([A-F0-9]{32})'/i)
    || nocacheJs.match(/'([A-F0-9]{32})'/i)
  if (match) {
    strongName = match[1]
  }

  const moduleBase = `${PLANNING_ORIGIN}/direct/gwtdirectplanning/`
  const rpcHeaders = {
    'Content-Type': 'text/x-gwt-rpc; charset=utf-8',
    'X-GWT-Module-Base': moduleBase,
    ...(strongName ? { 'X-GWT-Permutation': strongName } : {}),
  }

  return { moduleBase, strongName, rpcHeaders, ticket }
}

function createEntDevAuthPlugin() {
  const sessions = new Map()

  const attachMiddlewares = (middlewares) => {
    middlewares.use('/__ent_auth/session', async (req, res, next) => {
      if (req.method !== 'GET') {
        next()
        return
      }

      try {
        const session = getSessionFromRequest(req, sessions)

        if (!session) {
          sendJson(res, 200, {
            authenticated: false,
            user: null,
          })
          return
        }

        const layout = await fetchEntLayout(session.jar)

        if (!layout.ok || !layout.data || String(layout.data.authenticated) !== 'true') {
          sessions.delete(session.id)
          clearLocalSessionCookie(res)
          sendJson(res, 200, {
            authenticated: false,
            user: null,
          })
          return
        }

        session.user = layout.data.user

        sendJson(res, 200, {
          authenticated: true,
          user: layout.data.user,
          cookieNames: session.jar.getCookieNamesForHost('services-numeriques.univ-rennes.fr'),
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

      try {
        const body = await readJsonBody(req)
        const username = String(body.username ?? '').trim()
        const password = String(body.password ?? '')

        if (!username || !password) {
          sendJson(res, 400, {
            error: 'Username and password are required.',
          })
          return
        }

        const result = await performEntLogin({ username, password })
        const sessionId = randomUUID()

        sessions.set(sessionId, {
          id: sessionId,
          user: result.layout.user,
          updatedAt: Date.now(),
          jar: result.jar,
          credentials: { username, password },
        })

        setLocalSessionCookie(res, sessionId)
        sendJson(res, 200, {
          authenticated: true,
          user: result.layout.user,
        })
      } catch (error) {
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
        const session = getSessionFromRequest(req, sessions)

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
        const session = getSessionFromRequest(req, sessions)

        if (!session) {
          sendJson(res, 200, { authenticated: false, events: null })
          return
        }

        const CAMPUS_API = 'https://campus-app.univ-rennes.fr/api'
        const campusHeaders = {
          deviceid: 'null',
          devicemanufacturer: 'Google Inc.',
          devicemodel: '',
          deviceos: 'Web',
          deviceversion: '20030107',
          'x-app-version': '2.4.5',
          'x-lang': 'fr',
          'x-nav-lang': 'fr-FR',
        }

        // Helper: get a fresh CAS ticket for a given service URL (without consuming it)
        const getTicket = async (serviceUrl) => {
          const casUrl = `${CAS_ORIGIN}/login?service=${encodeURIComponent(serviceUrl)}`
          let cur = casUrl
          for (let i = 0; i < 10; i++) {
            const r = await fetchWithJar(cur, session.jar, { headers: { Accept: 'text/html, */*' }, redirect: 'manual' })
            const loc = r.headers.get('location')
            await r.text()
            if (!loc || !isRedirectStatus(r.status)) return null
            const next = resolveUrl(loc, cur)
            const m = next.match(/[?&]ticket=([^&]+)/)
            if (m) return m[1]
            cur = next
          }
          return null
        }

        const results = {}

        // Just navigate to the web app like a browser would
        const webResult = await followRedirectChain('https://campus-app.univ-rennes.fr/web/', session.jar, {
          headers: { Accept: 'text/html,application/xhtml+xml,*/*' },
        })
        const webHtml = await webResult.response.text()
        results.chain = webResult.chain
        results.finalUrl = webResult.finalUrl
        results.status = webResult.response.status
        results.bodySnippet = webHtml.slice(0, 1000)
        results.cookies = session.jar.getCookieNamesForHost('campus-app.univ-rennes.fr')

        sendJson(res, 200, { authenticated: true, events: [], debug: results })
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

      if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
        res.statusCode = 302
        res.setHeader('Location', '/')
        res.end()
        return
      }

      const session = getSessionFromRequest(req, sessions)
      if (!session) {
        res.statusCode = 302
        res.setHeader('Location', targetUrl)
        res.end()
        return
      }

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

          if (!isRedirectStatus(response.status)) {
            const html = await response.text()
            const htmlRedirect = extractHtmlRedirect(html, currentUrl)
            if (htmlRedirect) {
              currentUrl = htmlRedirect
              continue
            }
            res.statusCode = 302
            res.setHeader('Location', currentUrl)
            res.end()
            return
          }

          if (!location) {
            res.statusCode = 302
            res.setHeader('Location', currentUrl)
            res.end()
            return
          }

          const nextUrl = resolveUrl(location, currentUrl)
          const currentHost = new URL(currentUrl).hostname
          const nextHost = new URL(nextUrl).hostname

          if (currentHost.includes('sso-cas') && !nextHost.includes('sso-cas')) {
            res.statusCode = 302
            res.setHeader('Location', nextUrl)
            res.end()
            return
          }

          currentUrl = nextUrl
        }

        res.statusCode = 302
        res.setHeader('Location', targetUrl)
        res.end()
      } catch {
        res.statusCode = 302
        res.setHeader('Location', targetUrl)
        res.end()
      }
    })

    middlewares.use('/__ent_auth/grades', async (req, res, next) => {
      if (req.method !== 'GET') {
        next()
        return
      }

      try {
        const session = getSessionFromRequest(req, sessions)

        if (!session) {
          sendJson(res, 200, { authenticated: false, grades: null })
          return
        }

        const NOTES9_ORIGIN = 'https://notes9.iutlan.univ-rennes1.fr'

        // Authenticate via doAuth.php → CAS to establish a notes9 PHP session
        const doAuthUrl = `${NOTES9_ORIGIN}/services/doAuth.php?href=${encodeURIComponent(`${NOTES9_ORIGIN}/`)}`
        await followRedirectChain(doAuthUrl, session.jar, {
          headers: { Accept: 'text/html,application/xhtml+xml,*/*' },
        })

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

    middlewares.use('/__ent_auth/logout', (req, res, next) => {
      if (req.method !== 'POST') {
        next()
        return
      }

      const session = getSessionFromRequest(req, sessions)
      if (session) {
        sessions.delete(session.id)
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
        const session = getSessionFromRequest(req, sessions)
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
      const session = getSessionFromRequest(req, sessions)
      if (session) {
        const targetUrl = buildEntProxyTargetUrl(req.url)
        session.jar.setFromProxySetCookie(proxyRes.headers['set-cookie'], targetUrl)
      }

      delete proxyRes.headers['set-cookie']
    },
  }
}

const entDevAuthPlugin = createEntDevAuthPlugin()

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    entDevAuthPlugin,
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
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