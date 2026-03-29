import { useEffect, useState } from 'react'
import { Icon } from '@iconify/react'
import { ENT_AUTH_PREFIX, getAverageGrade } from '../entApi'

const NOTES9_DOAUTH = 'https://notes9.iutlan.univ-rennes1.fr/services/doAuth.php?href=https://notes9.iutlan.univ-rennes1.fr/'
const NOTES9_HREF = `${ENT_AUTH_PREFIX}/launch?url=${encodeURIComponent(NOTES9_DOAUTH)}`
import waveGlowLight from '../assets/wave-glow-light.png'
import waveGlowDark from '../assets/wave-glow-dark.png'

function WidgetAverageGrade({ visible = false }) {
  const [data, setData] = useState(null)

  useEffect(() => {
    let mounted = true
    getAverageGrade()
      .then((result) => {
        if (mounted && !result.error) setData(result)
      })
      .catch(() => {})
    return () => { mounted = false }
  }, [])

  if (!data || (data.average == null && data.promoAverage == null)) return null

  const avgDisplay = data.average != null ? String(parseFloat(data.average)) : '—'
  const promoDisplay = data.promoAverage != null ? String(parseFloat(data.promoAverage)) : null

  return (
    <article
      className={`average-grade-widget widget-card shadow-md flex-[0_1_220px] min-h-[120px] p-5 border border-white rounded-[1.75rem] overflow-hidden bg-widget-bg text-base leading-6 min-w-0 max-2xl:flex-[1_1_calc(50%-7px)] max-2xl:min-w-0 max-md:min-h-[108px] max-md:p-4 max-md:rounded-3xl flex flex-col gap-[3px] text-text cursor-pointer relative ${visible ? 'widget-card-visible delay-[280ms]' : ''}`}
      aria-label="Moyenne générale"
      onClick={() => window.open(NOTES9_HREF, '_blank', 'noopener,noreferrer')}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') window.open(NOTES9_HREF, '_blank', 'noopener,noreferrer') }}
    >
      <Icon icon="carbon:arrow-up-right" className="grade-corner-arrow absolute top-[14px] right-[14px] w-[14px] h-[14px] text-text opacity-0 transition-opacity duration-150 ease-in-out shrink-0" aria-hidden="true" />
      <div className="flex items-center gap-[5px]">
        <Icon icon="carbon:chart-average" className="w-[17px] h-[17px] shrink-0 text-text" aria-hidden="true" />
        <span className="m-0 leading-[1.06] text-base font-medium max-md:text-[15px]">Moyenne Générale</span>
      </div>

      <div className="average-grade-waves absolute bottom-0 left-0 right-0 h-[60px] pointer-events-none" aria-hidden="true">
        <img src={waveGlowLight} alt="" className="absolute bottom-0 left-0 w-full h-full object-fill dark:hidden" />
        <img src={waveGlowDark} alt="" className="absolute bottom-0 left-0 w-full h-full object-fill hidden dark:block" />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center relative z-10">
        <span className="text-[37px] font-bold leading-none tracking-[0.01em] max-md:text-[32px]">{avgDisplay}</span>
        {promoDisplay ? (
          <span className="text-base font-medium leading-[1.06] opacity-60 dark:opacity-80 max-md:text-[15px]">
            Moy. Promo : {promoDisplay}
          </span>
        ) : null}
      </div>
    </article>
  )
}

export default WidgetAverageGrade
