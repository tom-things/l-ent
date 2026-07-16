// Production server: loads the university config (UNIVERSITY env var), mounts
// the shared ENT auth backend (server/entAuthApp.js — also used by the Vite
// dev server) and serves the built frontend from dist/.
import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createEntAuthApp } from './server/entAuthApp.js'
import { loadServerConfig } from './universities/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const app = express()
const PORT = process.env.PORT || 3000

const universityConfig = await loadServerConfig()

app.use(createEntAuthApp(universityConfig))

// ============================================================================
// STATIC FILE SERVING (REACT FRONTEND)
// ============================================================================
function getPublicOrigin(req) {
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim()
  const forwardedHost = String(req.headers['x-forwarded-host'] || '').split(',')[0].trim()
  const protocol = forwardedProto || req.protocol || 'http'
  const host = forwardedHost || req.get('host') || `localhost:${PORT}`

  return `${protocol}://${host}`
}

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
  res.sendFile(path.join(__dirname, 'dist', 'index.html'))
}

app.get('/', sendAppShell)

// Serve the built static files
app.use(express.static(path.join(__dirname, 'dist')))

// Support for client-side routing (React Router)
app.get(/^.*$/, sendAppShell)

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT} (university: ${universityConfig.id})`)
})
