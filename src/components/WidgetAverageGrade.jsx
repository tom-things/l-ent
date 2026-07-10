import { Icon } from '@iconify/react'
import waveGlowLight from '../assets/wave-glow-light.png'
import waveGlowDark from '../assets/wave-glow-dark.png'
import {
  DEMO_AVERAGE_GRADE,
  GRADES_DISABLED_PILL_LABEL,
  GRADES_UNAVAILABLE_DETAIL,
  GRADES_UNAVAILABLE_MESSAGE,
  GRADES_UNAVAILABLE_TITLE,
  positionGradeTooltipFromElement,
  positionGradeTooltipFromPointer,
} from '../gradeFeatureState'

function WidgetAverageGrade({ visible = false }) {
  const avgDisplay = String(parseFloat(DEMO_AVERAGE_GRADE.average))
  const promoDisplay = String(parseFloat(DEMO_AVERAGE_GRADE.promoAverage))

  return (
    <article
      className={`average-grade-widget grade-feature-disabled widget-card shadow-md flex-[0_1_220px] h-[148px] p-5 border rounded-[1.75rem] overflow-hidden text-base leading-6 min-w-0 max-2xl:flex-[1_1_calc(50%-7px)] max-2xl:min-w-0 max-md:h-[132px] max-md:p-4 max-md:rounded-3xl relative ${visible ? 'widget-card-visible delay-[280ms]' : ''}`}
      aria-label={`Moyenne générale indisponible: ${GRADES_UNAVAILABLE_MESSAGE}`}
      aria-disabled="true"
      tabIndex={0}
      onFocus={positionGradeTooltipFromElement}
      onPointerMove={positionGradeTooltipFromPointer}
    >
      <div className="grade-disabled-content flex h-full flex-col gap-[6px]">
        <div className="flex items-center gap-[5px] min-w-0">
          <Icon icon="carbon:chart-average" className="w-[17px] h-[17px] shrink-0" aria-hidden="true" />
          <span className="m-0 min-w-0 leading-[1.06] text-base font-medium overflow-hidden text-ellipsis whitespace-nowrap max-md:text-[15px]">Moyenne Générale</span>
        </div>

        <div className="average-grade-waves absolute bottom-0 left-0 right-0 h-[60px] pointer-events-none" aria-hidden="true">
          <img src={waveGlowLight} alt="" className="absolute bottom-0 left-0 w-full h-full object-fill dark:hidden" />
          <img src={waveGlowDark} alt="" className="absolute bottom-0 left-0 w-full h-full object-fill hidden dark:block" />
        </div>

        <div className="flex-1 flex flex-col items-center justify-center relative z-10">
          <span className="text-[37px] font-bold leading-none tracking-[0.01em] max-md:text-[32px]">{avgDisplay}</span>
          <span className="text-base font-medium leading-[1.06] opacity-60 dark:opacity-80 whitespace-nowrap max-md:text-[15px]">
            Moy. Promo : {promoDisplay}
          </span>
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

export default WidgetAverageGrade
