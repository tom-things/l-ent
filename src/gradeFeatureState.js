import universityConfig from '@university'

const gradesCopy = universityConfig.grades ?? {}

export const GRADES_UNAVAILABLE_TITLE = gradesCopy.unavailableTitle ?? 'Notes indisponibles'
export const GRADES_UNAVAILABLE_DETAIL = gradesCopy.unavailableDetail ?? ''
export const GRADES_UNAVAILABLE_MESSAGE = `${GRADES_UNAVAILABLE_TITLE}. ${GRADES_UNAVAILABLE_DETAIL}`
export const GRADES_DISABLED_PILL_LABEL = gradesCopy.disabledPillLabel ?? 'Notes indisponibles'

export const DEMO_AVERAGE_GRADE = {
  average: '13.7',
  promoAverage: '12.4',
}

export const DEMO_LATEST_GRADE = {
  description: 'Projet démo',
  note: '15.5',
  noteSur: '20',
  resource: 'SAE',
}

function getTooltipWidth() {
  if (typeof window === 'undefined') {
    return 320
  }

  return Math.min(320, Math.max(0, window.innerWidth - 32))
}

function clampTooltipX(clientX, rect) {
  if (typeof window === 'undefined') {
    return clientX - rect.left
  }

  const tooltipWidth = getTooltipWidth()
  const minX = 16 + tooltipWidth / 2 - rect.left
  const maxX = window.innerWidth - 16 - tooltipWidth / 2 - rect.left
  const relativeX = clientX - rect.left

  return Math.min(Math.max(relativeX, minX), Math.max(minX, maxX))
}

export function positionGradeTooltipFromPointer(event) {
  const rect = event.currentTarget.getBoundingClientRect()

  event.currentTarget.style.setProperty('--grade-tooltip-x', `${clampTooltipX(event.clientX, rect)}px`)
  event.currentTarget.style.setProperty('--grade-tooltip-y', `${event.clientY - rect.top}px`)
}

export function positionGradeTooltipFromElement(event) {
  const rect = event.currentTarget.getBoundingClientRect()
  const clientX = rect.left + rect.width / 2

  event.currentTarget.style.setProperty('--grade-tooltip-x', `${clampTooltipX(clientX, rect)}px`)
  event.currentTarget.style.setProperty('--grade-tooltip-y', `${rect.height / 2}px`)
}
