import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '@iconify/react'
import { getAppIcon } from '../assets/app_icons/uni_rennes'
import {
  ENT_ORIGIN,
  buildEntProxyHref,
  collectFavoritePortlets,
  collectPortletsFromLayout,
  collectServiceSections,
  extractLaunchLink,
  getPortalBootstrap,
  getPortletFragment,
  mergePortlets,
  requestEnt,
} from '../entApi'

const DEFAULT_ERROR_MESSAGE = 'Impossible de charger les applications pour le moment.'
const FAVORITES_CONTEXT_MENU_WIDTH = 216
const FAVORITES_CONTEXT_MENU_HEIGHT = 56
const FAVORITES_CONTEXT_MENU_MARGIN = 12
const FAVORITE_REMOVAL_ANIMATION_MS = 220

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function getFirstText(...values) {
  for (const value of values) {
    if (typeof value === 'string') {
      const trimmedValue = value.trim()
      if (trimmedValue) {
        return trimmedValue
      }
    }
  }

  return ''
}

function getPortletKey(item = {}) {
  return item.fname || item.nodeId || item.ID || `${item.title ?? item.name ?? 'unknown'}-${item.url ?? ''}`
}

function getLookupCandidates(item = {}) {
  return Array.from(new Set(
    [
      getPortletKey(item),
      item.fname,
      item.ID,
      item.nodeId,
      item.chanID,
      item.title,
      item.name,
      item.url,
      item.widgetURL,
    ]
      .filter((value) => value !== undefined && value !== null)
      .map((value) => String(value).trim())
      .filter(Boolean),
  ))
}

function getApplicationKey(application = {}) {
  return application.fname || application.id
}

const FAVORITES_ORDER_KEY = 'l-ent:favorites-order'

function loadFavoritesOrder() {
  try {
    const stored = localStorage.getItem(FAVORITES_ORDER_KEY)
    return stored ? JSON.parse(stored) : null
  } catch {
    return null
  }
}

function saveFavoritesOrder(favorites) {
  try {
    const keys = favorites.map(getApplicationKey)
    localStorage.setItem(FAVORITES_ORDER_KEY, JSON.stringify(keys))
  } catch {
    return
  }
}

function applyStoredOrder(favorites) {
  const storedKeys = loadFavoritesOrder()
  if (!storedKeys || storedKeys.length === 0) {
    return favorites
  }

  const keyToIndex = new Map(storedKeys.map((key, i) => [key, i]))
  return [...favorites].sort((a, b) => {
    const ai = keyToIndex.get(getApplicationKey(a)) ?? Infinity
    const bi = keyToIndex.get(getApplicationKey(b)) ?? Infinity
    return ai - bi
  })
}

const LOCAL_PINS_KEY = 'l-ent:local-pins'

