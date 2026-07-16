// Multi-tenant build: one frontend bundle per university, each in
// dist/<id>/, consumed by `MULTI_TENANT=1 node server.js`.
//
// Universities built: the TENANTS env var (comma-separated ids), or every
// directory under universities/ except example-* stubs.
import { execSync } from 'node:child_process'
import { listUniversityIds, resolveUniversityId } from '../universities/index.js'

const ids = process.env.TENANTS
  ? process.env.TENANTS.split(',').map((id) => resolveUniversityId(id.trim()))
  : listUniversityIds().filter((id) => !id.startsWith('example'))

if (ids.length === 0) {
  console.error('No universities to build. Set TENANTS or add universities/<id>/.')
  process.exit(1)
}

for (const id of ids) {
  console.log(`\n=== Building ${id} → dist/${id}/ ===`)
  execSync(`npx vite build --outDir dist/${id} --emptyOutDir`, {
    stdio: 'inherit',
    env: { ...process.env, UNIVERSITY: id },
  })
}

console.log(`\nBuilt ${ids.length} universit${ids.length > 1 ? 'ies' : 'y'}: ${ids.join(', ')}`)
