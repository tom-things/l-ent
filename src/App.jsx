import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import favicon from './assets/favicon.png'
import AppHeader from './components/AppHeader'
import LentButton from './components/LentButton'
import LoginPage from './components/LoginPage'
import WidgetContainer from './components/WidgetContainer'
import {
  getAuthSession,
  getLayout,
  getMarketplaceEntries,
  loginToEnt,
  logoutFromEnt,
  requestEnt,
} from './entApi'

const DEFAULT_REQUEST_PATH = '/api/v4-3/dlm/layout.json'
const BASE_DOCUMENT_TITLE = "l'ent - Toute ta fac, au même endroit."

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
  const usernameInputRef = useRef(null)
  const [credentials, setCredentials] = useState({
    username: '',
    password: '',
  })
  const [requestPath, setRequestPath] = useState(DEFAULT_REQUEST_PATH)
  const [sessionState, setSessionState] = useState({
    checking: true,
    authenticated: false,
    user: null,
    error: '',
  })
  const [hasCheckedInitialSession, setHasCheckedInitialSession] = useState(false)
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
      setSessionState({
        checking: false,
        authenticated: Boolean(session.authenticated),
        user: session.user ?? null,
        error: '',
      })

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
        error: message,
      })

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
      setSessionState({
        checking: false,
        authenticated: false,
        user: null,
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
      setSessionState({
        checking: false,
        authenticated: false,
        user: null,
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
    <main className="app-shell">
      {shouldHoldInitialRender ? (
        <div className="blank-surface" aria-hidden="true" />
      ) : sessionState.authenticated ? (
        <>
          <AppHeader
            authenticated={sessionState.authenticated}
            checking={sessionState.checking}
            onPrimaryAction={handleHeaderAction}
          />
          <div className="blank-surface">
            <WidgetContainer
              userName={sessionState.user}
              isSessionReady={!sessionState.checking}
            />
          </div>
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
        className="debug-hotspot"
        onClick={() => setDebugOpen((current) => !current)}
        aria-label={debugOpen ? 'Fermer le menu debug' : 'Ouvrir le menu debug'}
        title="Debug"
      />

      {debugOpen ? (
        <aside className="debug-overlay" role="dialog" aria-modal="false" aria-label="Menu debug">
          <header className="debug-header">
            <div>
              <p className="debug-kicker">Mode debug</p>
              <h1 className="debug-title">ENT minimal</h1>
              <p className="hint">Cmd/Ctrl + Shift + D pour afficher ou masquer.</p>
            </div>
            <button
              type="button"
              className="debug-control-button debug-control-button--ghost"
              onClick={() => setDebugOpen(false)}
            >
              Fermer
            </button>
          </header>

          <section className="debug-card">
            <div className="status-row">
              <span className={`status-pill ${sessionState.authenticated ? 'is-authenticated' : 'is-guest'}`}>
                {sessionLabel}
              </span>
              <button
                type="button"
                className="debug-control-button debug-control-button--ghost"
                onClick={() => void refreshSession({ exposeOutput: true })}
                disabled={sessionState.checking}
              >
                Session
              </button>
            </div>

            {!sessionState.authenticated ? (
              <form className="credentials-form" onSubmit={handleLogin}>
                <div className="credentials-grid">
                  <label className="field">
                    <span>Identifiant</span>
                    <input
                      ref={usernameInputRef}
                      autoComplete="username"
                      type="text"
                      value={credentials.username}
                      onChange={(event) => setCredentials((current) => ({ ...current, username: event.target.value }))}
                    />
                  </label>

                  <label className="field">
                    <span>Mot de passe</span>
                    <input
                      autoComplete="current-password"
                      type="password"
                      value={credentials.password}
                      onChange={(event) => setCredentials((current) => ({ ...current, password: event.target.value }))}
                    />
                  </label>
                </div>

                <div className="quick-actions">
                  <LentButton type="submit" disabled={sessionState.checking}>
                    {sessionState.checking ? 'Connexion...' : 'Se connecter'}
                  </LentButton>
                </div>
              </form>
            ) : (
              <div className="user-row">
                <p className="hint">Session active pour {sessionState.user ?? 'un utilisateur connecte'}.</p>
                <button
                  type="button"
                  className="debug-control-button debug-control-button--ghost"
                  onClick={() => void handleLogout()}
                  disabled={sessionState.checking}
                >
                  Se deconnecter
                </button>
              </div>
            )}

            {sessionState.error ? <p className="error-message">{sessionState.error}</p> : null}
          </section>

          <section className="debug-card">
            <div className="quick-actions">
              <button
                type="button"
                className="debug-control-button debug-control-button--ghost"
                onClick={() => void runDebugAction('Layout', () => getLayout())}
                disabled={debugState.loading}
              >
                Layout
              </button>
              <button
                type="button"
                className="debug-control-button debug-control-button--ghost"
                onClick={() => void runDebugAction('Marketplace', () => getMarketplaceEntries())}
                disabled={debugState.loading}
              >
                Marketplace
              </button>
            </div>

            <form className="request-form" onSubmit={handleCustomRequest}>
              <label className="field field-path">
                <span>Endpoint ENT</span>
                <input
                  type="text"
                  value={requestPath}
                  onChange={(event) => setRequestPath(event.target.value)}
                  placeholder="/api/v4-3/dlm/layout.json"
                />
              </label>
              <LentButton type="submit" disabled={debugState.loading || !requestPath.trim()}>
                GET
              </LentButton>
            </form>
          </section>

          <section className="debug-card debug-output-card">
            <div className="debug-output-header">
              <div>
                <strong>{debugState.label || 'Sortie JSON'}</strong>
                <p className="hint">Sortie JSON brute des appels locaux et proxifies.</p>
              </div>
              {debugState.loading ? <span className="hint">Chargement...</span> : null}
            </div>

            {debugState.error ? <p className="error-message">{debugState.error}</p> : null}
            <pre className="debug-json">{output}</pre>
          </section>
        </aside>
      ) : null}
    </main>
  )
}

export default App
