import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '@iconify/react'
import './AvailableApplications.css'
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
  } catch {}
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

  if (/^[a-z][a-z\d+.-]*:/i.test(href) && !/^https?:/i.test(href)) {
    return href
  }

  try {
    return buildEntProxyHref(href)
  } catch {
    return href
  }
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


function isPlainLeftClick(event) {
  return event.button === 0
    && !event.metaKey
    && !event.ctrlKey
    && !event.shiftKey
    && !event.altKey
}

function navigateToApplication({ href, target }, preparedWindow = null) {
  if (!href) {
    return
  }

  if (target === '_blank') {
    if (preparedWindow && !preparedWindow.closed) {
      try {
        preparedWindow.opener = null
      } catch {
        // Some browsers restrict opener writes; navigation still works without it.
      }

      preparedWindow.location.assign(href)
      return
    }

    window.open(href, '_blank', 'noopener,noreferrer')
    return
  }

  window.location.assign(href)
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

function AvailableApplications() {
  const [viewState, setViewState] = useState({
    status: 'loading',
    source: 'none',
    rawCount: 0,
    sections: [],
    error: '',
  })
  const [reloadKey, setReloadKey] = useState(0)
  const [launchTargets, setLaunchTargets] = useState({})
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
  const [orderedFavorites, setOrderedFavorites] = useState([])
  const [isDragging, setIsDragging] = useState(false)
  const launchRequestsRef = useRef(new Map())
  const removalTimeoutsRef = useRef(new Map())
  const isMountedRef = useRef(true)
  const contextMenuRef = useRef(null)
  const dragRef = useRef({ index: -1, didDrag: false })
  const favoritesRowRef = useRef(null)
  const flipRectsRef = useRef(new Map())

  const favoriteApplications = useMemo(
    () => getFavoriteApplications(viewState.sections),
    [viewState.sections],
  )
  const shouldShowFavoriteRow = viewState.status === 'ready' && orderedFavorites.length > 0
  const shouldHideFavoritesSection = viewState.status === 'empty'
    || (viewState.status === 'ready' && favoriteApplications.length === 0)

  useEffect(() => {
    setOrderedFavorites(applyStoredOrder(favoriteApplications))
  }, [favoriteApplications])

  useEffect(() => {
    const launchRequests = launchRequestsRef.current
    const removalTimeouts = removalTimeoutsRef.current

    return () => {
      isMountedRef.current = false
      launchRequests.clear()
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
  }, [reloadKey])

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

    const request = getPortletFragment({}, application.fname)
      .then((fragmentResponse) => {
        const launchLink = extractLaunchLink(fragmentResponse?.text ?? '')
        const resolvedLaunch = {
          href: toNavigableHref(launchLink.href) || application.href,
          target: getFirstText(launchLink.target, application.target),
        }

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

  async function handleUnfavorite(application) {
    const applicationKey = getApplicationKey(application)
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
    const lastFavorite = orderedFavorites[orderedFavorites.length - 1]
    const requestPath = buildAddFavoriteRequestPath(application, lastFavorite)

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
    const launchKey = getApplicationKey(application)
    const resolvedLaunch = launchTargets[launchKey]

    if (resolvedLaunch || !application.fname || !isPlainLeftClick(event)) {
      return
    }

    event.preventDefault()

    if (launchingKeys[launchKey]) {
      return
    }

    const preparedWindow = application.target === '_blank'
      ? window.open('about:blank', '_blank')
      : null

    setLaunchingKeys((current) => ({ ...current, [launchKey]: true }))

    try {
      const nextLaunch = await resolveApplicationLaunch(application)
      clearLaunchingState(launchKey)
      navigateToApplication(nextLaunch, preparedWindow)
    } catch {
      clearLaunchingState(launchKey)
      if (preparedWindow && !preparedWindow.closed) {
        preparedWindow.close()
      }
      navigateToApplication({
        href: application.href,
        target: application.target,
      })
    } finally {
      if (isMountedRef.current) {
        clearLaunchingState(launchKey)
      }
    }
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
    <section className="favorites-strip" aria-labelledby="favorites-strip-title">
      <div className="favorites-strip__label">
        <Icon icon="carbon:star" className="favorites-strip__label-icon" aria-hidden="true" />
        <h2 className="favorites-strip__label-text" id="favorites-strip-title">Favoris</h2>
      </div>

      {viewState.status === 'loading' ? (
        <div className="favorites-strip__row" role="status" aria-live="polite">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={`loading-favorite-${index}`} className="favorites-strip__item favorites-strip__item--placeholder" aria-hidden="true">
              <span className="favorites-strip__badge favorites-strip__badge--placeholder" />
              <span className="favorites-strip__text-placeholder" />
            </div>
          ))}
        </div>
      ) : null}

      {viewState.status === 'error' ? (
        <div className="favorites-strip__feedback">
          <div className="favorites-strip__feedback-copy">
            <Icon icon="carbon:warning-filled" className="favorites-strip__feedback-icon" aria-hidden="true" />
            <p className="favorites-strip__feedback-text">{viewState.error}</p>
          </div>

          <button type="button" className="favorites-strip__retry" onClick={handleRetry}>
            Réessayer
          </button>
        </div>
      ) : null}

      {viewState.status === 'empty' ? (
        <p className="favorites-strip__feedback-text">Aucun favori ENT disponible pour le moment.</p>
      ) : null}

      {shouldShowFavoriteRow ? (
        <div className={`favorites-strip__row ${isDragging ? 'favorites-strip__row--dragging' : ''}`} ref={favoritesRowRef}>
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
            return (
              <a
                key={application.id}
                data-app-id={application.id}
                className={`favorites-strip__item ${isLaunching ? 'favorites-strip__item--loading' : ''} ${(isRemovingFavorite || isExitingFavorite) ? 'favorites-strip__item--busy' : ''} ${isExitingFavorite ? 'favorites-strip__item--removing' : ''} ${isContextOpen ? 'favorites-strip__item--context-open' : ''}`}
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
                  className="favorites-strip__badge"
                  aria-hidden="true"
                  style={getAppIcon(application.title) ? undefined : { backgroundColor: getLetterStyle(application.title).bg, color: getLetterStyle(application.title).fg }}
                >
                  {isLaunching ? (
                    <Icon
                      icon="carbon:renew"
                      className="favorites-strip__badge-icon favorites-strip__badge-icon--spinning"
                    />
                  ) : getAppIcon(application.title) ? (
                    <img
                      src={getAppIcon(application.title)}
                      alt=""
                      className="favorites-strip__badge-image"
                    />
                  ) : (
                    <span className="favorites-strip__badge-letter">
                      {getAppLetter(application.title)}
                    </span>
                  )}
                </span>
                <span className="favorites-strip__item-name">
                  {isLaunching ? 'Opening...' : application.title}
                </span>
              </a>
            )
          })}
        </div>
      ) : null}

      {favoriteActionState.error ? (
        <p className="favorites-strip__feedback-text">{favoriteActionState.error}</p>
      ) : null}

      {allServices.length > 0 ? (
        <div className="app-drawer">
          <div className="app-drawer__label">
            <Icon icon="carbon:app-switcher" className="app-drawer__label-icon" aria-hidden="true" />
            <span className="app-drawer__label-text">Toutes les applications</span>
          </div>
          <div className="app-drawer__grid">
            {allServices.map((service) => {
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
                  className={`app-card ${isBusy ? 'app-card--busy' : ''} ${isContextOpen ? 'app-card--context-open' : ''}`}
                  href={href}
                  target={target || undefined}
                  rel={target === '_blank' ? 'noreferrer' : undefined}
                  onMouseEnter={() => warmApplicationLaunch(service)}
                  onFocus={() => warmApplicationLaunch(service)}
                  onContextMenu={(event) => handleFavoriteContextMenu(event, service, 'all')}
                  onClick={(event) => void handleApplicationClick(event, service)}
                >
                  <span
                    className="app-card__icon"
                    aria-hidden="true"
                    style={getAppIcon(service.title) ? undefined : { backgroundColor: getLetterStyle(service.title).bg, color: getLetterStyle(service.title).fg }}
                  >
                    {getAppIcon(service.title) ? (
                      <img
                        src={getAppIcon(service.title)}
                        alt=""
                        className="app-card__icon-image"
                      />
                    ) : (
                      <span className="app-card__icon-letter">
                        {getAppLetter(service.title)}
                      </span>
                    )}
                  </span>
                  <span className="app-card__text">
                    <span className="app-card__title">{service.title}</span>
                    {service.description ? (
                      <span className="app-card__description">{service.description}</span>
                    ) : null}
                  </span>
                  <button
                    type="button"
                    className={`app-card__action ${isFavorite ? 'app-card__action--is-favorite' : ''}`}
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
                    <Icon icon={isFavorite ? 'carbon:star-filled' : 'carbon:star'} className="app-card__action-icon" aria-hidden="true" />
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
        
        // Find the actual application with remove limits if it's already a favorite
        const targetApplication = isAddMode 
          ? contextMenuState.application 
          : (orderedFavorites.find(f => getApplicationKey(f) === applicationKey) || contextMenuState.application)

        return (
        <div
          ref={contextMenuRef}
          className="favorites-context-menu"
          role="menu"
          aria-label={`Actions pour ${targetApplication.title}`}
          style={{
            top: `${contextMenuState.y}px`,
            left: `${contextMenuState.x}px`,
            '--favorites-context-origin-x': contextMenuState.originX,
            '--favorites-context-origin-y': contextMenuState.originY,
          }}
        >
          {isAddMode ? (
            <button
              type="button"
              className="favorites-context-menu__action"
              role="menuitem"
              onClick={() => void handleAddFavorite(targetApplication)}
            >
              <Icon icon="carbon:star" className="favorites-context-menu__action-icon" aria-hidden="true" />
              <span>Ajouter aux favoris</span>
            </button>
          ) : (
            <button
              type="button"
              className="favorites-context-menu__action"
              role="menuitem"
              onClick={() => void handleUnfavorite(targetApplication)}
            >
              <Icon icon="carbon:close-outline" className="favorites-context-menu__action-icon" aria-hidden="true" />
              <span>Retirer des favoris</span>
            </button>
          )}
        </div>
      )})() : null}
    </section>
  )
}

export default AvailableApplications
