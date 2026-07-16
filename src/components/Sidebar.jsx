import { useCallback, useState } from 'react'
import { Icon } from '@iconify/react'
import universityConfig from '@university'
import UniversityLockup from './UniversityLockup'
import UpdateNotice from './UpdateNotice'
import { ENT_AUTH_PREFIX } from '../entApi'
import { GRADES_UNAVAILABLE_DETAIL, GRADES_UNAVAILABLE_TITLE } from '../gradeFeatureState'

const PLANNING_SERVICE_URL = universityConfig.planning?.serviceUrl ?? null
const PLANNING_HREF = PLANNING_SERVICE_URL
  ? `${ENT_AUTH_PREFIX}/launch?url=${encodeURIComponent(PLANNING_SERVICE_URL)}`
  : null

function buildNavItems(establishment) {
  const showGradesNav = Boolean(universityConfig.features?.grades)
    && universityConfig.establishments?.byId?.[establishment]?.gradeWidgets

  return [
    {
      id: 'applications',
      label: 'Toutes les applications',
      icon: 'carbon:app-switcher',
      targetId: 'sidebar-section-applications',
    },
    // Grades nav (and their unavailability notice) only for establishments
    // whose config enables grade widgets.
    ...(showGradesNav
      ? [{
          id: 'grades',
          label: 'Mes notes',
          icon: 'carbon:chart-pie',
          disabled: true,
          disabledTitle: GRADES_UNAVAILABLE_TITLE,
          disabledDetail: GRADES_UNAVAILABLE_DETAIL,
        }]
      : []),
    ...(universityConfig.features?.planning && PLANNING_HREF
      ? [{
          id: 'planning',
          label: 'Planning',
          icon: 'carbon:calendar',
          href: PLANNING_HREF,
          target: '_blank',
        }]
      : []),
  ]
}

function Sidebar({
  authenticated,
  checking,
  userName,
  userSubtitle,
  profilePhotoSrc,
  onLogout,
  onAccountClick,
  favoritesSlotRef = null,
  hasPendingUpdate = false,
  onUpdateClick,
  establishment = null,
}) {
  const [activeSection, setActiveSection] = useState('applications')
  const navItems = buildNavItems(establishment)

  const handleNavigate = useCallback((item) => {
    if (typeof document === 'undefined') {
      return
    }

    if (item.disabled) {
      return
    }

    if (item.href) {
      if (item.target === '_blank') {
        window.open(item.href, '_blank', 'noopener,noreferrer')
        return
      }

      window.location.assign(item.href)
      return
    }

    setActiveSection(item.id)
    const target = document.getElementById(item.targetId)
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [])

  const initials = (userName || '?').trim().charAt(0).toUpperCase()

  return (
    <aside
      className="hidden 4xl:flex flex-col justify-between p-[30px] w-[340px] shrink-0 bg-[#f5f3ec] dark:bg-[#141414] border-r border-border h-screen overflow-y-auto"
      aria-label="Navigation principale"
    >
      <div className="flex flex-col gap-[35px] w-full">
        <a
          href="/"
          className="inline-flex items-center no-underline"
          aria-label="Retour à l'accueil"
        >
          <UniversityLockup variant="sidebar" />
        </a>

        <nav className="flex flex-col w-full" aria-label="Sections">
          {navItems.map((item) => {
            const isActive = activeSection === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigate(item)}
                aria-disabled={item.disabled ? 'true' : undefined}
                aria-current={isActive ? 'page' : undefined}
                className={`group relative inline-flex items-center gap-2 w-full h-[46px] px-[13px] rounded-full border text-left text-text text-base font-body font-medium leading-6 whitespace-nowrap transition-[background-color,box-shadow,border-color] duration-150 ease-in-out ${
                  isActive
                    ? 'bg-widget-bg border-white dark:border-[rgba(255,255,255,0.08)] shadow-[0_1px_3px_rgba(0,0,0,0.06)]'
                    : item.disabled
                      ? 'bg-transparent border-transparent cursor-not-allowed opacity-55 grayscale'
                      : 'bg-transparent border-transparent hover:bg-brand-subtle'
                }`}
              >
                <Icon
                  icon={item.icon}
                  className="w-[17px] h-[17px] shrink-0"
                  aria-hidden="true"
                />
                <span>{item.label}</span>
                {item.disabled ? (
                  <span
                    role="tooltip"
                    className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 flex flex-col gap-[2px] w-max max-w-[260px] -translate-x-1/2 -translate-y-1 scale-95 whitespace-normal text-center rounded-[14px] border border-black/10 bg-black px-3 py-[6px] text-[12px] font-medium leading-tight text-white opacity-0 shadow-[0_12px_32px_rgba(0,0,0,0.18)] transition-[opacity,transform] duration-180 ease-out invisible group-hover:visible group-hover:translate-y-0 group-hover:scale-100 group-hover:opacity-100 group-focus-visible:visible group-focus-visible:translate-y-0 group-focus-visible:scale-100 group-focus-visible:opacity-100 dark:border-white/15 dark:bg-white dark:text-black"
                  >
                    <span className="block font-semibold">{item.disabledTitle}</span>
                    {item.disabledDetail ? (
                      <span className="block text-[11px] text-white/70 dark:text-black/60">{item.disabledDetail}</span>
                    ) : null}
                  </span>
                ) : null}
              </button>
            )
          })}
        </nav>
      </div>

      <div className="flex flex-col gap-4 w-full">
        <div ref={favoritesSlotRef} className="sidebar-favorites-slot empty:hidden w-full" />
        {hasPendingUpdate ? <UpdateNotice onUpdateClick={onUpdateClick} /> : null}
        {authenticated ? (
          <div aria-hidden="true" className="h-px w-full bg-border/70" />
        ) : null}
        {authenticated ? (
          <div className="flex items-center justify-between w-full h-[46px] gap-2">
          <button
            type="button"
            onClick={onAccountClick}
            disabled={checking}
            className="flex items-center gap-2 min-w-0 flex-1 bg-transparent border-0 p-0 text-left cursor-pointer disabled:opacity-40 disabled:cursor-wait"
            aria-label="Mon compte"
          >
            <span className="inline-flex shrink-0 size-10 rounded-full overflow-hidden border border-border-input bg-bg-input items-center justify-center">
              {profilePhotoSrc ? (
                <img
                  src={profilePhotoSrc}
                  alt=""
                  className="block w-full h-full object-cover"
                />
              ) : (
                <span className="text-sm font-semibold text-text-muted font-body">
                  {initials}
                </span>
              )}
            </span>
            <span className="flex flex-col min-w-0 gap-0">
              <span className="block text-base leading-[1.15] text-text font-body tracking-[-0.01em] truncate">
                {userName || 'Mon compte'}
              </span>
              {userSubtitle ? (
                <span className="block text-[13px] leading-[1.15] text-text-muted font-body font-medium truncate">
                  {userSubtitle}
                </span>
              ) : null}
            </span>
          </button>
            <button
              type="button"
              onClick={onLogout}
              disabled={checking}
              className="inline-flex items-center justify-center size-8 rounded-full bg-transparent border-0 text-text-muted cursor-pointer transition-opacity duration-120 ease-in-out hover:opacity-70 disabled:opacity-40 disabled:cursor-wait"
              aria-label="Se déconnecter"
            >
              <Icon icon="carbon:logout" className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        ) : null}
      </div>
    </aside>
  )
}

export default Sidebar
