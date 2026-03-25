import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '@iconify/react'
import { ENT_AUTH_PREFIX, getLatestGrade } from '../entApi'

const NOTES9_DOAUTH = 'https://notes9.iutlan.univ-rennes1.fr/services/doAuth.php?href=https://notes9.iutlan.univ-rennes1.fr/'
const NOTES9_HREF = `${ENT_AUTH_PREFIX}/launch?url=${encodeURIComponent(NOTES9_DOAUTH)}`

const GRADE_COLORS_KEY = 'l-ent:grade-colors'

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
    return '#0073d1'
  }
}

function WidgetLatestGrade({ visible = false }) {
  const [grade, setGrade] = useState(null)
  const [isReady, setIsReady] = useState(false)
  const [wide, setWide] = useState(false)
  const titleRef = useRef(null)
  const visibleRef = useRef(visible)
  visibleRef.current = visible

  useEffect(() => {
    let mounted = true
    getLatestGrade()
      .then((data) => {
        if (!mounted) return
        if (data && !data.error) {
          setGrade(data)
        }
      })
      .catch(() => {})
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    if (!grade || isReady) return
    const el = titleRef.current
    if (el && el.scrollWidth > el.clientWidth) {
      setWide(true)
    }
    if (visible) {
      // Grade arrived late (visible is already true) — wait one frame
      // so the element renders hidden first, then animate in.
      window.requestAnimationFrame(() => setIsReady(true))
    }
  }, [grade, visible, isReady])

  const accentColor = useMemo(() => grade?.resource ? getGradeColor(grade.resource) : '#0073d1', [grade?.resource])
  const noteDisplay = grade?.note ? String(parseFloat(grade.note)) : '—'
  const noteMax = grade?.noteSur ? String(Math.round(parseFloat(grade.noteSur))) : '20'

  if (!grade) return null

  return (
    <article
      className={`latest-grade-widget widget-card shadow-md flex-[0_1_280px] min-h-[120px] p-5 border border-white rounded-[1.75rem] overflow-hidden bg-widget-bg text-base leading-6 min-w-0 max-2xl:flex-[1_1_calc(50%-7px)] max-2xl:min-w-[min(280px,100%)] max-md:min-h-[108px] max-md:p-4 max-md:rounded-3xl max-xs:flex-[1_1_100%] max-xs:min-w-0 flex flex-col gap-[3px] text-text cursor-pointer relative ${wide ? 'flex-[0_1_360px]' : ''} ${isReady ? 'widget-card-visible' : ''}`}
      aria-label="Dernière note"
      onClick={() => window.open(NOTES9_HREF, '_blank', 'noopener,noreferrer')}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') window.open(NOTES9_HREF, '_blank', 'noopener,noreferrer') }}
    >
      <Icon icon="carbon:arrow-up-right" className="grade-corner-arrow absolute top-[14px] right-[14px] w-[14px] h-[14px] text-text opacity-0 transition-opacity duration-150 ease-in-out shrink-0" aria-hidden="true" />
      <div className="flex items-center gap-[5px]">
        <Icon icon="carbon:chart-pie" className="w-[17px] h-[17px] shrink-0 text-text" aria-hidden="true" />
        <span className="m-0 leading-[1.06] text-base font-medium max-md:text-[15px]">Dernière note</span>
      </div>

      <div className="flex-1 flex flex-col gap-[5px] justify-end">
        <div className="flex items-start gap-[5px]">
          <div
            className="w-[6px] h-[39px] rounded-[25px] shrink-0 relative overflow-hidden"
            style={{ background: accentColor }}
            aria-hidden="true"
          >
            <div className="absolute inset-0 rounded-[25px]" style={{ background: `linear-gradient(180deg, rgba(255,255,255,0.5) 0%, transparent 70%)` }} />
          </div>
          <div className="flex items-end gap-[3px] leading-[1.06]">
            <span className="text-[37px] font-bold leading-none whitespace-nowrap max-md:text-[32px]">{noteDisplay}</span>
            <span className="text-[19px] font-medium leading-[1.06] whitespace-nowrap pb-[3px] max-md:text-[17px]">/{noteMax}</span>
          </div>
        </div>
        <div className="flex items-end justify-between gap-2 min-w-0">
          <span ref={titleRef} className="m-0 leading-[1.06] text-base font-medium min-w-0 overflow-hidden text-ellipsis whitespace-nowrap max-md:text-[15px]">{grade.description}</span>
          <span className="m-0 leading-[1.06] text-base font-medium opacity-60 shrink-0 max-md:text-[15px]">{grade.resource}</span>
        </div>
      </div>
    </article>
  )
}

export default WidgetLatestGrade
