import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '@iconify/react'
import './AvailableApplications.css'
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

function isGenericIconSrc(value = '') {
  const normalizedValue = String(value).trim().toLowerCase()

  return normalizedValue.includes('/media/skins/icons/mobile/default')
    || normalizedValue.includes('/resourceservingwebapp/rs/tango/')
    || normalizedValue.includes('/categories/preferences-system.png')
    || normalizedValue.includes('/mimetypes/text-html.png')
}

function extractPortalPageIconUrls(pageHtml = '') {
  const iconMap = new Map()
  const stylePattern = /#Pluto_[^_\s]+_([^_\s]+)_[^_\s]+_app\s+\.portlet-icon\s*\{[\s\S]*?background-image:\s*url\((['"]?)([^)"']+)\2\)/gi

  for (const match of pageHtml.matchAll(stylePattern)) {
    const nodeId = match[1]?.trim()
    const iconSrc = match[3]?.trim()

    if (nodeId && iconSrc && !iconMap.has(nodeId)) {
      iconMap.set(nodeId, iconSrc)
    }
  }

  return iconMap
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
    iconSrc: toNavigableHref(
      getFirstText(
        entry?.iconUrl,
        metadata?.iconUrl,
        entry?.parameters?.mobileIconUrl,
        metadata?.parameters?.mobileIconUrl,
        entry?.parameters?.iconUrl,
        metadata?.parameters?.iconUrl,
      ),
    ),
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

function pickApplicationIcon(title = '') {
  const normalizedTitle = title.toLowerCase()

  if (normalizedTitle.includes('moodle') || normalizedTitle.includes('cours')) {
    return 'carbon:education'
  }

  if (normalizedTitle.includes('mail') || normalizedTitle.includes('messag') || normalizedTitle.includes('zimbra')) {
    return 'carbon:email'
  }

  if (normalizedTitle.includes('emploi du temps') || normalizedTitle.includes('agenda') || normalizedTitle.includes('calendar') || normalizedTitle.includes('edt')) {
    return 'carbon:calendar'
  }

  if (normalizedTitle.includes('notes') || normalizedTitle.includes('result') || normalizedTitle.includes('grade')) {
    return 'carbon:chart-line-data'
  }

  if (normalizedTitle.includes('bibli') || normalizedTitle.includes('library')) {
    return 'carbon:book'
  }

  if (normalizedTitle.includes('drive') || normalizedTitle.includes('document') || normalizedTitle.includes('fichier')) {
    return 'carbon:folder'
  }

  return 'carbon:application-web'
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
  const [favoriteIconUrls, setFavoriteIconUrls] = useState({})
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
  })
  const launchRequestsRef = useRef(new Map())
  const iconRequestsRef = useRef(new Map())
  const removalTimeoutsRef = useRef(new Map())
  const isMountedRef = useRef(true)
  const contextMenuRef = useRef(null)

  const favoriteApplications = useMemo(
    () => getFavoriteApplications(viewState.sections),
    [viewState.sections],
  )
  const shouldShowFavoriteRow = viewState.status === 'ready' && favoriteApplications.length > 0
  const shouldHideFavoritesSection = viewState.status === 'empty'
    || (viewState.status === 'ready' && favoriteApplications.length === 0)

  useEffect(() => {
    const launchRequests = launchRequestsRef.current
    const iconRequests = iconRequestsRef.current
    const removalTimeouts = removalTimeoutsRef.current

    return () => {
      isMountedRef.current = false
      launchRequests.clear()
      iconRequests.clear()
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
    const applicationsNeedingIcons = favoriteApplications.filter((application) => {
      const applicationKey = getApplicationKey(application)
      const hasRealMetadataIcon = application.iconSrc && !isGenericIconSrc(application.iconSrc)
      return application.portalNodeId
        && !hasRealMetadataIcon
        && !favoriteIconUrls[applicationKey]
        && !iconRequestsRef.current.has(applicationKey)
    })

    if (applicationsNeedingIcons.length === 0) {
      return undefined
    }

    const request = requestEnt('/f/services/normal/render.uP', {
      headers: {
        Accept: 'text/html, application/xhtml+xml;q=0.9, */*;q=0.8',
      },
    })
      .then((pageResponse) => {
        const pageIconUrls = extractPortalPageIconUrls(pageResponse?.text ?? '')

        if (pageIconUrls.size === 0 || isCancelled || !isMountedRef.current) {
          return
        }

        setFavoriteIconUrls((current) => {
          const nextState = { ...current }
          let hasChanged = false

          for (const application of applicationsNeedingIcons) {
            const applicationKey = getApplicationKey(application)
            const rawIconSrc = pageIconUrls.get(application.portalNodeId)
            const iconSrc = toNavigableHref(rawIconSrc)

            if (iconSrc && !nextState[applicationKey]) {
              nextState[applicationKey] = iconSrc
              hasChanged = true
            }
          }

          return hasChanged ? nextState : current
        })
      })
      .catch(() => {})
      .finally(() => {
        for (const application of applicationsNeedingIcons) {
          iconRequestsRef.current.delete(getApplicationKey(application))
        }
      })

    for (const application of applicationsNeedingIcons) {
      iconRequestsRef.current.set(getApplicationKey(application), request)
    }

    return () => {
      isCancelled = true
    }
  }, [favoriteApplications, favoriteIconUrls])

  useEffect(() => {
    let isCancelled = false

    async function hydrateApplications() {
      try {
        const bootstrap = await getPortalBootstrap()
        if (isCancelled) {
          return
        }

        const sections = normalizeBootstrapSections(bootstrap)
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
    })
  }

  function handleFavoriteContextMenu(event, application) {
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
    })
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
        <div className="favorites-strip__row">
          {favoriteApplications.map((application) => {
            const applicationKey = getApplicationKey(application)
            const resolvedLaunch = launchTargets[applicationKey]
            const iconSrc = favoriteIconUrls[applicationKey] || application.iconSrc || ''
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
                className={`favorites-strip__item ${isLaunching ? 'favorites-strip__item--loading' : ''} ${(isRemovingFavorite || isExitingFavorite) ? 'favorites-strip__item--busy' : ''} ${isExitingFavorite ? 'favorites-strip__item--removing' : ''} ${isContextOpen ? 'favorites-strip__item--context-open' : ''}`}
                href={href}
                target={target || undefined}
                rel={target === '_blank' ? 'noreferrer' : undefined}
                aria-label={`Ouvrir ${application.title}`}
                aria-busy={isLaunching || isRemovingFavorite || isExitingFavorite}
                onMouseEnter={() => warmApplicationLaunch(application)}
                onFocus={() => warmApplicationLaunch(application)}
                onContextMenu={(event) => handleFavoriteContextMenu(event, application)}
                onClick={(event) => void handleApplicationClick(event, application)}
              >
                <span className="favorites-strip__badge" aria-hidden="true">
                  {isLaunching ? (
                    <Icon
                      icon="carbon:renew"
                      className="favorites-strip__badge-icon favorites-strip__badge-icon--spinning"
                    />
                  ) : iconSrc ? (
                    <img
                      src={iconSrc}
                      alt=""
                      className="favorites-strip__badge-image"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <Icon
                      icon={pickApplicationIcon(application.title)}
                      className="favorites-strip__badge-icon"
                    />
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

      {contextMenuState.open && contextMenuState.application ? (
        <div
          ref={contextMenuRef}
          className="favorites-context-menu"
          role="menu"
          aria-label={`Actions pour ${contextMenuState.application.title}`}
          style={{
            top: `${contextMenuState.y}px`,
            left: `${contextMenuState.x}px`,
            '--favorites-context-origin-x': contextMenuState.originX,
            '--favorites-context-origin-y': contextMenuState.originY,
          }}
        >
          <button
            type="button"
            className="favorites-context-menu__action"
            role="menuitem"
            onClick={() => void handleUnfavorite(contextMenuState.application)}
          >
            <Icon icon="carbon:close-outline" className="favorites-context-menu__action-icon" aria-hidden="true" />
            <span>Retirer des favoris</span>
          </button>
        </div>
      ) : null}
    </section>
  )
}

export default AvailableApplications
