import lentLogoOutline from '../assets/login/lentlogo_outline.svg'
import illustration from '../assets/login/illustration.webp'
import universityRennesLogo from '../assets/uni_logos/univ-rennes.svg'
import LentButton from './LentButton'
import './LoginPage.css'

function LoginPage({
  credentials,
  checking,
  errorMessage,
  onCredentialsChange,
  onSubmit,
}) {
  return (
    <section className="login-page" aria-label="Login page">
      <div className="login-page__illustration">
        <div className="login-page__headline">
          <img
            className="login-page__headline-logo"
            src={lentLogoOutline}
            alt="L'ent"
            width="128"
            height="64"
          />
          <h1 className="login-page__headline-title">Toute ta fac, au même endroit.</h1>
        </div>
        <div className="login-page__illustration-media" aria-hidden="true">
          <img
            className="login-page__illustration-image"
            src={illustration}
            alt=""
          />
        </div>
      </div>

      <div className="login-page__panel">
        <div className="login-page__panel-frame">
          <div className="login-page__mobile-brand">
            <img
              className="login-page__panel-logo login-page__panel-logo--mobile"
              src={lentLogoOutline}
              alt="L'ent"
              width="128"
              height="64"
            />

            <div className="login-page__badge login-page__badge--mobile">
              <span className="login-page__badge-text">Avec</span>
              <img
                className="login-page__badge-mark"
                src={universityRennesLogo}
                alt="Université de Rennes"
                width="92"
                height="28"
              />
            </div>
          </div>

          <img
            className="login-page__panel-logo login-page__panel-logo--standalone"
            src={lentLogoOutline}
            alt="L'ent"
            width="128"
            height="64"
          />

          <div className="login-page__form-header">
            <div className="login-page__badge">
              <span className="login-page__badge-text">Avec</span>
              <img
                className="login-page__badge-mark"
                src={universityRennesLogo}
                alt="Université de Rennes"
                width="92"
                height="28"
              />
            </div>

            <div className="login-page__copy">
              <h2 className="login-page__title">Connexion</h2>
              <p className="login-page__description">
                Utilise tes codes fournis par ton établissement d'enseignement supérieur
              </p>
            </div>
          </div>

          <form className="login-page__form" onSubmit={onSubmit}>
            <input
              className="login-page__input"
              autoComplete="username"
              type="text"
              placeholder="Identifiant"
              aria-label="Identifiant"
              value={credentials.username}
              onChange={(event) => onCredentialsChange('username', event.target.value)}
            />

            <input
              className="login-page__input"
              autoComplete="current-password"
              type="password"
              placeholder="Mot de passe"
              aria-label="Mot de passe"
              value={credentials.password}
              onChange={(event) => onCredentialsChange('password', event.target.value)}
            />

            {errorMessage ? <p className="login-page__error">{errorMessage}</p> : null}

            <LentButton type="submit" className="login-page__submit" disabled={checking}>
              {checking ? 'Connexion...' : 'Se connecter'}
            </LentButton>
          </form>

          <div className="login-page__links">
            <a
              className="login-page__link-button"
              href="https://docinfo.univ-rennes1.fr/documentation/compte-jai-oublie-mon-mot-de-passe"
            >
              Mot de passe oublié
            </a>
            <a
              className="login-page__link-button"
              href="https://sesame.univ-rennes1.fr/motdepasse/public/activate"
            >
              Activer mon compte
            </a>
          </div>
        </div>

        <footer className="login-page__mentions" aria-label="Copyright">
          <span>Client alternatif à l&apos;ENT de l&apos;Université de Rennes</span>
        </footer>
      </div>
    </section>
  )
}

export default LoginPage
