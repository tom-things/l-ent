export const ESTABLISHMENT_KEY = 'l-ent:establishment'
export const STUDENT_TP_KEY = 'l-ent:student-tp'
const STUDENT_TP_SELECTION_VERSION = 2

function readStoredValue(key) {
  try {
    const rawValue = localStorage.getItem(key)
    if (!rawValue) {
      return null
    }

    try {
      return JSON.parse(rawValue)
    } catch {
      return rawValue
    }
  } catch {
    return null
  }
}

function readScopedStorageValue(key, userId) {
  const storedValue = readStoredValue(key)

  if (!storedValue) {
    return null
  }

  if (typeof storedValue === 'string') {
    return userId ? null : storedValue
  }

  if (typeof storedValue !== 'object' || storedValue === null) {
    return null
  }

  if ('value' in storedValue) {
    if (userId && storedValue.user && storedValue.user !== userId) {
      return null
    }
    return storedValue.value
  }

  if (userId && storedValue.user && storedValue.user !== userId) {
    return null
  }

  return storedValue
}

export function getStoredEstablishment(userId = null) {
  const storedValue = readScopedStorageValue(ESTABLISHMENT_KEY, userId)
  return typeof storedValue === 'string' && storedValue.trim() ? storedValue : null
}

export function persistEstablishment(establishmentId, userId = null) {
  try {
    localStorage.setItem(ESTABLISHMENT_KEY, JSON.stringify({
      user: userId || null,
      value: establishmentId,
    }))
  } catch {
    // Storage unavailable
  }
}

function normalizeTpSelection(selection, { requireVersion = false } = {}) {
  if (!selection || typeof selection !== 'object') {
    return null
  }

  if (requireVersion && Number(selection.selectionVersion ?? 0) < STUDENT_TP_SELECTION_VERSION) {
    return null
  }

  const resourceId = String(selection.resourceId ?? '').trim()
  const label = String(selection.label ?? '').trim()

  if (!resourceId || !label) {
    return null
  }

  return {
    resourceId,
    label,
    parentResourceId: selection.parentResourceId == null ? null : String(selection.parentResourceId),
    parentLabel: selection.parentLabel ? String(selection.parentLabel) : null,
    contextLabel: selection.contextLabel ? String(selection.contextLabel) : null,
    programResourceId: selection.programResourceId == null ? null : String(selection.programResourceId),
    programLabel: selection.programLabel ? String(selection.programLabel) : null,
    yearResourceId: selection.yearResourceId == null ? null : String(selection.yearResourceId),
    yearLabel: selection.yearLabel ? String(selection.yearLabel) : null,
    tdResourceId: selection.tdResourceId == null ? null : String(selection.tdResourceId),
    tdLabel: selection.tdLabel ? String(selection.tdLabel) : null,
    tpResourceId: selection.tpResourceId == null ? null : String(selection.tpResourceId),
    tpLabel: selection.tpLabel ? String(selection.tpLabel) : null,
  }
}

export function getStoredTpSelection(userId = null) {
  return normalizeTpSelection(readScopedStorageValue(STUDENT_TP_KEY, userId), { requireVersion: true })
}

export function persistTpSelection(selection, userId = null) {
  const normalizedSelection = normalizeTpSelection(selection)
  if (!normalizedSelection) {
    return
  }

  try {
    localStorage.setItem(STUDENT_TP_KEY, JSON.stringify({
      user: userId || null,
      selectionVersion: STUDENT_TP_SELECTION_VERSION,
      ...normalizedSelection,
    }))
  } catch {
    // Storage unavailable
  }
}

export function clearStoredTpSelection() {
  try {
    localStorage.removeItem(STUDENT_TP_KEY)
  } catch {
    // Storage unavailable
  }
}
