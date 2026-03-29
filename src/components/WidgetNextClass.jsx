import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '@iconify/react'
import { ENT_AUTH_PREFIX, getAdeUpcoming } from '../entApi'

const CLASS_COLORS_KEY = 'l-ent:class-colors'
const NEXT_CLASS_LOOKAHEAD_DAYS = 14
const NEXT_CLASS_TICK_MS = 30 * 1000
const NEXT_CLASS_REFRESH_MS = 5 * 60 * 1000
const ADE_DOAUTH = 'https://planning.univ-rennes1.fr/direct/myplanning.jsp'
const ADE_HREF = `${ENT_AUTH_PREFIX}/launch?url=${encodeURIComponent(ADE_DOAUTH)}`

function createWidgetState(overrides = {}) {
  return {
    status: 'idle',
    nextClass: null,
    errorMessage: '',
    complete: true,
    ...overrides,
  }
}

function getClassHue(title) {
  try {
    const stored = JSON.parse(localStorage.getItem(CLASS_COLORS_KEY) || '{}')
    if (stored[title] != null) return stored[title]
    const hue = Math.floor(Math.random() * 360)
    stored[title] = hue
    localStorage.setItem(CLASS_COLORS_KEY, JSON.stringify(stored))
    return hue
  } catch {
    return 207
  }
}

function formatDateOnly(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getTodayDateString() {
  return formatDateOnly(new Date())
}

function getEventKey(event) {
  return [
    event?.start ?? '',
    event?.end ?? '',
    event?.title ?? '',
    event?.location ?? '',
    event?.teacher ?? '',
  ].join('||')
}

function compareEvents(left, right) {
  if ((left?.start ?? '') !== (right?.start ?? '')) {
    return (left?.start ?? '').localeCompare(right?.start ?? '')
  }

  if ((left?.end ?? '') !== (right?.end ?? '')) {
    return (left?.end ?? '').localeCompare(right?.end ?? '')
  }

  return (left?.title ?? '').localeCompare(right?.title ?? '')
}

function findNextClass(events) {
  if (!events?.length) return null

  const now = new Date()

  for (const event of events) {
    if (!event.start) continue
    const end = event.end ? new Date(event.end) : new Date(event.start)
    if (end > now) return event
  }

  return null
}

function getTimeRemainingLabel(startStr, endStr) {
  const now = new Date()
  const start = new Date(startStr)
  const end = endStr ? new Date(endStr) : null

  if (start <= now && end && end > now) return 'En cours'
  if (end && end <= now) return ''

  const diffMs = start - now
  if (diffMs <= 0) return ''

  const today = new Date(now)
  today.setHours(0, 0, 0, 0)

  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const startDay = new Date(start)
  startDay.setHours(0, 0, 0, 0)

  if (startDay.getTime() === tomorrow.getTime()) {
    return 'Demain'
  }

  const diffMins = Math.round(diffMs / 60000)
  if (diffMins < 60) return `Dans ${diffMins} min${diffMins > 1 ? 's' : ''}`

  if (diffMins < 24 * 60) {
    const hours = Math.floor(diffMins / 60)
    const mins = diffMins % 60
    if (mins === 0) return `Dans ${hours}h`
    return `Dans ${hours}h${String(mins).padStart(2, '0')}`
  }

  const diffDays = Math.floor(diffMins / (24 * 60))
  if (diffDays < 7) {
    return `Dans ${diffDays} j`
  }

  return `Le ${new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(start)}`
}

function capitalizeLabel(value) {
  if (!value) return ''
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function formatEventTimeLabel(startStr, endStr) {
  if (!startStr) {
    return ''
  }

  const start = new Date(startStr)
  const end = endStr ? new Date(endStr) : null
  const formatter = new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  })

  if (!end || Number.isNaN(end.getTime())) {
    return formatter.format(start).replace(':', 'h')
  }

  return `${formatter.format(start).replace(':', 'h')} - ${formatter.format(end).replace(':', 'h')}`
}

function formatExactDateLabel(startStr) {
  if (!startStr) {
    return ''
  }

  const start = new Date(startStr)
  const now = new Date()
  const options = {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }

  if (start.getFullYear() !== now.getFullYear()) {
    options.year = 'numeric'
  }

  return capitalizeLabel(new Intl.DateTimeFormat('fr-FR', options).format(start))
}

