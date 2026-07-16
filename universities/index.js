// University registry. Each university lives in universities/<id>/ with a
// client.js (browser-safe) and a server.js (origins, auth params, secrets).
// The active university is picked with the UNIVERSITY env var at build AND
// run time (they must match — the frontend bundle is baked per university).
import { readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const UNIVERSITIES_DIR = path.dirname(fileURLToPath(import.meta.url))

export const DEFAULT_UNIVERSITY_ID = 'univ-rennes'

export function listUniversityIds() {
  return readdirSync(UNIVERSITIES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
}

export function resolveUniversityId(rawId = process.env.UNIVERSITY) {
  const id = String(rawId || '').trim() || DEFAULT_UNIVERSITY_ID

  if (!/^[a-z0-9-]+$/.test(id) || !listUniversityIds().includes(id)) {
    throw new Error(
      `Unknown university "${id}". Available: ${listUniversityIds().join(', ')}. ` +
      'Set the UNIVERSITY env var to one of these, or add universities/<id>/ (see docs/ADDING_A_UNIVERSITY.md).',
    )
  }

  return id
}

export function clientConfigPath(id) {
  return path.join(UNIVERSITIES_DIR, id, 'client.js')
}

export async function loadServerConfig(rawId) {
  const id = resolveUniversityId(rawId)
  // Built as a runtime path (not a static template literal) so bundlers that
  // process vite.config.js don't try to glob-bundle every university module.
  const moduleUrl = pathToFileURL(path.join(UNIVERSITIES_DIR, id, 'server.js')).href
  const module = await import(moduleUrl)
  return module.default
}
