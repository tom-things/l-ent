import fs from 'fs'
import { CookieJar } from 'cookie-parser'
import { XMLParser } from 'fast-xml-parser'

const PLANNING_ORIGIN = 'https://planning.univ-rennes1.fr'
const xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' })

async function run() {
  const cookiesStr = fs.readFileSync('cookies.txt', 'utf8')
  const myCookie = cookiesStr.split('\n').find(l => l.includes('JSESSIONID'))
  const sessionIdMatch = myCookie ? myCookie.match(/JSESSIONID\s+(.*)/) : null
  const jsessionid = sessionIdMatch ? sessionIdMatch[1] : ''

  console.log("JSESSIONID:", jsessionid)

  const headers = {
    Accept: '*/*',
    Cookie: `JSESSIONID=${jsessionid}`
  }

  // 1. Fetch projects
  const url1 = `${PLANNING_ORIGIN}/jsp/webapi?function=projects&detail=2`
  const res1 = await fetch(url1, { headers })
  const xml1 = await res1.text()
  const parsed1 = xmlParser.parse(xml1)
  console.log("Projects:", parsed1?.projects?.project?.map(p => ({ id: p.id, name: p.name })))
  
  const projectId = 3 // Assuming 3 or the highest 2025/2026
  
  // 2. Fetch resources
  console.log("Fetching resources for project", projectId)
  const url2 = `${PLANNING_ORIGIN}/jsp/webapi?function=resources&projectId=${projectId}&detail=2`
  const res2 = await fetch(url2, { headers })
  const xml2 = await res2.text()
  const parsed2 = xmlParser.parse(xml2)
  
  const resources = parsed2?.resources?.resource || []
  console.log("Total resources:", resources.length)

  // 3. Search for "theliere" or "heliere"
  const matches = resources.filter(r => 
    (r.name && r.name.toLowerCase().includes('heliere')) || 
    (r.code && r.code.toLowerCase().includes('heliere'))
  )
  console.log("Matches for 'heliere':", matches)
}

run().catch(console.error)
