import SidebarStatPocket from './SidebarStatPocket'
import {
  DEMO_AVERAGE_GRADE,
  GRADES_UNAVAILABLE_DETAIL,
  GRADES_UNAVAILABLE_MESSAGE,
  GRADES_UNAVAILABLE_TITLE,
} from '../gradeFeatureState'

function SidebarAveragePocket() {
  const averageDisplay = String(parseFloat(DEMO_AVERAGE_GRADE.average))
  const promoDisplay = String(parseFloat(DEMO_AVERAGE_GRADE.promoAverage))

  return (
    <SidebarStatPocket
      icon="carbon:summary-kpi"
      label="Moyenne"
      value={averageDisplay}
      max="20"
      caption={`Promo : ${promoDisplay}`}
      ariaLabel={`Moyenne indisponible: ${GRADES_UNAVAILABLE_MESSAGE}`}
      tooltipPrimary={GRADES_UNAVAILABLE_TITLE}
      tooltipSecondary={GRADES_UNAVAILABLE_DETAIL}
      disabled
    />
  )
}

export default SidebarAveragePocket
