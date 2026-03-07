const WEATHER_API_URL = 'https://api.open-meteo.com/v1/forecast'
const GEOCODING_API_URL = 'https://geocoding-api.open-meteo.com/v1'
const REVERSE_GEOCODING_API_URL = 'https://nominatim.openstreetmap.org/reverse'
const DEFAULT_FALLBACK_LOCATION = 'Rennes'
const DEFAULT_GRADIENT_BOTTOM = '#fafafa'

function buildWeatherGradient(topColor, middleColor, lowerColor) {
  return `linear-gradient(180deg, ${topColor} 4.11%, ${middleColor} 35.01%, ${lowerColor} 69.27%, ${DEFAULT_GRADIENT_BOTTOM} 99.76%)`
}

function buildUrl(baseUrl, params) {
  const url = new URL(baseUrl)
  url.search = new URLSearchParams(params).toString()
  return url.toString()
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      ...(options.headers ?? {}),
    },
    ...options,
  })

  if (!response.ok) {
    throw new Error(`La requête météo a échoué (${response.status}).`)
  }

  return response.json()
}

function formatLocation(result) {
  const primaryName = result?.name ?? result?.city ?? result?.admin2 ?? result?.admin1 ?? 'Position inconnue'
  const countryCode = result?.country_code ?? ''
  return countryCode ? `${primaryName}, ${countryCode}` : primaryName
}

function formatNearestCity(address = {}) {
  const primaryName = address.city
    ?? address.town
    ?? address.village
    ?? address.municipality
    ?? address.county
    ?? address.state_district
    ?? address.state
    ?? DEFAULT_FALLBACK_LOCATION
  const countryCode = address.country_code?.toUpperCase() ?? 'FR'

  return countryCode ? `${primaryName}, ${countryCode}` : primaryName
}

function getWeatherDescriptor(weatherCode, isDay) {
  const dayPartlyCloudyIcon = isDay ? 'carbon:partly-cloudy' : 'carbon:partly-cloudy-night'
  const dayMostlyCloudyIcon = isDay ? 'carbon:mostly-cloudy' : 'carbon:mostly-cloudy-night'

  if (weatherCode === 0) {
    return {
      label: isDay ? 'Ensoleillé' : 'Dégagé',
      icon: dayPartlyCloudyIcon,
      gradient: isDay
        ? buildWeatherGradient('#ffa1c0', '#f6ea00', '#dfffae')
        : buildWeatherGradient('#c495ff', '#ff9fd7', '#ceff7c'),
    }
  }

  if ([1, 2].includes(weatherCode)) {
    return {
      label: 'Partiellement nuageux',
      icon: dayPartlyCloudyIcon,
      gradient: isDay
        ? buildWeatherGradient('#ffb1d2', '#ffe63b', '#c8ff9d')
        : buildWeatherGradient('#d49cff', '#ffb4dc', '#d5ff8a'),
    }
  }

  if (weatherCode === 3) {
    return {
      label: 'Couvert',
      icon: dayMostlyCloudyIcon,
      gradient: buildWeatherGradient('#8cb4ff', '#b6f0ff', '#d9ff9c'),
    }
  }

  if ([45, 48].includes(weatherCode)) {
    return {
      label: 'Brouillard',
      icon: 'carbon:cloudy',
      gradient: buildWeatherGradient('#c5b4ff', '#ffdcb0', '#f0ffb8'),
    }
  }

  if ([51, 53, 55, 56, 57].includes(weatherCode)) {
    return {
      label: 'Bruine',
      icon: 'carbon:cloudy',
      gradient: buildWeatherGradient('#6c9dff', '#7ce1ff', '#d8ff8e'),
    }
  }

  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(weatherCode)) {
    return {
      label: 'Pluie',
      icon: 'carbon:cloudy',
      gradient: buildWeatherGradient('#4f7fff', '#61ccff', '#cfff6f'),
    }
  }

  if ([71, 73, 75, 77, 85, 86].includes(weatherCode)) {
    return {
      label: 'Neige',
      icon: 'carbon:cloudy',
      gradient: buildWeatherGradient('#9de6ff', '#d5fbff', '#f1ffba'),
    }
  }

  if ([95, 96, 99].includes(weatherCode)) {
    return {
      label: 'Orage',
      icon: 'carbon:cloudy',
      gradient: buildWeatherGradient('#9c7aff', '#ff89cf', '#f3f05a'),
    }
  }

  return {
    label: 'Conditions variables',
    icon: 'carbon:cloudy',
    gradient: buildWeatherGradient('#ffb1d2', '#f6ea00', '#d8ff9a'),
  }
}

