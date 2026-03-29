export const PLANNING_ORIGIN = 'https://planning.univ-rennes1.fr'
export const PLANNING_SERVICE_URL = `${PLANNING_ORIGIN}/direct/myplanning.jsp`

const DAY_MS = 24 * 60 * 60 * 1000
const PLANNING_GWT_MODULE_BASE = `${PLANNING_ORIGIN}/direct/gwtdirectplanning/`
const PLANNING_GWT_CLIENT_ID = 'Z0pqq18'
const CONTEXT_CACHE_TTL_MS = 5 * 60 * 1000
const CONTEXT_CACHE_STALE_MS = 55 * 60 * 1000
const TREE_CACHE_TTL_MS = 30 * 60 * 1000
const TREE_CACHE_STALE_MS = 6 * 60 * 60 * 1000
const TIMETABLE_CURRENT_WEEK_TTL_MS = 5 * 60 * 1000
const TIMETABLE_CURRENT_WEEK_STALE_MS = 2 * 60 * 60 * 1000
const TIMETABLE_HISTORICAL_TTL_MS = 60 * 60 * 1000
const TIMETABLE_HISTORICAL_STALE_MS = 24 * 60 * 60 * 1000
const PLANNING_CACHE_LIMITS = {
  context: 200,
  tree: 500,
  timetable: 1000,
}
const PLANNING_GWT_PERMUTATIONS = {
  webClient: 'FE500F0EAC5A5732DFC902C566E7EBA7',
  configuration: '2151F6DCAC1F72D0ABE4B87ADF1A9E37',
  myPlanning: '2912ADA6C426CFB85D3ACABE4CE65F74',
  directPlanning: 'ED09B1B4CB67D19361C6552338791595',
  directPlanningPlanning: 'F37B3FF029554C53D8CCFA3BD4A4621C',
  pac: 'D9934DAC4B2CC6CE64601BBCF028E77A',
}
const PLANNING_TREE_ROOT_CONFIG = '{"-100""true""-1""-1""-1""-1""0""false"[0]"""""0""0"[0][0]'

function clonePlanningCacheValue(value) {
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(value)
  }

  return JSON.parse(JSON.stringify(value))
}

function createPlanningCacheStore(maxEntries) {
  return {
    entries: new Map(),
    maxEntries,
  }
}

function prunePlanningCacheStore(store) {
  if (!(store?.entries instanceof Map)) {
    return
  }

  const now = Date.now()

  for (const [key, entry] of store.entries.entries()) {
    if (entry.pendingPromise) {
      continue
    }

    if (entry.staleUntil <= now) {
      store.entries.delete(key)
    }
  }

  if (store.entries.size <= store.maxEntries) {
    return
  }

  const evictionCandidates = Array.from(store.entries.entries())
    .filter(([, entry]) => !entry.pendingPromise)
    .sort((left, right) => left[1].lastAccessedAt - right[1].lastAccessedAt)

  while (store.entries.size > store.maxEntries && evictionCandidates.length > 0) {
    const [key] = evictionCandidates.shift()
    store.entries.delete(key)
  }
}

function createPlanningCacheEntry(value, policy) {
  const now = Date.now()

  return {
    value: clonePlanningCacheValue(value),
    cachedAt: now,
    expiresAt: now + policy.ttlMs,
    staleUntil: now + policy.ttlMs + policy.staleMs,
    lastAccessedAt: now,
    pendingPromise: null,
  }
}

function touchPlanningCacheEntry(entry) {
  if (!entry) {
    return
  }

  entry.lastAccessedAt = Date.now()
}

function buildPlanningCacheMetadata(bucket, status, policy, entry, extra = {}) {
  const now = Date.now()

  return {
    bucket,
    enabled: true,
    status,
    cachedAt: entry?.cachedAt ?? null,
    expiresAt: entry?.expiresAt ?? null,
    staleUntil: entry?.staleUntil ?? null,
    ageMs: entry?.cachedAt ? Math.max(0, now - entry.cachedAt) : null,
    ttlMs: policy.ttlMs,
    staleMs: policy.staleMs,
    ...extra,
  }
}

function attachPlanningCacheMetadata(value, cache) {
  const clonedValue = clonePlanningCacheValue(value)
  clonedValue.cache = cache
  return clonedValue
}

function buildBypassCacheMetadata(bucket, policy) {
  return {
    bucket,
    enabled: false,
    status: 'bypass',
    cachedAt: null,
    expiresAt: null,
    staleUntil: null,
    ageMs: null,
    ttlMs: policy.ttlMs,
    staleMs: policy.staleMs,
  }
}

function startPlanningCacheRefresh(store, key, loadValue, policy) {
  const existingEntry = store.entries.get(key)

  if (existingEntry?.pendingPromise) {
    return existingEntry.pendingPromise
  }

  const refreshPromise = (async () => {
    const loadedValue = await loadValue()
    const nextEntry = createPlanningCacheEntry(loadedValue, policy)
    store.entries.set(key, nextEntry)
    prunePlanningCacheStore(store)
    return nextEntry
  })()

  store.entries.set(key, {
    value: existingEntry?.value,
    cachedAt: existingEntry?.cachedAt ?? null,
    expiresAt: existingEntry?.expiresAt ?? 0,
    staleUntil: existingEntry?.staleUntil ?? 0,
    lastAccessedAt: Date.now(),
    pendingPromise: refreshPromise,
  })

  refreshPromise.catch(() => {
    const currentEntry = store.entries.get(key)
    if (!currentEntry || currentEntry.pendingPromise !== refreshPromise) {
      return
    }

    if (existingEntry?.value !== undefined) {
      store.entries.set(key, {
        ...existingEntry,
        pendingPromise: null,
        lastAccessedAt: Date.now(),
      })
      return
    }

    store.entries.delete(key)
  })

  return refreshPromise
}

