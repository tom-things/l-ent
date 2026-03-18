import { useCallback, useEffect, useState } from 'react'
import { Icon } from '@iconify/react'
import AvailableApplications from './AvailableApplications'
import './WidgetContainer.css'
import {
  getCurrentLocationWeather,
  getEditableLocationLabel,
  getWeatherForQuery,
} from '../weatherApi'

const WEATHER_CITY_KEY = 'l-ent:weather-city'

const INITIAL_WEATHER_STATE = {
  summary: 'Chargement météo...',
  location: 'Localisation...',
  icon: 'carbon:cloudy',
  gradient: 'linear-gradient(180deg, #ffb1d2 4.11%, #f6ea00 35.01%, #dfffae 69.27%, #fafafa 99.76%)',
}

function getLoadingWeatherState(previousState) {
  return {
    summary: 'Chargement météo...',
    location: previousState?.location || 'Localisation...',
    icon: previousState?.icon || 'carbon:cloudy',
    gradient: previousState?.gradient || INITIAL_WEATHER_STATE.gradient,
  }
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error)
}

function getGreetingSubtitle(date = new Date()) {
  const weekday = new Intl.DateTimeFormat('fr-FR', { weekday: 'long' }).format(date)
  const hour = date.getHours()
  const dayPeriod = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'

  const messages = {
    lundi: {
      morning: 'On lance la semaine.',
      afternoon: 'Lundi file, on garde le cap.',
      evening: 'Lundi plié, cap sur la suite.',
    },
    mardi: {
      morning: 'Mardi démarre déjà en rythme.',
      afternoon: 'Mardi tient la cadence sans broncher.',
      evening: 'Mardi se termine proprement.',
    },
    mercredi: {
      morning: 'Mercredi léger, idées bien réveillées.',
      afternoon: 'Mercredi roule sans perdre le fil.',
      evening: 'Mercredi s’étire tout en douceur.',
    },
    jeudi: {
      morning: 'Jeudi pose de bonnes bases.',
      afternoon: 'Jeudi avance, proprement.',
      evening: 'Jeudi se range, mission tenue.',
    },
    vendredi: {
      morning: 'Vendredi arrive avec un bel élan.',
      afternoon: 'Dernière ligne droite avant le week-end.',
      evening: 'Vendredi soir, souffle mérité.',
    },
    samedi: {
      morning: 'Samedi tranquille, rythme plus libre.',
      afternoon: 'Samedi doux pour faire à son tempo.',
      evening: 'Samedi calme, esprit léger.',
    },
    dimanche: {
      morning: 'Dimanche doux avant la relance.',
      afternoon: 'Dimanche prend son temps.',
      evening: 'Dimanche soir, on prépare la suite.',
    },
  }

  return messages[weekday]?.[dayPeriod] ?? "Bonne journée sur l'université de Rennes."
}