function formatEventDayLabel(startStr) {
  if (!startStr) {
    return ''
  }

  const start = new Date(startStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const targetDay = new Date(start)
  targetDay.setHours(0, 0, 0, 0)

  if (targetDay.getTime() === today.getTime()) {
    return 'Aujourd’hui'
  }

  if (targetDay.getTime() === tomorrow.getTime()) {
    return 'Demain'
  }

  return capitalizeLabel(new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(start))
}

function decorateUpcomingEvent(event) {
  if (!event) {
    return null
  }

  return {
    ...event,
    dayLabel: event.dayLabel || formatEventDayLabel(event.start),
    timeLabel: event.timeLabel || formatEventTimeLabel(event.start, event.end),
  }
}

function simplifyTimeLabel(timeLabel) {
  if (!timeLabel) return ''
  return timeLabel.replace(/(\d{2})h00/g, '$1h')
}

function getWidgetErrorMessage(error) {
  if (error?.name === 'AbortError') {
    return ''
  }

  const message = error instanceof Error ? error.message : String(error)

  if (!message) {
    return 'Planning indisponible pour le moment.'
  }

  if (message.toLowerCase().includes('connexion')) {
    return 'Connexion ENT requise pour afficher le prochain cours.'
  }

  return 'Planning indisponible pour le moment.'
}

function buildFakeNextClass() {
  const now = new Date()
  const start = new Date(now.getTime() + 20 * 60000)
  const end = new Date(start.getTime() + 60 * 60000)
  const pad = (n) => String(n).padStart(2, '0')

  return {
    title: 'R211 Gestion de contenus CM 1MMI',
    teacher: 'CANU Fabien',
    location: 'B03 - Amphi 2 (008)',
    groups: ['MM1A'],
    dayLabel: 'Aujourd’hui',
    timeLabel: `${pad(start.getHours())}h${pad(start.getMinutes())} - ${pad(end.getHours())}h${pad(end.getMinutes())}`,
    start: start.toISOString(),
    end: end.toISOString(),
  }
}

function buildResourceIdsFromSelection(selection) {
  const candidates = [
    selection?.tpResourceId,
    selection?.tdResourceId,
    selection?.yearResourceId,
    selection?.resourceId,
  ]

  return candidates.filter((value, index) => {
    const normalizedValue = String(value ?? '').trim()
    if (!normalizedValue) {
      return false
    }

    return candidates.findIndex((candidate) => String(candidate ?? '').trim() === normalizedValue) === index
  }).map((value) => String(value).trim())
}

function getStatusCopy(widgetState) {
  switch (widgetState.status) {
    case 'loading':
      return {
        title: 'Recherche du prochain cours...',
        body: 'On charge ton planning en direct.',
        icon: 'carbon:search',
      }
    case 'unconfigured':
      return {
        title: 'Groupe manquant',
        body: 'Choisis ton TD ou ton TP dans ton compte pour afficher le prochain cours.',
        icon: 'carbon:user-multiple',
      }
    case 'limited':
      return {
        title: 'Planning partiel',
        body: 'Le flux planning renvoie des données incomplètes pour le moment. Le prochain cours n’a pas pu être confirmé.',
        icon: 'carbon:warning-alt',
      }
    case 'empty':
      return {
        title: 'Aucun cours à venir',
        body: `Rien de prévu dans les ${NEXT_CLASS_LOOKAHEAD_DAYS} prochains jours.`,
        icon: 'carbon:calendar',
      }
    case 'error':
      return {
        title: 'Planning indisponible',
        body: widgetState.errorMessage || 'Réessaie dans quelques instants.',
        icon: 'carbon:warning-alt',
      }
    default:
      return {
        title: 'Prochain cours',
        body: '',
        icon: 'carbon:calendar',
      }
  }
}

async function loadUpcomingClasses({ selection, signal, startDate = getTodayDateString() }) {
  const data = await getAdeUpcoming({
    date: startDate,
    lookaheadDays: NEXT_CLASS_LOOKAHEAD_DAYS,
    selection,
    signal,
  })

  if (!data?.authenticated) {
    throw new Error('Connexion ENT requise pour charger le planning.')
  }

  const events = Array.isArray(data?.upcoming?.events)
    ? data.upcoming.events.map(decorateUpcomingEvent).filter(Boolean).sort(compareEvents)
    : []

  return {
    complete: data?.upcoming?.complete !== false,
    events,
    nextClass: findNextClass(events),
  }
}

function WidgetNextClass({ visible = false, debug = false, selection = null }) {
  const resourceIds = useMemo(() => buildResourceIdsFromSelection(selection), [selection])
  const resourceKey = resourceIds.join('|')
  const hasResources = resourceIds.length > 0
  const [widgetState, setWidgetState] = useState(() => (
    debug
      ? createWidgetState({ status: 'ready', nextClass: buildFakeNextClass() })
      : createWidgetState({ status: hasResources ? 'loading' : 'unconfigured' })
  ))
  const [timeLabel, setTimeLabel] = useState('')
  const visibleRef = useRef(visible)
  const loadedEventsRef = useRef([])
  const loadedCompleteRef = useRef(true)
  const lastRefreshAtRef = useRef(0)
  const loadingRef = useRef(false)
  const abortControllerRef = useRef(null)
  visibleRef.current = visible

  const syncNextClassFromLoadedEvents = useCallback(() => {
    const nextClass = findNextClass(loadedEventsRef.current)
    setWidgetState((current) => {
      const currentKey = current.nextClass ? getEventKey(current.nextClass) : null
      const nextKey = nextClass ? getEventKey(nextClass) : null

      if (nextClass) {
        if (current.status === 'ready' && currentKey === nextKey) {
          return current
        }

        return createWidgetState({
          status: 'ready',
          nextClass,
          complete: true,
        })
      }

      if (loadedEventsRef.current.length === 0) {
        const nextStatus = loadedCompleteRef.current ? 'empty' : 'limited'
        if (current.status === nextStatus) {
          return current
        }

        return createWidgetState({
          status: nextStatus,
          complete: loadedCompleteRef.current,
        })
      }

      if (loadedCompleteRef.current) {
        if (current.status === 'empty') {
          return current
        }

        return createWidgetState({
          status: 'empty',
          complete: true,
        })
      }

      if (current.status === 'limited') {
        return current
      }

      return createWidgetState({
        status: 'limited',
        complete: false,
      })
    })

    return nextClass
  }, [])

  const loadNextClass = useCallback(async ({ background = false } = {}) => {
    if (debug) {
      return
    }

    abortControllerRef.current?.abort()

    if (!hasResources) {
      loadedEventsRef.current = []
      loadedCompleteRef.current = true
      lastRefreshAtRef.current = 0
      loadingRef.current = false
      setWidgetState(createWidgetState({ status: 'unconfigured' }))
      return
    }

    const controller = new AbortController()
    abortControllerRef.current = controller
    loadingRef.current = true

    if (!background) {
      setWidgetState((current) => (current.nextClass
        ? current
        : createWidgetState({ status: 'loading' })))
    }

    try {
      const result = await loadUpcomingClasses({
        selection,
        signal: controller.signal,
      })

      if (controller.signal.aborted) {
        return
      }

      loadedEventsRef.current = result.events
      loadedCompleteRef.current = result.complete
      lastRefreshAtRef.current = Date.now()

      if (result.nextClass) {
        setWidgetState(createWidgetState({
          status: 'ready',
          nextClass: result.nextClass,
          complete: true,
        }))
        return
      }

      setWidgetState(createWidgetState({
        status: result.complete ? 'empty' : 'limited',
        complete: result.complete,
      }))
    } catch (error) {
      if (controller.signal.aborted || error?.name === 'AbortError') {
        return
      }

      loadedEventsRef.current = []
      loadedCompleteRef.current = true
      lastRefreshAtRef.current = Date.now()
      setWidgetState(createWidgetState({
        status: 'error',
        errorMessage: getWidgetErrorMessage(error),
      }))
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null
      }

      loadingRef.current = false
    }
  }, [debug, hasResources, selection])

  useEffect(() => {
    abortControllerRef.current?.abort()
    loadedEventsRef.current = []
    loadedCompleteRef.current = true
    lastRefreshAtRef.current = 0
    loadingRef.current = false

    if (debug) {
      setWidgetState(createWidgetState({
        status: 'ready',
        nextClass: buildFakeNextClass(),
      }))

      return undefined
    }

    void loadNextClass()

    return () => {
      abortControllerRef.current?.abort()
      abortControllerRef.current = null
      loadingRef.current = false
    }
  }, [debug, loadNextClass, resourceKey])

  useEffect(() => {
    function updateWidgetState() {
      const liveNextClass = debug
        ? widgetState.nextClass
        : loadedEventsRef.current.length > 0
          ? syncNextClassFromLoadedEvents()
          : widgetState.nextClass

      if (liveNextClass?.start) {
        setTimeLabel(getTimeRemainingLabel(liveNextClass.start, liveNextClass.end))
      } else {
        setTimeLabel('')
      }

      if (!debug && hasResources && visibleRef.current && !loadingRef.current) {
        const shouldRefresh = Date.now() - lastRefreshAtRef.current >= NEXT_CLASS_REFRESH_MS

        if (shouldRefresh) {
          void loadNextClass({ background: true })
        }
      }
    }

    updateWidgetState()

    const intervalId = window.setInterval(updateWidgetState, NEXT_CLASS_TICK_MS)
    return () => window.clearInterval(intervalId)
  }, [debug, hasResources, loadNextClass, syncNextClassFromLoadedEvents, widgetState.nextClass])

  useEffect(() => {
    if (debug || !hasResources) {
      return undefined
    }

    function handleForegroundRefresh() {
      if (document.visibilityState === 'hidden' || loadingRef.current) {
        return
      }

      if (Date.now() - lastRefreshAtRef.current >= NEXT_CLASS_REFRESH_MS) {
        void loadNextClass({ background: true })
        return
      }

      syncNextClassFromLoadedEvents()
    }

    window.addEventListener('focus', handleForegroundRefresh)
    document.addEventListener('visibilitychange', handleForegroundRefresh)

    return () => {
      window.removeEventListener('focus', handleForegroundRefresh)
      document.removeEventListener('visibilitychange', handleForegroundRefresh)
    }
  }, [debug, hasResources, loadNextClass, syncNextClassFromLoadedEvents])

  const nextClass = widgetState.nextClass
  const hue = useMemo(
    () => nextClass?.title ? getClassHue(nextClass.title) : 207,
    [nextClass?.title],
  )
  const accentColor = `hsl(${hue}, 60%, 42%)`
  const classGradient = `linear-gradient(180deg, hsla(${hue}, 60%, 72%, 0.25) 0%, transparent 55%)`
  const classGradientDark = `linear-gradient(180deg, hsla(${hue}, 40%, 18%, 0.4) 0%, transparent 55%)`
  const displayTimeRange = simplifyTimeLabel(nextClass?.timeLabel)
  const exactDateLabel = formatExactDateLabel(nextClass?.start)
  const shouldShowExactDateTooltip = Boolean(exactDateLabel && timeLabel && timeLabel !== 'En cours')
  const firstGroup = nextClass?.groups?.[0] || ''
  const statusCopy = getStatusCopy(widgetState)
  const openAdePlanning = useCallback(() => {
    window.open(ADE_HREF, '_blank', 'noopener,noreferrer')
  }, [])
  const handleKeyDown = useCallback((event) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return
    }

    event.preventDefault()
    openAdePlanning()
  }, [openAdePlanning])

  return (
    <article
      className={`next-class-widget widget-card relative z-0 hover:z-10 shadow-md flex-[0_1_320px] min-h-[120px] p-5 border border-white rounded-[1.75rem] overflow-visible text-base leading-6 min-w-0 max-2xl:flex-[1_1_calc(50%-7px)] max-2xl:min-w-[min(320px,100%)] max-2xl:min-h-[160px] max-md:min-h-[150px] max-md:p-4 max-md:rounded-3xl max-xs:flex-[1_1_100%] max-xs:min-w-0 flex flex-col gap-[7px] text-text cursor-pointer ${visible ? 'widget-card-visible delay-[80ms]' : ''}`}
      style={{ '--class-gradient': classGradient, '--class-gradient-dark': classGradientDark }}
      aria-label="Prochain cours, ouvrir ADE"
      onClick={openAdePlanning}
      onKeyDown={handleKeyDown}
      role="link"
      tabIndex={0}
    >
      <Icon icon="carbon:arrow-up-right" className="grade-corner-arrow absolute top-[14px] right-[14px] w-[14px] h-[14px] text-text opacity-0 transition-opacity duration-150 ease-in-out shrink-0" aria-hidden="true" />
      <div className="flex items-center gap-[5px]">
        <Icon icon="carbon:calendar" className="w-[17px] h-[17px] shrink-0 text-text" aria-hidden="true" />
        <span className="m-0 leading-[1.06] text-base font-medium max-md:text-[15px]">Prochain cours</span>
      </div>

      <div className="flex-1 flex flex-col justify-between min-h-0">
        {widgetState.status === 'ready' && nextClass ? (
          <>
            <div className="flex items-center gap-2 flex-1 my-3">
              <div className="flex self-stretch items-center">
                <div
                  className="w-[6px] h-full rounded-[25px] shrink-0 relative overflow-hidden"
                  style={{ background: accentColor }}
                  aria-hidden="true"
                >
                  <div className="absolute inset-0 rounded-[25px]" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.5) 0%, transparent 70%)' }} />
                </div>
              </div>
              <div className="flex flex-col gap-1 min-w-0 flex-1">
                <span className="m-0 leading-[1.06] text-base font-bold max-md:text-[15px]">{nextClass.title}</span>
                <div className="flex flex-wrap gap-x-[9px] gap-y-[2px] items-center">
                  {nextClass.location ? (
                    <span className="flex items-center gap-[3px] opacity-60">
                      <Icon icon="carbon:location" className="w-[17px] h-[17px] shrink-0" aria-hidden="true" />
                      <span className="leading-[1.06] text-base max-md:text-[15px] whitespace-nowrap">{nextClass.location}</span>
                    </span>
                  ) : null}
                  {nextClass.teacher ? (
                    <span className="flex items-center gap-[3px] opacity-60">
                      <Icon icon="carbon:user-avatar" className="w-[17px] h-[17px] shrink-0" aria-hidden="true" />
                      <span className="leading-[1.06] text-base max-md:text-[15px] whitespace-nowrap">{nextClass.teacher}</span>
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col gap-[2px] min-w-0">
                <div className="flex items-center gap-[7px] flex-wrap">
                  <span
                    className={`relative inline-flex items-center gap-[5px] ${shouldShowExactDateTooltip ? 'group/next-class cursor-help' : ''}`}
                    title={shouldShowExactDateTooltip ? exactDateLabel : undefined}
                  >
                    <Icon icon="carbon:time" className="w-[17px] h-[17px] shrink-0" aria-hidden="true" />
                    <span className="leading-[1.06] text-base font-medium max-md:text-[15px] whitespace-nowrap">{timeLabel}</span>
                    {shouldShowExactDateTooltip ? (
                      <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 inline-flex -translate-x-1/2 translate-y-1 scale-95 whitespace-nowrap rounded-full border border-white/70 bg-[rgba(17,24,39,0.92)] px-3 py-1.5 text-[12px] font-medium leading-none text-white opacity-0 shadow-[0_12px_32px_rgba(17,24,39,0.18)] transition-[opacity,transform] duration-180 ease-out invisible group-hover/next-class:visible group-hover/next-class:translate-y-0 group-hover/next-class:scale-100 group-hover/next-class:opacity-100">
                        {exactDateLabel}
                      </span>
                    ) : null}
                  </span>
                  {displayTimeRange ? (
                    <span className="leading-[1.06] text-base opacity-60 max-md:text-[15px] whitespace-nowrap">{displayTimeRange}</span>
                  ) : null}
                </div>
              </div>
              {firstGroup ? (
                <span className="leading-[1.06] text-base font-semibold opacity-60 max-md:text-[15px] whitespace-nowrap">{firstGroup}</span>
              ) : null}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col justify-center gap-2 py-1">
            <div className="flex items-center gap-[7px]">
              <Icon icon={statusCopy.icon} className="w-[18px] h-[18px] shrink-0 opacity-70" aria-hidden="true" />
              <span className="m-0 leading-[1.06] text-base font-bold max-md:text-[15px]">{statusCopy.title}</span>
            </div>
            {statusCopy.body ? (
              <p className="m-0 text-base leading-6 opacity-70 max-md:text-[15px] line-clamp-2">{statusCopy.body}</p>
            ) : null}
          </div>
        )}
      </div>
    </article>
  )
}

export default WidgetNextClass
