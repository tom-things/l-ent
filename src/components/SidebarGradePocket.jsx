import { useEffect, useState } from 'react'
import { ENT_AUTH_PREFIX, getLatestGrade } from '../entApi'
import SidebarStatPocket from './SidebarStatPocket'

const NOTES9_DOAUTH = 'https://notes9.iutlan.univ-rennes1.fr/services/doAuth.php?href=https://notes9.iutlan.univ-rennes1.fr/'
const NOTES9_HREF = `${ENT_AUTH_PREFIX}/launch?url=${encodeURIComponent(NOTES9_DOAUTH)}`

function SidebarGradePocket() {
  const [grade, setGrade] = useState(null)

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

  if (!grade) return null

  const noteDisplay = grade?.note ? String(parseFloat(grade.note)) : '—'
  const noteMax = grade?.noteSur ? String(Math.round(parseFloat(grade.noteSur))) : '20'
  const openNotes9 = () => window.open(NOTES9_HREF, '_blank', 'noopener,noreferrer')

  const gradeName = grade.description || ''
  const resourceLabel = grade.resource || ''
  const ariaTooltipParts = [gradeName, resourceLabel].filter(Boolean).join(' — ')

  return (
    <SidebarStatPocket
      icon="carbon:chart-pie"
      label="Dernière note"
      value={noteDisplay}
      max={noteMax}
      onClick={openNotes9}
      caption={gradeName}
      ariaLabel={`Dernière note: ${noteDisplay} sur ${noteMax}${ariaTooltipParts ? ` (${ariaTooltipParts})` : ''}`}
      tooltipPrimary={gradeName}
      tooltipSecondary={resourceLabel}
    />
  )
}

export default SidebarGradePocket
