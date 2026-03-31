export const APP_NAME = "l'ent"
export const APP_DEFAULT_TITLE = "l'ent | Toute ta fac, au même endroit."
export const SEO_TITLE = "l'ent | Client alternatif ENT Université de Rennes"
export const SEO_DESCRIPTION = "Client alternatif non officiel à l'ENT de l'Université de Rennes pour consulter notes, emploi du temps ADE, résultats et services universitaires depuis une interface plus lisible."
export const SEO_ROBOTS_CONTENT = 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1'

const OG_IMAGE_PATH = '/og-image.png'
const STRUCTURED_DATA_SCRIPT_ID = 'seo-structured-data'

function ensureHeadNode(selector, tagName, attributes = {}) {
  let node = document.head.querySelector(selector)

  if (!node) {
    node = document.createElement(tagName)
    for (const [key, value] of Object.entries(attributes)) {
      node.setAttribute(key, value)
    }
    document.head.appendChild(node)
  }

  return node
}

function setMetaByName(name, content) {
  const meta = ensureHeadNode(`meta[name="${name}"]`, 'meta', { name })
  meta.setAttribute('content', content)
}

function setMetaByProperty(property, content) {
  const meta = ensureHeadNode(`meta[property="${property}"]`, 'meta', { property })
  meta.setAttribute('content', content)
}

function setCanonicalLink(href) {
  const link = ensureHeadNode('link[rel="canonical"]', 'link', { rel: 'canonical' })
  link.setAttribute('href', href)
}

function buildStructuredData(pageUrl, imageUrl) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: APP_NAME,
    headline: SEO_TITLE,
    description: SEO_DESCRIPTION,
    applicationCategory: 'EducationApplication',
    operatingSystem: 'Any',
    inLanguage: 'fr-FR',
    isAccessibleForFree: true,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'EUR',
    },
    url: pageUrl,
    image: imageUrl,
    sameAs: [
      'https://github.com/tom-things/l-ent',
    ],
    featureList: [
      'Consulter ses notes et résultats',
      'Retrouver son emploi du temps ADE',
      'Accéder aux services universitaires depuis une interface unique',
      "Installer l'application en PWA sur mobile et ordinateur",
    ],
  }
}

function syncStructuredData(pageUrl, imageUrl) {
  const script = ensureHeadNode(
    `script#${STRUCTURED_DATA_SCRIPT_ID}`,
    'script',
    { id: STRUCTURED_DATA_SCRIPT_ID, type: 'application/ld+json' },
  )

  script.textContent = JSON.stringify(buildStructuredData(pageUrl, imageUrl))
}

export function buildDocumentTitle(authenticated) {
  return authenticated ? APP_DEFAULT_TITLE : `Connexion | ${SEO_TITLE}`
}

export function syncRuntimeSeo({ authenticated = false } = {}) {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return
  }

  const pageUrl = new URL(window.location.pathname + window.location.search, window.location.origin).toString()
  const imageUrl = new URL(OG_IMAGE_PATH, window.location.origin).toString()
  const title = buildDocumentTitle(authenticated)

  document.documentElement.setAttribute('lang', 'fr')
  document.title = title

  setMetaByName('description', SEO_DESCRIPTION)
  setMetaByName('robots', SEO_ROBOTS_CONTENT)
  setMetaByName('googlebot', SEO_ROBOTS_CONTENT)
  setMetaByName('twitter:card', 'summary_large_image')
  setMetaByName('twitter:title', SEO_TITLE)
  setMetaByName('twitter:description', SEO_DESCRIPTION)
  setMetaByName('twitter:url', pageUrl)
  setMetaByName('twitter:image', imageUrl)
  setMetaByName('twitter:image:alt', "Aperçu de l'application l'ent")

  setMetaByProperty('og:type', 'website')
  setMetaByProperty('og:locale', 'fr_FR')
  setMetaByProperty('og:site_name', APP_NAME)
  setMetaByProperty('og:title', SEO_TITLE)
  setMetaByProperty('og:description', SEO_DESCRIPTION)
  setMetaByProperty('og:url', pageUrl)
  setMetaByProperty('og:image', imageUrl)
  setMetaByProperty('og:image:alt', "Aperçu de l'application l'ent")

  setCanonicalLink(pageUrl)
  syncStructuredData(pageUrl, imageUrl)
}
