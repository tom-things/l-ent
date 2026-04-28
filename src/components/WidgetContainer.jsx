import { useCallback, useEffect, useState } from 'react'
import { Icon } from '@iconify/react'
import AvailableApplications from './AvailableApplications'
import WidgetAverageGrade from './WidgetAverageGrade'
import WidgetLatestGrade from './WidgetLatestGrade'
import WidgetNextClass from './WidgetNextClass'
import {
  getCurrentLocationWeather,
  getEditableLocationLabel,
  getWeatherForQuery,
} from '../weatherApi'

const WEATHER_CITY_KEY = 'l-ent:weather-city'
const DEFAULT_WEATHER_CITY = 'Rennes'

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
      morning: ['On démarre.', 'Nouveau lundi.', 'C\u2019est parti.', 'Lundi matin.'],
      afternoon: ['Lundi file.', 'Bon rythme.', 'On tient bon.', 'Cap maintenu.'],
      evening: ['Lundi plié.', 'Premier jour ok.', 'Lundi bouclé.', 'Bonne soirée.'],
    },
    mardi: {
      morning: ['Mardi démarre.', 'On enchaîne.', 'Bonne énergie.', 'Mardi matin.'],
      afternoon: ['Mardi roule.', 'Belle cadence.', 'Bien lancé.', 'On continue.'],
      evening: ['Mardi bouclé.', 'Deux jours faits.', 'Bonne soirée.', 'Mardi rangé.'],
    },
    mercredi: {
      morning: ['Mi-semaine.', 'Mercredi léger.', 'À mi-chemin.', 'On garde le fil.'],
      afternoon: ['Mercredi roule.', 'Cap franchi.', 'On continue.', 'Belle dynamique.'],
      evening: ['Mi-semaine ok.', 'On souffle.', 'Mercredi calme.', 'Le pire est fait.'],
    },
    jeudi: {
      morning: ['Jeudi matin.', 'On y est presque.', 'Avant-dernier.', 'Bonne énergie.'],
      afternoon: ['Jeudi avance.', 'Le bout approche.', 'On garde le cap.', 'Bientôt fini.'],
      evening: ['Jeudi rangé.', 'Presque au bout.', 'Plus qu\u2019un jour.', 'Bonne soirée.'],
    },
    vendredi: {
      morning: ['Vendredi !', 'Dernier jour.', 'Bel élan.', 'Week-end en vue.'],
      afternoon: ['Presque libre.', 'Dernière ligne.', 'Week-end proche.', 'Bientôt fini.'],
      evening: ['Souffle mérité.', 'Semaine pliée.', 'Week-end !', 'Bien joué.'],
    },
    samedi: {
      morning: ['Samedi tranquille.', 'Pas de pression.', 'Week-end !', 'À ton rythme.'],
      afternoon: ['Profite bien.', 'Samedi doux.', 'Bon week-end.', 'À ton tempo.'],
      evening: ['Soirée tranquille.', 'On décompresse.', 'Samedi calme.', 'Bonne soirée.'],
    },
    dimanche: {
      morning: ['Dimanche doux.', 'Prends ton temps.', 'Tranquille.', 'Bonne grasse mat\u2019.'],
      afternoon: ['On recharge.', 'Dimanche calme.', 'Savoure bien.', 'Profite.'],
      evening: ['On prépare lundi.', 'Demain reparti.', 'Bonne soirée.', 'On recharge.'],
    },
  }

  const pool = messages[weekday]?.[dayPeriod]
  if (!pool) return 'Bonne journée !'
  const dayOfYear = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 86400000)
  return pool[dayOfYear % pool.length]
}

function WidgetContainer({
  userName = ' ',
  greeting,
  isSessionReady = true,
  establishment = null,
  sessionUser = null,
  selectedPlanningSelection = null,
  debugNextClass = false,
  canUseServerLaunch = true,
  hideNextClass = false,
  hideGradeWidgets = false,
  favoritesPortalTarget = null,
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
      const resolvedCity = getEditableLocationLabel(nextWeather.location)
      if (resolvedCity) {
        localStorage.setItem(WEATHER_CITY_KEY, resolvedCity)
      }
      return nextWeather
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
          : await getWeatherForQuery(DEFAULT_WEATHER_CITY)

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
      <div className="flex flex-wrap gap-5 items-stretch max-2xl:gap-[14px] max-md:gap-[10px] overflow-hidden p-2 -m-2">
        <article className={`widget-card shadow-md flex-[0_1_240px] h-[148px] p-5 border border-white rounded-[1.75rem] overflow-hidden bg-widget-bg text-base leading-6 min-w-0 max-2xl:flex-[1_1_calc(50%-7px)] max-2xl:min-w-[min(240px,100%)] max-md:min-h-[132px] max-md:h-auto max-md:p-4 max-md:rounded-3xl max-xs:flex-[1_1_calc(50%-5px)] max-xs:min-w-0 flex flex-col justify-end gap-[6px] text-text ${areWidgetsVisible ? 'widget-card-visible delay-[80ms]' : ''}`}>
          <Icon icon="ph:hand-waving" className="greeting-icon w-10 h-10 text-inherit shrink-0 max-md:w-[34px] max-md:h-[34px]" aria-hidden="true" />
          <h2 className="m-0 leading-[1.06] text-2xl font-bold whitespace-nowrap max-md:overflow-hidden max-md:text-ellipsis max-md:text-[22px]" title={`Salut ${displayName} !`}>Salut {displayName} !</h2>
          <p className="m-0 leading-[1.06] text-base font-medium whitespace-nowrap overflow-hidden text-ellipsis max-md:whitespace-normal max-md:line-clamp-2 max-md:leading-[1.2] max-md:text-[15px]" title={greetingSubtitle}>{greetingSubtitle}</p>
        </article>

        {!hideNextClass && (establishment === 'iutlan' || debugNextClass) ? (
          <div id="sidebar-section-planning" className="contents">
            <WidgetNextClass
              visible={areWidgetsVisible}
              debug={debugNextClass}
              selection={selectedPlanningSelection}
              sessionUser={sessionUser}
            />
          </div>
        ) : null}
        {!hideGradeWidgets && establishment === 'iutlan' ? (
          <div id="sidebar-section-grades" className="flex-[1_1_100%] min-w-0 flex items-stretch gap-5 max-2xl:gap-[14px] max-md:gap-[10px] 2xl:contents">
            <WidgetAverageGrade visible={areWidgetsVisible} />
            <WidgetLatestGrade visible={areWidgetsVisible} />
          </div>
        ) : null}
      </div>

      <div id="sidebar-section-applications">
        <AvailableApplications
          establishment={establishment}
          canUseServerLaunch={canUseServerLaunch}
          favoritesPortalTarget={favoritesPortalTarget}
        />
      </div>

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
