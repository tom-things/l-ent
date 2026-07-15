import SidebarStatPocket from './SidebarStatPocket'
import {
  DEMO_LATEST_GRADE,
  GRADES_UNAVAILABLE_DETAIL,
  GRADES_UNAVAILABLE_MESSAGE,
  GRADES_UNAVAILABLE_TITLE,
} from '../gradeFeatureState'

function SidebarGradePocket() {
  const grade = DEMO_LATEST_GRADE
  const noteDisplay = grade?.note ? String(parseFloat(grade.note)) : '—'
  const noteMax = grade?.noteSur ? String(Math.round(parseFloat(grade.noteSur))) : '20'

  const gradeName = grade.description || ''

  return (
    <SidebarStatPocket
      icon="carbon:chart-pie"
      label="Dernière note"
      value={noteDisplay}
      max={noteMax}
      caption={gradeName}
      ariaLabel={`Dernière note indisponible: ${GRADES_UNAVAILABLE_MESSAGE}`}
      tooltipPrimary={GRADES_UNAVAILABLE_TITLE}
      tooltipSecondary={GRADES_UNAVAILABLE_DETAIL}
      disabled
    />
  )
}

export default SidebarGradePocket
