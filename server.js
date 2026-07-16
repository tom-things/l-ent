// Production server.
//
// Single-tenant (default): serves the university picked by UNIVERSITY from
// dist/ — same behavior as always.
//
// Multi-tenant (MULTI_TENANT=1): loads every university listed in TENANTS
// (default: all non-example universities), builds one app per tenant, and
// routes each request by hostname. A tenant matches when the request host's
// first label equals its id without dashes (univ-rennes → univrennes.lent…)
// or when the host appears in the university's optional `hostnames` export
// (shared.js). Unmatched hosts fall back to the UNIVERSITY default.
// Frontends must be built per tenant with `npm run build:all` (dist/<id>/).
import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createEntAuthApp } from './server/entAuthApp.js'
import {
  listUniversityIds,
  loadServerConfig,
  loadSharedConfig,
  resolveUniversityId,
} from './universities/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const PORT = process.env.PORT || 3000
const MULTI_TENANT = ['1', 'true', 'yes'].includes(String(process.env.MULTI_TENANT ?? '').toLowerCase())

function getPublicOrigin(req) {
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim()
  const forwardedHost = String(req.headers['x-forwarded-host'] || '').split(',')[0].trim()
  const protocol = forwardedProto || req.protocol || 'http'
  const host = forwardedHost || req.get('host') || `localhost:${PORT}`

  return `${protocol}://${host}`
}

function getRequestHost(req) {
  const forwardedHost = String(req.headers['x-forwarded-host'] || '').split(',')[0].trim()
  const host = forwardedHost || String(req.headers.host || '')

  return host.split(':')[0].toLowerCase()
}

// Full app for one university: auth/proxy backend + SEO routes + built frontend.
function createTenantApp(universityConfig, distDir) {
  const app = express()

  app.use(createEntAuthApp(universityConfig))

  app.get('/robots.txt', (req, res) => {
    const origin = getPublicOrigin(req)

    res.type('text/plain')
    res.send([
      'User-agent: *',
      'Allow: /',
      'Disallow: /__ent_auth/',
      'Disallow: /__ent_proxy/',
      `Sitemap: ${origin}/sitemap.xml`,
    ].join('\n'))
  })

  app.get('/sitemap.xml', (req, res) => {
    const origin = getPublicOrigin(req)

    res.type('application/xml')
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${origin}/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`)
  })

  function sendAppShell(req, res) {
    const canonicalUrl = new URL('/', getPublicOrigin(req)).toString()

    res.setHeader('Content-Language', 'fr')
    res.setHeader('Link', `<${canonicalUrl}>; rel="canonical"`)
    res.sendFile(path.join(distDir, 'index.html'))
  }

  app.get('/', sendAppShell)

  // Serve the built static files
  app.use(express.static(distDir))

  // Support for client-side routing (React Router)
  app.get(/^.*$/, sendAppShell)

  return app
}

const rootApp = express()
const defaultUniversityId = resolveUniversityId()

if (!MULTI_TENANT) {
  const universityConfig = await loadServerConfig(defaultUniversityId)
  rootApp.use(createTenantApp(universityConfig, path.join(__dirname, 'dist')))

  rootApp.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT} (university: ${universityConfig.id})`)
  })
} else {
  const tenantIds = process.env.TENANTS
    ? process.env.TENANTS.split(',').map((id) => resolveUniversityId(id.trim()))
    : listUniversityIds().filter((id) => !id.startsWith('example'))

  if (!tenantIds.includes(defaultUniversityId)) {
    tenantIds.unshift(defaultUniversityId)
  }

  const tenantsById = new Map()
  const tenantIdByHost = new Map()
  const tenantIdByLabel = new Map()

  for (const id of tenantIds) {
    const config = await loadServerConfig(id)
    const shared = await loadSharedConfig(id)
    tenantsById.set(id, createTenantApp(config, path.join(__dirname, 'dist', id)))

    // Default subdomain label: the id without dashes (univ-rennes → univrennes).
    tenantIdByLabel.set(id.replace(/-/g, ''), id)
    for (const hostname of shared.hostnames ?? []) {
      tenantIdByHost.set(String(hostname).toLowerCase(), id)
    }
  }

  function resolveTenantId(req) {
    const host = getRequestHost(req)

    return tenantIdByHost.get(host)
      ?? tenantIdByLabel.get(host.split('.')[0])
      ?? defaultUniversityId
  }

  rootApp.use((req, res, next) => {
    tenantsById.get(resolveTenantId(req))(req, res, next)
  })

  rootApp.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT} (multi-tenant: ${tenantIds.join(', ')}; default: ${defaultUniversityId})`)
  })
}
