import { useCallback, useState } from 'react'
import { Icon } from '@iconify/react'
import lentLogo from '../assets/lentlogo.svg'
import lentLogoDark from '../assets/lentlogo-dark.svg'
import UpdateNotice from './UpdateNotice'
import { ENT_AUTH_PREFIX } from '../entApi'

const NOTES9_DOAUTH = 'https://notes9.iutlan.univ-rennes1.fr/services/doAuth.php?href=https://notes9.iutlan.univ-rennes1.fr/'
const ADE_DOAUTH = 'https://planning.univ-rennes1.fr/direct/myplanning.jsp'
const NOTES9_HREF = `${ENT_AUTH_PREFIX}/launch?url=${encodeURIComponent(NOTES9_DOAUTH)}`
const ADE_HREF = `${ENT_AUTH_PREFIX}/launch?url=${encodeURIComponent(ADE_DOAUTH)}`

const NAV_ITEMS = [
  {
    id: 'applications',
    label: 'Toutes les applications',
    icon: 'carbon:app-switcher',
    targetId: 'sidebar-section-applications',
  },
  {
    id: 'grades',
    label: 'Mes notes',
    icon: 'carbon:chart-pie',
    href: NOTES9_HREF,
    target: '_blank',
  },
  {
    id: 'planning',
    label: 'Planning',
    icon: 'carbon:calendar',
    href: ADE_HREF,
    target: '_blank',
  },
]

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
}) {
  const [activeSection, setActiveSection] = useState('applications')

  const handleNavigate = useCallback((item) => {
    if (typeof document === 'undefined') {
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
          <img
            src={lentLogo}
            alt="L'ent — Université de Rennes"
            className="block h-[58px] w-auto dark:hidden"
          />
          <img
            src={lentLogoDark}
            alt="L'ent — Université de Rennes"
            className="hidden h-[58px] w-auto dark:block"
          />
        </a>

        <nav className="flex flex-col w-full" aria-label="Sections">
          {NAV_ITEMS.map((item) => {
            const isActive = activeSection === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigate(item)}
                aria-current={isActive ? 'page' : undefined}
                className={`group inline-flex items-center gap-2 w-full h-[46px] px-[13px] rounded-full border text-left text-text text-base font-body font-medium leading-6 whitespace-nowrap transition-[background-color,box-shadow,border-color] duration-150 ease-in-out ${
                  isActive
                    ? 'bg-widget-bg border-white dark:border-[rgba(255,255,255,0.08)] shadow-[0_1px_3px_rgba(0,0,0,0.06)]'
                    : 'bg-transparent border-transparent hover:bg-brand-subtle'
                }`}
              >
                <Icon
                  icon={item.icon}
                  className="w-[17px] h-[17px] shrink-0"
                  aria-hidden="true"
                />
                <span>{item.label}</span>
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
              <span className="block text-base leading-[1.15] text-text font-display tracking-[-0.01em] truncate">
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
