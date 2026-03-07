export const authFlow = [
  {
    step: 'Portal entry',
    url: 'https://services-numeriques.univ-rennes.fr/f/services/normal/render.uP',
    notes: 'Unauthenticated requests return a 302 redirect to /Login?refUrl=%2Ff%2Fservices%2Fnormal%2Frender.uP.',
  },
  {
    step: 'Portal login bootstrap',
    url: 'https://services-numeriques.univ-rennes.fr/Login?refUrl=%2Ff%2Fservices%2Fnormal%2Frender.uP',
    notes: 'The portal sets a host-local JSESSIONID and redirects through /api/cookiecheck before handing off to CAS.',
  },
  {
    step: 'Cookie support check',
    url: 'https://services-numeriques.univ-rennes.fr/api/cookiecheck',
    notes: 'Without a cookie jar it returns an HTML error page. With cookies enabled it redirects back to /Login.',
  },
  {
    step: 'CAS handoff',
    url: 'https://sso-cas.univ-rennes.fr/login?service=https://services-numeriques.univ-rennes.fr/Login%3FrefUrl%3D%2Ff%2Fservices%2Fnormal%2Frender.uP',
    notes: 'CAS exposes a username/password form with hidden execution and _eventId fields. A successful login should redirect back to the portal Login endpoint with a service ticket.',
  },
]

export const knownEndpoints = [
  {
    method: 'GET',
    path: '/f/services/normal/render.uP',
    auth: 'guest redirect or authenticated portal page',
    responseType: '302 redirect or HTML',
    purpose: 'Main ENT landing page.',
  },
  {
    method: 'GET',
    path: '/Login?refUrl=%2Ff%2Fservices%2Fnormal%2Frender.uP',
    auth: 'guest',
    responseType: '302 redirect',
    purpose: 'Portal-local login bootstrap before CAS.',
  },
  {
    method: 'GET',
    path: '/api/cookiecheck',
    auth: 'guest',
    responseType: '302 redirect or HTML error page',
    purpose: 'Cookie support check used before CAS handoff.',
  },
  {
    method: 'GET',
    path: '/api/v4-3/dlm/layout.json',
    auth: 'guest and authenticated',
    responseType: 'JSON',
    purpose: 'Returns the current user layout, tabs, regions, and other portal UI metadata.',
  },
  {
    method: 'GET',
    path: '/api/layoutDoc',
    auth: 'guest and authenticated',
    responseType: 'JSON',
    purpose: 'Returns a flat array of the current user portlets. Supports ?tab=<tab-id-or-externalId>.',
  },
  {
    method: 'GET',
    path: '/api/marketplace/entries.json',
    auth: 'guest and authenticated',
    responseType: 'JSON',
    purpose: 'Visible marketplace entries for the current user.',
  },
  {
    method: 'GET',
    path: '/api/portlet/{fname}.json',
    auth: 'depends on portlet permissions',
    responseType: 'JSON',
    purpose: 'Portlet metadata, including widgetURL, widgetType, static content, parameters, and alt URLs.',
  },
  {
    method: 'GET',
    path: '/api/v4-3/portlet/{fname}.html',
    auth: 'depends on portlet permissions',
    responseType: 'HTML fragment',
    purpose: 'Rendered portlet fragment. Use as a fallback to inspect links, forms, and embedded endpoint hints.',
  },
  {
    method: 'GET',
    path: '/api/swagger-ui.html',
    auth: 'guest',
    responseType: 'HTML',
    purpose: 'Swagger UI shell is exposed, but /api/swagger-resources currently returns an empty array.',
  },
  {
    method: 'GET',
    path: '/api/swagger-resources',
    auth: 'guest',
    responseType: 'JSON',
    purpose: 'Returns the list of documented Swagger resources. Currently empty on this deployment.',
  },
]

export const devtoolsChecklist = [
  'Open DevTools on the authenticated portal page and enable Preserve log in the Network tab.',
  'Filter first by fetch/XHR, then by Doc, then by the path fragments api, render.uP, and login.',
  'Open one portal section at a time: timetable, grades, Moodle, messaging, admin, notifications.',
  'For each interesting request, copy the full URL, method, request headers, cookies, body, and a sample response.',
  'Use Copy as cURL when a request is non-trivial, then paste it into the app importer to replay it through the Vite proxy.',
]

export const expectedSections = [
  'Timetable / emploi du temps',
  'Grades / results',
  'Messaging / email',
  'Moodle / e-learning',
  'Administrative information',
  'Notifications / alerts',
]
