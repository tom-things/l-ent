import './AppFooter.css'

import iutlanLogo from '../assets/uni_logos/iutlan.svg'
import iutsaibLogo from '../assets/uni_logos/iutsaib.svg'
import iutsaiLogo from '../assets/uni_logos/iutsai.svg'
import ufrsLogo from '../assets/uni_logos/ufrs.svg'
import ufrmLogo from '../assets/uni_logos/ufrm.svg'
import ufrpLogo from '../assets/uni_logos/ufrp.svg'
import ufroLogo from '../assets/uni_logos/ufro.svg'
import fdseLogo from '../assets/uni_logos/fdse.svg'
import odsLogo from '../assets/uni_logos/ods.svg'
import univRennesLogo from '../assets/uni_logos/univ-rennes.svg'

const LOGOS = {
  iutlan: iutlanLogo,
  iutsaib: iutsaibLogo,
  iutsai: iutsaiLogo,
  ufrs: ufrsLogo,
  ufrm: ufrmLogo,
  ufrp: ufrpLogo,
  ufro: ufroLogo,
  fdse: fdseLogo,
  ods: odsLogo,
  other: univRennesLogo,
}

function AppFooter({ establishment }) {
  const logo = LOGOS[establishment] || univRennesLogo

  return (
    <footer className="app-footer">
      <img
        className="app-footer__logo"
        src={logo}
        alt=""
      />
      <span className="app-footer__mention">
        Client alternatif à l&apos;ENT de l&apos;Université de Rennes
      </span>
    </footer>
  )
}

export default AppFooter
