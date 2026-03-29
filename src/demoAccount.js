export const DEMO_SESSION_MODE = 'demo'

export const DEMO_CREDENTIALS = Object.freeze({
  username: 'demo@l-ent.app',
  password: 'lent-demo',
})

const DEMO_DEFAULT_FAVORITE_IDS = [
  'demo-mail',
  'demo-planning',
  'demo-moodle',
  'demo-directory',
]

const DEMO_SCHEDULE_TEMPLATES = [
  {
    key: 'ux-writing',
    dayOffset: 0,
    startHour: 9,
    startMinute: 0,
    durationMinutes: 120,
    title: 'R5.07 UX Writing',
    teacher: 'M. Le Goff',
    location: 'B03 - Salle Atelier',
  },
  {
    key: 'sae-proto',
    dayOffset: 1,
    startHour: 13,
    startMinute: 30,
    durationMinutes: 180,
    title: 'SAE Prototype interactif',
    teacher: 'Mme Le Fur',
    location: 'C12 - FabLab',
  },
  {
    key: 'dev-front',
    dayOffset: 2,
    startHour: 10,
    startMinute: 15,
    durationMinutes: 105,
    title: 'R5.11 Développement Front',
    teacher: 'M. Lemoine',
    location: 'A08 - Info 2',
  },
  {
    key: 'culture-num',
    dayOffset: 3,
    startHour: 15,
    startMinute: 15,
    durationMinutes: 90,
    title: 'R5.02 Culture numérique',
    teacher: 'Mme Martin',
    location: 'Amphi 2',
  },
]

const DEMO_APPLICATIONS = Object.freeze([
  {
    id: 'demo-mail',
    fname: 'demo-messagerie',
    title: 'Messagerie',
    description: 'Consulter un webmail de démonstration.',
    href: 'https://outlook.office.com/mail/',
    target: '_blank',
  },
  {
    id: 'demo-planning',
    fname: 'demo-emploi-du-temps',
    title: 'Emplois du temps',
    description: 'Ouvrir un calendrier public.',
    href: 'https://calendar.google.com/',
    target: '_blank',
  },
  {
    id: 'demo-moodle',
    fname: 'demo-moodle',
    title: 'Moodle',
    description: 'Découvrir une plateforme de cours en ligne.',
    href: 'https://moodle.org/',
    target: '_blank',
  },
  {
    id: 'demo-directory',
    fname: 'demo-annuaire',
    title: 'Annuaire',
    description: 'Parcourir un annuaire public.',
    href: 'https://www.pagesjaunes.fr/',
    target: '_blank',
  },
  {
    id: 'demo-docs',
    fname: 'demo-documentation',
    title: 'Documentation services',
    description: 'Lire une documentation produit publique.',
    href: 'https://support.microsoft.com/',
    target: '_blank',
  },
  {
    id: 'demo-help',
    fname: 'demo-assistance',
    title: 'Assistance',
    description: 'Consulter une page d’aide.',
    href: 'https://support.google.com/',
    target: '_blank',
  },
  {
    id: 'demo-webconf',
    fname: 'demo-webconference',
    title: 'Webconference',
    description: 'Lancer une visioconférence publique.',
    href: 'https://meet.jit.si/',
    target: '_blank',
  },
  {
    id: 'demo-365',
    fname: 'demo-m365',
    title: 'Microsoft 365',
    description: 'Voir la suite bureautique en ligne.',
    href: 'https://www.microsoft.com/microsoft-365',
    target: '_blank',
  },
])

const DEMO_APPLICATIONS_BY_ID = new Map(DEMO_APPLICATIONS.map((application) => [application.id, application]))
const DEMO_APPLICATIONS_BY_FNAME = new Map(DEMO_APPLICATIONS.map((application) => [application.fname, application]))

