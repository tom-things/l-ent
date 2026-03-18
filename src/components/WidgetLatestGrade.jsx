import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '@iconify/react'
import { ENT_AUTH_PREFIX, getLatestGrade } from '../entApi'
import './WidgetLatestGrade.css'

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
          // Only use the rAF trick if the parent already revealed widgets —
          // the grade arrived late (async). If visible is still false, the
          // visible prop itself will drive the animation once it flips to true.
          if (visibleRef.current) {
            window.requestAnimationFrame(() => {
              if (mounted) setIsReady(true)
            })
          }
        }
      })
      .catch(() => {})
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    if (!grade) return
    const el = titleRef.current
    if (el && el.scrollWidth > el.clientWidth) {
      setWide(true)
    }
  }, [grade])

  const accentColor = useMemo(() => grade?.resource ? getGradeColor(grade.resource) : '#0073d1', [grade?.resource])
  const noteDisplay = grade?.note ? String(parseFloat(grade.note)) : '—'
  const noteMax = grade?.noteSur ? String(Math.round(parseFloat(grade.noteSur))) : '20'

  if (!grade) return null

  return (
    <article
      className={`widget-card latest-grade-widget widget-card--delay-3 ${wide ? 'latest-grade-widget--wide' : ''} ${(visible || isReady) ? 'widget-card--visible' : ''}`}
      aria-label="Dernière note"
      onClick={() => window.open(NOTES9_HREF, '_blank', 'noopener,noreferrer')}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') window.open(NOTES9_HREF, '_blank', 'noopener,noreferrer') }}
    >
      <Icon icon="carbon:arrow-up-right" className="latest-grade-widget__corner-arrow" aria-hidden="true" />
      <div className="latest-grade-widget__label">
        <Icon icon="carbon:chart-pie" className="latest-grade-widget__label-icon" aria-hidden="true" />
        <span className="widget-card__text">Dernière note</span>
      </div>

      <div className="latest-grade-widget__content">
        <div className="latest-grade-widget__score-row">
          <div
            className="latest-grade-widget__accent-bar"
            style={{ background: accentColor }}
            aria-hidden="true"
          />
          <div className="latest-grade-widget__score">
            <span className="latest-grade-widget__score-value">{noteDisplay}</span>
            <span className="latest-grade-widget__score-max">/{noteMax}</span>
          </div>
        </div>
        <div className="latest-grade-widget__meta">
          <span ref={titleRef} className="widget-card__text">{grade.description}</span>
          <span className="widget-card__text latest-grade-widget__code">{grade.resource}</span>
        </div>
      </div>
    </article>
  )
}

export default WidgetLatestGrade
