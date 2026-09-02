import { useEffect, useRef, useState } from 'react'
import { Icon } from '@iconify/react'
import { GRADES_LAUNCH_HREF, getLatestGrade, openGradesService } from '../entApi'
import {
  DEMO_LATEST_GRADE,
  GRADES_DISABLED_PILL_LABEL,
  GRADES_FEATURE_DISABLED,
  GRADES_UNAVAILABLE_DETAIL,
  GRADES_UNAVAILABLE_MESSAGE,
  GRADES_UNAVAILABLE_TITLE,
  positionGradeTooltipFromElement,
  positionGradeTooltipFromPointer,
} from '../gradeFeatureState'

const CARD_CLASSES = 'latest-grade-widget widget-card shadow-md flex-[0_1_280px] h-[148px] p-5 border rounded-[1.75rem] overflow-hidden text-base leading-6 min-w-0 max-2xl:flex-[1_1_calc(50%-7px)] max-2xl:min-w-0 max-md:h-[132px] max-md:p-4 max-md:rounded-3xl relative'
const GRADE_COLORS_KEY = 'l-ent:grade-colors'
const DEFAULT_ACCENT_COLOR = '#0073d1'

// One stable random hue per resource code, remembered per browser so the
// accent bar keeps the same colour between visits.
function getGradeColor(resource) {
  try {
    const stored = JSON.parse(localStorage.getItem(GRADE_COLORS_KEY) || '{}')
    if (stored[resource]) return stored[resource]
    const hue = Math.floor(Math.random() * 360)
    const color = `hsl(${hue}, 60%, 42%)`
    stored[resource] = color
    localStorage.setItem(GRADE_COLORS_KEY, JSON.stringify(stored))
    return color
  } catch {
    return DEFAULT_ACCENT_COLOR
  }
}

function LatestGradeHeader() {
  return (
    <div className="flex items-center gap-[5px] min-w-0">
      <Icon icon="carbon:chart-pie" className="w-[17px] h-[17px] shrink-0" aria-hidden="true" />
      <span className="m-0 min-w-0 leading-[1.06] text-base font-medium overflow-hidden text-ellipsis whitespace-nowrap max-md:text-[15px]">Dernière note</span>
    </div>
  )
}

function LatestGradeValue({ noteDisplay, noteMax, accentColor = null }) {
  return (
    <div className="flex items-start gap-[5px] max-md:items-end">
      <div
        className="w-[6px] h-[39px] rounded-[25px] shrink-0 relative overflow-hidden max-md:h-[34px]"
        style={accentColor ? { background: accentColor } : undefined}
        aria-hidden="true"
      >
        {accentColor ? (
          <div className="absolute inset-0 rounded-[25px]" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.5) 0%, transparent 70%)' }} />
        ) : (
          <div className="absolute inset-0 rounded-[25px] bg-black dark:bg-white" />
        )}
      </div>
      <div className="flex items-end gap-[3px] leading-[1.06]">
        <span className="text-[37px] font-bold leading-none whitespace-nowrap max-md:text-[32px]">{noteDisplay}</span>
        <span className="text-[19px] font-medium leading-[1.06] whitespace-nowrap pb-[3px] max-md:text-[17px]">/{noteMax}</span>
      </div>
    </div>
  )
}

// features.grades === 'disabled': demo grade, blurred, behind an
// "unavailable" pill. No data is fetched.
function DisabledWidgetLatestGrade({ visible }) {
  const grade = DEMO_LATEST_GRADE
  const noteDisplay = String(parseFloat(grade.note))
  const noteMax = String(Math.round(parseFloat(grade.noteSur)))

  return (
    <article
      className={`${CARD_CLASSES} grade-feature-disabled ${visible ? 'widget-card-visible delay-[280ms]' : ''}`}
      aria-label={`Dernière note indisponible: ${GRADES_UNAVAILABLE_MESSAGE}`}
      aria-disabled="true"
      tabIndex={0}
      onFocus={positionGradeTooltipFromElement}
      onPointerMove={positionGradeTooltipFromPointer}
    >
      <div className="grade-disabled-content flex h-full flex-col gap-[6px]">
        <LatestGradeHeader />
        <div className="flex-1 flex flex-col gap-[5px] justify-end">
          <LatestGradeValue noteDisplay={noteDisplay} noteMax={noteMax} />
          <div className="flex items-end justify-between gap-2 min-w-0">
            <span className="m-0 leading-[1.06] text-base font-medium min-w-0 overflow-hidden text-ellipsis whitespace-nowrap max-md:text-[15px]">{grade.description}</span>
            <span className="m-0 leading-[1.06] text-base font-medium opacity-60 shrink-0 max-w-[34%] overflow-hidden text-ellipsis whitespace-nowrap text-right max-md:text-[15px]">{grade.resource}</span>
          </div>
        </div>
      </div>
      <span className="grade-disabled-pill" aria-hidden="true">{GRADES_DISABLED_PILL_LABEL}</span>
      <span className="grade-disabled-hover-note" role="tooltip">
        <span className="grade-disabled-hover-title">{GRADES_UNAVAILABLE_TITLE}</span>
        <span className="grade-disabled-hover-detail">{GRADES_UNAVAILABLE_DETAIL}</span>
      </span>
    </article>
  )
}

