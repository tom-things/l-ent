// Université de Rennes — values shared by the client and server configs.
// Pure data only: this file is imported by Node at runtime, so it must not
// import assets (images, CSS) or browser-only modules.

export const id = 'univ-rennes'

// Public origin of the ENT portal — used by the frontend to normalize URLs
// before sending them through the local proxy, and by the server as the
// proxy target.
export const entOrigin = 'https://services-numeriques.univ-rennes.fr'

// Feature switchboard. A missing/false feature hides its widgets, nav items
// and server endpoints. 'disabled' (grades) keeps the UI pill visible with
// demo data while the backend endpoint is off.
export const features = {
  ade: true,
  planning: true,
  moodle: true,
  grades: 'disabled',
  weather: { enabled: true, defaultCity: 'Rennes' },
  demo: true,
}

// Public launch URL of the planning service (opened through /__ent_auth/launch).
export const planningServiceUrl = 'https://planning.univ-rennes1.fr/direct/myplanning.jsp'