const DEMO_TREE_ROOT = Object.freeze({
  id: '-100',
  name: 'Ressources',
  path: 'Ressources',
  children: [
    {
      id: '10',
      name: 'IUT Lannion',
      path: 'Université de Rennes / IUT Lannion',
      children: [
        {
          id: '110',
          name: 'BUT MMI',
          path: 'Université de Rennes / IUT Lannion / BUT MMI',
          children: [
            {
              id: '111',
              name: 'MMI 2',
              path: 'Université de Rennes / IUT Lannion / BUT MMI / MMI 2',
              children: [
                {
                  id: '1111',
                  name: 'TD A',
                  path: 'Université de Rennes / IUT Lannion / BUT MMI / MMI 2 / TD A',
                  children: [
                    {
                      id: '11111',
                      name: 'TP 1',
                      path: 'Université de Rennes / IUT Lannion / BUT MMI / MMI 2 / TD A / TP 1',
                      children: [],
                    },
                    {
                      id: '11112',
                      name: 'TP 2',
                      path: 'Université de Rennes / IUT Lannion / BUT MMI / MMI 2 / TD A / TP 2',
                      children: [],
                    },
                  ],
                },
                {
                  id: '1112',
                  name: 'TD B',
                  path: 'Université de Rennes / IUT Lannion / BUT MMI / MMI 2 / TD B',
                  children: [
                    {
                      id: '11121',
                      name: 'TP 3',
                      path: 'Université de Rennes / IUT Lannion / BUT MMI / MMI 2 / TD B / TP 3',
                      children: [],
                    },
                  ],
                },
              ],
            },
            {
              id: '112',
              name: 'MMI 1',
              path: 'Université de Rennes / IUT Lannion / BUT MMI / MMI 1',
              children: [
                {
                  id: '1121',
                  name: 'TD A',
                  path: 'Université de Rennes / IUT Lannion / BUT MMI / MMI 1 / TD A',
                  children: [
                    {
                      id: '11211',
                      name: 'TP 1',
                      path: 'Université de Rennes / IUT Lannion / BUT MMI / MMI 1 / TD A / TP 1',
                      children: [],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
})

const DEMO_DEFAULT_TREE_PATH = Object.freeze(['-100', '10', '110', '111', '1111', '11111'])

function cloneDemoValue(value) {
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(value)
  }

  return JSON.parse(JSON.stringify(value))
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function createDemoAvatarDataUri(initials = 'CM') {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" role="img" aria-label="Avatar demo"><defs><linearGradient id="demoAvatarGradient" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#f8ffa1"/><stop offset="48%" stop-color="#acf600"/><stop offset="100%" stop-color="#8bd3ff"/></linearGradient></defs><rect width="128" height="128" rx="32" fill="url(#demoAvatarGradient)"/><circle cx="64" cy="50" r="24" fill="#fffaf0" fill-opacity="0.95"/><path d="M27 110c3-20 19-33 37-33s34 13 37 33" fill="#fffaf0" fill-opacity="0.95"/><text x="64" y="116" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="18" font-weight="700" fill="#341200">${escapeHtml(initials)}</text></svg>`
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

export const DEMO_ACCOUNT = Object.freeze({
  preferred_username: DEMO_CREDENTIALS.username,
  given_name: 'Camille',
  family_name: 'Martin',
  email: DEMO_CREDENTIALS.username,
  mail: DEMO_CREDENTIALS.username,
  name: 'Camille Martin',
  picture: createDemoAvatarDataUri('CM'),
})

function normalizeDemoFavoriteIds(value) {
  if (!Array.isArray(value)) {
    return [...DEMO_DEFAULT_FAVORITE_IDS]
  }

  return value
    .map((id) => String(id ?? '').trim())
    .filter((id, index, ids) => id && ids.indexOf(id) === index && DEMO_APPLICATIONS_BY_ID.has(id))
}

export function isDemoCredentials(username, password) {
  return String(username ?? '').trim().toLowerCase() === DEMO_CREDENTIALS.username.toLowerCase()
    && String(password ?? '') === DEMO_CREDENTIALS.password
}

export function createInitialDemoState() {
  return {
    favoritePortletIds: [...DEMO_DEFAULT_FAVORITE_IDS],
  }
}

export function normalizeDemoState(value) {
  return {
    favoritePortletIds: normalizeDemoFavoriteIds(value?.favoritePortletIds),
  }
}

function getDemoApplicationPortlets(ids = []) {
  return ids
    .map((id) => DEMO_APPLICATIONS_BY_ID.get(id))
    .filter(Boolean)
    .map((application) => ({
      _objectType: 'portlet',
      ID: application.id,
      nodeId: application.id,
      chanID: application.id,
      fname: application.fname,
      title: application.title,
      name: application.title,
      description: application.description,
      portletName: 'app-launcher',
      typeID: '2',
      parameters: {
        launchUrl: application.href,
        description: application.description,
        target: application.target,
        stopImmediately: application.target === '_blank' ? 'true' : 'false',
      },
      widgetURL: application.href,
      url: application.href,
      target: application.target,
    }))
}

export function buildDemoLayoutData(demoStateInput) {
  const demoState = normalizeDemoState(demoStateInput)
  const favoritePortlets = getDemoApplicationPortlets(demoState.favoritePortletIds)
  const allPortlets = getDemoApplicationPortlets(DEMO_APPLICATIONS.map((application) => application.id))

  return {
    authenticated: 'true',
    user: DEMO_ACCOUNT.preferred_username,
    layout: {
      globals: {
        hasFavorites: 'true',
      },
      navigation: {
        tabs: [
          {
            ID: 'demo-tab-services',
            name: 'Services',
            content: [
              {
                _objectType: 'folder',
                ID: 'demo-folder-favorites',
                name: 'Favoris',
                content: favoritePortlets,
              },
              {
                _objectType: 'folder',
                ID: 'demo-folder-services',
                name: 'Toutes les applications',
                content: allPortlets,
              },
            ],
          },
        ],
        favorites: favoritePortlets,
      },
      favorites: favoritePortlets,
    },
  }
}

export function buildDemoLayoutDocData() {
  return DEMO_APPLICATIONS.map((application) => ({
    ID: application.id,
    nodeId: application.id,
    fname: application.fname,
    title: application.title,
    name: application.title,
    description: application.description,
    portletName: 'app-launcher',
    typeID: '2',
    parameters: {
      launchUrl: application.href,
      description: application.description,
      target: application.target,
      stopImmediately: application.target === '_blank' ? 'true' : 'false',
    },
    widgetURL: application.href,
    url: application.href,
    target: application.target,
  }))
}

export function buildDemoMarketplaceEntries() {
  return []
}

export function buildDemoPortletFragment(fname) {
  const application = DEMO_APPLICATIONS_BY_FNAME.get(String(fname ?? '').trim())
  if (!application) {
    return null
  }

  return `<div class="demo-portlet-fragment"><a href="${escapeHtml(application.href)}" target="${escapeHtml(application.target)}" rel="noreferrer">${escapeHtml(application.title)}</a></div>`
}

export function buildDemoPortletMetadata(fname) {
  const application = DEMO_APPLICATIONS_BY_FNAME.get(String(fname ?? '').trim())
  if (!application) {
    return null
  }

  return {
    ID: application.id,
    nodeId: application.id,
    fname: application.fname,
    title: application.title,
    name: application.title,
    description: application.description,
    portletName: 'app-launcher',
    typeID: '2',
    parameters: {
      launchUrl: application.href,
      description: application.description,
      target: application.target,
      stopImmediately: application.target === '_blank' ? 'true' : 'false',
    },
    widgetURL: application.href,
    url: application.href,
    target: application.target,
  }
}

function insertAfter(list, targetValue, nextValue) {
  const nextList = [...list]
  const targetIndex = nextList.indexOf(targetValue)

  if (targetIndex !== -1) {
    return nextList
  }

  if (nextValue && nextList.includes(nextValue)) {
    nextList.splice(nextList.indexOf(nextValue), 0, targetValue)
    return nextList
  }

  nextList.push(targetValue)
  return nextList
}

export function applyDemoLayoutMutation(requestPath, demoStateInput) {
  const demoState = normalizeDemoState(demoStateInput)
  const requestUrl = new URL(String(requestPath ?? '/api/layout'), 'https://demo.l-ent.local')

  if (requestUrl.pathname !== '/api/layout') {
    return {
      handled: false,
      demoState,
    }
  }

  const sourceId = String(
    requestUrl.searchParams.get('sourceId')
      || requestUrl.searchParams.get('sourceID')
      || '',
  ).trim()

  if (!DEMO_APPLICATIONS_BY_ID.has(sourceId)) {
    return {
      handled: true,
      demoState,
    }
  }

  const favoritePortletIds = demoState.favoritePortletIds.includes(sourceId)
    ? demoState.favoritePortletIds.filter((id) => id !== sourceId)
    : insertAfter(
      demoState.favoritePortletIds,
      sourceId,
      String(requestUrl.searchParams.get('nextNodeId') || '').trim(),
    )

  return {
    handled: true,
    demoState: normalizeDemoState({ favoritePortletIds }),
    payload: {
      ok: true,
      action: requestUrl.searchParams.get('action') || 'toggleFavorite',
      favoritePortletIds,
    },
  }
}

function findDemoTreeNodeById(node, targetId) {
  if (!node) {
    return null
  }

  if (String(node.id) === String(targetId)) {
    return node
  }

  for (const child of node.children ?? []) {
    const match = findDemoTreeNodeById(child, targetId)
    if (match) {
      return match
    }
  }

  return null
}

function findDemoTreePathIds(node, targetId, currentPath = []) {
  if (!node) {
    return null
  }

  const nextPath = [...currentPath, String(node.id)]
  if (String(node.id) === String(targetId)) {
    return nextPath
  }

  for (const child of node.children ?? []) {
    const match = findDemoTreePathIds(child, targetId, nextPath)
    if (match) {
      return match
    }
  }

  return null
}

function collectDemoTreeNodes(node, collector) {
  if (!node) {
    return
  }

  collector.push(node)

  for (const child of node.children ?? []) {
    collectDemoTreeNodes(child, collector)
  }
}

export function buildDemoAdeTreePayload(requestedResourceId = '') {
  const normalizedRequestedResourceId = String(requestedResourceId ?? '').trim()
  const hasRequestedResource = normalizedRequestedResourceId && findDemoTreeNodeById(DEMO_TREE_ROOT, normalizedRequestedResourceId)
  const focusResourceId = hasRequestedResource ? normalizedRequestedResourceId : DEMO_DEFAULT_TREE_PATH[DEMO_DEFAULT_TREE_PATH.length - 1]
  const currentPathIds = findDemoTreePathIds(DEMO_TREE_ROOT, focusResourceId) ?? [...DEMO_DEFAULT_TREE_PATH]

  return {
    source: 'demo',
    root: cloneDemoValue(DEMO_TREE_ROOT),
    currentResourceId: currentPathIds[currentPathIds.length - 1] ?? null,
    focusResourceId,
    currentPathIds,
  }
}

export function searchDemoAdeTree(query) {
  const normalizedQuery = String(query ?? '').trim().toLowerCase()
  if (!normalizedQuery) {
    return []
  }

  const nodes = []
  collectDemoTreeNodes(DEMO_TREE_ROOT, nodes)

  return nodes
    .filter((node) => {
      const haystack = [node.name, node.path, node.id].join(' | ').toLowerCase()
      return haystack.includes(normalizedQuery) && String(node.id) !== '-100'
    })
    .map((node) => ({
      id: String(node.id),
      name: node.name,
      path: node.path,
      childrenCount: Array.isArray(node.children) ? node.children.length : 0,
    }))
}

function parseDateOnly(dateString) {
  const rawValue = String(dateString ?? '').trim()
  if (!rawValue) {
    return new Date()
  }

  const parts = rawValue.split('-').map((part) => Number.parseInt(part, 10))
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
    return new Date(rawValue)
  }

  return new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0)
}

function formatDateOnly(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function startOfWeek(date) {
  const nextDate = new Date(date)
  nextDate.setHours(0, 0, 0, 0)
  const currentDay = nextDate.getDay()
  const shift = currentDay === 0 ? -6 : 1 - currentDay
  nextDate.setDate(nextDate.getDate() + shift)
  return nextDate
}

function addDays(date, amount) {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + amount)
  return nextDate
}

function makeLocalDateTime(date, hours, minutes) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    hours,
    minutes,
    0,
    0,
  )
}

function getSelectionLabel(selection = null) {
  return selection?.tpLabel
    || selection?.tdLabel
    || selection?.yearLabel
    || 'TP 1'
}

function buildDemoEventsForWeek(anchorDate, selectionLabel) {
  const weekStart = startOfWeek(anchorDate)

  return DEMO_SCHEDULE_TEMPLATES.map((template) => {
    const eventDate = addDays(weekStart, template.dayOffset)
    const start = makeLocalDateTime(eventDate, template.startHour, template.startMinute)
    const end = new Date(start.getTime() + template.durationMinutes * 60 * 1000)

    return {
      id: `${template.key}-${formatDateOnly(start)}`,
      title: template.title,
      teacher: template.teacher,
      location: template.location,
      description: template.title,
      groups: [selectionLabel],
      start: start.toISOString(),
      end: end.toISOString(),
    }
  })
}

function normalizeSelectionFromResource(resourceId = '') {
  const normalizedResourceId = String(resourceId ?? '').trim()
  const currentPathIds = findDemoTreePathIds(DEMO_TREE_ROOT, normalizedResourceId) ?? DEMO_DEFAULT_TREE_PATH
  const selectedNode = findDemoTreeNodeById(DEMO_TREE_ROOT, currentPathIds[currentPathIds.length - 1])

  return {
    resourceId: selectedNode ? String(selectedNode.id) : DEMO_DEFAULT_TREE_PATH[DEMO_DEFAULT_TREE_PATH.length - 1],
    label: selectedNode?.name ?? 'TP 1',
  }
}

function buildWeekLabel(weekStart) {
  const weekEnd = addDays(weekStart, 4)
  return `Semaine du ${formatDateOnly(weekStart)} au ${formatDateOnly(weekEnd)}`
}

export function buildDemoTimetablePayload({ date, resourceId } = {}) {
  const anchorDate = parseDateOnly(date || formatDateOnly(new Date()))
  const resolvedSelection = normalizeSelectionFromResource(resourceId)
  const weekStart = startOfWeek(anchorDate)
  const events = buildDemoEventsForWeek(anchorDate, resolvedSelection.label)

  return {
    source: 'demo',
    date: formatDateOnly(anchorDate),
    resourceId: resolvedSelection.resourceId,
    weekLabel: buildWeekLabel(weekStart),
    resolvedWeek: {
      label: buildWeekLabel(weekStart),
      start: formatDateOnly(weekStart),
      end: formatDateOnly(addDays(weekStart, 6)),
      current: formatDateOnly(startOfWeek(new Date())) === formatDateOnly(weekStart),
    },
    outOfRange: false,
    dayLabels: Array.from({ length: 5 }, (_, index) => formatDateOnly(addDays(weekStart, index))),
    events,
  }
}

export function buildDemoPlanningPayload({ date, resourceId } = {}) {
  const timetable = buildDemoTimetablePayload({ date, resourceId })
  return {
    events: timetable.events,
    weekLabel: timetable.weekLabel,
    dayLabels: timetable.dayLabels,
    resolvedWeek: timetable.resolvedWeek,
    outOfRange: timetable.outOfRange,
  }
}

export function buildDemoCalendarPayload({ date, resourceId } = {}) {
  const anchorDate = parseDateOnly(date || formatDateOnly(new Date()))
  const weekStart = startOfWeek(anchorDate)
  const resolvedSelection = normalizeSelectionFromResource(resourceId)
  const weeks = Array.from({ length: 6 }, (_, index) => {
    const currentWeekStart = addDays(weekStart, index * 7)
    const currentWeekEnd = addDays(currentWeekStart, 6)

    return {
      index,
      label: buildWeekLabel(currentWeekStart),
      start: formatDateOnly(currentWeekStart),
      end: formatDateOnly(currentWeekEnd),
      current: index === 0,
    }
  })

  return {
    source: 'demo',
    resourceId: resolvedSelection.resourceId,
    currentResourceId: resolvedSelection.resourceId,
    requestedResourceId: String(resourceId ?? '').trim() || resolvedSelection.resourceId,
    targetDate: formatDateOnly(anchorDate),
    targetDateMatched: true,
    outOfRange: false,
    matchedWeek: weeks[0],
    currentWeek: weeks[0],
    firstWeek: weeks[0],
    lastWeek: weeks[weeks.length - 1],
    weekCount: weeks.length,
    weeks,
  }
}

export function buildDemoUpcomingPayload({ date, lookaheadDays = 14, selection = null } = {}) {
  const requestedDate = parseDateOnly(date || formatDateOnly(new Date()))
  const selectionLabel = getSelectionLabel(selection)
  const upcomingEvents = [
    ...buildDemoEventsForWeek(requestedDate, selectionLabel),
    ...buildDemoEventsForWeek(addDays(requestedDate, 7), selectionLabel),
  ]
    .filter((event) => {
      const eventStart = new Date(event.start)
      const maxDate = addDays(requestedDate, lookaheadDays)
      return eventStart >= requestedDate && eventStart <= maxDate
    })
    .sort((left, right) => left.start.localeCompare(right.start))

  return {
    source: 'demo',
    date: formatDateOnly(requestedDate),
    lookaheadDays,
    complete: true,
    resourceIds: [
      selection?.tpResourceId,
      selection?.tdResourceId,
      selection?.yearResourceId,
      selection?.resourceId,
    ].filter(Boolean).map((value) => String(value)),
    selectionLabels: [selectionLabel],
    events: upcomingEvents,
    nextEvent: upcomingEvents[0] ?? null,
  }
}

export function buildDemoAlertsPayload() {
  return [
    {
      level: 'info',
      title: 'Mode démo',
      message: 'Certaines applications ouvrent des pages publiques pour illustrer le parcours.',
    },
  ]
}

export function buildDemoGradesPayload() {
  const currentReleve = {
    ressources: {
      R5_07: {
        titre: 'UX Writing',
        moyenne: {
          value: '15.6',
          max: '20',
          coef: '2',
          moy: '13.4',
        },
        evaluations: [
          {
            date: '2026-03-12',
            description: 'Atelier persona',
            coef: '1',
            note: {
              value: '14',
              max: '20',
              moy: '12.6',
            },
          },
          {
            date: '2026-03-21',
            description: 'Audit éditorial',
            coef: '1',
            note: {
              value: '17',
              max: '20',
              moy: '13.9',
            },
          },
        ],
      },
      R5_11: {
        titre: 'Développement Front',
        moyenne: {
          value: '16.1',
          max: '20',
          coef: '3',
          moy: '12.8',
        },
        evaluations: [
          {
            date: '2026-03-19',
            description: 'Composants React',
            coef: '2',
            note: {
              value: '16',
              max: '20',
              moy: '12.5',
            },
          },
          {
            date: '2026-03-26',
            description: 'Accessibilité UI',
            coef: '1',
            note: {
              value: '18',
              max: '20',
              moy: '13.2',
            },
          },
        ],
      },
    },
    saes: {
      SAE5_PROTO: {
        titre: 'Prototype interactif',
        moyenne: {
          value: '14.9',
          max: '20',
          coef: '4',
          moy: '12.2',
        },
        evaluations: [
          {
            date: '2026-03-28',
            description: 'Sprint review',
            coef: '2',
            note: {
              value: '15.5',
              max: '20',
              moy: '12.7',
            },
          },
        ],
      },
    },
  }

  return {
    'relevé': currentReleve,
    semestres: [
      {
        libelle: 'Semestre 4',
        'relevé': currentReleve,
      },
      {
        libelle: 'Semestre 5',
        'relevé': currentReleve,
      },
    ],
  }
}
