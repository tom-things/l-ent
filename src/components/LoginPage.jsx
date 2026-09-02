/* global __UNIVERSITY_ID__ */
import { useState } from 'react'
import { Icon } from '@iconify/react'
import universityConfig from '@university'
import universityShowcase from '../../universities/showcase.js'
import lentLogoWhite from '../assets/login/lentlogo_white.svg'
import lentLogoAlez from '../assets/login/lentlogo_alez.svg'
import lentLogoAlezDark from '../assets/login/lentlogo_alez_dark.svg'
import toutaticeLoginHero from '../assets/login/toutatice-login-hero.webp'
import toutaticeClouds from '../assets/login/toutatice-clouds.webp'
import LentButton from './LentButton'
import AboutModal from './AboutModal'

const universityLogo = universityConfig.branding.logo
const universityLogoAlt = universityConfig.branding.logoAlt ?? universityConfig.university?.name ?? ''
const loginLinks = universityConfig.links ?? {}

const activeUniversityId = typeof __UNIVERSITY_ID__ !== 'undefined' ? __UNIVERSITY_ID__ : universityConfig.id
const otherUniversities = universityShowcase.filter(
  (entry) => entry.id !== activeUniversityId && (!entry.devOnly || import.meta.env.DEV),
)

// Subdomain labels of every tenant we know about client-side, used to strip
// an existing tenant label from the hostname before adding the target's.
const tenantLabels = new Set(
  [activeUniversityId, ...universityShowcase.map((entry) => entry.id)].map((id) => id.replace(/-/g, '')),
)

// Login URL of another tenant. Tenants live on `<id-without-dashes>.<root>`
// (see server.js); the root domain is the current host, minus its leading
// tenant label when we're already on a tenant subdomain.
function universityLoginUrl(entry) {
  if (entry.url) return entry.url

  const targetLabel = entry.id.replace(/-/g, '')

  // The dev server serves a single baked university: /<label> asks it to
  // restart on that tenant (see the switcher middleware in vite.config.js).
  if (import.meta.env.DEV) return `/${targetLabel}`

  const { protocol, hostname, port } = window.location
  const labels = hostname.split('.')
  const rootDomain = labels.length > 1 && tenantLabels.has(labels[0]) ? labels.slice(1).join('.') : hostname

  return `${protocol}//${targetLabel}.${rootDomain}${port ? `:${port}` : ''}`
}

