import { useCallback, useEffect, useRef, useState } from 'react'
import favicon from './assets/favicon.png'
import AppFooter from './components/AppFooter'
import AppHeader from './components/AppHeader'
import LentButton from './components/LentButton'
import LoginPage from './components/LoginPage'
import PwaInstallPrompt from './components/PwaInstallPrompt'
import RefreshedPrompt from './components/RefreshedPrompt'
import OnboardingPage, { getStoredEstablishment, ESTABLISHMENT_KEY } from './components/OnboardingPage'
import WidgetContainer from './components/WidgetContainer'
import {
  getAccountInfo,
  getAuthSession,
  getAverageGrade,
  getGrades,
  getLatestGrade,
  getLayout,
  getMarketplaceEntries,
  getPlanning,
  loginToEnt,
  logoutFromEnt,
  requestEnt,
} from './entApi'

const DEFAULT_REQUEST_PATH = '/api/v4-3/dlm/layout.json'
const BASE_DOCUMENT_TITLE = "l'ent - Toute ta fac, au même endroit."
const SESSION_CACHE_KEY = 'l-ent:session-cache'
const SESSION_CACHE_TTL_MS = 8 * 60 * 60 * 1000

function loadCachedSession() {
  try {
    const raw = localStorage.getItem(SESSION_CACHE_KEY)
    if (!raw) return null
    const cached = JSON.parse(raw)
    if (!cached?.authenticated || !cached.cachedAt) return null
    if (Date.now() - cached.cachedAt > SESSION_CACHE_TTL_MS) {
      localStorage.removeItem(SESSION_CACHE_KEY)
      return null
    }
    return cached
  } catch {
    return null
  }
}

function saveCachedSession({ user, givenName, account }) {
  try {
    localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify({
      authenticated: true,
      user,
      givenName,
      account,
      cachedAt: Date.now(),
    }))
  } catch {
    // Storage full or unavailable
  }
}

function clearCachedSession() {
  try {
    localStorage.removeItem(SESSION_CACHE_KEY)
  } catch {
    // Ignore
  }
}

function prettyPrint(value) {
  if (typeof value === 'string') {
    return value
  }

  if (value === undefined) {
    return ''
  }

  return JSON.stringify(value, null, 2)
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error)
}

function getFrenchAuthErrorMessage(error, context = 'login') {
  const rawMessage = getErrorMessage(error).trim()
  const normalizedMessage = rawMessage.toLowerCase()
  const mentionsUsername = normalizedMessage.includes('username') || normalizedMessage.includes('identifiant')
  const mentionsPassword = normalizedMessage.includes('password') || normalizedMessage.includes('mot de passe')
  const mentionsRequired = (
    normalizedMessage.includes('required')
    || normalizedMessage.includes('requis')
    || normalizedMessage.includes('missing')
  )

  if (
    (mentionsUsername && mentionsPassword && mentionsRequired)
    || normalizedMessage.includes('missing username')
    || normalizedMessage.includes('missing password')
    || normalizedMessage.includes('mot de passe requis')
  ) {
    return 'Merci de renseigner ton identifiant et ton mot de passe.'
  }

  if (
    normalizedMessage.includes('cas login failed')
    || normalizedMessage.includes('check your username and password')
    || normalizedMessage.includes('invalid credentials')
    || normalizedMessage.includes('bad credentials')
    || normalizedMessage.includes('invalid username')
    || normalizedMessage.includes('invalid password')
    || normalizedMessage.includes('incorrect password')
    || normalizedMessage.includes('portal session was not established')
    || normalizedMessage.includes('unauthorized')
    || normalizedMessage.includes('status 401')
    || normalizedMessage.includes('status 403')
    || normalizedMessage.includes('forbidden')
  ) {
    return 'Identifiant ou mot de passe incorrect.'
  }

  if (normalizedMessage.includes('status 429') || normalizedMessage.includes('too many requests')) {
    return 'Trop de tentatives de connexion. Réessaie dans quelques instants.'
  }

  if (
    normalizedMessage.includes('networkerror')
    || normalizedMessage.includes('failed to fetch')
    || normalizedMessage.includes('load failed')
    || normalizedMessage.includes('network request failed')
    || normalizedMessage.includes('fetch')
  ) {
    return context === 'session'
      ? 'Impossible de vérifier la session pour le moment. Réessaie dans quelques instants.'
      : 'Impossible de joindre le service de connexion. Vérifie ta connexion puis réessaie.'
  }

  if (normalizedMessage.includes('status 5') || normalizedMessage.includes('internal server error')) {
    return context === 'session'
      ? 'Le service de session est indisponible pour le moment.'
      : 'Le service de connexion est indisponible pour le moment.'
  }

  return context === 'session'
    ? 'Impossible de vérifier la session pour le moment.'
    : 'La connexion a échoué. Vérifie tes identifiants puis réessaie.'
}

