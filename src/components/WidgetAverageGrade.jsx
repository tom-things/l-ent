import { useEffect, useState } from 'react'
import { Icon } from '@iconify/react'
import waveGlowLight from '../assets/wave-glow-light.png'
import waveGlowDark from '../assets/wave-glow-dark.png'
import { GRADES_LAUNCH_HREF, getAverageGrade, openGradesService } from '../entApi'
import {
  DEMO_AVERAGE_GRADE,
  GRADES_DISABLED_PILL_LABEL,
  GRADES_FEATURE_DISABLED,
  GRADES_UNAVAILABLE_DETAIL,
  GRADES_UNAVAILABLE_MESSAGE,
  GRADES_UNAVAILABLE_TITLE,
  positionGradeTooltipFromElement,
  positionGradeTooltipFromPointer,
} from '../gradeFeatureState'

const CARD_CLASSES = 'average-grade-widget widget-card shadow-md flex-[0_1_220px] h-[148px] p-5 border rounded-[1.75rem] overflow-hidden text-base leading-6 min-w-0 max-2xl:flex-[1_1_calc(50%-7px)] max-2xl:min-w-0 max-md:h-[132px] max-md:p-4 max-md:rounded-3xl relative'

function AverageGradeHeader() {
  return (
    <div className="flex items-center gap-[5px] min-w-0">
      <Icon icon="carbon:chart-average" className="w-[17px] h-[17px] shrink-0" aria-hidden="true" />
      <span className="m-0 min-w-0 leading-[1.06] text-base font-medium overflow-hidden text-ellipsis whitespace-nowrap max-md:text-[15px]">Moyenne Générale</span>
    </div>
  )
}

function AverageGradeWaves() {
  return (
    <div className="average-grade-waves absolute bottom-0 left-0 right-0 h-[60px] pointer-events-none" aria-hidden="true">
      <img src={waveGlowLight} alt="" className="absolute bottom-0 left-0 w-full h-full object-fill dark:hidden" />
      <img src={waveGlowDark} alt="" className="absolute bottom-0 left-0 w-full h-full object-fill hidden dark:block" />
    </div>
  )
}

function AverageGradeValues({ avgDisplay, promoDisplay }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center relative z-10">
      <span className="text-[37px] font-bold leading-none tracking-[0.01em] max-md:text-[32px]">{avgDisplay}</span>
      {promoDisplay ? (
        <span className="text-base font-medium leading-[1.06] opacity-60 dark:opacity-80 whitespace-nowrap max-md:text-[15px]">
          Moy. Promo : {promoDisplay}
        </span>
      ) : null}
    </div>
  )
}

// features.grades === 'disabled': demo numbers, blurred, behind an
// "unavailable" pill. No data is fetched.
function DisabledWidgetAverageGrade({ visible }) {
  const avgDisplay = String(parseFloat(DEMO_AVERAGE_GRADE.average))
  const promoDisplay = String(parseFloat(DEMO_AVERAGE_GRADE.promoAverage))

  return (
    <article
      className={`${CARD_CLASSES} grade-feature-disabled ${visible ? 'widget-card-visible delay-[280ms]' : ''}`}
      aria-label={`Moyenne générale indisponible: ${GRADES_UNAVAILABLE_MESSAGE}`}
      aria-disabled="true"
      tabIndex={0}
      onFocus={positionGradeTooltipFromElement}
      onPointerMove={positionGradeTooltipFromPointer}
    >
      <div className="grade-disabled-content flex h-full flex-col gap-[6px]">
        <AverageGradeHeader />
        <AverageGradeWaves />
        <AverageGradeValues avgDisplay={avgDisplay} promoDisplay={promoDisplay} />
      </div>
      <span className="grade-disabled-pill" aria-hidden="true">{GRADES_DISABLED_PILL_LABEL}</span>
      <span className="grade-disabled-hover-note" role="tooltip">
        <span className="grade-disabled-hover-title">{GRADES_UNAVAILABLE_TITLE}</span>
        <span className="grade-disabled-hover-detail">{GRADES_UNAVAILABLE_DETAIL}</span>
      </span>
    </article>
  )
}

// features.grades === true: live ScoDoc average, click-through to the grade
// service. Renders nothing until data is available (or on error).
function LiveWidgetAverageGrade({ visible }) {
  const [data, setData] = useState(null)

  useEffect(() => {
    let mounted = true
    getAverageGrade()
      .then((result) => {
        if (mounted && result && !result.error) {
          setData(result)
        }
      })
      .catch(() => {})
    return () => { mounted = false }
  }, [])

  if (!data || (data.average == null && data.promoAverage == null)) {
    return null
  }

  const avgDisplay = data.average != null ? String(parseFloat(data.average)) : '—'
  const promoDisplay = data.promoAverage != null ? String(parseFloat(data.promoAverage)) : null
  const canOpen = Boolean(GRADES_LAUNCH_HREF)
  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openGradesService()
    }
  }

  return (
    <article
      className={`${CARD_CLASSES} border-white bg-widget-bg flex flex-col gap-[6px] text-text ${canOpen ? 'cursor-pointer' : ''} ${visible ? 'widget-card-visible delay-[280ms]' : ''}`}
      aria-label={`Moyenne générale: ${avgDisplay} sur 20${promoDisplay ? ` (promo: ${promoDisplay})` : ''}`}
      role={canOpen ? 'link' : undefined}
      tabIndex={canOpen ? 0 : undefined}
      onClick={canOpen ? openGradesService : undefined}
      onKeyDown={canOpen ? handleKeyDown : undefined}
    >
      {canOpen ? (
        <Icon icon="carbon:arrow-up-right" className="grade-corner-arrow absolute top-[14px] right-[14px] w-[14px] h-[14px] text-text opacity-0 transition-opacity duration-150 ease-in-out shrink-0" aria-hidden="true" />
      ) : null}
      <AverageGradeHeader />
      <AverageGradeWaves />
      <AverageGradeValues avgDisplay={avgDisplay} promoDisplay={promoDisplay} />
    </article>
  )
}

function WidgetAverageGrade({ visible = false }) {
  if (GRADES_FEATURE_DISABLED) {
    return <DisabledWidgetAverageGrade visible={visible} />
  }

  return <LiveWidgetAverageGrade visible={visible} />
}

export default WidgetAverageGrade
