export const ENT_ORIGIN = 'https://services-numeriques.univ-rennes.fr'
export const ENT_PROXY_PREFIX = '/__ent_proxy'
export const ENT_AUTH_PREFIX = '/__ent_auth'
export const DEFAULT_REFERER = `${ENT_ORIGIN}/f/services/normal/render.uP`
const DEFAULT_ACCEPT = 'application/json, text/html;q=0.9, text/plain;q=0.8, */*;q=0.5'

function normalizeProxyPath(input) {
  if (!input) {
    return '/'
  }

  if (input.startsWith(ENT_ORIGIN)) {
    const url = new URL(input)
    return `${url.pathname}${url.search}`
  }

  if (input.startsWith('http://') || input.startsWith('https://')) {
    throw new Error('Only services-numeriques.univ-rennes.fr URLs are supported by the local proxy.')
  }

  return input.startsWith('/') ? input : `/${input}`
}

export function buildEntProxyHref(input) {
  return `${ENT_PROXY_PREFIX}${normalizeProxyPath(input)}`
}

function normalizeExtraHeaders(extraHeaders = {}) {
  const headers = {}

  for (const [name, value] of Object.entries(extraHeaders)) {
    if (value === undefined || value === null || value === '') {
      continue
    }

    const lowerName = name.toLowerCase()
    if (lowerName === 'cookie' || lowerName === 'referer') {
      continue
    }

    headers[name] = String(value)
  }

  return headers
}

function buildFetchHeaders(auth = {}, extraHeaders = {}) {
  const headers = new Headers()
  const mergedExtraHeaders = normalizeExtraHeaders({
    Accept: DEFAULT_ACCEPT,
    ...(auth.extraHeaders ?? {}),
    ...extraHeaders,
  })

  if (auth.cookie?.trim()) {
    headers.set('x-ent-cookie', auth.cookie.trim())
  }

  if (auth.referer?.trim()) {
    headers.set('x-ent-referer', auth.referer.trim())
  }

  if (Object.keys(mergedExtraHeaders).length > 0) {
    headers.set('x-ent-extra-headers', JSON.stringify(mergedExtraHeaders))
  }

  return headers
}

async function parseResponse(response) {
  const text = await response.text()
  const contentType = response.headers.get('content-type') ?? ''
  let data = text

  if (contentType.includes('application/json')) {
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = text
    }
  }

  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    url: response.url,
    contentType,
    headers: Object.fromEntries(response.headers.entries()),
    text,
    data,
  }
}

async function parseJsonPayload(response) {
  const text = await response.text()
  let data = {}

  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    data = text
  }

  if (!response.ok) {
    const errorMessage = typeof data === 'object' && data?.error
      ? data.error
      : typeof data === 'string' && data
        ? data
        : `Request failed with status ${response.status}.`

    throw new Error(errorMessage)
  }

  return data
}

export async function requestEnt(path, options = {}) {
  const {
    auth = {},
    method = 'GET',
    body = '',
    headers = {},
  } = options
  const upperMethod = method.toUpperCase()
  const hasBody = body !== '' && body !== undefined && body !== null && !['GET', 'HEAD'].includes(upperMethod)

  const response = await fetch(`${ENT_PROXY_PREFIX}${normalizeProxyPath(path)}`, {
    method: upperMethod,
    credentials: 'same-origin',
    headers: buildFetchHeaders(auth, headers),
    body: hasBody ? body : undefined,
  })

  return parseResponse(response)
}

export async function getAuthSession() {
  const response = await fetch(`${ENT_AUTH_PREFIX}/session`, {
    credentials: 'same-origin',
  })

  return parseJsonPayload(response)
}

export async function loginToEnt({ username, password }) {
  const response = await fetch(`${ENT_AUTH_PREFIX}/login`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, password }),
  })

  return parseJsonPayload(response)
}

export async function logoutFromEnt() {
  const response = await fetch(`${ENT_AUTH_PREFIX}/logout`, {
    method: 'POST',
    credentials: 'same-origin',
  })

  return parseJsonPayload(response)
}

export function getPortalBootstrap(auth) {
  return Promise.allSettled([
    getLayout(auth),
    getLayoutDoc(auth),
    getMarketplaceEntries(auth),
  ]).then(([layout, layoutDoc, marketplace]) => ({
    layout: unwrapSettledResult(layout),
    layoutDoc: unwrapSettledResult(layoutDoc),
    marketplace: unwrapSettledResult(marketplace),
  }))
}

function unwrapSettledResult(result) {
  if (result.status === 'fulfilled') {
    return result.value
  }

  return {
    ok: false,
    status: 0,
    statusText: 'client-error',
    contentType: 'text/plain',
    text: result.reason instanceof Error ? result.reason.message : String(result.reason),
    data: null,
    error: result.reason instanceof Error ? result.reason.message : String(result.reason),
  }
}

export function getLayout(auth) {
  return requestEnt('/api/v4-3/dlm/layout.json', { auth })
}

export function getLayoutDoc(auth, tab) {
  const suffix = tab ? `?tab=${encodeURIComponent(tab)}` : ''
  return requestEnt(`/api/layoutDoc${suffix}`, { auth })
}

export function getMarketplaceEntries(auth) {
  return requestEnt('/api/marketplace/entries.json', { auth })
}

export function getPortletMetadata(auth, fname) {
  return requestEnt(`/api/portlet/${encodeURIComponent(fname)}.json`, { auth })
}

export function getPortletFragment(auth, fname) {
  return requestEnt(`/api/v4-3/portlet/${encodeURIComponent(fname)}.html`, {
    auth,
    headers: {
      Accept: 'text/html, application/xhtml+xml;q=0.9, */*;q=0.8',
    },
  })
}