async function readThroughPlanningCache({
  bucket,
  cacheScope,
  cacheStore,
  cacheKey,
  policy,
  loadValue,
  allowStaleWhileRevalidate = false,
}) {
  if (!cacheScope || !cacheStore || !cacheKey) {
    const value = await loadValue()
    return attachPlanningCacheMetadata(value, buildBypassCacheMetadata(bucket, policy))
  }

  const now = Date.now()
  const entry = cacheStore.entries.get(cacheKey)
  touchPlanningCacheEntry(entry)

  if (entry?.value !== undefined && now < entry.expiresAt) {
    return attachPlanningCacheMetadata(entry.value, buildPlanningCacheMetadata(bucket, 'hit', policy, entry))
  }

  if (entry?.value !== undefined && now < entry.staleUntil && allowStaleWhileRevalidate) {
    startPlanningCacheRefresh(cacheStore, cacheKey, loadValue, policy)

    return attachPlanningCacheMetadata(
      entry.value,
      buildPlanningCacheMetadata(bucket, 'stale', policy, entry, {
        revalidating: true,
      }),
    )
  }

  const hadCachedValue = entry?.value !== undefined

  try {
    const freshEntry = await startPlanningCacheRefresh(cacheStore, cacheKey, loadValue, policy)
    return attachPlanningCacheMetadata(
      freshEntry.value,
      buildPlanningCacheMetadata(bucket, hadCachedValue ? 'refresh' : 'miss', policy, freshEntry),
    )
  } catch (error) {
    if (entry?.value !== undefined && now < entry.staleUntil) {
      return attachPlanningCacheMetadata(
        entry.value,
        buildPlanningCacheMetadata(bucket, 'stale-error', policy, entry, {
          error: error instanceof Error ? error.message : String(error),
        }),
      )
    }

    throw error
  }
}

function normalizePlanningCacheScope(rawScope) {
  const normalizedScope = String(rawScope ?? '').trim()
  return normalizedScope || null
}

function deletePlanningCacheEntry(store, key) {
  if (!(store?.entries instanceof Map) || !key) {
    return
  }

  store.entries.delete(key)
}

function isPlanningInvalidIdentifierError(error) {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('GwtInvalidIdentifier')
}

function buildPlanningTimetablePolicy(resolvedWeek) {
  if (resolvedWeek?.current) {
    return {
      ttlMs: TIMETABLE_CURRENT_WEEK_TTL_MS,
      staleMs: TIMETABLE_CURRENT_WEEK_STALE_MS,
    }
  }

  return {
    ttlMs: TIMETABLE_HISTORICAL_TTL_MS,
    staleMs: TIMETABLE_HISTORICAL_STALE_MS,
  }
}

function buildPlanningRpcHeaders(permutation) {
  return {
    'Content-Type': 'text/x-gwt-rpc; charset=utf-8',
    'X-GWT-Module-Base': PLANNING_GWT_MODULE_BASE,
    'X-GWT-Permutation': permutation,
  }
}

function evaluatePlanningRpcPayload(text) {
  if (!text.startsWith('//OK')) {
    throw new Error(`Unexpected planning payload: ${text.slice(0, 120)}`)
  }

  return Function(`"use strict"; return (${text.slice(4)});`)()
}