function buildDebugSnapshot(label, data, error = '') {
  return {
    label,
    capturedAt: new Date().toISOString(),
    error,
    data,
  }
}

function App() {
  const [debugOpen, setDebugOpen] = useState(false)
  const [forceInstallPrompt, setForceInstallPrompt] = useState(false)
  const [forceIosPrompt, setForceIosPrompt] = useState(false)
  const [refreshedPromptOpen, setRefreshedPromptOpen] = useState(false)
  const usernameInputRef = useRef(null)
  const [credentials, setCredentials] = useState({
    username: '',
    password: '',
  })
  const [requestPath, setRequestPath] = useState(DEFAULT_REQUEST_PATH)
  const [establishment, setEstablishment] = useState(getStoredEstablishment)
  const cachedSession = useRef(loadCachedSession()).current
  const [sessionState, setSessionState] = useState({
    checking: true,
    authenticated: Boolean(cachedSession?.authenticated),
    user: cachedSession?.user ?? null,
    givenName: cachedSession?.givenName ?? null,
    account: cachedSession?.account ?? null,
    error: '',
  })
  const [hasCheckedInitialSession, setHasCheckedInitialSession] = useState(Boolean(cachedSession))
  const [debugState, setDebugState] = useState({
    loading: false,
    label: 'Session',
    error: '',
    payload: buildDebugSnapshot('Session', { status: 'initializing' }),
  })

  const commitDebugState = useCallback((label, data, error = '') => {
    setDebugState({
      loading: false,
      label,
      error,
      payload: buildDebugSnapshot(label, data, error),
    })
  }, [])

  const refreshSession = useCallback(async (options = {}) => {
    const { exposeOutput = false } = options

    setSessionState((current) => ({
      ...current,
      checking: true,
      error: '',
    }))

    if (exposeOutput) {
      setDebugState((current) => ({
        ...current,
        loading: true,
        label: 'Session',
        error: '',
      }))
    }

    try {
      const session = await getAuthSession()
      let givenName = null
      let account = null

      if (session.authenticated) {
        try {
          const accountResponse = await getAccountInfo()
          account = accountResponse.account ?? null
          givenName = account?.given_name ?? null
        } catch {
          // Account info is best-effort
        }
      }

      const authenticated = Boolean(session.authenticated)
      const user = session.user ?? null

      setSessionState({
        checking: false,
        authenticated,
        user,
        givenName,
        account,
        error: '',
      })

      if (authenticated) {
        saveCachedSession({ user, givenName, account })
      } else {
        clearCachedSession()
      }

      if (exposeOutput) {
        commitDebugState('Session', session)
      }

      return session
    } catch (error) {
      const message = getFrenchAuthErrorMessage(error, 'session')

      setSessionState({
        checking: false,
        authenticated: false,
        user: null,
        givenName: null,
        account: null,
        error: message,
      })
      clearCachedSession()

      if (exposeOutput) {
        commitDebugState('Session', null, message)
      }

      return null
    } finally {
      setHasCheckedInitialSession(true)
    }
  }, [commitDebugState])

  const runDebugAction = useCallback(async (label, action) => {
    setDebugState((current) => ({
      ...current,
      loading: true,
      label,
      error: '',
    }))

    try {
      const result = await action()
      commitDebugState(label, result)
      return result
    } catch (error) {
      commitDebugState(label, null, getErrorMessage(error))
      return null
    }
  }, [commitDebugState])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void refreshSession({ exposeOutput: true })
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [refreshSession])

  useEffect(() => {
    function handleWindowKeydown(event) {
      const key = event.key.toLowerCase()

      if ((event.metaKey || event.ctrlKey) && event.shiftKey && key === 'd') {
        event.preventDefault()
        setDebugOpen((current) => !current)
      }

      if (key === 'escape') {
        setDebugOpen(false)
      }
    }

    window.addEventListener('keydown', handleWindowKeydown)
    return () => window.removeEventListener('keydown', handleWindowKeydown)
  }, [])

  useEffect(() => {
    let faviconLink = document.querySelector("link[rel='icon']")

    if (!faviconLink) {
      faviconLink = document.createElement('link')
      faviconLink.setAttribute('rel', 'icon')
      document.head.appendChild(faviconLink)
    }

    faviconLink.setAttribute('type', 'image/png')
    faviconLink.setAttribute('href', favicon)
  }, [])

  useEffect(() => {
    document.title = sessionState.authenticated
      ? BASE_DOCUMENT_TITLE
      : `${BASE_DOCUMENT_TITLE} - Connexion`
  }, [sessionState.authenticated])

  useEffect(() => {
    if (!debugOpen || sessionState.authenticated) {
      return undefined
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      usernameInputRef.current?.focus()
    })

    return () => window.cancelAnimationFrame(animationFrameId)
  }, [debugOpen, sessionState.authenticated])

  async function handleLogin(event) {
    event.preventDefault()

    setSessionState((current) => ({
      ...current,
      checking: true,
      error: '',
    }))
    setDebugState((current) => ({
      ...current,
      loading: true,
      label: 'Connexion',
      error: '',
    }))

    try {
      const result = await loginToEnt(credentials)
      setCredentials((current) => ({
        ...current,
        password: '',
      }))
      commitDebugState('Connexion', result)
      await refreshSession()
    } catch (error) {
      const message = getFrenchAuthErrorMessage(error, 'login')
      clearCachedSession()
      setSessionState({
        checking: false,
        authenticated: false,
        user: null,
        givenName: null,
        account: null,
        error: message,
      })
      commitDebugState('Connexion', null, message)
    }
  }

  async function handleLogout() {
    setSessionState((current) => ({
      ...current,
      checking: true,
      error: '',
    }))
    setDebugState((current) => ({
      ...current,
      loading: true,
      label: 'Deconnexion',
      error: '',
    }))

    try {
      const result = await logoutFromEnt()
      clearCachedSession()
      setSessionState({
        checking: false,
        authenticated: false,
        user: null,
        givenName: null,
        account: null,
        error: '',
      })
      commitDebugState('Deconnexion', result)
    } catch (error) {
      const message = getErrorMessage(error)
      setSessionState((current) => ({
        ...current,
        checking: false,
        error: message,
      }))
      commitDebugState('Deconnexion', null, message)
    }
  }

  function handleCustomRequest(event) {
    event.preventDefault()

    const path = requestPath.trim()
    if (!path) {
      return
    }

    void runDebugAction(`GET ${path}`, () => requestEnt(path))
  }

  function handleHeaderAction() {
    if (sessionState.checking) {
      return
    }

    if (sessionState.authenticated) {
      void handleLogout()
      return
    }

    setDebugOpen(true)
  }

  const sessionLabel = sessionState.checking
    ? 'Verification de session...'
    : sessionState.authenticated
      ? sessionState.user
        ? `Connecte: ${sessionState.user}`
        : 'Connecte'
      : 'Deconnecte'

  const output = prettyPrint(
    debugState.payload
      ?? buildDebugSnapshot('Debug', { message: 'Aucune sortie disponible.' }),
  )
  const shouldHoldInitialRender = !hasCheckedInitialSession && sessionState.checking

  return (
    <main className="relative min-h-screen flex flex-col bg-bg">
      {shouldHoldInitialRender ? (
        <div className="flex-1 min-h-0 bg-bg" aria-hidden="true" />
      ) : sessionState.authenticated && !establishment ? (
        <OnboardingPage
          userName={sessionState.givenName ?? sessionState.user}
          onSelect={setEstablishment}
        />
      ) : sessionState.authenticated ? (
        <>
          <AppHeader
            authenticated={sessionState.authenticated}
            checking={sessionState.checking}
            onPrimaryAction={handleHeaderAction}
            onRefreshedClick={() => setRefreshedPromptOpen(true)}
          />
          <div className="flex-1 min-h-0 bg-bg">
            <WidgetContainer
              userName={sessionState.givenName ?? sessionState.user}
              isSessionReady={!sessionState.checking}
              account={sessionState.account}
              establishment={establishment}
            />
          </div>
          <AppFooter establishment={establishment} />
        </>
      ) : (
        <LoginPage
          credentials={credentials}
          checking={sessionState.checking}
          errorMessage={sessionState.error}
          onCredentialsChange={(field, value) => setCredentials((current) => ({ ...current, [field]: value }))}
          onSubmit={handleLogin}
        />
      )}
      <button
        type="button"
        className="fixed top-0 left-0 w-5 h-5 p-0 border-0 bg-transparent opacity-0 z-20 focus-visible:opacity-100 focus-visible:rounded-br-[12px] focus-visible:bg-context-bg"
        onClick={() => setDebugOpen((current) => !current)}
        aria-label={debugOpen ? 'Fermer le menu debug' : 'Ouvrir le menu debug'}
        title="Debug"
      />

      <PwaInstallPrompt forceShow={forceInstallPrompt || forceIosPrompt} forceIos={forceIosPrompt} />
      <RefreshedPrompt visible={refreshedPromptOpen} onDismiss={() => setRefreshedPromptOpen(false)} />

      {debugOpen ? (
        <aside className="fixed top-4 right-4 bottom-4 w-[min(720px,calc(100vw-2rem))] grid grid-rows-[auto_auto_auto_minmax(0,1fr)] gap-3 p-4 bg-context-bg text-text border border-border rounded-[20px] shadow-[0_24px_80px_var(--color-shadow)] backdrop-blur-[10px] overflow-hidden z-30 max-lg:top-3 max-lg:right-3 max-lg:left-3 max-lg:bottom-3 max-lg:w-auto" role="dialog" aria-modal="false" aria-label="Menu debug">
          <header className="flex gap-4 justify-between items-center max-lg:flex-col max-lg:items-stretch">
            <div>
              <p className="m-0 mb-1 text-xs font-bold tracking-[0.08em] uppercase text-text-muted font-body">Mode debug</p>
              <h1 className="m-0 text-xl font-bold">ENT minimal</h1>
              <p className="m-0 text-[0.9rem] text-text-muted font-body">Cmd/Ctrl + Shift + D pour afficher ou masquer.</p>
            </div>
            <button
              type="button"
              className="appearance-none border border-border rounded-[12px] bg-bg text-text py-[0.7rem] px-[0.9rem] font-inherit font-semibold leading-[1.1] disabled:opacity-45 disabled:cursor-wait"
              onClick={() => setDebugOpen(false)}
            >
              Fermer
            </button>
          </header>

          <section className="grid gap-3 p-4 border border-border rounded-2xl bg-bg-surface">
            <div className="flex gap-3 justify-between items-center max-lg:flex-col max-lg:items-stretch">
              <span className={`inline-flex items-center min-h-8 py-[0.35rem] px-3 rounded-full text-[0.92rem] font-semibold ${sessionState.authenticated ? 'bg-success-bg text-success-text' : 'bg-bg-subtle text-text-secondary'}`}>
                {sessionLabel}
              </span>
              <button
                type="button"
                className="appearance-none border border-border rounded-[12px] bg-bg text-text py-[0.7rem] px-[0.9rem] font-inherit font-semibold leading-[1.1] disabled:opacity-45 disabled:cursor-wait"
                onClick={() => void refreshSession({ exposeOutput: true })}
                disabled={sessionState.checking}
              >
                Session
              </button>
            </div>

            {!sessionState.authenticated ? (
              <form className="grid gap-3" onSubmit={handleLogin}>
                <div className="grid grid-cols-2 gap-3 max-lg:grid-cols-1">
                  <label className="grid gap-[0.35rem] min-w-0">
                    <span className="text-[0.85rem] font-semibold text-text-secondary font-body">Identifiant</span>
                    <input
                      ref={usernameInputRef}
                      autoComplete="username"
                      type="text"
                      className="w-full min-w-0 py-3 px-[0.85rem] border border-border rounded-[12px] bg-bg text-text"
                      value={credentials.username}
                      onChange={(event) => setCredentials((current) => ({ ...current, username: event.target.value }))}
                    />
                  </label>

                  <label className="grid gap-[0.35rem] min-w-0">
                    <span className="text-[0.85rem] font-semibold text-text-secondary font-body">Mot de passe</span>
                    <input
                      autoComplete="current-password"
                      type="password"
                      className="w-full min-w-0 py-3 px-[0.85rem] border border-border rounded-[12px] bg-bg text-text"
                      value={credentials.password}
                      onChange={(event) => setCredentials((current) => ({ ...current, password: event.target.value }))}
                    />
                  </label>
                </div>

                <div className="flex gap-3 flex-wrap max-lg:flex-col max-lg:items-stretch">
                  <LentButton type="submit" loading={sessionState.checking}>
                    Se connecter
                  </LentButton>
                </div>
              </form>
            ) : (
              <div className="flex gap-3 justify-between items-center max-lg:flex-col max-lg:items-stretch">
                <p className="m-0 text-[0.9rem] text-text-muted font-body">Session active pour {sessionState.user ?? 'un utilisateur connecte'}.</p>
                <button
                  type="button"
                  className="appearance-none border border-border rounded-[12px] bg-bg text-text py-[0.7rem] px-[0.9rem] font-inherit font-semibold leading-[1.1] disabled:opacity-45 disabled:cursor-wait"
                  onClick={() => void handleLogout()}
                  disabled={sessionState.checking}
                >
                  Se deconnecter
                </button>
              </div>
            )}

            {sessionState.error ? <p className="m-0 text-error font-body">{sessionState.error}</p> : null}
          </section>

          <section className="grid gap-3 p-4 border border-border rounded-2xl bg-bg-surface">
            <div className="flex gap-3 flex-wrap max-lg:flex-col max-lg:items-stretch">
                <button
                type="button"
                className="appearance-none border border-border rounded-[12px] bg-bg text-text py-[0.7rem] px-[0.9rem] font-inherit font-semibold leading-[1.1]"
                onClick={() => { setForceInstallPrompt(true); setTimeout(() => setForceInstallPrompt(false), 100) }}
              >
                PWA Prompt
              </button>
              <button
                type="button"
                className="appearance-none border border-border rounded-[12px] bg-bg text-text py-[0.7rem] px-[0.9rem] font-inherit font-semibold leading-[1.1]"
                onClick={() => { setForceIosPrompt(true); setTimeout(() => setForceIosPrompt(false), 100) }}
              >
                PWA Prompt iOS
              </button>
            {['Account', 'Layout', 'Planning', 'Marketplace', 'Grades', 'Latest Grade', 'Average Grade'].map((label) => (
                <button
                  key={label}
                  type="button"
                  className="appearance-none border border-border rounded-[12px] bg-bg text-text py-[0.7rem] px-[0.9rem] font-inherit font-semibold leading-[1.1] disabled:opacity-45 disabled:cursor-wait"
                  onClick={() => void runDebugAction(label, () => {
                    const actions = { Account: getAccountInfo, Layout: getLayout, Planning: getPlanning, Marketplace: getMarketplaceEntries, Grades: getGrades, 'Latest Grade': getLatestGrade, 'Average Grade': getAverageGrade }
                    return actions[label]()
                  })}
                  disabled={debugState.loading}
                >
                  {label}
                </button>
              ))}
            </div>

            <form className="flex gap-3 items-end max-lg:flex-col max-lg:items-stretch" onSubmit={handleCustomRequest}>
              <label className="grid gap-[0.35rem] min-w-0 flex-1">
                <span className="text-[0.85rem] font-semibold text-text-secondary font-body">Endpoint ENT</span>
                <input
                  type="text"
                  className="w-full min-w-0 py-3 px-[0.85rem] border border-border rounded-[12px] bg-bg text-text"
                  value={requestPath}
                  onChange={(event) => setRequestPath(event.target.value)}
                  placeholder="/api/v4-3/dlm/layout.json"
                />
              </label>
              <LentButton type="submit" className="shrink-0" disabled={debugState.loading || !requestPath.trim()}>
                GET
              </LentButton>
            </form>
          </section>

          <section className="grid gap-3 p-4 border border-border rounded-2xl bg-bg-surface min-h-0 grid-rows-[auto_auto_minmax(0,1fr)]">
            <div className="flex gap-3 justify-between items-center max-lg:flex-col max-lg:items-stretch">
              <div>
                <strong>{debugState.label || 'Sortie JSON'}</strong>
                <p className="m-0 text-[0.9rem] text-text-muted font-body">Sortie JSON brute des appels locaux et proxifies.</p>
              </div>
              {debugState.loading ? <span className="m-0 text-[0.9rem] text-text-muted font-body">Chargement...</span> : null}
            </div>

            {debugState.error ? <p className="m-0 text-error font-body">{debugState.error}</p> : null}
            <pre className="m-0 min-h-0 h-full overflow-auto p-4 rounded-[14px] border border-border bg-bg text-text text-[0.85rem] leading-[1.45] whitespace-pre-wrap break-words">{output}</pre>
          </section>
        </aside>
      ) : null}
    </main>
  )
}

export default App
