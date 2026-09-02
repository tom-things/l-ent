// Université de Rennes — values shared by the client and server configs.
// Pure data only: this file is imported by Node at runtime, so it must not
// import assets (images, CSS) or browser-only modules.

export const id = 'univ-rennes'

export const university = {
  name: 'Université de Rennes',
  shortName: 'Rennes',
}

// Branding text (no assets here — the logo lives in client.js so this file
// stays importable by Node).
export const branding = {
  appName: "l'ent",
  defaultTitle: "l'ent | Toute ta fac, au même endroit.",
  seoTitle: "l'ent | Client alternatif ENT Université de Rennes",
  seoDescription:
    "Client alternatif non officiel à l'ENT de l'Université de Rennes pour consulter notes, emploi du temps ADE, résultats et services universitaires depuis une interface plus lisible.",
  pwaDescription:
    "l'ent réunit toutes vos données universitaires — cours, résultats, messagerie dans une interface lisible, rapide et agréable à utiliser.",
  logoAlt: 'Université de Rennes',
  sidebarLogoAlt: "L'ent — Université de Rennes",
  loginFooterLine: "Client alternatif à l'ENT de l'Université de Rennes",
  about: {
    intro: "est un client alternatif aux services numériques de l'Université de Rennes.",
    disclaimer:
      "Client non officiel, indépendant et non affilié à l'Université de Rennes. Ce projet ne stocke aucune donnée personnelle et se contente de relayer les services existants dans une interface repensée.",
    authorLine: "Fait par un étudiant de l'IUT de Lannion",
    authorUrl: 'https://tomthings.fr',
    repoUrl: 'https://github.com/tom-things/l-ent',
  },
}

// Public origin of the ENT portal — used by the frontend to normalize URLs
// before sending them through the local proxy, and by the server as the
// proxy target.
export const entOrigin = 'https://services-numeriques.univ-rennes.fr'

// CAS SSO origin. Public: browsers are redirected there during login; the
// frontend uses it to recognize CAS hops in launch chains.
export const casOrigin = 'https://sso-cas.univ-rennes.fr'

// uPortal landing page: login entry point, default Referer for proxied
// requests, and the URL whose response proves a CAS login landed back
// authenticated.
export const portalEntryPath = '/f/services/normal/render.uP'

// Feature switchboard. A missing/false feature hides its widgets, nav items
// and server endpoints.
export const features = {
  ade: true,
  planning: true,
  moodle: true,
  grades: true,
  weather: { enabled: true, defaultCity: 'Rennes' },
  demo: true,
}

// Public launch URL of the planning service (opened through /__ent_auth/launch).
export const planningServiceUrl = 'https://planning.univ-rennes.fr/portal/planning/calendar'

export const gradesOrigin = 'https://notes9.iutlan.univ-rennes1.fr'
export const gradesServiceUrl = `${gradesOrigin}/services/doAuth.php?href=${encodeURIComponent(`${gradesOrigin}/`)}`

// Fallback copy shown when the upstream grade service is unavailable.
export const gradesCopy = {
  unavailableTitle: 'Notes indisponibles',
  unavailableDetail: 'ScoDoc ne répond pas pour le moment.',
  disabledPillLabel: 'Notes indisponibles',
}