// features.grades === true: latest ScoDoc evaluation, click-through to the
// grade service. Renders nothing until data is available (or on error).
function LiveWidgetLatestGrade({ visible }) {
  const [grade, setGrade] = useState(null)
  const [isReady, setIsReady] = useState(false)
  const [wide, setWide] = useState(false)
  const titleRef = useRef(null)

  useEffect(() => {
    let mounted = true
    getLatestGrade()
      .then((data) => {
        if (mounted && data && !data.error) {
          setGrade(data)
        }
      })
      .catch(() => {})
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    if (!grade || isReady) return undefined
    const frameId = window.requestAnimationFrame(() => {
      const el = titleRef.current
      setWide(Boolean(el && el.scrollWidth > el.clientWidth))

      if (visible) {
        // Grade arrived late (visible is already true) — wait one frame
        // so the element renders hidden first, then animate in.
        setIsReady(true)
      }
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [grade, visible, isReady])

  if (!grade) {
    return null
  }

  const accentColor = grade.resource ? getGradeColor(grade.resource) : DEFAULT_ACCENT_COLOR
  const noteDisplay = grade.note ? String(parseFloat(grade.note)) : '—'
  const noteMax = grade.noteSur ? String(Math.round(parseFloat(grade.noteSur))) : '20'
  const canOpen = Boolean(GRADES_LAUNCH_HREF)
  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openGradesService()
    }
  }

  return (
    <article
      className={`${CARD_CLASSES} border-white bg-widget-bg flex flex-col gap-[6px] text-text ${canOpen ? 'cursor-pointer' : ''} ${wide ? '2xl:flex-[0_1_360px]' : ''} ${isReady ? 'widget-card-visible' : ''}`}
      aria-label={`Dernière note: ${noteDisplay} sur ${noteMax}${grade.description ? ` (${grade.description})` : ''}`}
      role={canOpen ? 'link' : undefined}
      tabIndex={canOpen ? 0 : undefined}
      onClick={canOpen ? openGradesService : undefined}
      onKeyDown={canOpen ? handleKeyDown : undefined}
    >
      {canOpen ? (
        <Icon icon="carbon:arrow-up-right" className="grade-corner-arrow absolute top-[14px] right-[14px] w-[14px] h-[14px] text-text opacity-0 transition-opacity duration-150 ease-in-out shrink-0" aria-hidden="true" />
      ) : null}
      <LatestGradeHeader />
      <div className="flex-1 flex flex-col gap-[5px] justify-end">
        <LatestGradeValue noteDisplay={noteDisplay} noteMax={noteMax} accentColor={accentColor} />
        <div className="flex items-end justify-between gap-2 min-w-0">
          <span ref={titleRef} className="m-0 leading-[1.06] text-base font-medium min-w-0 overflow-hidden text-ellipsis whitespace-nowrap max-md:text-[15px]" title={grade.description}>{grade.description}</span>
          <span className="m-0 leading-[1.06] text-base font-medium opacity-60 shrink-0 max-w-[34%] overflow-hidden text-ellipsis whitespace-nowrap text-right max-md:text-[15px]" title={grade.resource}>{grade.resource}</span>
        </div>
      </div>
    </article>
  )
}

function WidgetLatestGrade({ visible = false }) {
  if (GRADES_FEATURE_DISABLED) {
    return <DisabledWidgetLatestGrade visible={visible} />
  }

  return <LiveWidgetLatestGrade visible={visible} />
}

export default WidgetLatestGrade
