import { useEffect, useState } from 'react'
import { ENT_AUTH_PREFIX, getAverageGrade } from '../entApi'
import SidebarStatPocket from './SidebarStatPocket'

const NOTES9_DOAUTH = 'https://notes9.iutlan.univ-rennes1.fr/services/doAuth.php?href=https://notes9.iutlan.univ-rennes1.fr/'
const NOTES9_HREF = `${ENT_AUTH_PREFIX}/launch?url=${encodeURIComponent(NOTES9_DOAUTH)}`

function SidebarAveragePocket() {
  const [data, setData] = useState(null)

  useEffect(() => {
    let mounted = true
    getAverageGrade()
      .then((result) => {
        if (!mounted) return
        if (result && !result.error) {
          setData(result)
        }
      })
      .catch(() => {})
    return () => { mounted = false }
  }, [])

  if (!data) return null

  const averageDisplay = data?.average ? String(parseFloat(data.average)) : '—'
  const promoDisplay = data?.promoAverage ? String(parseFloat(data.promoAverage)) : null
  const openNotes9 = () => window.open(NOTES9_HREF, '_blank', 'noopener,noreferrer')

  return (
    <SidebarStatPocket
      icon="carbon:summary-kpi"
      label="Moyenne"
      value={averageDisplay}
      max="20"
      accentHue={330}
      onClick={openNotes9}
      caption={promoDisplay ? `Promo : ${promoDisplay}` : ''}
      ariaLabel={`Moyenne du semestre: ${averageDisplay} sur 20${promoDisplay ? ` (promo: ${promoDisplay})` : ''}`}
      tooltipPrimary="Moyenne du semestre"
      tooltipSecondary={promoDisplay ? `Promo: ${promoDisplay}/20` : ''}
    />
  )
}

export default SidebarAveragePocket