function extractWeatherPayload(weatherResponse, locationLabel) {
  const currentWeather = weatherResponse?.current_weather

  if (!currentWeather) {
    throw new Error('Les données météo sont indisponibles.')
  }

  const weatherCode = currentWeather.weathercode
  const descriptor = getWeatherDescriptor(weatherCode, Boolean(currentWeather.is_day))
  const roundedTemperature = Math.round(currentWeather.temperature)

  return {
    summary: `${roundedTemperature}°C, ${descriptor.label}`,
    location: locationLabel,
    icon: descriptor.icon,
    gradient: descriptor.gradient,
  }
}

function getCurrentPosition() {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.reject(new Error('La géolocalisation n’est pas disponible sur cet appareil.'))
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        resolve({
          latitude: coords.latitude,
          longitude: coords.longitude,
        })
      },
      () => reject(new Error('La position actuelle n’a pas pu être récupérée.')),
      {
        enableHighAccuracy: false,
        timeout: 8000,
        maximumAge: 30 * 60 * 1000,
      },
    )
  })
}

async function getNearestCityForCoordinates(latitude, longitude) {
  const reverseUrl = buildUrl(REVERSE_GEOCODING_API_URL, {
    lat: String(latitude),
    lon: String(longitude),
    format: 'jsonv2',
    zoom: '10',
    addressdetails: '1',
    'accept-language': 'fr',
  })

  try {
    const reverseResponse = await fetchJson(reverseUrl, {
      headers: {
        'Accept-Language': 'fr',
      },
    })

    return formatNearestCity(reverseResponse?.address)
  } catch {
    return DEFAULT_FALLBACK_LOCATION
  }
}

export async function getWeatherForCoordinates(latitude, longitude) {
  const weatherUrl = buildUrl(WEATHER_API_URL, {
    latitude: String(latitude),
    longitude: String(longitude),
    current_weather: 'true',
    timezone: 'auto',
  })

  const [weatherResponse, locationLabel] = await Promise.all([
    fetchJson(weatherUrl),
    getNearestCityForCoordinates(latitude, longitude),
  ])

  return extractWeatherPayload(weatherResponse, locationLabel)
}

export async function getWeatherForQuery(query) {
  const trimmedQuery = query.trim()

  if (!trimmedQuery) {
    throw new Error('Merci de saisir une ville ou un code postal.')
  }

  const searchUrl = buildUrl(`${GEOCODING_API_URL}/search`, {
    name: trimmedQuery,
    count: '1',
    language: 'fr',
    format: 'json',
  })

  const searchResponse = await fetchJson(searchUrl)
  const locationResult = searchResponse?.results?.[0]

  if (!locationResult) {
    throw new Error('Aucune localité trouvée.')
  }

  const weatherPayload = await getWeatherForCoordinates(locationResult.latitude, locationResult.longitude)

  return {
    ...weatherPayload,
    location: formatLocation(locationResult),
  }
}

export async function getCurrentLocationWeather() {
  try {
    const coords = await getCurrentPosition()
    return getWeatherForCoordinates(coords.latitude, coords.longitude)
  } catch {
    return getWeatherForQuery(DEFAULT_FALLBACK_LOCATION)
  }
}

export function getEditableLocationLabel(locationLabel) {
  return locationLabel.split(',')[0]?.trim() ?? ''
}
