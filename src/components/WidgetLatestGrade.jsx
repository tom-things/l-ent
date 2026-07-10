import { Icon } from '@iconify/react'
import {
  DEMO_LATEST_GRADE,
  GRADES_DISABLED_PILL_LABEL,
  GRADES_UNAVAILABLE_DETAIL,
  GRADES_UNAVAILABLE_MESSAGE,
  GRADES_UNAVAILABLE_TITLE,
  positionGradeTooltipFromElement,
  positionGradeTooltipFromPointer,
} from '../gradeFeatureState'

function WidgetLatestGrade({ visible = false }) {
  const grade = DEMO_LATEST_GRADE
  const noteDisplay = String(parseFloat(grade.note))
  const noteMax = String(Math.round(parseFloat(grade.noteSur)))

  return (
    <article
      className={`latest-grade-widget grade-feature-disabled widget-card shadow-md flex-[0_1_280px] h-[148px] p-5 border rounded-[1.75rem] overflow-hidden text-base leading-6 min-w-0 max-2xl:flex-[1_1_calc(50%-7px)] max-2xl:min-w-0 max-md:h-[132px] max-md:p-4 max-md:rounded-3xl relative ${visible ? 'widget-card-visible delay-[280ms]' : ''}`}
      aria-label={`Dernière note indisponible: ${GRADES_UNAVAILABLE_MESSAGE}`}
      aria-disabled="true"
      tabIndex={0}
      onFocus={positionGradeTooltipFromElement}
      onPointerMove={positionGradeTooltipFromPointer}
    >
      <div className="grade-disabled-content flex h-full flex-col gap-[6px]">
        <div className="flex items-center gap-[5px] min-w-0">
          <Icon icon="carbon:chart-pie" className="w-[17px] h-[17px] shrink-0" aria-hidden="true" />
          <span className="m-0 min-w-0 leading-[1.06] text-base font-medium overflow-hidden text-ellipsis whitespace-nowrap max-md:text-[15px]">Dernière note</span>
        </div>

        <div className="flex-1 flex flex-col gap-[5px] justify-end">
          <div className="flex items-start gap-[5px] max-md:items-end">
            <div
              className="w-[6px] h-[39px] rounded-[25px] shrink-0 relative overflow-hidden max-md:h-[34px]"
              aria-hidden="true"
            >
              <div className="absolute inset-0 rounded-[25px] bg-black dark:bg-white" />
            </div>
            <div className="flex items-end gap-[3px] leading-[1.06]">
              <span className="text-[37px] font-bold leading-none whitespace-nowrap max-md:text-[32px]">{noteDisplay}</span>
              <span className="text-[19px] font-medium leading-[1.06] whitespace-nowrap pb-[3px] max-md:text-[17px]">/{noteMax}</span>
            </div>
          </div>
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

export default WidgetLatestGrade
