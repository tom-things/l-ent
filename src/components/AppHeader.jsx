import lentLogo from '../assets/lentlogo.svg'
import lentLogoDark from '../assets/lentlogo-dark.svg'
import { Icon } from '@iconify/react'
import LentButton from './LentButton'

function AppHeader({ authenticated, checking, onPrimaryAction, onRefreshedClick }) {
  const actionLabel = checking
    ? 'Chargement...'
    : authenticated
      ? 'Se déconnecter'
      : 'Se connecter'

  return (
    <header className="w-full pt-10 px-10 max-xl:pt-6 max-md:pt-5 max-md:px-4">
      <div className="w-full flex items-center justify-between gap-6 max-xl:gap-[0.9rem] max-md:items-start max-md:gap-3">
        <a className="inline-flex items-center no-underline min-w-0 max-md:self-start" href="/" aria-label="Retour à l'accueil">
          <img className="block w-[290px] h-16 object-contain max-xl:w-[180px] max-xl:h-12 max-md:w-[200px] max-md:h-auto dark:hidden" src={lentLogo} alt="L'ent" width="128" height="64" aria-hidden="true" />
          <img className="hidden w-[290px] h-16 object-contain max-xl:w-[180px] max-xl:h-12 max-md:w-[200px] max-md:h-auto dark:block" src={lentLogoDark} alt="L'ent" width="128" height="64" />
        </a>

        <div className="flex items-center gap-2 justify-end max-md:ml-auto max-md:items-start max-md:gap-[0.4rem]">
          {authenticated ? (
            <>

              <button
                type="button"
                className="header-logout-btn inline-flex items-center justify-center gap-2 px-3 py-2 border-0 rounded-full bg-transparent text-text-muted text-[0.9rem] font-medium leading-[1.06] whitespace-nowrap cursor-pointer transition-opacity duration-120 ease-in-out hover:opacity-70 disabled:opacity-40 disabled:cursor-wait max-md:w-[42px] max-md:min-w-[42px] max-md:h-[42px] max-md:p-0 max-md:justify-center max-md:gap-0"
                onClick={onPrimaryAction}
                disabled={checking}
                aria-label={actionLabel}
              >
                <Icon icon="carbon:login" className="w-4 h-4 shrink-0 max-md:w-[1.1rem] max-md:h-[1.1rem]" aria-hidden="true" />
                <span className="max-md:hidden">{actionLabel}</span>
              </button>

              <button
                type="button"
                className="header-account-btn inline-flex items-center justify-center gap-2 px-3 py-[10px] border border-white rounded-full bg-widget-bg text-text text-[0.9rem] font-semibold leading-[1.06] whitespace-nowrap cursor-pointer transition-[background-color,opacity] duration-120 ease-in-out hover:not-disabled:bg-bg-subtle disabled:opacity-40 disabled:cursor-wait max-md:w-[42px] max-md:min-w-[42px] max-md:h-[42px] max-md:p-0 max-md:justify-center max-md:gap-0"
                onClick={() => {
                  window.location.assign('https://sesame.univ-rennes.fr/comptes/')
                }}
                disabled={checking}
                aria-label="Mon compte"
              >
                <Icon icon="carbon:user-avatar" className="w-4 h-4 shrink-0 max-md:w-[1.1rem] max-md:h-[1.1rem]" aria-hidden="true" />
                <span className="max-md:hidden">Mon compte</span>
              </button>
            </>
          ) : (
            <LentButton
              className="inline-flex items-center justify-center"
              onClick={onPrimaryAction}
              disabled={checking}
              aria-label={actionLabel}
            >
              {actionLabel}
            </LentButton>
          )}
        </div>
      </div>
    </header>
  )
}

export default AppHeader
