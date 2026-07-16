import { execSync } from 'node:child_process'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vite'
import { createEntAuthApp } from './server/entAuthApp.js'
import { clientConfigPath, loadServerConfig, loadSharedConfig, resolveUniversityId } from './universities/index.js'

const universityId = resolveUniversityId()
const universityServerConfig = await loadServerConfig(universityId)
const { branding } = await loadSharedConfig(universityId)

// Dev/preview backend: the same Express app the production server mounts
// (server/entAuthApp.js). Unmatched requests fall through to Vite.
const entDevAuthPlugin = {
  name: 'ent-dev-auth',
  configureServer(server) {
    server.middlewares.use(createEntAuthApp(universityServerConfig))
  },
  configurePreviewServer(server) {
    server.middlewares.use(createEntAuthApp(universityServerConfig))
  },
  // index.html carries %LENT_*% placeholders so titles/SEO follow the
  // configured university in both dev and build.
  transformIndexHtml(html) {
    const replacements = {
      LENT_APP_NAME: branding.appName,
      LENT_SEO_TITLE: branding.seoTitle,
      LENT_SEO_DESCRIPTION: branding.seoDescription,
      LENT_REPO_URL: branding.about?.repoUrl ?? '',
    }

    return html.replace(/%(LENT_[A-Z_]+)%/g, (match, token) => replacements[token] ?? match)
  },
}

const gitHash = (() => {
  try { return execSync('git rev-parse --short HEAD').toString().trim() }
  catch { return 'dev' }
})()


export default defineConfig({
  resolve: {
    alias: {
      '@university': clientConfigPath(universityId),
    },
  },
  define: {
    __BUILD_HASH__: JSON.stringify(gitHash),
    __UNIVERSITY_ID__: JSON.stringify(universityId),
  },
  plugins: [
    tailwindcss(),
    react(),
    entDevAuthPlugin,
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      workbox: {
        navigateFallbackDenylist: [/^\/__ent_auth/, /^\/__ent_proxy/],
      },
      manifest: {
        name: branding.appName,
        short_name: branding.appName,
        description: branding.pwaDescription ?? branding.seoDescription,
        theme_color: '#FCFBF8',
        background_color: '#FCFBF8',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
  server: {
    allowedHosts: true,
    // /__ent_proxy is handled by the shared entAuthApp middleware above.
  },
})
