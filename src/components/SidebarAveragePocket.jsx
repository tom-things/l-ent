import SidebarStatPocket from './SidebarStatPocket'
import { DEMO_AVERAGE_GRADE, GRADES_UNAVAILABLE_MESSAGE } from '../gradeFeatureState'

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
      tooltipPrimary={GRADES_UNAVAILABLE_MESSAGE}
      disabled
    />
  )
}

export default SidebarAveragePocket