export function collectTabs(layoutResponse) {
  return layoutResponse?.layout?.navigation?.tabs ?? []
}

function walkLayoutPortlets(node, collector) {
  if (!node) {
    return
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      walkLayoutPortlets(item, collector)
    }
    return
  }

  if (typeof node !== 'object') {
    return
  }

  if (node._objectType === 'portlet' || node.fname || node.title || node.url) {
    collector.push(node)
  }

  for (const key of ['content', 'folders', 'tabs', 'regions', 'favorites', 'favoriteGroups']) {
    if (key in node) {
      walkLayoutPortlets(node[key], collector)
    }
  }
}

export function collectPortletsFromLayout(layoutResponse) {
  const collector = []

  if (layoutResponse?.layout?.navigation) {
    walkLayoutPortlets(layoutResponse.layout.navigation.tabs, collector)
  }

  if (layoutResponse?.layout?.regions) {
    walkLayoutPortlets(layoutResponse.layout.regions, collector)
  }

  return collector
}

function isFavoritePortletCandidate(node) {
  return Boolean(
    node?._objectType === 'portlet'
    || node?.fname
    || node?.url
    || node?.widgetURL
    || node?.chanID
    || node?.portletName
    || node?.parameters?.launchUrl
  )
}

function walkFavoritePortlets(node, collector, visited = new Set()) {
  if (!node) {
    return
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      walkFavoritePortlets(item, collector, visited)
    }
    return
  }

  if (typeof node !== 'object') {
    return
  }

  if (visited.has(node)) {
    return
  }

  visited.add(node)

  if (isFavoritePortletCandidate(node)) {
    collector.push(node)
  }

  for (const nestedValue of Object.values(node)) {
    if (nestedValue && (typeof nestedValue === 'object' || Array.isArray(nestedValue))) {
      walkFavoritePortlets(nestedValue, collector, visited)
    }
  }
}

export function collectFavoritePortlets(layoutResponse) {
  const collector = []
  const layout = layoutResponse?.layout

  walkFavoritePortlets(layout?.favorites, collector)
  walkFavoritePortlets(layout?.favoriteGroups, collector)
  walkFavoritePortlets(layout?.navigation?.favorites, collector)
  walkFavoritePortlets(layout?.navigation?.favoriteGroups, collector)

  return collector
}

export function mergePortlets(...sources) {
  const merged = new Map()

  for (const source of sources) {
    for (const item of source ?? []) {
      if (!item) {
        continue
      }

      const key = item.fname || item.nodeId || item.ID || `${item.title ?? 'unknown'}-${item.url ?? ''}`
      const current = merged.get(key) ?? {}
      merged.set(key, { ...current, ...item })
    }
  }

  return Array.from(merged.values()).sort((left, right) => {
    const leftTitle = left.title ?? left.name ?? left.fname ?? ''
    const rightTitle = right.title ?? right.name ?? right.fname ?? ''
    return leftTitle.localeCompare(rightTitle, 'fr')
  })
}

export function extractFragmentSignals(fragment = '') {
  const links = new Set()
  const scripts = new Set()
  const formActions = new Set()
  const apiHints = new Set()

  for (const match of fragment.matchAll(/href=["']([^"']+)["']/gi)) {
    links.add(match[1])
  }

  for (const match of fragment.matchAll(/src=["']([^"']+)["']/gi)) {
    scripts.add(match[1])
  }

  for (const match of fragment.matchAll(/action=["']([^"']+)["']/gi)) {
    formActions.add(match[1])
  }

  for (const match of fragment.matchAll(/(\/(?:api|f|p|Login)[^"'\\\s<>]*)/g)) {
    apiHints.add(match[1])
  }

  return {
    links: Array.from(links),
    scripts: Array.from(scripts),
    formActions: Array.from(formActions),
    apiHints: Array.from(apiHints),
  }
}

function collectPortletsInNode(node, collector) {
  if (!node) {
    return
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      collectPortletsInNode(item, collector)
    }
    return
  }

  if (typeof node !== 'object') {
    return
  }

  if (node._objectType === 'portlet') {
    collector.push(node)
  }

  if (Array.isArray(node.content)) {
    collectPortletsInNode(node.content, collector)
  }
}

function isLauncherPortlet(portlet) {
  return portlet?.portletName === 'app-launcher'
    || String(portlet?.typeID) === '2'
    || portlet?.parameters?.target === '_blank'
    || portlet?.parameters?.stopImmediately === 'true'
}

export function collectServiceSections(layoutData) {
  const tabs = collectTabs(layoutData)

  return tabs
    .map((tab) => {
      const folders = Array.isArray(tab.content) ? tab.content.filter((item) => item?._objectType === 'folder') : []
      const sections = folders
        .map((folder) => {
          const services = []
          collectPortletsInNode(folder.content ?? [], services)

          return {
            id: folder.ID,
            title: folder.name,
            services: services.filter(isLauncherPortlet),
          }
        })
        .filter((section) => section.services.length > 0)

      return {
        id: tab.ID,
        title: tab.name,
        externalId: tab.externalId,
        sections,
      }
    })
    .filter((tab) => tab.sections.length > 0)
}

export function extractLaunchLink(fragment = '') {
  if (typeof DOMParser !== 'undefined') {
    const document = new DOMParser().parseFromString(fragment, 'text/html')
    const link = document.querySelector('a[href]')

    if (link) {
      return {
        href: link.getAttribute('href') ?? '',
        text: link.textContent?.replace(/\s+/g, ' ').trim() ?? '',
        target: link.getAttribute('target') ?? '',
      }
    }
  }

  const hrefMatch = fragment.match(/href=["']([^"']+)["']/i)
  return {
    href: hrefMatch?.[1] ?? '',
    text: '',
    target: '',
  }
}
