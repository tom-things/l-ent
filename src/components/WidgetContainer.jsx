import { useCallback, useEffect, useState } from 'react'
import { Icon } from '@iconify/react'
import AvailableApplications from './AvailableApplications'
import WidgetAverageGrade from './WidgetAverageGrade'
import WidgetLatestGrade from './WidgetLatestGrade'
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
  gradient: 'linear-gradient(180deg, #fde68a 0%, transparent 55%)',
  gradientDark: 'linear-gradient(180deg, #5c3d0e 0%, transparent 55%)',
}

function getLoadingWeatherState(previousState) {
  return {
    summary: 'Chargement météo...',
    location: previousState?.location || 'Localisation...',
    icon: previousState?.icon || 'carbon:cloudy',
    gradient: previousState?.gradient ?? INITIAL_WEATHER_STATE.gradient,
    gradientDark: previousState?.gradientDark ?? INITIAL_WEATHER_STATE.gradientDark,
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
      evening: 'Mercredi s\u2019étire tout en douceur.',
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
    <section className="w-full grid gap-8 pt-6 px-10 pb-10 max-md:px-4 max-md:pt-4 max-md:pb-8 max-md:gap-6" aria-label="Widgets">
      <div className="flex flex-wrap gap-5 items-stretch max-2xl:gap-[14px] max-md:gap-[10px]">
        <article className={`widget-card shadow-md flex-[0_1_217px] min-h-[120px] p-5 border border-white rounded-[1.75rem] overflow-hidden bg-widget-bg text-base leading-6 min-w-0 max-2xl:flex-[1_1_calc(50%-7px)] max-2xl:min-w-[min(280px,100%)] max-md:min-h-[108px] max-md:p-4 max-md:rounded-3xl max-xs:flex-[1_1_100%] max-xs:min-w-0 flex flex-col justify-end gap-[3px] text-text ${areWidgetsVisible ? 'widget-card-visible delay-[80ms]' : ''}`}>
          <Icon icon="ph:hand-waving" className="greeting-icon w-10 h-10 text-inherit shrink-0 max-md:w-[34px] max-md:h-[34px]" aria-hidden="true" />
          <h2 className="m-0 leading-[1.06] text-2xl font-bold max-md:text-[22px]">Salut {displayName} !</h2>
          <p className="m-0 leading-[1.06] text-base font-medium max-md:text-[15px]">{greetingSubtitle}</p>
        </article>

        <article className={`widget-card shadow-md flex-[0_1_217px] min-h-[120px] border border-white rounded-[1.75rem] overflow-hidden bg-widget-bg text-base leading-6 min-w-0 max-2xl:flex-[1_1_calc(50%-7px)] max-2xl:min-w-[min(280px,100%)] max-md:min-h-[108px] max-md:rounded-3xl max-xs:flex-[1_1_100%] max-xs:min-w-0 flex p-0 max-md:p-0 ${areWidgetsVisible ? 'widget-card-visible delay-[180ms]' : ''}`}>
          <div
            className="weather-widget-inner flex-1 flex flex-col justify-end gap-[3px] p-5 rounded-[18px] text-text max-md:w-full max-md:min-h-full max-md:p-4 max-md:rounded-[15px]"
            style={{ '--weather-gradient': weatherState.gradient, '--weather-gradient-dark': weatherState.gradientDark }}
          >
            <Icon icon={weatherState.icon} className="w-10 h-10 text-text shrink-0 max-md:w-[34px] max-md:h-[34px]" aria-hidden="true" />

            <div className="flex flex-col gap-[2px]">
              <p className="m-0 leading-[1.06] text-base font-medium text-inherit max-md:text-[15px]">{weatherState.summary}</p>

              <div className="flex items-center gap-[6px]">
                <p className="m-0 leading-[1.06] text-base font-medium text-inherit max-md:text-[15px]">{weatherState.location}</p>
                <button
                  type="button"
                  className="inline-flex items-center justify-center w-[17px] h-[17px] p-0 border-0 bg-transparent text-inherit disabled:opacity-60 disabled:cursor-wait"
                  onClick={handleOpenLocationPicker}
                  aria-label="Modifier la localisation météo"
                  disabled={isLocationActionDisabled}
                >
                  <Icon icon="carbon:edit" className="w-[17px] h-[17px]" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        </article>

        {establishment === 'iutlan' ? (
          <>
            <WidgetAverageGrade visible={areWidgetsVisible} />
            <WidgetLatestGrade visible={areWidgetsVisible} />
          </>
        ) : null}
      </div>

      <AvailableApplications establishment={establishment} />

      {isLocationPickerOpen ? (
        <div
          className="weather-modal-backdrop fixed inset-0 z-40 bg-backdrop flex items-center justify-center p-5 animate-modal-backdrop-in max-md:p-[14px]"
          onClick={isLocationActionDisabled ? undefined : handleCloseLocationPicker}
          role="presentation"
        >
          <div
            className="weather-modal-card w-[min(440px,100%)] border border-border rounded-[22px] bg-bg shadow-none p-5 text-text animate-modal-card-in max-md:rounded-[20px] max-md:p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Choisir le lieu de la météo"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-[14px]">
              <h3 className="m-0 text-[28px] font-bold leading-[0.95] tracking-[-0.01em] max-md:text-2xl">Choisir le lieu météo</h3>
              <button
                type="button"
                className="ml-auto w-[38px] h-[38px] p-0 border border-border-input rounded-full bg-bg-input text-text inline-flex items-center justify-center transition-[background-color,opacity] duration-[120ms] ease-in-out hover:not-disabled:bg-bg-subtle disabled:opacity-60 disabled:cursor-wait"
                onClick={handleCloseLocationPicker}
                disabled={isLocationActionDisabled}
                aria-label="Fermer la modale de lieu météo"
              >
                <Icon icon="carbon:close" className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <form className="flex flex-col gap-[14px]" onSubmit={(event) => void handleSubmitLocation(event)}>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-semibold leading-none text-text font-body">Ville ou code postal</span>
                <input
                  type="text"
                  className="w-full min-h-[48px] border border-border-input rounded-[53px] bg-bg-input text-text font-inherit text-base leading-none py-[13px] px-4 box-border placeholder:text-text-muted focus-visible:border-brand focus-visible:outline-none font-body"
                  value={locationQuery}
                  onChange={(event) => setLocationQuery(event.target.value)}
                  placeholder="Ex: Rennes ou 35000"
                  disabled={isLocationActionDisabled}
                />
              </label>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="submit"
                  className="min-h-[42px] px-[18px] border-0 rounded-[53px] bg-brand text-bg font-inherit text-[15px] font-semibold leading-none transition-[background-color,opacity] duration-[120ms] ease-in-out hover:not-disabled:bg-brand-hover disabled:opacity-60 disabled:cursor-wait"
                  disabled={isLocationActionDisabled}
                >
                  Appliquer
                </button>
                <button
                  type="button"
                  className="min-h-[42px] px-[18px] border border-border-input rounded-[53px] bg-bg-input text-text font-inherit text-[15px] font-semibold leading-none transition-[background-color,opacity] duration-[120ms] ease-in-out hover:not-disabled:bg-bg-subtle disabled:opacity-60 disabled:cursor-wait"
                  onClick={() => void handleUseCurrentPosition()}
                  disabled={isLocationActionDisabled}
                >
                  Ma position
                </button>
              </div>

              {locationError ? <p className="m-0 text-[13px] font-semibold leading-[1.15] text-error font-body">{locationError}</p> : null}
            </form>
          </div>
        </div>
      ) : null}
    </section>
  )
}

export default WidgetContainer