function WidgetContainer({
  userName = ' ',
  greeting,
  isSessionReady = true,
  account = null,
  establishment = null,
}) {
  const displayName = userName?.trim() || ' '
  const greetingSubtitle = greeting ?? getGreetingSubtitle()
  const [weatherState, setWeatherState] = useState(INITIAL_WEATHER_STATE)
  const [hasWeatherLoaded, setHasWeatherLoaded] = useState(false)
  const [areWidgetsVisible, setAreWidgetsVisible] = useState(false)
  const [isWeatherLoading, setIsWeatherLoading] = useState(true)
  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false)
  const [locationQuery, setLocationQuery] = useState('')
  const [locationError, setLocationError] = useState('')

  const loadCurrentWeather = useCallback(async () => {
    setIsWeatherLoading(true)
    setWeatherState((current) => getLoadingWeatherState(current))

    try {
      const nextWeather = await getCurrentLocationWeather()
      setWeatherState(nextWeather)
    } finally {
      setIsWeatherLoading(false)
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    async function hydrateWeather() {
      setIsWeatherLoading(true)

      try {
        const storedCity = localStorage.getItem(WEATHER_CITY_KEY)
        const nextWeather = storedCity
          ? await getWeatherForQuery(storedCity)
          : await getCurrentLocationWeather()

        if (isMounted) {
          setWeatherState(nextWeather)
          setHasWeatherLoaded(true)
        }
      } catch {
        if (isMounted) {
          setWeatherState({
            summary: 'Météo indisponible',
            location: 'Choisir une ville',
            icon: 'carbon:cloudy',
            gradient: INITIAL_WEATHER_STATE.gradient,
          })
          setHasWeatherLoaded(true)
        }
      } finally {
        if (isMounted) {
          setIsWeatherLoading(false)
        }
      }
    }

    void hydrateWeather()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (!isSessionReady || !hasWeatherLoaded || areWidgetsVisible) {
      return undefined
    }

    const timeoutId = window.setTimeout(() => {
      setAreWidgetsVisible(true)
    }, 140)

    return () => window.clearTimeout(timeoutId)
  }, [areWidgetsVisible, hasWeatherLoaded, isSessionReady])

  useEffect(() => {
    if (!isLocationPickerOpen) {
      return undefined
    }

    function handleEscape(event) {
      if (event.key === 'Escape' && !isWeatherLoading) {
        setIsLocationPickerOpen(false)
        setLocationError('')
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isLocationPickerOpen, isWeatherLoading])

  const handleOpenLocationPicker = useCallback(() => {
    const suggestedLocation = getEditableLocationLabel(weatherState.location)
    setLocationQuery(suggestedLocation)
    setLocationError('')
    setIsLocationPickerOpen(true)
  }, [weatherState.location])

  const handleCloseLocationPicker = useCallback(() => {
    setIsLocationPickerOpen(false)
    setLocationError('')
  }, [])

  const handleUseCurrentPosition = useCallback(async () => {
    try {
      setLocationError('')
      localStorage.removeItem(WEATHER_CITY_KEY)
      await loadCurrentWeather()
      setIsLocationPickerOpen(false)
    } catch (error) {
      setLocationError(getErrorMessage(error))
    }
  }, [loadCurrentWeather])

  const handleSubmitLocation = useCallback(async (event) => {
    event.preventDefault()
    const trimmedQuery = locationQuery.trim()

    try {
      if (!trimmedQuery) {
        setLocationError('Saisis une ville/code postal ou choisis "Ma position".')
        return
      }

      setIsWeatherLoading(true)
      setLocationError('')
      const nextWeather = await getWeatherForQuery(trimmedQuery)
      setWeatherState(nextWeather)
      localStorage.setItem(WEATHER_CITY_KEY, trimmedQuery)
      setIsLocationPickerOpen(false)
    } catch (error) {
      setLocationError(getErrorMessage(error))
    } finally {
      setIsWeatherLoading(false)
    }
  }, [locationQuery])

  const isLocationActionDisabled = isWeatherLoading

  return (
    <section className="widget-container-shell" aria-label="Widgets">
      <div className="widget-container">
        <article className={`widget-card greeting-widget ${areWidgetsVisible ? 'widget-card--visible widget-card--delay-1' : ''}`}>
          <Icon icon="ph:hand-waving" className="greeting-widget__icon" aria-hidden="true" />
          <h2 className="widget-card__title">Salut {displayName} !</h2>
          <p className="widget-card__text">{greetingSubtitle}</p>
        </article>

        <article className={`widget-card weather-widget ${areWidgetsVisible ? 'widget-card--visible widget-card--delay-2' : ''}`}>
          <div
            className="weather-widget__inner"
            style={{ '--weather-gradient': weatherState.gradient }}
          >
            <Icon icon={weatherState.icon} className="weather-widget__icon" aria-hidden="true" />

            <div className="weather-widget__content">
              <p className="widget-card__text weather-widget__summary">{weatherState.summary}</p>

              <div className="weather-widget__location-row">
                <p className="widget-card__text weather-widget__location">{weatherState.location}</p>
                <button
                  type="button"
                  className="weather-widget__edit"
                  onClick={handleOpenLocationPicker}
                  aria-label="Modifier la localisation météo"
                  disabled={isLocationActionDisabled}
                >
                  <Icon icon="carbon:edit" className="weather-widget__edit-icon" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        </article>
      </div>

      <AvailableApplications establishment={establishment} />

      {isLocationPickerOpen ? (
        <div
          className="weather-location-modal__backdrop"
          onClick={isLocationActionDisabled ? undefined : handleCloseLocationPicker}
          role="presentation"
        >
          <div
            className="weather-location-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Choisir le lieu de la météo"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="weather-location-modal__header">
              <h3 className="weather-location-modal__title">Choisir le lieu météo</h3>
              <button
                type="button"
                className="weather-widget__picker-close"
                onClick={handleCloseLocationPicker}
                disabled={isLocationActionDisabled}
                aria-label="Fermer la modale de lieu météo"
              >
                <Icon icon="carbon:close" className="weather-widget__picker-close-icon" aria-hidden="true" />
              </button>
            </div>

            <form className="weather-widget__location-picker" onSubmit={(event) => void handleSubmitLocation(event)}>
              <label className="weather-widget__picker-field">
                <span className="weather-widget__picker-label">Ville ou code postal</span>
                <input
                  type="text"
                  value={locationQuery}
                  onChange={(event) => setLocationQuery(event.target.value)}
                  placeholder="Ex: Rennes ou 35000"
                  disabled={isLocationActionDisabled}
                />
              </label>

              <div className="weather-widget__picker-actions">
                <button
                  type="submit"
                  className="weather-widget__picker-button"
                  disabled={isLocationActionDisabled}
                >
                  Appliquer
                </button>
                <button
                  type="button"
                  className="weather-widget__picker-button weather-widget__picker-button--ghost"
                  onClick={() => void handleUseCurrentPosition()}
                  disabled={isLocationActionDisabled}
                >
                  Ma position
                </button>
              </div>

              {locationError ? <p className="weather-widget__picker-error">{locationError}</p> : null}
            </form>
          </div>
        </div>
      ) : null}
    </section>
  )
}

export default WidgetContainer