function parsePlanningFirstInteger(text) {
  const match = text.match(/^\/\/OK\[(-?\d+)/)
  return match ? Number(match[1]) : null
}

function parsePlanningIdentifier(text) {
  const match = text.match(/"L\d+"/)
  return match ? match[0].slice(1, -1) : null
}

function extractPlanningCalendarString(text) {
  const payload = evaluatePlanningRpcPayload(text)
  const stringArray = payload.find((value) => Array.isArray(value) && value.every((item) => typeof item === 'string'))
  return stringArray?.[0] ?? ''
}

function extractPlanningLegends(text) {
  const payload = evaluatePlanningRpcPayload(text)
  const strings = payload.find((value) => Array.isArray(value) && value.every((item) => typeof item === 'string')) ?? []
  const dayPattern = /^(Lundi|Mardi|Mercredi|Jeudi|Vendredi|Samedi|Dimanche) \d{2}\/\d{2}\/\d{4}$/
  const timePattern = /^\d{2}h\d{2}$/

  return {
    weekLabel: strings.find((value) => /^S\d+ /.test(value)) ?? null,
    dayLabels: strings.filter((value) => dayPattern.test(value)),
    timeLabels: strings.filter((value) => timePattern.test(value)),
  }
}

function parseDateOnlyToUtcMs(dateString) {
  const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) {
    return Number.NaN
  }

  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

function formatUtcDate(utcMs) {
  return new Date(utcMs).toISOString().slice(0, 10)
}

function extractPlanningWeekEntries(calendarString) {
  const weekPattern = /\{"(-?\d+)""(\d{13})""(S\d+\s+\d{2}\/\d{2}\/\d{4}\s+-\s+\d{2}\/\d{2}\/\d{4})""(true|false)"/g
  const weeksByIndex = new Map()
  let match

  while ((match = weekPattern.exec(calendarString)) !== null) {
    const index = Number(match[1])

    if (!weeksByIndex.has(index)) {
      weeksByIndex.set(index, {
        index,
        startUtcMs: Number(match[2]),
        label: match[3],
        current: match[4] === 'true',
      })
    }
  }

  return Array.from(weeksByIndex.values()).sort((left, right) => left.index - right.index)
}

function findPlanningWeekForDate(weeks, targetDate) {
  const targetUtcMs = parseDateOnlyToUtcMs(targetDate)
  if (!Number.isFinite(targetUtcMs)) {
    return null
  }

  return weeks.find((week) => targetUtcMs >= week.startUtcMs && targetUtcMs < week.startUtcMs + (7 * DAY_MS)) ?? null
}

function resolvePlanningWeekEntry(calendarString, targetDate) {
  const weeks = extractPlanningWeekEntries(calendarString)

  if (weeks.length === 0) {
    throw new Error('No planning weeks found in calendar response.')
  }

  const matchedWeek = targetDate ? findPlanningWeekForDate(weeks, targetDate) : null
  const fallbackWeek = weeks.find((week) => week.current) ?? weeks[0]

  return {
    weeks,
    week: matchedWeek ?? fallbackWeek,
    matchedTargetDate: Boolean(matchedWeek),
  }
}

function summarizePlanningWeek(week) {
  if (!week) {
    return null
  }

  const endUtcMs = week.startUtcMs + (6 * DAY_MS)

  return {
    index: week.index,
    label: week.label,
    current: week.current,
    startUtcMs: week.startUtcMs,
    endUtcMs,
    startDate: formatUtcDate(week.startUtcMs),
    endDate: formatUtcDate(endUtcMs),
  }
}

function buildPlanningLoginBody(clientId) {
  return `7|0|8|${PLANNING_GWT_MODULE_BASE}|${PLANNING_GWT_PERMUTATIONS.myPlanning}|com.adesoft.gwt.directplan.client.rpc.MyPlanningClientServiceProxy|method1login|J|com.adesoft.gwt.core.client.rpc.data.LoginRequest/3705388826|com.adesoft.gwt.directplan.client.rpc.data.DirectLoginRequest/635437471||1|2|3|4|2|5|6|${clientId}|7|0|0|0|1|1|8|8|-1|0|0|`
}

function buildPlanningLoadProjectBody(clientId) {
  return `7|0|7|${PLANNING_GWT_MODULE_BASE}|${PLANNING_GWT_PERMUTATIONS.webClient}|com.adesoft.gwt.core.client.rpc.WebClientServiceProxy|method6loadProject|J|I|Z|1|2|3|4|3|5|6|7|${clientId}|1|0|`
}

function buildPlanningSavedPropertiesBody(clientId) {
  return `7|0|6|${PLANNING_GWT_MODULE_BASE}|${PLANNING_GWT_PERMUTATIONS.webClient}|com.adesoft.gwt.core.client.rpc.WebClientServiceProxy|method26getSavedProperties|J|I|1|2|3|4|2|5|6|${clientId}|8|`
}

function buildPlanningResourceFieldsBody(clientId) {
  return `7|0|5|${PLANNING_GWT_MODULE_BASE}|${PLANNING_GWT_PERMUTATIONS.directPlanning}|com.adesoft.gwt.directplan.client.rpc.DirectPlanningServiceProxy|method3getResourceFields|J|1|2|3|4|1|5|${clientId}|`
}

function buildPlanningEventFieldsBody(clientId) {
  return `7|0|5|${PLANNING_GWT_MODULE_BASE}|${PLANNING_GWT_PERMUTATIONS.directPlanningPlanning}|com.adesoft.gwt.directplan.client.rpc.DirectPlanningPlanningServiceProxy|method2getEventFields|J|1|2|3|4|1|5|${clientId}|`
}

function buildPlanningDisplayConfigurationBody(clientId) {
  return `7|0|8|${PLANNING_GWT_MODULE_BASE}|${PLANNING_GWT_PERMUTATIONS.configuration}|com.adesoft.gwt.core.client.rpc.ConfigurationServiceProxy|method28getDisplayConfigurationByName|J|java.lang.String/2004016611|Z|web-default|1|2|3|4|3|5|6|7|${clientId}|8|0|`
}

function buildPlanningCalendarBody(clientId) {
  return `7|0|8|${PLANNING_GWT_MODULE_BASE}|${PLANNING_GWT_PERMUTATIONS.directPlanning}|com.adesoft.gwt.directplan.client.rpc.DirectPlanningServiceProxy|method2getCalendar|J|java.lang.String/2004016611|Etc/GMT-1|Etc/GMT-2|1|2|3|4|4|5|6|6|6|${clientId}|7|7|8|`
}

function buildPlanningSetSqlModeBody(clientId, calendarString) {
  return `7|0|8|${PLANNING_GWT_MODULE_BASE}|${PLANNING_GWT_PERMUTATIONS.directPlanningPlanning}|com.adesoft.gwt.directplan.client.rpc.DirectPlanningPlanningServiceProxy|method1setSqlMode|J|Z|java.lang.String/2004016611|${calendarString}|1|2|3|4|3|5|6|7|${clientId}|0|8|`
}

function buildPlanningConnectedStudentBody(clientId) {
  return `7|0|5|${PLANNING_GWT_MODULE_BASE}|${PLANNING_GWT_PERMUTATIONS.pac}|com.adesoft.gwt.pac.client.rpc.PacServiceProxy|method2getConnectedStudent|J|1|2|3|4|1|5|${clientId}|`
}

function buildPlanningResourceIdsBody(clientId, identifier) {
  return `7|0|13|${PLANNING_GWT_MODULE_BASE}|${PLANNING_GWT_PERMUTATIONS.directPlanning}|com.adesoft.gwt.directplan.client.rpc.DirectPlanningServiceProxy|method7getResourceIds|J|java.util.List|java.util.Map|Z|java.util.ArrayList/4159755760|java.util.HashMap/1797211028|com.adesoft.gwt.directplan.client.rpc.ResourceFieldCriteria/1324434193|java.lang.String/2004016611|${identifier}|1|2|3|4|4|5|6|7|8|${clientId}|9|0|10|1|11|1|9|1|12|13|0|`
}

function buildPlanningLegendsBody(clientId, displayConfigurationId, resourceId, weekIndex) {
  return `7|0|13|${PLANNING_GWT_MODULE_BASE}|${PLANNING_GWT_PERMUTATIONS.directPlanningPlanning}|com.adesoft.gwt.directplan.client.rpc.DirectPlanningPlanningServiceProxy|method5getLegends|J|com.adesoft.gwt.core.client.rpc.data.planning.PlanningSelection/927838067|com.extjs.gxt.ui.client.data.SortInfo/1143517771|java.util.ArrayList/4159755760|java.lang.Integer/3438268394|Cumul|Déplacement|com.extjs.gxt.ui.client.Style$SortDir/3873584144|NAME|1|2|3|4|3|5|6|7|${clientId}|6|8|7|9|0|9|1|9|2|9|3|9|4|9|5|9|6|${displayConfigurationId}|10|11|0|0|8|1|9|${resourceId}|8|1|9|${weekIndex}|7|12|1|13|`
}

function buildPlanningTimetableBody(clientId, displayConfigurationId, resourceId, weekIndex) {
  return `7|0|13|${PLANNING_GWT_MODULE_BASE}|${PLANNING_GWT_PERMUTATIONS.directPlanningPlanning}|com.adesoft.gwt.directplan.client.rpc.DirectPlanningPlanningServiceProxy|method8getTimetable|J|com.adesoft.gwt.core.client.rpc.data.planning.PlanningSelection/927838067|I|Z|java.util.List|java.util.ArrayList/4159755760|java.lang.Integer/3438268394|Cumul|Déplacement|1|2|3|4|6|5|6|7|7|8|9|${clientId}|6|10|7|11|0|11|1|11|2|11|3|11|4|11|5|11|6|${displayConfigurationId}|12|13|0|0|10|1|11|${resourceId}|10|1|11|${weekIndex}|430|344|1|10|0|`
}

function buildPlanningTreeRootBody(clientId) {
  return `7|0|20|${PLANNING_GWT_MODULE_BASE}|${PLANNING_GWT_PERMUTATIONS.directPlanning}|com.adesoft.gwt.directplan.client.rpc.DirectPlanningServiceProxy|method4getChildren|J|java.lang.String/2004016611|com.adesoft.gwt.directplan.client.ui.tree.TreeResourceConfig/2234901663|${PLANNING_TREE_ROOT_CONFIG}|[I/2970817851|java.util.LinkedHashMap/3008245022|COLOR|com.adesoft.gwt.core.client.rpc.config.OutputField/870745015|LabelColor||com.adesoft.gwt.core.client.rpc.config.FieldType/1797283245|NAME|LabelName|java.util.ArrayList/4159755760|com.extjs.gxt.ui.client.data.SortInfo/1143517771|com.extjs.gxt.ui.client.Style$SortDir/3873584144|1|2|3|4|3|5|6|7|${clientId}|8|7|0|9|2|0|149|10|0|2|6|11|12|0|13|11|14|15|11|0|0|6|16|12|0|17|16|14|15|4|0|0|18|0|18|0|19|20|1|16|18|0|`
}

function buildPlanningTreeChildrenBody(clientId, nodeConfig) {
  return `7|0|20|${PLANNING_GWT_MODULE_BASE}|${PLANNING_GWT_PERMUTATIONS.directPlanning}|com.adesoft.gwt.directplan.client.rpc.DirectPlanningServiceProxy|method4getChildren|J|java.lang.String/2004016611|com.adesoft.gwt.directplan.client.ui.tree.TreeResourceConfig/2234901663|${nodeConfig}|[I/2970817851|java.util.LinkedHashMap/3008245022|COLOR|com.adesoft.gwt.core.client.rpc.config.OutputField/870745015|LabelColor||com.adesoft.gwt.core.client.rpc.config.FieldType/1797283245|NAME|LabelName|java.util.ArrayList/4159755760|com.extjs.gxt.ui.client.data.SortInfo/1143517771|com.extjs.gxt.ui.client.Style$SortDir/3873584144|1|2|3|4|3|5|6|7|${clientId}|8|7|0|9|2|-1|-1|10|0|2|6|11|12|0|13|11|14|15|11|0|0|6|16|12|0|17|16|14|15|4|0|0|18|0|18|0|19|20|1|16|18|0|`
}

function buildPlanningSearchDataByIdBody(clientId, resourceId) {
  return `7|0|9|${PLANNING_GWT_MODULE_BASE}|${PLANNING_GWT_PERMUTATIONS.configuration}|com.adesoft.gwt.core.client.rpc.ConfigurationServiceProxy|method25searchDataById|J|com.adesoft.gwt.core.client.rpc.config.FilterType/1396315430|java.util.List|java.util.ArrayList/4159755760|java.lang.Integer/3438268394|1|2|3|4|3|5|6|7|${clientId}|6|3|8|1|9|${resourceId}|`
}

function parseLegendDateLabel(label) {
  const match = label.match(/(\d{2})\/(\d{2})\/(\d{4})/)
  if (!match) {
    return null
  }

  return `${match[3]}-${match[2]}-${match[1]}`
}

function parsePlanningTimeRange(label) {
  const match = label.match(/^(\d{2})h(\d{2}) - (\d{2})h(\d{2})$/)
  if (!match) {
    return null
  }

  return {
    start: `${match[1]}:${match[2]}`,
    end: `${match[3]}:${match[4]}`,
  }
}

function extractPlanningTimetableEvents(text, dayLabels) {
  const payload = evaluatePlanningRpcPayload(text)
  const stringTable = payload.find((value) => Array.isArray(value) && value.every((item) => typeof item === 'string')) ?? []
  const stringTableIndex = payload.indexOf(stringTable)
  const numbers = payload.slice(0, stringTableIndex)
  const rawEvents = []

  function collectEvent(textStartIndex, geometryIndex) {
    const refs = []
    let cursor = textStartIndex

    while (cursor + 1 < numbers.length) {
      const ref = numbers[cursor]
      if (!(Number.isInteger(ref) && ref >= 7 && ref <= stringTable.length && numbers[cursor + 1] === 11)) {
        break
      }

      refs.push(ref)
      cursor += 2

      if (numbers[cursor] === 0) {
        cursor += 1
      }
    }

    if (refs.length < 6) {
      return null
    }

    return {
      x: numbers[geometryIndex],
      y: numbers[geometryIndex + 1],
      width: numbers[geometryIndex + 2],
      height: numbers[geometryIndex + 3],
      refs,
      nextCursor: cursor,
    }
  }

  if (
    numbers.length > 16
    && numbers[4] === 0
    && numbers[5] === 7
    && numbers[6] === 7
    && numbers[7] === 7
    && numbers[8] === 0
  ) {
    const firstEvent = collectEvent(9, 0)
    if (firstEvent) {
      rawEvents.push(firstEvent)
    }
  }

  for (let index = 10; index < numbers.length - 30; index += 1) {
    if (numbers[index - 10] !== 2) {
      continue
    }

    if (!(numbers[index - 5] === 0 && numbers[index - 4] === 7 && numbers[index - 3] === 7 && numbers[index - 2] === 7 && numbers[index - 1] === 0)) {
      continue
    }

    const event = collectEvent(index, index - 9)
    if (!event) {
      continue
    }

    rawEvents.push(event)
    index = event.nextCursor
  }

  const uniqueBandStarts = []
  for (const y of [...new Set(rawEvents.map((event) => event.y))].sort((left, right) => left - right)) {
    if (uniqueBandStarts.length === 0 || y - uniqueBandStarts[uniqueBandStarts.length - 1] > 50) {
      uniqueBandStarts.push(y)
    }
  }

  return rawEvents.map((event) => {
    const texts = event.refs.map((ref) => stringTable[ref - 1])
    const timeIndex = texts.findIndex((value) => /^\d{2}h\d{2} - \d{2}h\d{2}$/.test(value))
    const groups = timeIndex === -1 ? [] : texts.slice(0, timeIndex).filter(Boolean)
    const tail = timeIndex === -1 ? [] : texts.slice(timeIndex + 1)
    const nonEmptyTail = tail.filter(Boolean)
    const title = nonEmptyTail[nonEmptyTail.length - 1] ?? ''
    const room = tail.find((value) => value && value !== title) ?? ''
    const teacher = tail.slice(1).find((value) => value && value !== title) ?? ''
    const dayIndex = Math.max(0, uniqueBandStarts.findLastIndex((bandStart) => event.y >= bandStart))
    const dayLabel = dayLabels[dayIndex] ?? null
    const dayDate = dayLabel ? parseLegendDateLabel(dayLabel) : null
    const timeRange = timeIndex === -1 ? null : parsePlanningTimeRange(texts[timeIndex])

    return {
      title,
      teacher,
      location: room,
      groups,
      dayIndex,
      dayLabel,
      date: dayDate,
      timeLabel: timeIndex === -1 ? null : texts[timeIndex],
      start: dayDate && timeRange ? `${dayDate}T${timeRange.start}:00` : null,
      end: dayDate && timeRange ? `${dayDate}T${timeRange.end}:00` : null,
      lane: event.y - uniqueBandStarts[dayIndex],
      layout: {
        x: event.x,
        y: event.y,
        width: event.width,
        height: event.height,
      },
    }
  }).sort((left, right) => {
    if (left.dayIndex !== right.dayIndex) {
      return left.dayIndex - right.dayIndex
    }

    if ((left.start ?? '') !== (right.start ?? '')) {
      return (left.start ?? '').localeCompare(right.start ?? '')
    }

    if (left.lane !== right.lane) {
      return left.lane - right.lane
    }

    return left.title.localeCompare(right.title)
  })
}

function extractPlanningStringArray(text) {
  const payload = evaluatePlanningRpcPayload(text)
  return payload.find((value) => Array.isArray(value) && value.every((item) => typeof item === 'string')) ?? []
}

function extractPlanningTreeString(text) {
  const strings = extractPlanningStringArray(text)
  return strings.find((value) => value.startsWith('{"0"{')) ?? strings[0] ?? ''
}

function parsePlanningTreeString(treeString) {
  if (!treeString) {
    throw new Error('Planning tree payload is empty.')
  }

  let index = 0

  function currentChar() {
    return treeString[index] ?? ''
  }

  function preview() {
    return treeString.slice(Math.max(0, index - 40), Math.min(treeString.length, index + 120))
  }

  function expect(char) {
    if (treeString[index] !== char) {
      throw new Error(`Unexpected planning tree token at index ${index}: expected "${char}", got "${treeString[index] ?? 'EOF'}" near "${preview()}"`)
    }

    index += 1
  }

  function readQuotedString() {
    expect('"')
    const start = index

    while (index < treeString.length && treeString[index] !== '"') {
      index += 1
    }

    if (index >= treeString.length) {
      throw new Error(`Unterminated planning tree string near "${preview()}"`)
    }

    const value = treeString.slice(start, index)
    index += 1
    return value
  }

  function readArrayCount() {
    expect('[')
    const start = index

    while (index < treeString.length && treeString[index] !== ']') {
      index += 1
    }

    if (index >= treeString.length) {
      throw new Error(`Unterminated planning tree array near "${preview()}"`)
    }

    const count = Number(treeString.slice(start, index))
    index += 1

    if (!Number.isInteger(count) || count < 0) {
      throw new Error(`Invalid planning tree array count "${treeString.slice(start, index - 1)}"`)
    }

    return count
  }

  function readLooseArray() {
    const count = readArrayCount()
    const items = []

    for (let itemIndex = 0; itemIndex < count; itemIndex += 1) {
      if (currentChar() === '"') {
        items.push(readQuotedString())
        continue
      }

      if (currentChar() === '[') {
        items.push(readLooseArray())
        continue
      }

      throw new Error(`Unsupported planning tree array token "${currentChar()}" near "${preview()}"`)
    }

    return items
  }

  function parseField() {
    expect('{')
    return {
      type: readQuotedString(),
      key: readQuotedString(),
      label: readQuotedString(),
      value: readQuotedString(),
      flag1: readQuotedString(),
      flag2: readQuotedString(),
    }
  }

  function readFieldArray() {
    const count = readArrayCount()
    const fields = []

    for (let fieldIndex = 0; fieldIndex < count; fieldIndex += 1) {
      fields.push(parseField())
    }

    return fields
  }

  function parseNode() {
    const nodeStart = index
    expect('{')

    const id = readQuotedString()
    const visible = readQuotedString()
    const depth = readQuotedString()
    const childHint = readQuotedString()
    const leftIndex = readQuotedString()
    const rightIndex = readQuotedString()
    const selectionMode = readQuotedString()
    const collapsed = readQuotedString()
    const fields = readFieldArray()
    const fullPath = readQuotedString()
    const family = readQuotedString()
    const familyIndex = readQuotedString()
    const tailFlag = readQuotedString()
    const selectedIds = readLooseArray()
    const hiddenIds = readLooseArray()
    const configString = treeString.slice(nodeStart, index)

    let children = []
    let trailingFlag = null

    if (currentChar() === '[') {
      const count = readArrayCount()
      children = []

      for (let childIndex = 0; childIndex < count; childIndex += 1) {
        children.push(parseNode())
      }
    }

    if (currentChar() === '"') {
      trailingFlag = readQuotedString()
    }

    return {
      id,
      visible: visible === 'true',
      depth: Number(depth),
      childHint: Number(childHint),
      leftIndex: Number(leftIndex),
      rightIndex: Number(rightIndex),
      selectionMode: Number(selectionMode),
      collapsed: collapsed === 'true',
      fields,
      fullPath,
      family,
      familyIndex: Number(familyIndex),
      tailFlag,
      selectedIds,
      hiddenIds,
      children,
      trailingFlag,
      configString,
    }
  }

  if (treeString.startsWith('{"0"{')) {
    expect('{')
    readQuotedString()
    return parseNode()
  }

  return parseNode()
}

function parsePlanningTreeResponse(text) {
  return parsePlanningTreeString(extractPlanningTreeString(text))
}

function resolvePlanningTreeLabel(node) {
  const nameField = node.fields.find((field) => field.key === 'NAME')?.value?.trim()

  if (nameField && !/^type\.Category\d+$/i.test(nameField)) {
    return nameField
  }

  if (node.fullPath?.trim()) {
    const segments = node.fullPath.split('.').map((segment) => segment.trim()).filter(Boolean)
    if (segments.length > 0) {
      return segments[segments.length - 1]
    }
  }

  const fallbackLabels = {
    '-1': 'Etudiants',
    '-2': 'Enseignants',
    '-3': 'Salles',
    '-4': 'Equipements',
    '-5': 'Categorie 5',
    '-6': 'Categorie 6',
    '-100': 'Ressources',
  }

  return fallbackLabels[node.id] ?? nameField ?? node.fullPath ?? node.id
}

function normalizePlanningTreeNode(node) {
  const colorField = node.fields.find((field) => field.key === 'COLOR')?.value ?? null
  const path = node.fullPath?.trim() || resolvePlanningTreeLabel(node)

  return {
    id: node.id,
    name: resolvePlanningTreeLabel(node),
    path,
    family: node.family || null,
    depth: Number.isFinite(node.depth) ? node.depth : null,
    color: colorField,
    childrenLoaded: node.children.length > 0,
    config: node.configString,
    children: node.children.map(normalizePlanningTreeNode),
  }
}

function mergePlanningTreeNodes(baseNode, overrideNode) {
  if (!baseNode || baseNode.id !== overrideNode.id) {
    return overrideNode
  }

  const overrideChildrenById = new Map(overrideNode.children.map((child) => [child.id, child]))
  const mergedChildren = []

  for (const child of baseNode.children) {
    const overrideChild = overrideChildrenById.get(child.id)
    if (overrideChild) {
      mergedChildren.push(mergePlanningTreeNodes(child, overrideChild))
      overrideChildrenById.delete(child.id)
    } else {
      mergedChildren.push(child)
    }
  }

  for (const overrideChild of overrideChildrenById.values()) {
    mergedChildren.push(overrideChild)
  }

  return {
    ...baseNode,
    ...overrideNode,
    fields: overrideNode.fields.length > 0 ? overrideNode.fields : baseNode.fields,
    fullPath: overrideNode.fullPath || baseNode.fullPath,
    family: overrideNode.family || baseNode.family,
    configString: overrideNode.configString || baseNode.configString,
    children: mergedChildren,
  }
}

function replacePlanningTreeNode(rootNode, replacementNode) {
  if (rootNode.id === replacementNode.id) {
    return mergePlanningTreeNodes(rootNode, replacementNode)
  }

  if (rootNode.children.length === 0) {
    return rootNode
  }

  return {
    ...rootNode,
    children: rootNode.children.map((child) => replacePlanningTreeNode(child, replacementNode)),
  }
}

function parseAdeTreeResourceId(rawValue) {
  const matches = String(rawValue ?? '').match(/-?\d+/g)
  if (!matches || matches.length === 0) {
    return null
  }

  const parsedValue = Number(matches[matches.length - 1])
  return Number.isInteger(parsedValue) ? parsedValue : null
}

function extractPlanningTreePathIds(text) {
  const treeString = extractPlanningTreeString(text)
  if (!treeString) {
    return []
  }

  let index = 0

  function currentChar() {
    return treeString[index] ?? ''
  }

  function expect(char) {
    if (treeString[index] !== char) {
      throw new Error(`Unexpected planning path token at index ${index}: expected "${char}", got "${treeString[index] ?? 'EOF'}"`)
    }

    index += 1
  }

  function readQuotedString() {
    expect('"')
    const start = index

    while (index < treeString.length && treeString[index] !== '"') {
      index += 1
    }

    if (index >= treeString.length) {
      throw new Error('Unterminated planning path string.')
    }

    const value = treeString.slice(start, index)
    index += 1
    return value
  }

  function readArrayCount() {
    expect('[')
    const start = index

    while (index < treeString.length && treeString[index] !== ']') {
      index += 1
    }

    if (index >= treeString.length) {
      throw new Error('Unterminated planning path array.')
    }

    const count = Number(treeString.slice(start, index))
    index += 1
    return count
  }

  function skipField() {
    expect('{')
    for (let stringIndex = 0; stringIndex < 6; stringIndex += 1) {
      readQuotedString()
    }
  }

  function skipLooseArray() {
    const count = readArrayCount()

    for (let itemIndex = 0; itemIndex < count; itemIndex += 1) {
      if (currentChar() === '"') {
        readQuotedString()
      } else if (currentChar() === '[') {
        skipLooseArray()
      } else {
        throw new Error(`Unsupported planning path array token "${currentChar()}" at index ${index}`)
      }
    }
  }

  function parsePathNode() {
    expect('{')
    const id = readQuotedString()

    for (let stringIndex = 0; stringIndex < 7; stringIndex += 1) {
      readQuotedString()
    }

    const fieldCount = readArrayCount()
    for (let fieldIndex = 0; fieldIndex < fieldCount; fieldIndex += 1) {
      skipField()
    }

    readQuotedString()
    const ids = [id]

    if (currentChar() === '[') {
      const firstArrayCount = readArrayCount()
      if (firstArrayCount > 0 && currentChar() === '{') {
        for (let childIndex = 0; childIndex < firstArrayCount; childIndex += 1) {
          ids.push(...parsePathNode())
        }
        return ids
      }

      if (firstArrayCount > 0) {
        for (let itemIndex = 0; itemIndex < firstArrayCount; itemIndex += 1) {
          if (currentChar() === '"') {
            readQuotedString()
          } else if (currentChar() === '[') {
            skipLooseArray()
          } else {
            throw new Error(`Unsupported planning path array token "${currentChar()}" at index ${index}`)
          }
        }
      }

      if (currentChar() === '[') {
        const childCount = readArrayCount()
        for (let childIndex = 0; childIndex < childCount; childIndex += 1) {
          ids.push(...parsePathNode())
        }
      }
    }

    return ids
  }

  return parsePathNode()
}

function findPlanningTreeNodeById(node, targetId) {
  if (!node) {
    return null
  }

  if (String(node.id) === String(targetId)) {
    return node
  }

  for (const child of node.children ?? []) {
    const match = findPlanningTreeNodeById(child, targetId)
    if (match) {
      return match
    }
  }

  return null
}

export function createPlanningRpcClient({
  casOrigin,
  fetchWithJar,
  followRedirectChain,
}) {
  if (typeof casOrigin !== 'string' || !casOrigin) {
    throw new TypeError('createPlanningRpcClient requires a casOrigin string.')
  }

  if (typeof fetchWithJar !== 'function' || typeof followRedirectChain !== 'function') {
    throw new TypeError('createPlanningRpcClient requires fetchWithJar and followRedirectChain functions.')
  }

  const contextCache = createPlanningCacheStore(PLANNING_CACHE_LIMITS.context)
  const treeCache = createPlanningCacheStore(PLANNING_CACHE_LIMITS.tree)
  const timetableCache = createPlanningCacheStore(PLANNING_CACHE_LIMITS.timetable)

  async function postPlanningRpc(jar, serviceName, permutation, body) {
    const response = await fetchWithJar(`${PLANNING_GWT_MODULE_BASE}${serviceName}`, jar, {
      method: 'POST',
      headers: buildPlanningRpcHeaders(permutation),
      body,
      redirect: 'follow',
    })

    const text = await response.text()

    return {
      ok: response.ok && text.startsWith('//OK'),
      status: response.status,
      text,
    }
  }

  function ensurePlanningRpcOk(result, label) {
    if (result.ok) {
      return
    }

    throw new Error(`${label} failed (${result.status}): ${result.text.slice(0, 240)}`)
  }

  async function initializePlanningRpcContext(jar) {
    const clientId = PLANNING_GWT_CLIENT_ID
    const acceptHeader = 'text/html,application/xhtml+xml,*/*'
    const casLoginUrl = `${casOrigin}/login?service=${encodeURIComponent(PLANNING_SERVICE_URL)}`
    const casResult = await followRedirectChain(casLoginUrl, jar, {
      headers: { Accept: acceptHeader },
    })
    await casResult.response.text()

    const loginResult = await postPlanningRpc(jar, 'MyPlanningClientServiceProxy', PLANNING_GWT_PERMUTATIONS.myPlanning, buildPlanningLoginBody(clientId))
    ensurePlanningRpcOk(loginResult, 'Planning login')

    const planningIdentifier = parsePlanningIdentifier(loginResult.text)
    if (!planningIdentifier) {
      throw new Error(`Could not extract planning identifier from login response: ${loginResult.text.slice(0, 240)}`)
    }

    const loadProjectResult = await postPlanningRpc(jar, 'WebClientServiceProxy', PLANNING_GWT_PERMUTATIONS.webClient, buildPlanningLoadProjectBody(clientId))
    ensurePlanningRpcOk(loadProjectResult, 'Planning project load')

    const savedPropertiesResult = await postPlanningRpc(jar, 'WebClientServiceProxy', PLANNING_GWT_PERMUTATIONS.webClient, buildPlanningSavedPropertiesBody(clientId))
    ensurePlanningRpcOk(savedPropertiesResult, 'Planning saved properties')

    const resourceFieldsResult = await postPlanningRpc(jar, 'DirectPlanningServiceProxy', PLANNING_GWT_PERMUTATIONS.directPlanning, buildPlanningResourceFieldsBody(clientId))
    ensurePlanningRpcOk(resourceFieldsResult, 'Planning resource fields')

    const eventFieldsResult = await postPlanningRpc(jar, 'DirectPlanningPlanningServiceProxy', PLANNING_GWT_PERMUTATIONS.directPlanningPlanning, buildPlanningEventFieldsBody(clientId))
    ensurePlanningRpcOk(eventFieldsResult, 'Planning event fields')

    const displayConfigurationResult = await postPlanningRpc(jar, 'ConfigurationServiceProxy', PLANNING_GWT_PERMUTATIONS.configuration, buildPlanningDisplayConfigurationBody(clientId))
    ensurePlanningRpcOk(displayConfigurationResult, 'Planning display configuration')

    const displayConfigurationId = parsePlanningFirstInteger(displayConfigurationResult.text)
    if (!Number.isInteger(displayConfigurationId)) {
      throw new Error(`Could not extract planning display configuration id: ${displayConfigurationResult.text.slice(0, 240)}`)
    }

    const connectedStudentResult = await postPlanningRpc(jar, 'PacServiceProxy', PLANNING_GWT_PERMUTATIONS.pac, buildPlanningConnectedStudentBody(clientId))
    ensurePlanningRpcOk(connectedStudentResult, 'Planning connected student')

    const calendarResult = await postPlanningRpc(jar, 'DirectPlanningServiceProxy', PLANNING_GWT_PERMUTATIONS.directPlanning, buildPlanningCalendarBody(clientId))
    ensurePlanningRpcOk(calendarResult, 'Planning calendar')

    const calendarString = extractPlanningCalendarString(calendarResult.text)
    if (!calendarString) {
      throw new Error('Could not extract planning calendar data.')
    }

    const sqlModeResult = await postPlanningRpc(jar, 'DirectPlanningPlanningServiceProxy', PLANNING_GWT_PERMUTATIONS.directPlanningPlanning, buildPlanningSetSqlModeBody(clientId, calendarString))
    ensurePlanningRpcOk(sqlModeResult, 'Planning SQL mode')

    const resourceIdsResult = await postPlanningRpc(jar, 'DirectPlanningServiceProxy', PLANNING_GWT_PERMUTATIONS.directPlanning, buildPlanningResourceIdsBody(clientId, planningIdentifier))
    ensurePlanningRpcOk(resourceIdsResult, 'Planning resource ids')

    const resourceId = parsePlanningFirstInteger(resourceIdsResult.text)
    if (!Number.isInteger(resourceId)) {
      throw new Error(`Could not extract planning resource id: ${resourceIdsResult.text.slice(0, 240)}`)
    }

    return {
      clientId,
      resourceId,
      planningIdentifier,
      displayConfigurationId,
      calendarString,
      finalUrl: casResult.finalUrl,
    }
  }

  async function getPlanningContext(jar, options = {}) {
    const cacheScope = normalizePlanningCacheScope(options.cacheScope)
    const cachePolicy = {
      ttlMs: CONTEXT_CACHE_TTL_MS,
      staleMs: CONTEXT_CACHE_STALE_MS,
    }

    return readThroughPlanningCache({
      bucket: 'context',
      cacheScope,
      cacheStore: contextCache,
      cacheKey: cacheScope,
      policy: cachePolicy,
      loadValue: () => initializePlanningRpcContext(jar),
      allowStaleWhileRevalidate: false,
    })
  }

  async function withPlanningContextRetry(jar, options, loadWithContext) {
    const cacheScope = normalizePlanningCacheScope(options.cacheScope)
    let context = await getPlanningContext(jar, options)

    try {
      const value = await loadWithContext(context)
      return { value, context }
    } catch (error) {
      if (!isPlanningInvalidIdentifierError(error)) {
        throw error
      }

      deletePlanningCacheEntry(contextCache, cacheScope)
      context = await getPlanningContext(jar, { ...options, cacheScope })
      const value = await loadWithContext(context)
      return { value, context }
    }
  }

  async function fetchPlanningTimetableFromRpc(jar, targetDate, rawTargetResourceId = null, options = {}) {
    const cacheScope = normalizePlanningCacheScope(options.cacheScope)
    const { value: timetable, context } = await withPlanningContextRetry(jar, options, async (context) => {
      const requestedResourceId = parseAdeTreeResourceId(rawTargetResourceId)
      const resourceId = Number.isInteger(requestedResourceId) ? requestedResourceId : context.resourceId
      const weekResolution = resolvePlanningWeekEntry(context.calendarString, targetDate)
      const resolvedWeek = summarizePlanningWeek(weekResolution.week)
      const planningSelectionWeekIndex = Math.max(0, weekResolution.week.index - 1)
      const cachePolicy = buildPlanningTimetablePolicy(resolvedWeek)
      const cacheKey = cacheScope ? `${cacheScope}:${resourceId}:${resolvedWeek?.startDate ?? planningSelectionWeekIndex}` : null

      return readThroughPlanningCache({
        bucket: 'timetable',
        cacheScope,
        cacheStore: timetableCache,
        cacheKey,
        policy: cachePolicy,
        loadValue: async () => {
          const legendsResult = await postPlanningRpc(jar, 'DirectPlanningPlanningServiceProxy', PLANNING_GWT_PERMUTATIONS.directPlanningPlanning, buildPlanningLegendsBody(context.clientId, context.displayConfigurationId, resourceId, planningSelectionWeekIndex))
          ensurePlanningRpcOk(legendsResult, 'Planning legends')

          const legends = extractPlanningLegends(legendsResult.text)

          const timetableResult = await postPlanningRpc(jar, 'DirectPlanningPlanningServiceProxy', PLANNING_GWT_PERMUTATIONS.directPlanningPlanning, buildPlanningTimetableBody(context.clientId, context.displayConfigurationId, resourceId, planningSelectionWeekIndex))
          ensurePlanningRpcOk(timetableResult, 'Planning timetable')

          const events = extractPlanningTimetableEvents(timetableResult.text, legends.dayLabels)

          return {
            events,
            weekLabel: legends.weekLabel ?? weekResolution.week.label,
            dayLabels: legends.dayLabels,
            resourceId,
            currentResourceId: context.resourceId,
            planningIdentifier: context.planningIdentifier,
            displayConfigurationId: context.displayConfigurationId,
            weekIndex: planningSelectionWeekIndex,
            calendarWeekIndex: weekResolution.week.index,
            requestedDate: targetDate,
            requestedDateMatched: weekResolution.matchedTargetDate,
            outOfRange: !weekResolution.matchedTargetDate,
            resolvedWeek,
            finalUrl: context.finalUrl,
          }
        },
        allowStaleWhileRevalidate: true,
      })
    })

    timetable.cache.context = context.cache
    return timetable
  }

  async function fetchPlanningTreeFromRpc(jar, rawTargetResourceId, options = {}) {
    const cacheScope = normalizePlanningCacheScope(options.cacheScope)
    const cachePolicy = {
      ttlMs: TREE_CACHE_TTL_MS,
      staleMs: TREE_CACHE_STALE_MS,
    }
    const { value: tree, context } = await withPlanningContextRetry(jar, options, async (context) => {
      const explicitTargetResourceId = parseAdeTreeResourceId(rawTargetResourceId)
      const focusResourceId = Number.isInteger(explicitTargetResourceId) ? explicitTargetResourceId : context.resourceId
      const treeVariant = explicitTargetResourceId === null
        ? 'implicit-current-path'
        : `explicit:${explicitTargetResourceId}`
      const cacheKey = cacheScope ? `${cacheScope}:${treeVariant}:${focusResourceId}` : null

      return readThroughPlanningCache({
        bucket: 'tree',
        cacheScope,
        cacheStore: treeCache,
        cacheKey,
        policy: cachePolicy,
        loadValue: async () => {
          const rootTreeResult = await postPlanningRpc(jar, 'DirectPlanningServiceProxy', PLANNING_GWT_PERMUTATIONS.directPlanning, buildPlanningTreeRootBody(context.clientId))
          ensurePlanningRpcOk(rootTreeResult, 'Planning tree root')

          let mergedTreeRoot = parsePlanningTreeResponse(rootTreeResult.text)
          let currentPathIds = []

          if (Number.isInteger(focusResourceId)) {
            const pathResult = await postPlanningRpc(jar, 'ConfigurationServiceProxy', PLANNING_GWT_PERMUTATIONS.configuration, buildPlanningSearchDataByIdBody(context.clientId, focusResourceId))
            ensurePlanningRpcOk(pathResult, 'Planning tree current path')

            currentPathIds = extractPlanningTreePathIds(pathResult.text)

            const pathIdsToExpand = explicitTargetResourceId === null
              ? currentPathIds.slice(1, -1)
              : currentPathIds.slice(1)

            for (const pathNodeId of pathIdsToExpand) {
              const pathNode = findPlanningTreeNodeById(mergedTreeRoot, pathNodeId)
              if (!pathNode?.configString) {
                throw new Error(`Could not find planning tree node ${pathNodeId} to expand.`)
              }

              const childrenResult = await postPlanningRpc(
                jar,
                'DirectPlanningServiceProxy',
                PLANNING_GWT_PERMUTATIONS.directPlanning,
                buildPlanningTreeChildrenBody(context.clientId, pathNode.configString),
              )
              ensurePlanningRpcOk(childrenResult, `Planning tree children for ${pathNode.id}`)
              mergedTreeRoot = replacePlanningTreeNode(mergedTreeRoot, parsePlanningTreeResponse(childrenResult.text))
            }
          }

          return {
            root: normalizePlanningTreeNode(mergedTreeRoot),
            currentResourceId: context.resourceId,
            focusResourceId,
            currentPathIds,
            planningIdentifier: context.planningIdentifier,
            finalUrl: context.finalUrl,
          }
        },
        allowStaleWhileRevalidate: true,
      })
    })

    tree.cache.context = context.cache
    return tree
  }

  async function fetchPlanningCalendarMetadataFromRpc(jar, { targetDate = null, resourceId: rawTargetResourceId = null, cacheScope = null } = {}) {
    const context = await getPlanningContext(jar, { cacheScope })
    const weeks = extractPlanningWeekEntries(context.calendarString)

    if (weeks.length === 0) {
      throw new Error('No planning weeks found in calendar response.')
    }

    const requestedResourceId = parseAdeTreeResourceId(rawTargetResourceId)
    const weekResolution = targetDate ? resolvePlanningWeekEntry(context.calendarString, targetDate) : null

    const calendar = {
      resourceId: Number.isInteger(requestedResourceId) ? requestedResourceId : context.resourceId,
      currentResourceId: context.resourceId,
      requestedResourceId,
      planningIdentifier: context.planningIdentifier,
      displayConfigurationId: context.displayConfigurationId,
      finalUrl: context.finalUrl,
      targetDate: targetDate || null,
      targetDateMatched: weekResolution ? weekResolution.matchedTargetDate : null,
      outOfRange: weekResolution ? !weekResolution.matchedTargetDate : null,
      matchedWeek: weekResolution ? summarizePlanningWeek(weekResolution.week) : null,
      currentWeek: summarizePlanningWeek(weeks.find((week) => week.current) ?? null),
      firstWeek: summarizePlanningWeek(weeks[0] ?? null),
      lastWeek: summarizePlanningWeek(weeks[weeks.length - 1] ?? null),
      weekCount: weeks.length,
      weeks: weeks.map(summarizePlanningWeek),
    }

    calendar.cache = {
      bucket: 'calendar',
      enabled: Boolean(context.cache?.enabled),
      status: context.cache?.enabled ? context.cache.status : 'bypass',
      context: context.cache,
    }

    return calendar
  }

  function clearPlanningCaches(cacheScope = null) {
    const normalizedScope = normalizePlanningCacheScope(cacheScope)

    if (!normalizedScope) {
      return
    }

    for (const key of contextCache.entries.keys()) {
      if (key === normalizedScope) {
        contextCache.entries.delete(key)
      }
    }

    for (const store of [treeCache, timetableCache]) {
      for (const key of store.entries.keys()) {
        if (key === normalizedScope || key.startsWith(`${normalizedScope}:`)) {
          store.entries.delete(key)
        }
      }
    }
  }

  return {
    clearPlanningCaches,
    fetchPlanningCalendarMetadataFromRpc,
    fetchPlanningTimetableFromRpc,
    fetchPlanningTreeFromRpc,
  }
}
