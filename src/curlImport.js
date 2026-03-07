import { ENT_ORIGIN } from './entApi'

function shellSplit(command) {
  const tokens = []
  let current = ''
  let quote = null
  let escaped = false

  for (const char of command) {
    if (escaped) {
      current += char
      escaped = false
      continue
    }

    if (char === '\\' && quote !== "'") {
      escaped = true
      continue
    }

    if (quote) {
      if (char === quote) {
        quote = null
      } else {
        current += char
      }
      continue
    }

    if (char === '"' || char === "'") {
      quote = char
      continue
    }

    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current)
        current = ''
      }
      continue
    }

    current += char
  }

  if (current) {
    tokens.push(current)
  }

  return tokens
}

function normalizeCommand(command) {
  return command.replace(/\\\r?\n/g, ' ').trim()
}

function parseHeader(headerLine) {
  const separatorIndex = headerLine.indexOf(':')
  if (separatorIndex === -1) {
    return [headerLine.trim(), '']
  }

  const name = headerLine.slice(0, separatorIndex).trim()
  const value = headerLine.slice(separatorIndex + 1).trim()
  return [name, value]
}

function toSameOriginPath(urlValue) {
  if (!urlValue) {
    return ''
  }

  if (urlValue.startsWith('/')) {
    return urlValue
  }

  const url = new URL(urlValue)
  if (url.origin !== ENT_ORIGIN) {
    throw new Error('The imported cURL request targets a different host. The local proxy only supports services-numeriques.univ-rennes.fr.')
  }

  return `${url.pathname}${url.search}`
}

export function parseCurlCommand(command) {
  const normalizedCommand = normalizeCommand(command)
  const tokens = shellSplit(normalizedCommand)
  const headers = {}
  const warnings = []
  let method = ''
  let url = ''
  const bodyParts = []

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]

    if (token === 'curl') {
      continue
    }

    if (token === '-X' || token === '--request') {
      method = tokens[index + 1] ?? method
      index += 1
      continue
    }

    if (token === '-H' || token === '--header') {
      const [name, value] = parseHeader(tokens[index + 1] ?? '')
      headers[name] = value
      index += 1
      continue
    }

    if (token === '-b' || token === '--cookie') {
      headers.Cookie = tokens[index + 1] ?? ''
      index += 1
      continue
    }

    if (token === '-d' || token === '--data' || token === '--data-raw' || token === '--data-binary' || token === '--data-ascii') {
      bodyParts.push(tokens[index + 1] ?? '')
      index += 1
      continue
    }

    if (token === '--url') {
      url = tokens[index + 1] ?? url
      index += 1
      continue
    }

    if (token.startsWith('http://') || token.startsWith('https://') || token.startsWith('/')) {
      url = token
      continue
    }

    if (token.startsWith('-')) {
      warnings.push(`Ignored unsupported curl flag: ${token}`)
    }
  }

  const cookie = headers.Cookie ?? headers.cookie ?? ''
  const referer = headers.Referer ?? headers.referer ?? ''
  delete headers.Cookie
  delete headers.cookie
  delete headers.Referer
  delete headers.referer

  return {
    method: method || (bodyParts.length > 0 ? 'POST' : 'GET'),
    url,
    path: toSameOriginPath(url),
    body: bodyParts.join('&'),
    cookie,
    referer,
    headers,
    warnings,
  }
}
