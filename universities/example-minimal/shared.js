// Minimal example university: only the ENT portal + CAS login are configured.
// Every optional feature is off. Copy this directory (or univ-rennes/ for a
// full-featured example) to add your university — see docs/ADDING_A_UNIVERSITY.md.

export const id = 'example-minimal'

export const university = {
  name: 'Mon Université',
  shortName: 'MonUniv',
}

export const branding = {
  appName: "l'ent",
  defaultTitle: "l'ent | Toute ta fac, au même endroit.",
  seoTitle: "l'ent | Client alternatif ENT Mon Université",
  seoDescription: "Client alternatif non officiel à l'ENT de Mon Université.",
  logoAlt: 'Mon Université',
  sidebarLogoAlt: "L'ent — Mon Université",
  loginFooterLine: "Client alternatif à l'ENT de Mon Université",
  about: {
    intro: 'est un client alternatif aux services numériques de Mon Université.',
    disclaimer: 'Client non officiel, indépendant et non affilié à Mon Université.',
  },
}

// REQUIRED: the uPortal-based ENT portal and its CAS SSO.
export const entOrigin = 'https://ent.example.fr'
export const casOrigin = 'https://cas.example.fr'
export const portalEntryPath = '/f/services/normal/render.uP'

// Everything off: the dashboard shows only the applications grid.
export const features = {
  ade: false,
  planning: false,
  moodle: false,
  grades: false,
  weather: { enabled: true, defaultCity: 'Paris' },
  demo: true,
}

export const planningServiceUrl = null

export const gradesCopy = {}
