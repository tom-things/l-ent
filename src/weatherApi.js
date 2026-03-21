const WEATHER_API_URL = 'https://api.open-meteo.com/v1/forecast'
const GEOCODING_API_URL = 'https://geocoding-api.open-meteo.com/v1'
const REVERSE_GEOCODING_API_URL = 'https://nominatim.openstreetmap.org/reverse'
const DEFAULT_FALLBACK_LOCATION = 'Rennes'
const DEFAULT_GRADIENT_BOTTOM = '#f7f7f5'
const DEFAULT_GRADIENT_BOTTOM_DARK = '#0f0f0f'

function buildWeatherGradient(topColor, middleColor, lowerColor) {
  return `linear-gradient(180deg, ${topColor} 4.11%, ${middleColor} 35.01%, ${lowerColor} 69.27%, ${DEFAULT_GRADIENT_BOTTOM} 99.76%)`
}

function buildWeatherGradientDark(topColor, middleColor, lowerColor) {
  return `linear-gradient(180deg, ${topColor} 4.11%, ${middleColor} 35.01%, ${lowerColor} 69.27%, ${DEFAULT_GRADIENT_BOTTOM_DARK} 99.76%)`
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
        ? buildWeatherGradient('#fce5b8', '#fdefd5', '#fdf5e8')
        : buildWeatherGradient('#c8c0e8', '#d8d2f0', '#e8e4f5'),
      gradientDark: isDay
        ? buildWeatherGradientDark('#2c1e06', '#1e1408', '#15100a')
        : buildWeatherGradientDark('#12102a', '#0e0c1e', '#0c0a14'),
    }
  }

  if ([1, 2].includes(weatherCode)) {
    return {
      label: 'Partiellement nuageux',
      icon: dayPartlyCloudyIcon,
      gradient: isDay
        ? buildWeatherGradient('#fad9c0', '#fce9d8', '#fdf3ec')
        : buildWeatherGradient('#c4bce8', '#d4cef0', '#e6e2f5'),
      gradientDark: isDay
        ? buildWeatherGradientDark('#221608', '#18120a', '#14100a')
        : buildWeatherGradientDark('#100e22', '#0e0c1a', '#0c0a14'),
    }
  }

  if (weatherCode === 3) {
    return {
      label: 'Couvert',
      icon: dayMostlyCloudyIcon,
      gradient: buildWeatherGradient('#c8d8ec', '#d8e5f2', '#e8eff7'),
      gradientDark: buildWeatherGradientDark('#18181e', '#141416', '#111110'),
    }
  }

  if ([45, 48].includes(weatherCode)) {
    return {
      label: 'Brouillard',
      icon: 'carbon:cloudy',
      gradient: buildWeatherGradient('#d4d0e4', '#dedad0', '#eae8ec'),
      gradientDark: buildWeatherGradientDark('#161618', '#141416', '#111110'),
    }
  }

  if ([51, 53, 55, 56, 57].includes(weatherCode)) {
    return {
      label: 'Bruine',
      icon: 'carbon:cloudy',
      gradient: buildWeatherGradient('#c0d4ec', '#d0e2f2', '#e2edf7'),
      gradientDark: buildWeatherGradientDark('#0e1218', '#10141c', '#0f1014'),
    }
  }

  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(weatherCode)) {
    return {
      label: 'Pluie',
      icon: 'carbon:cloudy',
      gradient: buildWeatherGradient('#b8ccec', '#c8daf0', '#dce8f5'),
      gradientDark: buildWeatherGradientDark('#0c1016', '#0e1218', '#0f0f10'),
    }
  }

  if ([71, 73, 75, 77, 85, 86].includes(weatherCode)) {
    return {
      label: 'Neige',
      icon: 'carbon:cloudy',
      gradient: buildWeatherGradient('#d8eef8', '#e5f3fa', '#f0f8fc'),
      gradientDark: buildWeatherGradientDark('#0e1218', '#101418', '#0f1012'),
    }
  }

  if ([95, 96, 99].includes(weatherCode)) {
    return {
      label: 'Orage',
      icon: 'carbon:cloudy',
      gradient: buildWeatherGradient('#c0b8e0', '#cec8e8', '#dedad0'),
      gradientDark: buildWeatherGradientDark('#0c0a1e', '#0e0a18', '#0f0f12'),
    }
  }

  return {
    label: 'Conditions variables',
    icon: 'carbon:cloudy',
    gradient: buildWeatherGradient('#ccd8ec', '#d8e4f0', '#e8eef5'),
    gradientDark: buildWeatherGradientDark('#14141a', '#111118', '#0f0f12'),
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
    gradientDark: descriptor.gradientDark,
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
