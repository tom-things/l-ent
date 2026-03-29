import { useState } from 'react'
import { Icon } from '@iconify/react'
import lentLogoAlez from '../assets/login/lentlogo_alez.svg'
import lentLogoAlezDark from '../assets/login/lentlogo_alez_dark.svg'
import illustration from '../assets/login/illustration.webp'
import universityRennesLogo from '../assets/uni_logos/univ-rennes.svg'
import LentButton from './LentButton'
import AboutModal from './AboutModal'

function LoginPage({
  credentials,
  checking,
  errorMessage,
  onCredentialsChange,
  onSubmit,
}) {
  const [showPassword, setShowPassword] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  return (
    <section className="flex w-full min-h-screen bg-bg" aria-label="Login page">
      <div
        className="login-left-panel flex-[0_0_min(529px,47vw)] max-w-[529px] min-w-0 min-h-screen flex flex-col justify-between items-start overflow-hidden max-4xl:hidden max-3xl:flex-[0_0_44vw] max-3xl:max-w-[529px]"
        style={{ background: 'linear-gradient(180deg, #F8FFA1 -13.62%, #ACF600 7.46%, #CDFFF5 25.93%, #F5F3ED 42.37%), #F5F3ED' }}
      >
        <div className="flex flex-col items-start gap-5 w-[min(540px,100%)] pt-[55px] px-[50px] max-3xl:w-[min(440px,100%)] max-3xl:pt-10 max-3xl:px-8">
          <img
            className="block w-32 h-16 object-contain"
            src={lentLogoAlez}
            alt="L'ent"
            width="128"
            height="64"
          />
          <h1 className="m-0 text-[#341200] text-[60px] font-bold leading-[0.9] max-3xl:text-[48px]">Toute ta fac, au même endroit.</h1>
          <p className="m-0 text-[#341200] text-lg font-medium leading-[1.2] font-body max-3xl:text-base">Le client universitaire alternatif</p>
        </div>
        <div className="w-full" aria-hidden="true">
          <img
            className="block w-full max-w-full h-auto"
            src={illustration}
            alt=""
          />
        </div>
      </div>

      <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />

      <div className="flex-[1_1_auto] min-w-0 min-h-screen relative flex justify-center items-stretch bg-bg max-4xl:w-full max-4xl:items-center max-md:justify-start">
        <button
          type="button"
          className="absolute top-6 right-6 inline-flex h-[38px] w-[38px] items-center justify-center rounded-full border-0 bg-transparent text-text-muted transition-colors duration-120 hover:text-text max-3xl:top-5 max-3xl:right-5 max-md:top-4 max-md:right-4"
          onClick={() => setAboutOpen(true)}
          aria-label="À propos"
        >
          <Icon icon="carbon:information" className="h-[18px] w-[18px]" />
        </button>

        <div className="w-[min(720px,100%)] min-h-screen flex flex-col gap-[25px] pt-[210px] px-[88px] pb-[120px] box-border max-4xl:w-[min(640px,100%)] max-4xl:min-h-auto max-4xl:gap-6 max-4xl:pt-14 max-4xl:px-10 max-4xl:pb-12 max-3xl:w-[min(600px,100%)] max-3xl:pt-10 max-3xl:px-8 max-3xl:pb-9 max-md:w-full max-md:pt-8 max-md:px-5 max-md:pb-6">
          <div className="hidden max-md:flex items-center gap-3 flex-wrap">
            <img
              className="block w-[112px] h-[56px] object-contain max-md:block dark:hidden"
              src={lentLogoAlez}
              alt="L'ent"
              width="128"
              height="64"
            />
            <img
              className="hidden w-[112px] h-[56px] object-contain dark:block"
              src={lentLogoAlezDark}
              alt="L'ent"
              width="128"
              height="64"
            />

            <div className="hidden max-md:inline-flex items-center gap-[10px] w-fit py-[10px] px-[15px] login-field border border-white rounded-[53px] bg-widget-bg overflow-hidden">
              <span className="text-text-muted text-base font-medium leading-none font-body">Avec</span>
              <img
                className="block w-[92px] h-7 object-contain dark:invert"
                src={universityRennesLogo}
                alt="Université de Rennes"
                width="92"
                height="28"
              />
            </div>
          </div>

          <img
            className="hidden w-32 h-16 object-contain max-4xl:block max-md:hidden"
            src={lentLogoAlez}
            alt="L'ent"
            width="128"
            height="64"
          />

          <div className="grid gap-2">
            <div className="inline-flex items-center gap-[10px] w-fit py-[10px] px-[15px] login-field border border-white rounded-[53px] bg-widget-bg overflow-hidden max-md:hidden">
              <span className="text-text-muted text-base font-medium leading-none font-body">Avec</span>
              <img
                className="block w-[92px] h-7 object-contain dark:invert"
                src={universityRennesLogo}
                alt="Université de Rennes"
                width="92"
                height="28"
              />
            </div>

            <div className="grid gap-2">
              <h2 className="m-0 text-text text-[46px] font-bold leading-[0.95] max-3xl:text-[40px] max-md:text-[36px]">Connexion</h2>
              <p className="m-0 text-text text-base font-medium leading-[1.06] font-body max-3xl:text-[17px] max-md:text-[15px]">
                Utilise tes codes fournis par ton établissement d'enseignement supérieur
              </p>
            </div>
          </div>

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

          <div className="flex justify-center items-start gap-[30px] max-md:flex-wrap max-md:gap-[14px_24px]">
            <a
              className="p-0 border-0 bg-transparent text-text font-inherit text-base font-medium leading-[1.06] underline underline-offset-2 font-body max-md:text-[15px]"
              href="https://docinfo.univ-rennes1.fr/documentation/compte-jai-oublie-mon-mot-de-passe"
            >
              Mot de passe oublié
            </a>
            <a
              className="p-0 border-0 bg-transparent text-text font-inherit text-base font-medium leading-[1.06] underline underline-offset-2 font-body max-md:text-[15px]"
              href="https://sesame.univ-rennes1.fr/motdepasse/public/activate"
            >
              Activer mon compte
            </a>
          </div>
        </div>

        <footer className="absolute bottom-8 left-12 right-12 flex flex-wrap justify-between gap-[8px_18px] text-text-muted text-[13px] font-medium leading-[1.1] font-body max-3xl:left-8 max-3xl:right-8 max-3xl:bottom-6 max-md:left-5 max-md:right-5 max-md:bottom-5 max-md:justify-center" aria-label="Copyright">
          <span className="max-md:hidden">Crédit photo : @_denniskim sur Instagram</span>
          <span>Client alternatif à l&apos;ENT de l&apos;Université de Rennes</span>
        </footer>
      </div>
    </section>
  )
}

export default LoginPage
