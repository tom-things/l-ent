# ENT API Notes

This repository now includes a local explorer UI and a cookie-aware proxy for reverse-engineering the University of Rennes ENT portal at `https://services-numeriques.univ-rennes.fr`.

## Confirmed Auth Flow

Observed from live HTTP requests against the portal host:

1. `GET /f/services/normal/render.uP`
   - Unauthenticated response: `302` to `/Login?refUrl=%2Ff%2Fservices%2Fnormal%2Frender.uP`
2. `GET /Login?refUrl=%2Ff%2Fservices%2Fnormal%2Frender.uP`
   - Response: `302` to `/api/cookiecheck`
   - Sets a portal-local `JSESSIONID`
3. `GET /api/cookiecheck`
   - Stateless request: HTML error page saying the browser does not accept cookies
   - Cookie-aware request: `302` back to `/Login?refUrl=...`
4. Portal then redirects to CAS:
   - `https://sso-cas.univ-rennes.fr/login?service=https://services-numeriques.univ-rennes.fr/Login%3FrefUrl%3D%2Ff%2Fservices%2Fnormal%2Frender.uP`
5. CAS login page contains:
   - form action `login`
   - hidden input `execution=<opaque value>`
   - hidden input `_eventId=submit`
   - fields `username`, `password`, `geolocation`

Expected post-login behavior, based on CAS conventions:

1. CAS authenticates the user and issues a service ticket.
2. Browser is redirected back to `https://services-numeriques.univ-rennes.fr/Login?...&ticket=...`
3. The portal validates the ticket and establishes a portal session on `services-numeriques.univ-rennes.fr`.
4. Subsequent portal API calls rely primarily on the portal-host cookies, especially `JSESSIONID`, and often also the sticky routing cookie `route=sticky.pentX`.

Practical note:

- The CAS `TGC` cookie lives on `sso-cas.univ-rennes.fr`. It is useful for SSO, but direct replay of ENT `/api/...` calls usually needs the portal-host session cookies instead.
- If replayed requests start redirecting to `/Login`, refresh the portal in the browser and copy a fresh portal cookie string.

## Confirmed Portal Endpoints

These were verified directly against the Rennes host:

### Platform bootstrap

- `GET /f/services/normal/render.uP`
- `GET /Login?refUrl=%2Ff%2Fservices%2Fnormal%2Frender.uP`
- `GET /api/cookiecheck`

### Layout and registry APIs

- `GET /api/v4-3/dlm/layout.json`
  - Returns JSON layout data.
  - Guest sample includes:
    - `user`
    - `authenticated`
    - `hostname`
    - `locale`
    - `layout.navigation.tabs`
    - `layout.regions`
- `GET /api/layoutDoc`
  - Returns a flat array of visible portlets for the current user.
  - Supports `?tab=<tab-id-or-externalId>`
- `GET /api/marketplace/entries.json`
  - Returns visible marketplace portlets for the current user.
- `GET /api/portlet/{fname}.json`
  - Returns metadata for a browsable portlet.
  - Important fields:
    - `title`
    - `description`
    - `fname`
    - `url`
    - `parameters`
    - `widgetURL`
    - `widgetType`
    - `widgetTemplate`
    - `widgetConfig`
    - `staticContent`
    - `altMaxUrl`
- `GET /api/v4-3/portlet/{fname}.html`
  - Returns the rendered HTML fragment for a portlet.
  - Useful as a last resort to extract links, action URLs, and embedded API hints.

### Swagger shell

- `GET /api/swagger-ui.html`
- `GET /api/swagger-resources`
- `GET /api/swagger-resources/configuration/ui`
- `GET /api/swagger-resources/configuration/security`

Current behavior:

- Swagger UI is exposed.
- `swagger-resources` currently returns `[]`, so no actual API spec is published there.

## Guest-Visible Portlets Observed

From `GET /api/layoutDoc` as guest:

- `portal-brand`
- `color-scheme`
- `portal-footer-navigation`
- `portal-footer-information`
- `portal-matomo`
- `portal-landing`

From `GET /api/marketplace/entries.json` as guest:

- `popular-portlets`
- `portletmarketplace`
- `user-locales-selector`
- `portal-activity`
- `favorites`

Notable guest fragment:

- `GET /api/v4-3/portlet/portal-landing.html`
  - Contains a direct CAS login link:
    - `https://sso-cas.univ-rennes.fr/login?service=https://services-numeriques.univ-rennes.fr/Login`

## Replay Strategy

### Direct curl

Use the cookies from an authenticated browser request on the portal host:

```bash
curl 'https://services-numeriques.univ-rennes.fr/api/layoutDoc' \
  -H 'cookie: JSESSIONID=...; route=sticky.pentX' \
  -H 'referer: https://services-numeriques.univ-rennes.fr/f/services/normal/render.uP'
```

### Local Vite proxy

The app uses `/__ent_proxy` as a local prefix. The browser sends custom headers to the Vite dev server, which rewrites them to real outbound headers:

- `x-ent-cookie` -> `cookie`
- `x-ent-referer` -> `referer`
- `x-ent-extra-headers` -> additional outbound headers as JSON

Example:

```js
fetch('/__ent_proxy/api/layoutDoc', {
  headers: {
    'x-ent-cookie': 'JSESSIONID=...; route=sticky.pentX',
    'x-ent-referer': 'https://services-numeriques.univ-rennes.fr/f/services/normal/render.uP',
    'x-ent-extra-headers': JSON.stringify({
      Accept: 'application/json',
      'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
    }),
  },
})
```

## Recommended DevTools Workflow

1. Open the authenticated ENT page.
2. In Network, enable `Preserve log`.
3. Filter by `Fetch/XHR`, then inspect the `Doc` requests around navigation changes.
4. Open one section at a time:
   - timetable
   - grades
   - Moodle
   - messaging
   - admin
   - notifications
5. For each interesting request:
   - copy the full URL
   - note the method
   - copy request headers
   - copy the cookie header
   - save a sample response
6. Paste the request as cURL into the app importer, then replay and simplify the header set until you know the minimum required headers.

## Files Added For Exploration

- `vite.config.js`
  - Local cookie-aware proxy at `/__ent_proxy`
- `src/entApi.js`
  - Reusable fetch helpers for the discovered platform endpoints
- `src/curlImport.js`
  - Parses DevTools `Copy as cURL` output into the generic request runner
- `src/knownEndpoints.js`
  - Captures the currently known auth flow and endpoint inventory
- `src/App.jsx`
  - Raw ENT explorer UI

