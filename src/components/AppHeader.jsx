import lentLogo from '../assets/lentlogo.svg'
import { Icon } from '@iconify/react'
import LentButton from './LentButton'
import './AppHeader.css'

function AppHeader({ authenticated, checking, onPrimaryAction }) {
  const actionLabel = checking
    ? 'Chargement...'
    : authenticated
      ? 'Se déconnecter'
      : 'Se connecter'

  return (
    <header className="app-header-shell">
      <div className="app-header">
        <a className="app-header__logo-link" href="/" aria-label="Retour à l'accueil">
          <img
            className="app-header__logo"
            src={lentLogo}
            alt="L'ent"
            width="128"
            height="64"
          />
        </a>

        <div className="app-header__actions">
          {authenticated ? (
            <>
              <LentButton
                className="app-header__action app-header__action--ghost"
                onClick={onPrimaryAction}
                disabled={checking}
                aria-label={actionLabel}
              >
                <span className="app-header__action-content">
                  <Icon icon="carbon:login" className="app-header__action-icon" aria-hidden="true" />
                  <span>{actionLabel}</span>
                </span>
              </LentButton>

              <LentButton
                className="app-header__action app-header__action--secondary"
                onClick={() => {
                  window.location.assign('https://sesame.univ-rennes.fr/comptes/')
                }}
                disabled={checking}
                aria-label="Mon compte"
              >
                <span className="app-header__action-content">
                  <Icon icon="carbon:user-avatar" className="app-header__action-icon" aria-hidden="true" />
                  <span>Mon compte</span>
                </span>
              </LentButton>
            </>
          ) : (
            <LentButton
              className="app-header__action"
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
