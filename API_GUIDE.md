# ENT API Guide

This project now treats the University of Rennes ENT as an authenticated launcher.

It does **not** try to reverse-engineer ADE, Apogee, or Moodle themselves yet. Instead, it:

1. logs in to the ENT through CAS
2. keeps the ENT portal session on the local Vite server
3. fetches the authenticated ENT layout
4. resolves the launcher URL behind each ENT service card

## What The App Does

The frontend talks only to the local Vite server:

- `POST /__ent_auth/login`
- `GET /__ent_auth/session`
- `POST /__ent_auth/logout`
- `GET /__ent_proxy/...`

The Vite server then talks to:

- `https://services-numeriques.univ-rennes.fr`
- `https://sso-cas.univ-rennes.fr`

The ENT cookies are stored **in memory only** on the local server. They are not written to disk.

## How To Run

```bash
npm install
npm run dev
```

Open the local Vite URL shown in the terminal.

## How To Use The Frontend

1. Enter your university username and password.
2. Click `Sign in`.
3. The local server performs the CAS login flow and establishes an ENT session.
4. The app fetches `layout.json` and resolves the launcher links for your services.
5. Click `Open service` on any launcher card.

## Local Auth Endpoints

### `POST /__ent_auth/login`

Logs in through CAS and creates a local session cookie on `localhost`.

Request body:

```json
{
  "username": "your-username",
  "password": "your-password"
}
```

Success response:

```json
{
  "authenticated": true,
  "user": "theliere"
}
```

Failure response:

```json
{
  "error": "CAS login failed. Check your username and password."
}
```

### `GET /__ent_auth/session`

Returns whether the local Vite server currently holds a valid ENT session.

Example authenticated response:

```json
{
  "authenticated": true,
  "user": "theliere",
  "cookieNames": [
    "JSESSIONID",
    "UrlCanonicalizingFilter.REDIRECT_COUNT",
    "org.apereo.portal.PORTLET_COOKIE",
    "route"
  ]
}
```

Example signed-out response:

```json
{
  "authenticated": false,
  "user": null
}
```

### `POST /__ent_auth/logout`

Clears the local session kept by the Vite server.

Response:

```json
{
  "authenticated": false
}
```

## ENT Proxy

All ENT requests should go through:

```text
/__ent_proxy
```

Example:

```text
/__ent_proxy/api/v4-3/dlm/layout.json
```

If a local auth session exists, the proxy automatically injects the stored ENT cookies.

## Main ENT Endpoints

### `GET /api/v4-3/dlm/layout.json`

This is the main authenticated endpoint used by the app.

Purpose:

- confirms the session is authenticated
- returns the current ENT user
- returns tabs, folders, and portlets visible to that user

Example fields:

```json
{
  "user": "theliere",
  "authenticated": "true",
  "layout": {
    "navigation": {
      "tabs": []
    },
    "regions": []
  }
}
```

### `GET /api/portlet/{fname}.json`

Returns metadata for a portlet.

Useful fields:

- `title`
- `fname`
- `description`
- `target`
- `widgetURL`
- `parameters`

Example:

```text
/api/portlet/webapp-ade.json
```

### `GET /api/v4-3/portlet/{fname}.html`

Returns the rendered portlet fragment.

For launcher portlets, this is the easiest way to get the final launch URL.

Examples:

```text
/api/v4-3/portlet/webapp-ade.html
/api/v4-3/portlet/webapp-apogee-mdw.html
```

Observed examples:

- `webapp-ade` -> `https://planning.univ-rennes1.fr/direct/myplanning.jsp`
- `webapp-apogee-mdw` -> `https://mdw.univ-rennes1.fr`

## Auth Flow Summary

The local server performs this sequence:

1. request `https://services-numeriques.univ-rennes.fr/f/services/normal/render.uP`
2. follow portal redirects
3. reach CAS at `https://sso-cas.univ-rennes.fr/login?...`
4. parse hidden inputs like `execution`
5. submit credentials to CAS
6. follow the service-ticket redirect back to ENT
7. verify the session by calling `/api/v4-3/dlm/layout.json`

## Recommended Frontend Usage

For a future custom frontend, the simplest pattern is:

1. call `GET /__ent_auth/session`
2. if unauthenticated, call `POST /__ent_auth/login`
3. call `GET /__ent_proxy/api/v4-3/dlm/layout.json`
4. extract launcher portlets from the response
5. for each launcher, call `GET /__ent_proxy/api/v4-3/portlet/{fname}.html`
6. parse the first `<a href="...">` to get the external service URL

## Example JavaScript

```js
async function login(username, password) {
  const response = await fetch('/__ent_auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })

  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.error || 'Login failed')
  }

  return data
}

async function getLayout() {
  const response = await fetch('/__ent_proxy/api/v4-3/dlm/layout.json')
  return response.json()
}

async function getPortletFragment(fname) {
  const response = await fetch(`/__ent_proxy/api/v4-3/portlet/${fname}.html`)
  return response.text()
}
```

## Current Scope

This project currently covers:

- ENT login
- ENT session reuse
- ENT service discovery
- launcher URL resolution

This project does **not** yet cover:

- ADE internal APIs
- Apogee internal APIs
- Moodle internal APIs
- downstream app proxying on other domains

