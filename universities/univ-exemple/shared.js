// Université Exemple — fake university used to test the multi-university
// setup end-to-end (subdomain routing, branding, demo account, widgets).
// Its origins don't exist: only the demo login (demo@l-ent.app / lent-demo)
// works; real CAS logins fail cleanly.

export const id = 'univ-exemple'

export const university = {
  name: 'Université Exemple',
  shortName: 'Exemple',
}

export const branding = {
  appName: "l'ent",
  defaultTitle: "l'ent | Toute ta fac, au même endroit.",
  seoTitle: "l'ent | Client alternatif ENT Université Exemple",
  seoDescription:
    "Instance de démonstration de l'ent pour l'Université Exemple : découvrez le client alternatif d'ENT avec le compte de démo.",
  pwaDescription:
    "l'ent réunit toutes vos données universitaires — cours, résultats, messagerie dans une interface lisible, rapide et agréable à utiliser.",
  logoAlt: 'Université Exemple',
  sidebarLogoAlt: "L'ent — Université Exemple",
  loginFooterLine: "Client alternatif à l'ENT de l'Université Exemple (démo)",
  about: {
    intro: "est un client alternatif aux services numériques de l'Université Exemple. Cette instance est une démonstration : connectez-vous avec le compte démo.",
    disclaimer: "Université fictive servant à tester l'ajout d'universités. Aucun service réel n'est relayé.",
    repoUrl: 'https://github.com/tom-things/l-ent',
  },
}

// Fake origins (.example TLD is reserved for documentation): demo sessions
// never reach them, and real logins fail with a clean CAS error.
export const entOrigin = 'https://ent.univ-exemple.example'
export const casOrigin = 'https://cas.univ-exemple.example'
export const portalEntryPath = '/f/services/normal/render.uP'

// Everything demo mode can back is enabled, so the full dashboard shows.
export const features = {
  ade: true,
  planning: true,
  moodle: false,
  grades: 'disabled',
  weather: { enabled: true, defaultCity: 'Paris' },
  demo: true,
}

export const planningServiceUrl = 'https://planning.univ-exemple.example/direct/myplanning.jsp'

export const gradesCopy = {
  unavailableTitle: 'Notes indisponibles en démo',
  unavailableDetail: 'Les notes affichées sont des données de démonstration.',
  disabledPillLabel: 'Notes indisponibles',
}
