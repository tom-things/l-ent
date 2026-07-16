import { useCallback, useEffect, useState } from 'react'
import { Icon } from '@iconify/react'
import universityConfig from '@university'
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
const WEATHER_CONFIG = universityConfig.features?.weather ?? {}
const DEFAULT_WEATHER_CITY = WEATHER_CONFIG.defaultCity || 'Paris'

function getEstablishmentConfig(establishment) {
  return universityConfig.establishments?.byId?.[establishment] ?? null
}

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
      morning: [
        'Nouveau lundi, on démarre tranquillement la semaine.',
        'C\u2019est reparti pour cinq jours, prends ton café.',
        'Lundi matin, rien ne sert de courir trop vite.',
        'Une nouvelle semaine commence, à toi de jouer.',
      ],
      afternoon: [
        'Lundi avance bien, garde un bon rythme.',
        'L\u2019après-midi file, on tient bon jusqu\u2019au bout.',
        'Belle cadence pour un lundi, continue comme ça.',
        'Cap maintenu, la semaine est bien lancée.',
      ],
      evening: [
        'Premier jour bouclé, tu peux souffler un peu.',
        'Lundi plié, le plus dur est derrière toi.',
        'Bonne soirée, profite avant de recommencer demain.',
        'Une journée de moins, encore quatre à venir.',
      ],
    },
    mardi: {
      morning: [
        'Mardi démarre, on enchaîne avec la même énergie.',
        'Deuxième round, tu as déjà pris le pli.',
        'Bonne énergie pour ce mardi, tout va bien.',
        'Encore un matin, encore une occasion d\u2019avancer.',
      ],
      afternoon: [
        'Mardi roule, belle cadence à garder jusqu\u2019au bout.',
        'L\u2019après-midi est bien lancée, on continue.',
        'Tu tiens un bon rythme, ne lâche rien maintenant.',
        'Le mardi passe vite quand on est dedans.',
      ],
      evening: [
        'Mardi bouclé, deux jours déjà derrière toi.',
        'Bonne soirée, la semaine prend forme tranquillement.',
        'Mardi terminé, repose-toi un peu maintenant.',
        'Deux jours de faits, plus que trois avant le week-end.',
      ],
    },
    mercredi: {
      morning: [
        'Mi-semaine, la moitié du chemin est déjà faite.',
        'Mercredi matin, le plus dur est derrière toi.',
        'À mi-chemin, garde le fil sans te brusquer.',
        'Mercredi léger, profite de ce petit répit bien mérité.',
      ],
      afternoon: [
        'Mercredi roule, le cap est franchi proprement.',
        'Belle dynamique aujourd\u2019hui, on garde le tempo.',
        'L\u2019après-midi avance bien, continue ainsi.',
        'Encore quelques heures et la pente descend.',
      ],
      evening: [
        'Mercredi bouclé, la semaine bascule du bon côté.',
        'On souffle un peu, demain c\u2019est la descente.',
        'Mercredi calme, savoure cette petite pause.',
        'La deuxième moitié de semaine commence bientôt.',
      ],
    },
    jeudi: {
      morning: [
        'Jeudi matin, tu es presque au bout de la semaine.',
        'Avant-dernier jour, l\u2019énergie est encore là.',
        'Plus qu\u2019un effort, le week-end pointe son nez.',
        'Bonne énergie pour ce jeudi, ça avance fort.',
      ],
      afternoon: [
        'Jeudi avance, le bout du tunnel approche.',
        'On garde le cap, demain c\u2019est vendredi.',
        'L\u2019après-midi file, plus très loin maintenant.',
        'Encore un peu de patience, ça paye toujours.',
      ],
      evening: [
        'Jeudi plié, plus qu\u2019une journée à tenir.',
        'Presque au bout, la lumière est en vue.',
        'Bonne soirée, demain ça sent déjà le week-end.',
        'Un dernier dodo et c\u2019est vendredi enfin.',
      ],
    },
    vendredi: {
      morning: [
        'Vendredi enfin, dernier jour de la semaine.',
        'Bel élan, le week-end est à portée de main.',
        'Dernier round, donne tout ce qu\u2019il te reste.',
        'Vendredi matin, l\u2019odeur du week-end approche.',
      ],
      afternoon: [
        'Presque libre, encore quelques heures à tenir.',
        'Dernière ligne droite, le week-end est tout proche.',
        'Bientôt fini, garde l\u2019énergie jusqu\u2019au bout.',
        'L\u2019après-midi file, on aperçoit déjà le repos.',
      ],
      evening: [
        'Semaine pliée, ton week-end commence maintenant.',
        'Souffle mérité, profite bien de chaque minute.',
        'Week-end enfin, tu l\u2019as bien gagné.',
        'Bien joué, tu peux débrancher jusqu’à lundi.',
      ],
    },
    samedi: {
      morning: [
        'Samedi tranquille, aucune pression à avoir aujourd\u2019hui.',
        'Week-end installé, prends le temps qu\u2019il te faut.',
        'Samedi matin, savoure cette grasse matinée.',
        'À ton rythme, la journée t\u2019appartient totalement.',
      ],
      afternoon: [
        'Profite bien, l\u2019après-midi t\u2019appartient.',
        'Samedi doux, fais ce qui te fait plaisir.',
        'Bon week-end, recharge à fond les batteries.',
        'À ton tempo, rien d\u2019obligatoire aujourd\u2019hui.',
      ],
      evening: [
        'Soirée tranquille, le week-end continue calmement.',
        'On décompresse, demain c\u2019est encore week-end.',
        'Samedi calme, savoure ce moment pour toi.',
        'Bonne soirée, profite sans culpabiliser.',
      ],
    },
    dimanche: {
      morning: [
        'Dimanche doux, prends vraiment ton temps ce matin.',
        'Grasse matinée méritée, savoure-la sans remords.',
        'Dimanche tranquille, aucune urgence à l\u2019horizon.',
        'Réveil en douceur, la journée est à toi.',
      ],
      afternoon: [
        'On recharge tranquillement avant la semaine.',
        'Dimanche calme, profite encore un peu.',
        'Savoure bien, il reste quelques heures de répit.',
        'Profite à fond, demain on repart pour cinq jours.',
      ],
      evening: [
        'On prépare doucement lundi, sans se presser.',
        'Demain reparti, mais ce soir reste tranquille.',
        'Bonne soirée, fais le plein avant la reprise.',
        'On recharge une dernière fois pour la semaine.',
      ],
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
  nextClassLookaheadDays = undefined,
  debugNextClass = false,
  canUseServerLaunch = true,
  hideNextClass = false,
  hideGradeWidgets = false,
  favoritesPortalTarget = null,
}) {
  const displayName = userName?.trim() || ' '
  const greetingSubtitle = greeting ?? getGreetingSubtitle()
  const [, setWeatherState] = useState(INITIAL_WEATHER_STATE)
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
      if (WEATHER_CONFIG.enabled === false) {
        setHasWeatherLoaded(true)
        setIsWeatherLoading(false)
        return
      }

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
      <div className="flex flex-wrap gap-5 items-stretch max-2xl:gap-[14px] max-md:gap-[10px] overflow-visible p-2 -m-2">
        <article className={`widget-card shadow-md flex-[0_1_280px] min-h-[148px] p-5 border border-white rounded-[1.75rem] overflow-hidden bg-widget-bg text-base leading-6 min-w-0 max-2xl:flex-[1_1_calc(50%-7px)] max-2xl:min-w-[min(280px,100%)] max-md:min-h-[132px] max-md:p-4 max-md:rounded-3xl max-xs:flex-[1_1_calc(50%-5px)] max-xs:min-w-0 flex flex-col justify-end gap-1 text-text ${areWidgetsVisible ? 'widget-card-visible delay-[80ms]' : ''}`}>
          <Icon icon="ph:hand-waving" className="greeting-icon w-[34px] h-[34px] text-inherit shrink-0" aria-hidden="true" />
          <h2 className="m-0 min-w-0 leading-[1.15] text-2xl font-bold overflow-hidden text-ellipsis whitespace-nowrap max-md:text-[22px]" title={`Salut ${displayName} !`}>Salut {displayName} !</h2>
          <p className="m-0 leading-[1.2] text-[15px] font-medium line-clamp-2" title={greetingSubtitle}>{greetingSubtitle}</p>
        </article>

        {!hideNextClass && (getEstablishmentConfig(establishment)?.nextClassWidget || debugNextClass) ? (
          <div id="sidebar-section-planning" className="contents">
            <WidgetNextClass
              visible={areWidgetsVisible}
              debug={debugNextClass}
              selection={selectedPlanningSelection}
              sessionUser={sessionUser}
              lookaheadDays={nextClassLookaheadDays}
            />
          </div>
        ) : null}
        {!hideGradeWidgets && Boolean(universityConfig.features?.grades) && getEstablishmentConfig(establishment)?.gradeWidgets ? (
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
                  placeholder={`Ex: ${DEFAULT_WEATHER_CITY} ou 35000`}
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