function loadLocalPins() {
  try {
    const stored = localStorage.getItem(LOCAL_PINS_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function saveLocalPins(pins) {
  try {
    localStorage.setItem(LOCAL_PINS_KEY, JSON.stringify(pins))
  } catch {
    return
  }
}

function isLocalService(application) {
  return !application?.portalNodeId
}

function getPortalNodeId(entry, metadata = {}) {
  return getFirstText(
    entry?.ID,
    entry?.nodeId,
    metadata?.ID,
    metadata?.nodeId,
  )
}

function toNavigableHref(value) {
  const href = getFirstText(value)
  if (!href || href.startsWith('#') || href.toLowerCase().startsWith('javascript:')) {
    return ''
  }

  if (/^[a-z][a-z\d+.-]*:/i.test(href)) {
    return href
  }

  return buildEntProxyHref(href)
}

const LETTER_COLORS = [
  { bg: '#dbeafe', fg: '#2563eb' },
  { bg: '#ede9fe', fg: '#7c3aed' },
  { bg: '#fce7f3', fg: '#db2777' },
  { bg: '#fee2e2', fg: '#dc2626' },
  { bg: '#ffedd5', fg: '#ea580c' },
  { bg: '#fef9c3', fg: '#ca8a04' },
  { bg: '#dcfce7', fg: '#16a34a' },
  { bg: '#ccfbf1', fg: '#0d9488' },
  { bg: '#cffafe', fg: '#0891b2' },
  { bg: '#e0e7ff', fg: '#4f46e5' },
  { bg: '#f3e8ff', fg: '#9333ea' },
  { bg: '#fae8ff', fg: '#c026d3' },
  { bg: '#ffe4e6', fg: '#e11d48' },
  { bg: '#fef3c7', fg: '#d97706' },
  { bg: '#d1fae5', fg: '#059669' },
  { bg: '#e0f2fe', fg: '#0284c7' },
]

function getLetterStyle(title = '') {
  const letter = (title.trim()[0] || '?').toUpperCase()
  const code = letter.charCodeAt(0)
  return LETTER_COLORS[code % LETTER_COLORS.length]
}

function getAppLetter(title = '') {
  return (title.trim()[0] || '?').toUpperCase()
}

function normalizeTarget(entry, metadata = {}) {
  const target = getFirstText(
    entry?.parameters?.target,
    metadata?.parameters?.target,
    entry?.target,
    metadata?.target,
  )

  if (target) {
    return target
  }

  return String(entry?.parameters?.stopImmediately ?? metadata?.parameters?.stopImmediately) === 'true'
    ? '_blank'
    : ''
}

function buildPortletLookup(layoutData, layoutDocData) {
  const mergedPortlets = mergePortlets(
    collectPortletsFromLayout(layoutData),
    Array.isArray(layoutDocData) ? layoutDocData : [],
  )

  const lookup = new Map()

  for (const item of mergedPortlets) {
    for (const candidate of getLookupCandidates(item)) {
      if (!lookup.has(candidate)) {
        lookup.set(candidate, item)
      }
    }
  }

  return lookup
}

function findPortletMetadata(item, lookup) {
  for (const candidate of getLookupCandidates(item)) {
    const match = lookup.get(candidate)
    if (match) {
      return match
    }
  }

  return null
}

function normalizeServiceEntry(entry, metadata = {}, extra = {}) {
  const title = getFirstText(
    entry?.title,
    entry?.name,
    metadata?.title,
    metadata?.name,
    entry?.fname,
    metadata?.fname,
  )

  const href = toNavigableHref(
    getFirstText(
      entry?.parameters?.launchUrl,
      metadata?.parameters?.launchUrl,
      entry?.widgetURL,
      metadata?.widgetURL,
      entry?.parameters?.url,
      metadata?.parameters?.url,
      entry?.url,
      metadata?.url,
      entry?.alternativeMaximizedLink,
      metadata?.alternativeMaximizedLink,
    ),
  )

  if (!title || !href) {
    return null
  }

  return {
    id: getPortletKey(entry),
    fname: getFirstText(entry?.fname, metadata?.fname),
    portalNodeId: getFirstText(extra.portalNodeId, getPortalNodeId(entry, metadata)),
    title,
    description: getFirstText(
      entry?.description,
      metadata?.description,
      entry?.parameters?.description,
      metadata?.parameters?.description,
      metadata?.summary,
      metadata?.parameters?.subtitle,
    ),
    href,
    target: normalizeTarget(entry, metadata),
    removeFavoriteTarget: extra.removeFavoriteTarget ?? null,
  }
}

function dedupeApplications(applications) {
  const seenKeys = new Set()

  return applications.filter((application) => {
    const uniqueKey = `${application.id}-${application.href}`

    if (seenKeys.has(uniqueKey)) {
      return false
    }

    seenKeys.add(uniqueKey)
    return true
  })
}

function isFavoritesLikeLabel(value = '') {
  const normalizedValue = String(value).trim().toLowerCase()
  return normalizedValue.includes('favori')
    || normalizedValue.includes('favorite')
    || normalizedValue.includes('bookmark')
}

function hasFavoriteCollections(layoutData) {
  const layout = layoutData?.layout

  return Array.isArray(layout?.favorites)
    || Array.isArray(layout?.favoriteGroups)
    || Array.isArray(layout?.navigation?.favorites)
    || Array.isArray(layout?.navigation?.favoriteGroups)
    || typeof layout?.globals?.hasFavorites === 'string'
}

function normalizeFavoriteSections(bootstrap) {
  const layoutData = bootstrap?.layout?.data
  if (!isRecord(layoutData)) {
    return {
      available: false,
      count: 0,
      sections: [],
    }
  }

  const portletLookup = buildPortletLookup(layoutData, bootstrap?.layoutDoc?.data)
  const serviceTabs = collectServiceSections(layoutData)
  let folderFavoriteApplications = []

  for (const tab of serviceTabs) {
    const favoriteSectionIndex = tab.sections.findIndex((section) => isFavoritesLikeLabel(section.title))
    if (favoriteSectionIndex === -1) {
      continue
    }

    const favoriteSection = tab.sections[favoriteSectionIndex]
    const nextSection = tab.sections[favoriteSectionIndex + 1] ?? null
    const firstNextService = nextSection?.services?.[0] ?? null
    const firstNextMetadata = firstNextService ? findPortletMetadata(firstNextService, portletLookup) : null
    const removeFavoriteTarget = nextSection
      ? {
          wrapperId: getFirstText(nextSection.id),
          nextElementId: getPortalNodeId(firstNextService, firstNextMetadata),
        }
      : null

    folderFavoriteApplications = dedupeApplications(
      favoriteSection.services
        .map((favoritePortlet) => {
          const metadata = findPortletMetadata(favoritePortlet, portletLookup)
          return normalizeServiceEntry(favoritePortlet, metadata, {
            portalNodeId: getPortalNodeId(favoritePortlet, metadata),
            removeFavoriteTarget,
          })
        })
        .filter(Boolean),
    )

    if (folderFavoriteApplications.length > 0) {
      break
    }
  }

  const directFavoriteApplications = dedupeApplications(
    collectFavoritePortlets(layoutData)
      .map((favoritePortlet) => (
        normalizeServiceEntry(
          favoritePortlet,
          findPortletMetadata(favoritePortlet, portletLookup),
          {
            portalNodeId: getPortalNodeId(
              favoritePortlet,
              findPortletMetadata(favoritePortlet, portletLookup),
            ),
          },
        )
      ))
      .filter(Boolean),
  )
  const applications = folderFavoriteApplications.length > 0
    ? folderFavoriteApplications
    : directFavoriteApplications

  return {
    available: hasFavoriteCollections(layoutData)
      || serviceTabs.some((tab) => tab.sections.some((section) => isFavoritesLikeLabel(section.title))),
    count: applications.length,
    sections: applications.length > 0
      ? [{
          id: 'ent-favorites',
          title: 'Favoris',
          subtitle: '',
          applications,
        }]
      : [],
  }
}

function normalizeBootstrapSections(bootstrap) {
  const favoriteSource = normalizeFavoriteSections(bootstrap)
  return {
    source: favoriteSource.available ? 'ent-favorites' : 'none',
    rawCount: favoriteSource.count,
    sections: favoriteSource.sections,
  }
}

const APP_CATEGORIES = [
  { label: 'Scolarité', keywords: ['notes', 'dossier étudiant', 'apogée', 'contrat pédagogique', 'stages', 'évaluation orthographique', 'contrats étudiants'] },
  { label: 'Communication', keywords: ['messagerie', 'annuaire', 'listes de diffusion', 'webconférence', 'webconference'] },
  { label: 'Pédagogie', keywords: ['moodle', 'foad', 'mooc', 'modules auto-formatifs', 'création de modules', 'téléformation', 'klaxoon'] },
  { label: 'Ressources', keywords: ['mediaserver', 'nudgis', 'ori-oai', 'portail des thèses', 'recherche documentaire', 'documentation des services', 'espaces de stockage', 'mise en ligne', 'loxya'] },
  { label: 'Compte', keywords: ['sésame', 'sesame', 'compte informatique', 'mfa', 'authentification', 'crédits d\'impression'] },
  { label: 'Outils', keywords: ['microsoft 365', 'esup signature', 'emplois du temps', 'assistance'] },
]

function getAppCategory(title = '') {
  const t = title.trim().toLowerCase()
  for (const { label, keywords } of APP_CATEGORIES) {
    if (keywords.some((kw) => t.includes(kw))) {
      return label
    }
  }
  return null
}

function normalizeAllServices(bootstrap) {
  const layoutData = bootstrap?.layout?.data
  if (!isRecord(layoutData)) {
    return []
  }

  const portletLookup = buildPortletLookup(layoutData, bootstrap?.layoutDoc?.data)
  const serviceTabs = collectServiceSections(layoutData)
  const allApps = []
  const seenKeys = new Set()

  for (const tab of serviceTabs) {
    for (const section of tab.sections) {
      if (isFavoritesLikeLabel(section.title)) {
        continue
      }

      for (const service of section.services) {
        const metadata = findPortletMetadata(service, portletLookup)
        const app = normalizeServiceEntry(service, metadata, {
          portalNodeId: getPortalNodeId(service, metadata),
        })

        if (!app) {
          continue
        }

        const category = getAppCategory(app.title)
        if (category) {
          app.category = category
        }

        const key = `${getApplicationKey(app)}-${app.href}`
        if (!seenKeys.has(key)) {
          seenKeys.add(key)
          allApps.push(app)
        }
      }
    }
  }

  return allApps
}

function getErrorMessage(error) {
  const message = error instanceof Error ? error.message.trim() : String(error).trim()

  if (!message || /<!doctype|<html/i.test(message) || message === '[object Object]') {
    return DEFAULT_ERROR_MESSAGE
  }

  return message
}

function getBootstrapErrorMessage(bootstrap) {
  const failedResponse = [bootstrap?.layout, bootstrap?.layoutDoc, bootstrap?.marketplace]
    .find((response) => response?.ok === false)

  if (!failedResponse) {
    return DEFAULT_ERROR_MESSAGE
  }

  if (failedResponse.status === 401 || failedResponse.status === 403) {
    return 'La session ENT ne permet pas de charger les applications.'
  }

  return getErrorMessage(
    failedResponse.error
      || (typeof failedResponse.data === 'object' ? failedResponse.data?.error : '')
      || failedResponse.text
      || DEFAULT_ERROR_MESSAGE,
  )
}

function getFavoriteApplications(sections) {
  const favorites = []
  const seenKeys = new Set()

  for (const section of sections) {
    for (const application of section.applications) {
      const key = `${getApplicationKey(application)}-${application.href}`

      if (seenKeys.has(key)) {
        continue
      }

      seenKeys.add(key)
      favorites.push(application)
    }
  }

  return favorites
}

function buildAddFavoriteRequestPath(application, lastFavorite) {
  const sourceId = getFirstText(application.portalNodeId)
  const previousNodeId = getFirstText(lastFavorite?.portalNodeId) || ''

  if (!sourceId) {
    return ''
  }

  const params = new URLSearchParams({
    action: 'movePortletAjax',
    sourceId,
    previousNodeId,
    nextNodeId: '',
  })

  return `/api/layout?${params.toString()}`
}

function buildRemoveFavoriteRequestPath(application) {
  const sourceId = getFirstText(application.portalNodeId)
  const wrapperId = getFirstText(application.removeFavoriteTarget?.wrapperId)
  const nextElementId = getFirstText(application.removeFavoriteTarget?.nextElementId)

  if (!sourceId) {
    return ''
  }

  if (nextElementId) {
    const params = new URLSearchParams({
      action: 'movePortletAjax',
      sourceId,
      previousNodeId: '',
      nextNodeId: nextElementId,
    })
    return `/api/layout?${params.toString()}`
  }

  if (wrapperId) {
    const params = new URLSearchParams({
      action: 'moveElement',
      sourceID: sourceId,
      elementID: wrapperId,
      method: 'appendAfter',
    })
    return `/api/layout?${params.toString()}`
  }

  return ''
}

function removeApplicationFromSections(sections, applicationKey) {
  return sections
    .map((section) => ({
      ...section,
      applications: section.applications.filter((application) => getApplicationKey(application) !== applicationKey),
    }))
    .filter((section) => section.applications.length > 0)
}

function getUrlHostname(value) {
  try {
    return new URL(value).hostname
  } catch {
    return ''
  }
}

function chainTouchesCas(chain = []) {
  return chain.some((step) => {
    const currentHost = getUrlHostname(step?.url)
    const nextHost = getUrlHostname(step?.location)
    return currentHost.includes('sso-cas') || nextHost.includes('sso-cas')
  })
}

function shouldUseServerLaunchForTarget(href, launchDebug = null) {
  if (!href) {
    return false
  }

  if (href.startsWith('/__ent_proxy')) {
    return true
  }

  const hrefHost = getUrlHostname(href)
  if (hrefHost.includes('sso-cas')) {
    return true
  }

  if (!launchDebug || launchDebug.degraded || launchDebug.saml) {
    return false
  }

  const chain = Array.isArray(launchDebug.chain) ? launchDebug.chain : []
  if (!chainTouchesCas(chain)) {
    return false
  }

  return /[?&]ticket=ST-/i.test(String(launchDebug.finalUrl ?? ''))
}

async function resolveLaunchTarget(application) {
  if (!application?.fname) {
    return {
      href: application?.href,
      target: application?.target,
    }
  }

  const fragmentResponse = await getPortletFragment({}, application.fname)
  const launchLink = extractLaunchLink(fragmentResponse?.text ?? '')

  return {
    href: toNavigableHref(launchLink.href) || application.href,
    target: getFirstText(launchLink.target, application.target),
  }
}

async function resolveLaunchTargets(applications) {
  const uniqueApplications = []
  const seenKeys = new Set()

  for (const application of applications) {
    const applicationKey = getApplicationKey(application)

    if (!application?.fname || seenKeys.has(applicationKey)) {
      continue
    }

    seenKeys.add(applicationKey)
    uniqueApplications.push([applicationKey, application])
  }

  const resolvedEntries = await Promise.all(uniqueApplications.map(async ([applicationKey, application]) => {
    try {
      return [applicationKey, await resolveLaunchTarget(application)]
    } catch {
      return [applicationKey, {
        href: application.href,
        target: application.target,
      }]
    }
  }))

  return Object.fromEntries(resolvedEntries)
}


function isPlainLeftClick(event) {
  return event.button === 0
    && !event.metaKey
    && !event.ctrlKey
    && !event.shiftKey
    && !event.altKey
}

function navigateToApplication({ href, target }, preparedWindow = null, options = {}) {
  const { useServerLaunch = true } = options

  if (!href) {
    return
  }

  let launchHref = href
  if (useServerLaunch) {
    if (href.startsWith('/__ent_proxy')) {
      const realUrl = ENT_ORIGIN + href.replace(/^\/__ent_proxy/, '')
      launchHref = `/__ent_auth/launch?url=${encodeURIComponent(realUrl)}`
    } else if (/^https?:\/\//i.test(href)) {
      launchHref = `/__ent_auth/launch?url=${encodeURIComponent(href)}`
    }
  }

  if (target === '_blank') {
    if (preparedWindow && !preparedWindow.closed) {
      try {
        preparedWindow.opener = null
      } catch {
        // Some browsers restrict opener writes; navigation still works without it.
      }

      preparedWindow.location.assign(launchHref)
      return
    }

    window.open(launchHref, '_blank', 'noopener,noreferrer')
    return
  }

  window.location.assign(launchHref)
}

async function copyTextToClipboard(text) {
  const content = String(text ?? '')
  if (!content) {
    throw new Error("Impossible de copier un lien vide.")
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(content)
    return
  }

  const fallbackInput = document.createElement('textarea')
  fallbackInput.value = content
  fallbackInput.setAttribute('readonly', '')
  fallbackInput.style.position = 'fixed'
  fallbackInput.style.opacity = '0'
  fallbackInput.style.pointerEvents = 'none'
  document.body.appendChild(fallbackInput)
  fallbackInput.select()
  fallbackInput.setSelectionRange(0, fallbackInput.value.length)

  const didCopy = document.execCommand('copy')
  document.body.removeChild(fallbackInput)

  if (!didCopy) {
    throw new Error("Impossible de copier le lien.")
  }
}

function getContextMenuPosition(event) {
  const maxX = window.innerWidth - FAVORITES_CONTEXT_MENU_WIDTH - FAVORITES_CONTEXT_MENU_MARGIN
  const maxY = window.innerHeight - FAVORITES_CONTEXT_MENU_HEIGHT - FAVORITES_CONTEXT_MENU_MARGIN
  const x = Math.max(FAVORITES_CONTEXT_MENU_MARGIN, Math.min(event.clientX, maxX))
  const y = Math.max(FAVORITES_CONTEXT_MENU_MARGIN, Math.min(event.clientY, maxY))

  return {
    x,
    y,
    originX: `${Math.max(18, event.clientX - x)}px`,
    originY: `${Math.max(18, event.clientY - y)}px`,
  }
}

function AvailableApplications({
  establishment = null,
  canUseServerLaunch = true,
}) {
  const [viewState, setViewState] = useState({
    status: 'loading',
    source: 'none',
    rawCount: 0,
    sections: [],
    error: '',
  })
  const [reloadKey, setReloadKey] = useState(0)
  const [launchTargets, setLaunchTargets] = useState({})
  const [launchBehaviors, setLaunchBehaviors] = useState({})
  const [launchingKeys, setLaunchingKeys] = useState({})
  const [exitingFavoriteKeys, setExitingFavoriteKeys] = useState({})
  const [favoriteActionState, setFavoriteActionState] = useState({
    removingKey: '',
    error: '',
  })
  const [contextMenuState, setContextMenuState] = useState({
    open: false,
    x: 0,
    y: 0,
    originX: '24px',
    originY: '24px',
    application: null,
    source: 'favorite',
  })
  const [allServices, setAllServices] = useState([])
  const [localPins, setLocalPins] = useState(loadLocalPins)
  const [orderedFavorites, setOrderedFavorites] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const launchRequestsRef = useRef(new Map())
  const launchBehaviorRequestsRef = useRef(new Map())
  const removalTimeoutsRef = useRef(new Map())
  const isMountedRef = useRef(true)
  const contextMenuRef = useRef(null)
  const dragRef = useRef({ index: -1, didDrag: false })
  const favoritesRowRef = useRef(null)
  const flipRectsRef = useRef(new Map())

  const favoriteApplications = useMemo(() => {
    const entFavorites = getFavoriteApplications(viewState.sections)
    const pinnedLocalServices = allServices.filter(
      (service) => isLocalService(service) && localPins.includes(getApplicationKey(service)),
    )
    return [...entFavorites, ...pinnedLocalServices]
  }, [viewState.sections, allServices, localPins])
  const visibleServices = useMemo(() => {
    const pinnedLocalKeys = new Set(localPins)
    return allServices.filter(
      (service) => !isLocalService(service) || !pinnedLocalKeys.has(getApplicationKey(service)),
    )
  }, [allServices, localPins])
  const categories = useMemo(() => {
    const present = new Set(visibleServices.map((s) => s.category).filter(Boolean))
    return APP_CATEGORIES.map((c) => c.label).filter((label) => present.has(label))
  }, [visibleServices])
  const filteredServices = useMemo(() => {
    let services = visibleServices
    if (selectedCategory) {
      services = services.filter((s) => s.category === selectedCategory)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      services = services.filter((s) => (s.title || s.name || '').toLowerCase().includes(q))
    }
    return services
  }, [visibleServices, searchQuery, selectedCategory])
  const highlightedFavoriteKeys = useMemo(() => {
    if (!searchQuery.trim()) return new Set()
    const q = searchQuery.trim().toLowerCase()
    return new Set(
      orderedFavorites
        .filter((f) => (f.title || f.name || '').toLowerCase().includes(q))
        .map(getApplicationKey)
    )
  }, [searchQuery, orderedFavorites])
  const shouldShowFavoriteRow = viewState.status === 'ready' && orderedFavorites.length > 0
  const shouldHideFavoritesSection = viewState.status === 'empty'
    || (viewState.status === 'ready' && favoriteApplications.length === 0)

  useEffect(() => {
    setOrderedFavorites(applyStoredOrder(favoriteApplications))
  }, [favoriteApplications])

  useEffect(() => {
    const launchRequests = launchRequestsRef.current
    const launchBehaviorRequests = launchBehaviorRequestsRef.current
    const removalTimeouts = removalTimeoutsRef.current

    return () => {
      isMountedRef.current = false
      launchRequests.clear()
      launchBehaviorRequests.clear()
      for (const timeoutId of removalTimeouts.values()) {
        window.clearTimeout(timeoutId)
      }
      removalTimeouts.clear()
    }
  }, [])

  useEffect(() => {
    function handlePageShow() {
      setLaunchingKeys({})
      setExitingFavoriteKeys({})
      setFavoriteActionState({
        removingKey: '',
        error: '',
      })
      setContextMenuState({
        open: false,
        x: 0,
        y: 0,
        originX: '24px',
        originY: '24px',
        application: null,
      })
    }

    window.addEventListener('pageshow', handlePageShow)

    return () => {
      window.removeEventListener('pageshow', handlePageShow)
    }
  }, [])

  useEffect(() => {
    if (!contextMenuState.open) {
      return undefined
    }

    function closeContextMenu() {
      setContextMenuState({
        open: false,
        x: 0,
        y: 0,
        originX: '24px',
        originY: '24px',
        application: null,
        source: 'favorite',
      })
    }

    function handlePointerDown(event) {
      if (contextMenuRef.current?.contains(event.target)) {
        return
      }

      closeContextMenu()
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        closeContextMenu()
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('resize', closeContextMenu)
    window.addEventListener('scroll', closeContextMenu, true)
    window.addEventListener('blur', closeContextMenu)

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', closeContextMenu)
      window.removeEventListener('scroll', closeContextMenu, true)
      window.removeEventListener('blur', closeContextMenu)
    }
  }, [contextMenuState.open])

  useEffect(() => {
    let isCancelled = false

    async function hydrateApplications() {
      try {
        const bootstrap = await getPortalBootstrap()
        if (isCancelled) {
          return
        }

        const sections = normalizeBootstrapSections(bootstrap)
        const services = normalizeAllServices(bootstrap)

        if (establishment === 'iutlan') {
          services.unshift({
            id: 'lent-iutlan-notes9',
            title: 'Notes IUT Lannion',
            description: 'Consulter ses notes et résultats',
            href: toNavigableHref('https://notes9.iutlan.univ-rennes1.fr/services/doAuth.php?href=https://notes9.iutlan.univ-rennes1.fr/'),
            target: '_blank',
          }, {
            id: 'lent-iutlan-loxya',
            title: 'Loxya',
            description: 'Location de matériel audiovisuel',
            href: toNavigableHref('https://iut-lannion.loxya.app/external/login'),
            target: '_blank',
          })
        }

        const nextLaunchTargets = await resolveLaunchTargets([
          ...getFavoriteApplications(sections.sections),
          ...services,
        ])
        if (isCancelled) {
          return
        }

        setLaunchTargets(nextLaunchTargets)
        setAllServices(services)

        if (sections.sections.length > 0) {
          setFavoriteActionState((current) => ({ ...current, error: '' }))
          setViewState({
            status: 'ready',
            source: sections.source,
            rawCount: sections.rawCount,
            sections: sections.sections,
            error: '',
          })
          return
        }

        const hasSuccessfulResponse = [bootstrap.layout, bootstrap.layoutDoc, bootstrap.marketplace]
          .some((response) => response?.ok)

        setViewState({
          status: hasSuccessfulResponse ? 'empty' : 'error',
          source: sections.source,
          rawCount: sections.rawCount,
          sections: [],
          error: hasSuccessfulResponse ? '' : getBootstrapErrorMessage(bootstrap),
        })
        if (hasSuccessfulResponse) {
          setFavoriteActionState((current) => ({ ...current, error: '' }))
        }
      } catch (error) {
        if (isCancelled) {
          return
        }

        setViewState({
          status: 'error',
          source: 'none',
          rawCount: 0,
          sections: [],
          error: getErrorMessage(error),
        })
      }
    }

    void hydrateApplications()

    return () => {
      isCancelled = true
    }
  }, [reloadKey, establishment])

  async function resolveApplicationLaunch(application) {
    const launchKey = getApplicationKey(application)
    const cachedLaunch = launchTargets[launchKey]
    if (!application.fname || cachedLaunch) {
      return cachedLaunch ?? {
        href: application.href,
        target: application.target,
      }
    }

    const existingRequest = launchRequestsRef.current.get(launchKey)
    if (existingRequest) {
      return existingRequest
    }

    const request = resolveLaunchTarget(application)
      .then((resolvedLaunch) => {
        if (isMountedRef.current) {
          setLaunchTargets((current) => (
            current[launchKey]
              ? current
              : { ...current, [launchKey]: resolvedLaunch }
          ))
        }

        return resolvedLaunch
      })
      .catch(() => ({
        href: application.href,
        target: application.target,
      }))
      .finally(() => {
        launchRequestsRef.current.delete(launchKey)
      })

    launchRequestsRef.current.set(launchKey, request)
    return request
  }

  async function resolveApplicationLaunchBehavior(application, launch = null) {
    const launchKey = getApplicationKey(application)
    const cachedBehavior = launchBehaviors[launchKey]
    if (typeof cachedBehavior === 'boolean') {
      return cachedBehavior
    }

    const existingRequest = launchBehaviorRequestsRef.current.get(launchKey)
    if (existingRequest) {
      return existingRequest
    }

    const resolvedLaunch = launch ?? await resolveApplicationLaunch(application)
    const href = resolvedLaunch?.href || application?.href || ''
    if (!/^https?:\/\//i.test(href)) {
      const fallbackBehavior = shouldUseServerLaunchForTarget(href, null)

      if (isMountedRef.current) {
        setLaunchBehaviors((current) => (
          launchKey in current
            ? current
            : { ...current, [launchKey]: fallbackBehavior }
        ))
      }

      return fallbackBehavior
    }

    const request = fetch(`/__ent_auth/launch-preview?url=${encodeURIComponent(href)}`, {
      credentials: 'same-origin',
    })
      .then(async (response) => {
        const previewPayload = await response.json().catch(() => null)

        if (typeof previewPayload?.useServerLaunch === 'boolean') {
          return previewPayload.useServerLaunch
        }

        return shouldUseServerLaunchForTarget(href, previewPayload)
      })
      .catch(() => shouldUseServerLaunchForTarget(href, null))
      .then((shouldUseServerLaunch) => {
        if (isMountedRef.current) {
          setLaunchBehaviors((current) => (
            launchKey in current
              ? current
              : { ...current, [launchKey]: shouldUseServerLaunch }
          ))
        }

        return shouldUseServerLaunch
      })
      .finally(() => {
        launchBehaviorRequestsRef.current.delete(launchKey)
      })

    launchBehaviorRequestsRef.current.set(launchKey, request)
    return request
  }

  function warmApplicationLaunch(application) {
    if (!application.fname) {
      return
    }

    void resolveApplicationLaunch(application)
  }

  function clearLaunchingState(launchKey) {
    setLaunchingKeys((current) => {
      if (!(launchKey in current)) {
        return current
      }

      const nextState = { ...current }
      delete nextState[launchKey]
      return nextState
    })
  }

  function closeContextMenu() {
    setContextMenuState({
      open: false,
      x: 0,
      y: 0,
      originX: '24px',
      originY: '24px',
      application: null,
      source: 'favorite',
    })
  }

  function handleFavoriteContextMenu(event, application, source = 'favorite') {
    event.preventDefault()

    const { x, y, originX, originY } = getContextMenuPosition(event)
    setFavoriteActionState((current) => ({ ...current, error: '' }))
    setContextMenuState({
      open: true,
      x,
      y,
      originX,
      originY,
      application,
      source,
    })
  }

  function snapshotPositions() {
    const row = favoritesRowRef.current
    if (!row) return
    flipRectsRef.current.clear()
    for (const child of row.children) {
      const id = child.getAttribute('data-app-id')
      if (id) {
        flipRectsRef.current.set(id, child.getBoundingClientRect())
      }
    }
  }

  const animateFlip = useCallback(() => {
    const row = favoritesRowRef.current
    if (!row || flipRectsRef.current.size === 0) return

    for (const child of row.children) {
      const id = child.getAttribute('data-app-id')
      const oldRect = flipRectsRef.current.get(id)
      if (!oldRect) continue

      const newRect = child.getBoundingClientRect()
      const dx = oldRect.left - newRect.left
      const dy = oldRect.top - newRect.top

      if (dx === 0 && dy === 0) continue

      child.style.transition = 'none'
      child.style.transform = `translate(${dx}px, ${dy}px)`

      requestAnimationFrame(() => {
        child.style.transition = 'transform 200ms cubic-bezier(0.2, 0, 0, 1)'
        child.style.transform = ''
      })
    }

    flipRectsRef.current.clear()
  }, [])

  useLayoutEffect(() => {
    animateFlip()
  }, [orderedFavorites, animateFlip])

  function handleDragStart(event, index) {
    dragRef.current = { index, didDrag: false }
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(index))
    setIsDragging(true)
  }

  function handleDragOver(event, index) {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    dragRef.current.didDrag = true

    const fromIndex = dragRef.current.index
    if (fromIndex === -1 || fromIndex === index) {
      return
    }

    const rect = event.currentTarget.getBoundingClientRect()
    const midX = rect.left + rect.width / 2
    const pastMid = fromIndex < index
      ? event.clientX > midX
      : event.clientX < midX

    if (!pastMid) {
      return
    }

    snapshotPositions()

    setOrderedFavorites((current) => {
      const next = [...current]
      const [moved] = next.splice(fromIndex, 1)
      next.splice(index, 0, moved)
      return next
    })
    dragRef.current.index = index
  }

  function handleDragEnd() {
    dragRef.current.index = -1
    setIsDragging(false)
    setOrderedFavorites((current) => {
      saveFavoritesOrder(current)
      return current
    })
  }

  function handleClickCapture(event) {
    if (dragRef.current.didDrag) {
      event.preventDefault()
      dragRef.current.didDrag = false
    }
  }

  async function launchApplicationFromAction(application, options = {}) {
    const launchKey = getApplicationKey(application)
    const { targetOverride = null, preparedWindow = null } = options
    const resolvedLaunch = launchTargets[launchKey]

    if (launchingKeys[launchKey]) {
      if (preparedWindow && !preparedWindow.closed) {
        preparedWindow.close()
      }
      return
    }

    setLaunchingKeys((current) => ({ ...current, [launchKey]: true }))

    try {
      const nextLaunch = resolvedLaunch ?? await resolveApplicationLaunch(application)
      const shouldUseServerLaunch = canUseServerLaunch
        ? await resolveApplicationLaunchBehavior(application, nextLaunch)
        : false
      const effectiveLaunch = targetOverride
        ? { ...nextLaunch, target: targetOverride }
        : nextLaunch

      clearLaunchingState(launchKey)
      navigateToApplication(effectiveLaunch, preparedWindow, {
        useServerLaunch: shouldUseServerLaunch,
      })
    } catch {
      clearLaunchingState(launchKey)
      if (preparedWindow && !preparedWindow.closed) {
        preparedWindow.close()
      }
      navigateToApplication({
        href: resolvedLaunch?.href || application.href,
        target: targetOverride || resolvedLaunch?.target || application.target,
      }, null, {
        useServerLaunch: false,
      })
    } finally {
      if (isMountedRef.current) {
        clearLaunchingState(launchKey)
      }
    }
  }

  async function handleOpenApplicationInNewTab(application) {
    setFavoriteActionState((current) => ({ ...current, error: '' }))
    closeContextMenu()

    const preparedWindow = window.open('about:blank', '_blank')
    if (!preparedWindow) {
      setFavoriteActionState((current) => ({
        ...current,
        error: "Impossible d'ouvrir un nouvel onglet pour le moment.",
      }))
      return
    }

    await launchApplicationFromAction(application, {
      targetOverride: '_blank',
      preparedWindow,
    })
  }

  async function handleCopyApplicationLink(application) {
    setFavoriteActionState((current) => ({ ...current, error: '' }))

    try {
      const nextLaunch = await resolveApplicationLaunch(application)
      const href = nextLaunch?.href || application?.href || ''
      await copyTextToClipboard(href)
      closeContextMenu()
    } catch (error) {
      setFavoriteActionState((current) => ({
        ...current,
        error: getErrorMessage(error),
      }))
      closeContextMenu()
    }
  }

  async function handleUnfavorite(application) {
    const applicationKey = getApplicationKey(application)

    if (isLocalService(application)) {
      closeContextMenu()
      setLocalPins((current) => {
        const next = current.filter((key) => key !== applicationKey)
        saveLocalPins(next)
        return next
      })
      return
    }

    const requestPath = buildRemoveFavoriteRequestPath(application)

    if (!requestPath) {
      setFavoriteActionState({
        removingKey: '',
        error: 'Impossible de retirer ce favori pour le moment.',
      })
      closeContextMenu()
      return
    }

    setFavoriteActionState({
      removingKey: applicationKey,
      error: '',
    })
    closeContextMenu()

    try {
      const response = await requestEnt(requestPath, {
        method: 'POST',
        headers: {
          Accept: 'application/json, text/javascript, */*; q=0.01',
          Origin: ENT_ORIGIN,
          'X-Requested-With': 'XMLHttpRequest',
        },
      })
      if (!response.ok) {
        throw new Error(
          (typeof response.data === 'object' ? response.data?.error : '')
          || response.text
          || 'Impossible de retirer ce favori pour le moment.',
        )
      }
      setFavoriteActionState({
        removingKey: '',
        error: '',
      })

      setExitingFavoriteKeys((current) => ({
        ...current,
        [applicationKey]: true,
      }))

      const timeoutId = window.setTimeout(() => {
        if (!isMountedRef.current) {
          return
        }

        setViewState((current) => {
          const nextSections = removeApplicationFromSections(current.sections, applicationKey)
          return {
            ...current,
            rawCount: Math.max(0, current.rawCount - 1),
            sections: nextSections,
            status: nextSections.length > 0 ? 'ready' : 'empty',
          }
        })
        setExitingFavoriteKeys((current) => {
          const nextState = { ...current }
          delete nextState[applicationKey]
          return nextState
        })
        removalTimeoutsRef.current.delete(applicationKey)
        setReloadKey((current) => current + 1)
      }, FAVORITE_REMOVAL_ANIMATION_MS)

      removalTimeoutsRef.current.set(applicationKey, timeoutId)
    } catch (error) {
      setFavoriteActionState({
        removingKey: '',
        error: getErrorMessage(error),
      })
    }
  }

  async function handleAddFavorite(application) {
    const applicationKey = getApplicationKey(application)

    if (isLocalService(application)) {
      closeContextMenu()
      setLocalPins((current) => {
        if (current.includes(applicationKey)) return current
        const next = [...current, applicationKey]
        saveLocalPins(next)
        return next
      })
      return
    }

    const lastEntFavorite = orderedFavorites.filter((f) => !isLocalService(f)).pop()
    const requestPath = buildAddFavoriteRequestPath(application, lastEntFavorite)

    if (!requestPath) {
      setFavoriteActionState({
        removingKey: '',
        error: "Impossible d'ajouter ce favori pour le moment.",
      })
      closeContextMenu()
      return
    }

    setFavoriteActionState({
      removingKey: applicationKey,
      error: '',
    })
    closeContextMenu()

    try {
      const response = await requestEnt(requestPath, {
        method: 'POST',
        headers: {
          Accept: 'application/json, text/javascript, */*; q=0.01',
          Origin: ENT_ORIGIN,
          'X-Requested-With': 'XMLHttpRequest',
        },
      })

      if (!response.ok) {
        throw new Error("Impossible d'ajouter ce favori pour le moment.")
      }

      setFavoriteActionState({
        removingKey: '',
        error: '',
      })

      setReloadKey((current) => current + 1)
    } catch (error) {
      setFavoriteActionState({
        removingKey: '',
        error: getErrorMessage(error),
      })
    }
  }

  async function handleApplicationClick(event, application) {
    if (!isPlainLeftClick(event)) {
      return
    }

    if (!application.fname) {
      return
    }

    event.preventDefault()

    const launchKey = getApplicationKey(application)
    const resolvedLaunch = launchTargets[launchKey]
    const preparedWindow = (resolvedLaunch?.target ?? application.target) === '_blank'
      ? window.open('about:blank', '_blank')
      : null

    await launchApplicationFromAction(application, { preparedWindow })
  }

  function handleRetry() {
    setViewState((current) => ({
      ...current,
      status: 'loading',
      error: '',
    }))
    setFavoriteActionState({
      removingKey: '',
      error: '',
    })
    setReloadKey((current) => current + 1)
  }

  if (shouldHideFavoritesSection) {
    return null
  }

  return (
    <section className="grid gap-[10px] relative text-brand" aria-labelledby="favorites-strip-title">
      <div className="flex items-center gap-[5px]">
        <Icon icon="carbon:star" className="w-[17px] h-[17px] text-brand shrink-0" aria-hidden="true" />
        <h2 className="m-0 text-base font-medium leading-[1.06]" id="favorites-strip-title">Favoris</h2>
      </div>

      {viewState.status === 'loading' ? (
        <div className="flex items-center flex-wrap gap-[8px_14px] overflow-visible max-md:flex-nowrap max-md:items-start max-md:gap-0 max-md:overflow-x-auto max-md:-mx-4 max-md:px-4 favorites-scroll-hide" role="status" aria-live="polite">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={`loading-favorite-${index}`} className="inline-flex items-center gap-[10px] max-w-full py-2 px-[6px] rounded-[18px] min-w-[140px] max-md:flex-col max-md:items-center max-md:gap-1.5 max-md:py-2 max-md:px-1 max-md:min-w-0 max-md:rounded-xl max-md:w-[76px] max-md:shrink-0" aria-hidden="true">
              <span className="badge-placeholder inline-flex items-center justify-center w-[47px] h-[47px] rounded-[25px] bg-[linear-gradient(90deg,var(--color-bg-muted)_0%,var(--color-bg-subtle)_50%,var(--color-bg-muted)_100%)] bg-[length:200%_100%] animate-shimmer shrink-0 max-md:w-[52px] max-md:h-[52px] max-md:rounded-[14px]" />
              <span className="text-placeholder-shimmer w-[92px] h-[14px] rounded-full bg-[linear-gradient(90deg,var(--color-bg-muted)_0%,var(--color-bg-subtle)_50%,var(--color-bg-muted)_100%)] bg-[length:200%_100%] animate-shimmer max-md:w-[48px] max-md:h-[10px]" />
            </div>
          ))}
        </div>
      ) : null}

      {viewState.status === 'error' ? (
        <div className="flex items-center gap-3 flex-wrap">
          <div className="inline-flex items-center gap-2">
            <Icon icon="carbon:warning-filled" className="w-[18px] h-[18px] text-error shrink-0" aria-hidden="true" />
            <p className="m-0 text-sm font-medium leading-[1.3] text-text-secondary font-body">{viewState.error}</p>
          </div>

          <button type="button" className="min-h-[34px] px-[14px] border border-border rounded-full bg-bg text-brand font-inherit text-sm font-semibold hover:bg-bg-subtle" onClick={handleRetry}>
            Réessayer
          </button>
        </div>
      ) : null}

      {viewState.status === 'empty' ? (
        <p className="m-0 text-sm font-medium leading-[1.3] text-text-secondary font-body">Aucun favori ENT disponible pour le moment.</p>
      ) : null}

      {shouldShowFavoriteRow ? (
        <div className={`flex items-center flex-wrap gap-[8px_10px] overflow-visible max-md:flex-nowrap max-md:items-start max-md:gap-3 max-md:overflow-x-auto max-md:overflow-y-hidden max-md:-mx-4 max-md:px-4 favorites-scroll-hide ${isDragging ? '[&_a:hover]:bg-transparent [&_a:focus-visible]:bg-transparent' : ''}`} ref={favoritesRowRef}>
          {orderedFavorites.map((application, index) => {
            const applicationKey = getApplicationKey(application)
            const resolvedLaunch = launchTargets[applicationKey]
            const href = resolvedLaunch?.href || application.href
            const target = resolvedLaunch?.target || application.target
            const isLaunching = Boolean(launchingKeys[applicationKey])
            const isRemovingFavorite = favoriteActionState.removingKey === applicationKey
            const isExitingFavorite = Boolean(exitingFavoriteKeys[applicationKey])
            const isContextOpen = contextMenuState.open
              && getApplicationKey(contextMenuState.application ?? {}) === applicationKey
            const isSearchHighlighted = highlightedFavoriteKeys.has(applicationKey)
            return (
              <a
                key={application.id}
                data-app-id={application.id}
                className={`favorites-strip-item inline-flex items-center gap-2.5 max-w-full py-1.5 px-1.5 pr-4 rounded-[16px] text-inherit no-underline transition-[background-color,box-shadow] duration-[120ms] ease-in-out min-w-0 hover:bg-bg-subtle/60 focus-visible:bg-bg-subtle/60 focus-visible:outline-none cursor-pointer max-md:flex-col max-md:items-center max-md:gap-1.5 max-md:py-2 max-md:px-1 max-md:pr-1 max-md:rounded-xl max-md:w-[76px] max-md:shrink-0 ${isLaunching ? 'pointer-events-none cursor-progress' : ''} ${(isRemovingFavorite || isExitingFavorite) ? 'pointer-events-none' : ''} ${isExitingFavorite ? 'animate-favorite-remove' : ''} ${isContextOpen ? 'bg-context-hover' : ''} ${isSearchHighlighted ? 'favorite-search-highlight' : ''}`}
                href={href}
                target={target || undefined}
                rel={target === '_blank' ? 'noreferrer' : undefined}
                aria-label={`Ouvrir ${application.title}`}
                aria-busy={isLaunching || isRemovingFavorite || isExitingFavorite}
                draggable="true"
                onDragStart={(event) => handleDragStart(event, index)}
                onDragOver={(event) => handleDragOver(event, index)}
                onDragEnd={handleDragEnd}
                onClickCapture={handleClickCapture}
                onMouseEnter={() => warmApplicationLaunch(application)}
                onFocus={() => warmApplicationLaunch(application)}
                onContextMenu={(event) => handleFavoriteContextMenu(event, application, 'favorite')}
                onClick={(event) => void handleApplicationClick(event, application)}
              >
                <span
                  className="app-icon inline-flex items-center justify-center w-[36px] h-[36px] rounded-[10px] bg-widget-bg shadow-sm text-brand shrink-0 max-md:w-[52px] max-md:h-[52px] max-md:rounded-[14px]"
                  aria-hidden="true"
                  style={getAppIcon(application.title) ? undefined : { backgroundColor: getLetterStyle(application.title).bg, color: getLetterStyle(application.title).fg }}
                >
                  {isLaunching ? (
                    <Icon
                      icon="carbon:renew"
                      className="badge-icon-spinning w-4 h-4 animate-spin-slow"
                    />
                  ) : getAppIcon(application.title) ? (
                    <img
                      src={getAppIcon(application.title)}
                      alt=""
                      className="w-full h-full object-contain rounded-[inherit]"
                    />
                  ) : (
                    <span className="text-sm font-semibold leading-none select-none">
                      {getAppLetter(application.title)}
                    </span>
                  )}
                </span>
                <span className="text-[15px] font-semibold leading-[1.06] whitespace-nowrap overflow-hidden text-ellipsis min-w-0 max-md:text-[13px] max-md:leading-[1.2] max-md:text-center max-md:whitespace-normal max-md:line-clamp-2 max-md:overflow-visible">
                  {isLaunching ? 'Opening...' : application.title}
                </span>
              </a>
            )
          })}
        </div>
      ) : null}

      {favoriteActionState.error ? (
        <p className="m-0 text-sm font-medium leading-[1.3] text-text-secondary font-body">{favoriteActionState.error}</p>
      ) : null}

      {visibleServices.length > 0 ? (
        <div className="grid gap-4 mt-7 text-brand">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-[5px]">
              <Icon icon="carbon:app-switcher" className="w-[17px] h-[17px] text-brand shrink-0" aria-hidden="true" />
              <span className="text-base font-medium leading-[1.06]">Toutes les applications</span>
            </div>
            <div className="relative">
              <Icon icon="carbon:search" className="absolute left-3 top-1/2 -translate-y-1/2 w-[14px] h-[14px] text-text-muted pointer-events-none" aria-hidden="true" />
              <input
                type="text"
                placeholder="Rechercher..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="app-search-input w-[180px] h-[36px] pl-8 pr-3 border border-border rounded-full bg-widget-bg text-text text-sm font-body leading-none placeholder:text-text-muted transition-[width,border-color] duration-200 focus:w-[240px] focus:border-text-muted max-sm:w-[140px] max-sm:focus:w-[180px]"
              />
            </div>
          </div>
          {categories.length > 1 ? (
            <div className="flex items-center gap-2 flex-wrap max-md:flex-nowrap max-md:overflow-x-auto max-md:-mx-4 max-md:px-4 favorites-scroll-hide">
              <button
                type="button"
                className={`min-h-[34px] px-[14px] border rounded-full font-inherit text-sm font-semibold transition-[background-color,border-color,color] duration-[120ms] ${selectedCategory === null ? 'border-brand bg-brand text-bg' : 'border-border bg-bg text-brand hover:bg-bg-subtle'}`}
                onClick={() => setSelectedCategory(null)}
              >
                Tout
              </button>
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  className={`min-h-[34px] px-[14px] border rounded-full font-inherit text-sm font-semibold whitespace-nowrap transition-[background-color,border-color,color] duration-[120ms] ${selectedCategory === category ? 'border-brand bg-brand text-bg' : 'border-border bg-bg text-brand hover:bg-bg-subtle'}`}
                  onClick={() => setSelectedCategory(category)}
                >
                  {category}
                </button>
              ))}
            </div>
          ) : null}
          <div className="grid grid-cols-3 gap-x-6 max-lg:grid-cols-2 max-md:grid-cols-1">
            {filteredServices.map((service, index) => {
              const applicationKey = getApplicationKey(service)
              const resolvedLaunch = launchTargets[applicationKey]
              const href = resolvedLaunch?.href || service.href
              const target = resolvedLaunch?.target || service.target
              const isBusy = favoriteActionState.removingKey === applicationKey
              const isContextOpen = contextMenuState.open && getApplicationKey(contextMenuState.application ?? {}) === applicationKey
              const isFavorite = orderedFavorites.some(f => getApplicationKey(f) === applicationKey)

              return (
                <a
                  key={service.id}
                  className={`app-card-enter group flex items-center gap-4 py-3 px-2 border-b border-border/40 text-inherit no-underline transition-[background-color] duration-[120ms] ease-in-out min-w-0 hover:bg-bg-subtle/50 focus-visible:bg-bg-subtle/50 focus-visible:outline-none ${isBusy ? 'pointer-events-none opacity-70' : ''} ${isContextOpen ? 'bg-context-hover' : ''}`}
                  style={{ animationDelay: `${index * 20}ms` }}
                  href={href}
                  target={target || undefined}
                  rel={target === '_blank' ? 'noreferrer' : undefined}
                  onMouseEnter={() => warmApplicationLaunch(service)}
                  onFocus={() => warmApplicationLaunch(service)}
                  onContextMenu={(event) => handleFavoriteContextMenu(event, service, 'all')}
                  onClick={(event) => void handleApplicationClick(event, service)}
                >
                  <span
                    className="app-icon inline-flex items-center justify-center w-[44px] h-[44px] rounded-[12px] bg-widget-bg shadow-sm shrink-0"
                    aria-hidden="true"
                    style={getAppIcon(service.title) ? undefined : { backgroundColor: getLetterStyle(service.title).bg, color: getLetterStyle(service.title).fg }}
                  >
                    {getAppIcon(service.title) ? (
                      <img
                        src={getAppIcon(service.title)}
                        alt=""
                        className="w-full h-full object-contain rounded-[inherit]"
                      />
                    ) : (
                      <span className="text-lg font-semibold leading-none select-none">
                        {getAppLetter(service.title)}
                      </span>
                    )}
                  </span>
                  <span className="flex flex-col gap-0.5 flex-1 min-w-0">
                    <span className="text-[15px] font-semibold leading-[1.2] whitespace-nowrap overflow-hidden text-ellipsis">{service.title}</span>
                    {service.description ? (
                      <span className="text-[13px] font-medium leading-[1.3] text-text-muted line-clamp-1 font-body">{service.description}</span>
                    ) : null}
                  </span>
                  <button
                    type="button"
                    className="app-card-action flex items-center justify-center w-8 h-8 rounded-full border-none bg-transparent text-text-muted opacity-0 cursor-pointer transition-[opacity,background-color,color] duration-[120ms] ease-in-out shrink-0 group-hover:opacity-60 group-focus-visible:opacity-60 focus-visible:opacity-60"
                    aria-label={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                    onClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      if (isFavorite) {
                        const targetApp = orderedFavorites.find(f => getApplicationKey(f) === applicationKey) || service
                        void handleUnfavorite(targetApp)
                      } else {
                        void handleAddFavorite(service)
                      }
                    }}
                  >
                    <Icon icon="carbon:star" className="w-[18px] h-[18px]" aria-hidden="true" />
                  </button>
                </a>
              )
            })}
          </div>
        </div>
      ) : null}

      {contextMenuState.open && contextMenuState.application ? (() => {
        const applicationKey = getApplicationKey(contextMenuState.application)
        const isFavorite = orderedFavorites.some(f => getApplicationKey(f) === applicationKey)
        const isAddMode = !isFavorite && contextMenuState.source === 'all'

        const targetApplication = isAddMode
          ? contextMenuState.application
          : (orderedFavorites.find(f => getApplicationKey(f) === applicationKey) || contextMenuState.application)

        return (
        <div
          ref={contextMenuRef}
          className="favorites-context-menu fixed z-60 min-w-[252px] p-[6px] border border-border rounded-[18px] bg-context-bg shadow-[0_18px_40px_var(--color-shadow)] backdrop-blur-[12px] animate-context-menu-in max-md:min-w-[220px]"
          role="menu"
          aria-label={`Actions pour ${targetApplication.title}`}
          style={{
            top: `${contextMenuState.y}px`,
            left: `${contextMenuState.x}px`,
            '--favorites-context-origin-x': contextMenuState.originX,
            '--favorites-context-origin-y': contextMenuState.originY,
          }}
        >
          <button
            type="button"
            className="favorites-context-action w-full flex items-center gap-[10px] min-h-[44px] px-3 border-0 rounded-[12px] bg-transparent text-brand font-inherit text-[15px] font-semibold text-left animate-context-action-in hover:bg-context-hover focus-visible:bg-context-hover focus-visible:outline-none"
            role="menuitem"
            onClick={() => void handleOpenApplicationInNewTab(targetApplication)}
          >
            <Icon icon="carbon:launch" className="w-[18px] h-[18px] shrink-0" aria-hidden="true" />
            <span>Ouvrir dans un nouvel onglet</span>
          </button>
          <button
            type="button"
            className="favorites-context-action w-full flex items-center gap-[10px] min-h-[44px] px-3 border-0 rounded-[12px] bg-transparent text-brand font-inherit text-[15px] font-semibold text-left animate-context-action-in hover:bg-context-hover focus-visible:bg-context-hover focus-visible:outline-none"
            role="menuitem"
            onClick={() => void handleCopyApplicationLink(targetApplication)}
          >
            <Icon icon="carbon:copy-link" className="w-[18px] h-[18px] shrink-0" aria-hidden="true" />
            <span>Copier le lien</span>
          </button>
          <div className="mx-2 my-1 h-px bg-border/80" aria-hidden="true" />
          {isAddMode ? (
            <button
              type="button"
              className="favorites-context-action w-full flex items-center gap-[10px] min-h-[44px] px-3 border-0 rounded-[12px] bg-transparent text-brand font-inherit text-[15px] font-semibold text-left animate-context-action-in hover:bg-context-hover focus-visible:bg-context-hover focus-visible:outline-none"
              role="menuitem"
              onClick={() => void handleAddFavorite(targetApplication)}
            >
              <Icon icon="carbon:star" className="w-[18px] h-[18px] shrink-0" aria-hidden="true" />
              <span>Ajouter aux favoris</span>
            </button>
          ) : (
            <button
              type="button"
              className="favorites-context-action w-full flex items-center gap-[10px] min-h-[44px] px-3 border-0 rounded-[12px] bg-transparent text-brand font-inherit text-[15px] font-semibold text-left animate-context-action-in hover:bg-context-hover focus-visible:bg-context-hover focus-visible:outline-none"
              role="menuitem"
              onClick={() => void handleUnfavorite(targetApplication)}
            >
              <Icon icon="carbon:close-outline" className="w-[18px] h-[18px] shrink-0" aria-hidden="true" />
              <span>Retirer des favoris</span>
            </button>
          )}
        </div>
      )})() : null}
    </section>
  )
}

export default AvailableApplications