function LoginPage({
  credentials,
  checking,
  errorMessage,
  onCredentialsChange,
  onDemoLogin,
  onSubmit,
}) {
  const [showPassword, setShowPassword] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)

  function handleDemoLinkClick() {
    setAboutOpen(false)
    onDemoLogin?.()
  }

  return (
    <section className="flex w-full min-h-screen bg-bg" aria-label="Page de connexion">
      <div
        className="login-left-panel relative flex-[0_0_min(529px,47vw)] max-w-[529px] min-w-0 min-h-screen overflow-hidden bg-[#f5f3ed] max-4xl:hidden max-3xl:flex-[0_0_44vw] max-3xl:max-w-[529px]"
      >
        <img
          className="absolute inset-0 block h-full w-full max-w-none object-cover"
          src={toutaticeLoginHero}
          alt=""
          aria-hidden="true"
        />

        <div className="relative z-10 ml-10 flex w-[381px] max-w-[calc(100%_-_80px)] flex-col items-start gap-5 pt-10 max-3xl:ml-8 max-3xl:max-w-[calc(100%_-_64px)]">
          <img
            className="block h-[66px] w-[120px] object-contain"
            src={lentLogoWhite}
            alt="L'ent"
            width="120"
            height="66"
          />
          <div className="flex w-full flex-col items-start gap-[10px] text-[#f5f3ed]">
            <h1 className="m-0 w-full whitespace-pre-line text-[60px] font-semibold leading-[0.9] max-3xl:text-[48px]">{`Toute ta fac,\nau même endroit.`}</h1>
            <p className="m-0 w-full text-[20px] font-medium leading-[0.9] font-body max-3xl:text-lg">Une solution libre et ouverte.</p>
          </div>
        </div>
      </div>

      <AboutModal
        open={aboutOpen}
        onClose={() => setAboutOpen(false)}
        demoLinkLabel="Accéder à la démo"
        onDemoLinkClick={handleDemoLinkClick}
      />

      <div className="relative isolate flex min-h-screen min-w-0 flex-[1_1_auto] items-stretch justify-center bg-[#f5f3ed] dark:bg-bg max-4xl:w-full max-md:justify-start">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[416px] overflow-hidden" aria-hidden="true">
          {/* Centered without translate: a transform would create a stacking
              context and break the clouds' soft-light blend with the page bg. */}
          <div className="absolute left-[calc(50%_-_376px)] top-0 h-[416px] w-[752px]">
            {/* Each cloud is stacked twice: soft-light alone is too faint,
                doubling the layer deepens the blend. */}
            {[0, 1].map((layer) => (
              <img
                key={`right-${layer}`}
                className="absolute left-[240px] top-[-92px] aspect-[1920/1292] w-[670px] max-w-none object-cover [mix-blend-mode:soft-light] dark:[mix-blend-mode:overlay] opacity-87"
                src={toutaticeClouds}
                alt=""
              />
            ))}
            {[0, 1].map((layer) => (
              <img
                key={`left-${layer}`}
                className="absolute left-[-298px] top-[-35px] aspect-[1920/1292] w-[670px] max-w-none -scale-x-100 object-cover [mix-blend-mode:soft-light] dark:[mix-blend-mode:overlay] opacity-87"
                src={toutaticeClouds}
                alt=""
              />
            ))}
          </div>
        </div>

        <button
          type="button"
          className="absolute top-6 right-6 z-30 inline-flex h-[38px] w-[38px] items-center justify-center rounded-full border-0 bg-transparent text-text-muted transition-colors duration-120 hover:text-text max-3xl:top-5 max-3xl:right-5 max-md:top-4 max-md:right-4"
          onClick={() => setAboutOpen(true)}
          aria-label="À propos"
        >
          <Icon icon="carbon:information" className="h-[18px] w-[18px]" />
        </button>

        <div className="relative z-10 box-border flex min-h-screen w-[min(720px,100%)] flex-col gap-[25px] px-[88px] pb-[120px] max-4xl:w-[min(640px,100%)] max-4xl:gap-6 max-4xl:px-10 max-4xl:pb-12 max-3xl:w-[min(600px,100%)] max-3xl:px-8 max-3xl:pb-9 max-md:w-full max-md:gap-5 max-md:px-5 max-md:pb-6">
          <header className="relative flex h-[295px] shrink-0 justify-center text-center max-md:h-[245px]">
            <div className="flex w-[337px] max-w-full flex-col items-center gap-5 pt-[117px] max-4xl:pt-[61px] max-md:pt-[26px]">
              {/* The left panel (and its l'ent logo) is hidden below 4xl, so
                  show the logo above the university one there instead. */}
              <img
                className="hidden h-9 w-auto object-contain max-4xl:block max-4xl:dark:hidden"
                src={lentLogoAlez}
                alt="L'ent"
              />
              <img
                className="hidden h-9 w-auto object-contain max-4xl:dark:block"
                src={lentLogoAlezDark}
                alt="L'ent"
              />
              <img
                className="block h-[51px] w-[173px] object-contain dark:invert"
                src={universityLogo}
                alt={universityLogoAlt}
                width="173"
                height="51"
              />

              <div className="flex w-full flex-col items-center gap-[10px] text-text">
                <h2 className="m-0 w-full text-[40px] leading-[0.9] max-md:text-[36px]">Connexion</h2>
                <p className="m-0 w-full text-[16px] font-medium leading-4 font-body max-md:text-[15px]">
                  Utilise tes codes fournis par ton établissement d&apos;enseignement supérieur.
                </p>
              </div>
            </div>
          </header>

          <form className="grid gap-[18px]" onSubmit={onSubmit}>
            <input
              name="username"
              className="w-full min-h-[56px] py-[17px] px-[18px] login-field border border-white rounded-[53px] bg-widget-bg text-text font-inherit text-base leading-none box-border placeholder:text-text-muted placeholder:opacity-100 focus-visible:border-brand font-body"
              autoComplete="username"
              type="text"
              placeholder="Identifiant"
              aria-label="Identifiant"
              value={credentials.username}
              onChange={(event) => onCredentialsChange('username', event.target.value)}
            />

            <div className="relative">
              <input
                name="password"
                className="w-full min-h-[56px] py-[17px] px-[18px] pr-[52px] login-field border border-white rounded-[53px] bg-widget-bg text-text font-inherit text-base leading-none box-border placeholder:text-text-muted placeholder:opacity-100 focus-visible:border-brand font-body"
                autoComplete="current-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Mot de passe"
                aria-label="Mot de passe"
                value={credentials.password}
                onChange={(event) => onCredentialsChange('password', event.target.value)}
              />
              <button
                type="button"
                className="absolute right-[6px] top-1/2 -translate-y-1/2 w-[42px] h-[42px] flex items-center justify-center rounded-full border-0 bg-transparent text-text-muted cursor-pointer transition-colors duration-120 hover:text-text hover:bg-bg-subtle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                tabIndex={-1}
              >
                <Icon icon={showPassword ? 'carbon:view-off' : 'carbon:view'} className="w-[18px] h-[18px]" />
              </button>
            </div>

            <div className={`grid transition-[grid-template-rows] duration-200 ease-out ${errorMessage ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
              <div className="overflow-hidden">
                <div className={`flex items-center gap-2 px-4 py-3 rounded-2xl bg-error-bg border border-error/20 transition-opacity duration-200 ${errorMessage ? 'opacity-100' : 'opacity-0'}`}>
                  <p className="m-0 text-error text-sm font-semibold font-body">{errorMessage}</p>
                </div>
              </div>
            </div>

            <LentButton type="submit" className="w-full justify-self-stretch font-bold!" loading={checking}>
              Se connecter
            </LentButton>
          </form>

          {loginLinks.forgotPassword || loginLinks.activateAccount ? (
            <div className="flex justify-center items-start gap-[30px] max-md:flex-wrap max-md:gap-[14px_24px]">
              {loginLinks.forgotPassword ? (
                <a
                  className="p-0 border-0 bg-transparent text-text font-inherit text-base font-medium leading-[1.06] underline underline-offset-2 font-body max-md:text-[15px]"
                  href={loginLinks.forgotPassword}
                >
                  Mot de passe oublié
                </a>
              ) : null}
              {loginLinks.activateAccount ? (
                <a
                  className="p-0 border-0 bg-transparent text-text font-inherit text-base font-medium leading-[1.06] underline underline-offset-2 font-body max-md:text-[15px]"
                  href={loginLinks.activateAccount}
                >
                  Activer mon compte
                </a>
              ) : null}
            </div>
          ) : null}

          {otherUniversities.length > 0 ? (
            <div
              className="mt-auto flex flex-col items-center gap-4 pt-10 max-md:mt-0 max-md:pt-3 max-md:gap-3"
              aria-label="Autres universités disponibles"
            >
              <p className="m-0 text-[13px] font-medium leading-[1.1] text-text-muted font-body">
                l&apos;ent est aussi disponible pour
              </p>
              <div className="flex flex-wrap items-center justify-center gap-x-9 gap-y-4">
                {otherUniversities.map((entry) => (
                  <a
                    key={entry.id}
                    className="opacity-35 transition-opacity duration-120 hover:opacity-70 focus-visible:opacity-70"
                    href={universityLoginUrl(entry)}
                    title={`Se connecter — ${entry.name}`}
                  >
                    <img
                      className="h-8 w-auto max-w-[150px] object-contain grayscale dark:invert max-md:h-7"
                      src={entry.logo}
                      alt={entry.name}
                    />
                  </a>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <footer className="absolute bottom-8 left-12 right-12 flex flex-wrap justify-end gap-[8px_18px] text-text-muted text-[13px] font-medium leading-[1.1] font-body max-3xl:left-8 max-3xl:right-8 max-3xl:bottom-6 max-md:left-5 max-md:right-5 max-md:bottom-5 max-md:justify-center" aria-label="Copyright">
          <span>{universityConfig.branding.loginFooterLine}</span>
        </footer>
      </div>
    </section>
  )
}

export default LoginPage
