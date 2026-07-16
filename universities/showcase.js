// Universities showcased at the bottom of the login page ("aussi disponible
// pour…"). This file is bundled into every tenant's browser build, so keep it
// to name + logo — no config imports. When adding a real university, append
// it here (see docs/ADDING_A_UNIVERSITY.md).
// Each logo links to that tenant's login page — by default the subdomain
// `<id-without-dashes>.<current root domain>`; set `url` to override (e.g. a
// custom hostname from shared.js).
import univRennesLogo from './univ-rennes/assets/logo.svg'
import univExempleLogo from './univ-exemple/assets/logo.png'

export default [
  { id: 'univ-rennes', name: 'Université de Rennes', logo: univRennesLogo },
  // Demo tenant — only shown on dev builds.
  { id: 'univ-exemple', name: 'Université Exemple', logo: univExempleLogo, devOnly: true },
]
