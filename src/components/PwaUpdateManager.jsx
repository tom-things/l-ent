import { useCallback, useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import RefreshedPrompt from './RefreshedPrompt'

const LOCAL_PWA_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1'])
const LOCAL_PWA_RESET_KEY = 'l-ent:local-pwa-reset'
const UPDATE_PROMPT_TITLE = 'Une nouvelle version est prête'
const UPDATE_PROMPT_DESCRIPTION = "Une nouvelle version de l'ent est disponible. Applique-la maintenant pour récupérer les derniers changements."

function isLocalPwaHost(hostname = '') {
  return LOCAL_PWA_HOSTS.has(hostname) || hostname.endsWith('.local')
}

function LocalPwaManager({ forceOpen, onForceOpenChange }) {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return undefined
    }

    let cancelled = false

    async function cleanupLocalPwa() {
      const registrations = await navigator.serviceWorker.getRegistrations()
      const hadRegistrations = registrations.length > 0

      if (hadRegistrations) {
        await Promise.allSettled(registrations.map((registration) => registration.unregister()))
      }

      if ('caches' in window) {
        const cacheKeys = await caches.keys()
        await Promise.allSettled(cacheKeys.map((cacheKey) => caches.delete(cacheKey)))
      }

      if (cancelled) {
        return
      }

      // Reload once after cleanup so localhost immediately picks up the network bundle.
      if (hadRegistrations && navigator.serviceWorker.controller) {
        const alreadyReset = sessionStorage.getItem(LOCAL_PWA_RESET_KEY) === '1'

        if (!alreadyReset) {
          sessionStorage.setItem(LOCAL_PWA_RESET_KEY, '1')
          window.location.reload()
          return
        }
      }

      sessionStorage.removeItem(LOCAL_PWA_RESET_KEY)
    }

    void cleanupLocalPwa()

    return () => {
      cancelled = true
    }
  }, [])

  const closePreview = useCallback(() => {
    onForceOpenChange(false)
  }, [onForceOpenChange])

  const reloadPreview = useCallback(() => {
    onForceOpenChange(false)
    window.location.reload()
  }, [onForceOpenChange])

  return (
    <RefreshedPrompt
      visible={forceOpen}
      title={UPDATE_PROMPT_TITLE}
      description={UPDATE_PROMPT_DESCRIPTION}
      dismissLabel="Plus tard"
      confirmLabel="Mettre à jour"
      onDismiss={closePreview}
      onConfirm={reloadPreview}
    />
  )
}

function ProductionPwaManager({ forceOpen, onForceOpenChange }) {
  const [isApplyingUpdate, setIsApplyingUpdate] = useState(false)
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onNeedRefresh() {
      setIsApplyingUpdate(false)
    },
    onRegisterError(error) {
      console.error('PWA registration failed', error)
    },
  })

  const visible = forceOpen || needRefresh

  const dismissPrompt = useCallback(() => {
    setIsApplyingUpdate(false)
    setNeedRefresh(false)
    onForceOpenChange(false)
  }, [onForceOpenChange, setNeedRefresh])

  const applyUpdate = useCallback(async () => {
    if (isApplyingUpdate) {
      return
    }

    setIsApplyingUpdate(true)

    try {
      if (needRefresh) {
        await updateServiceWorker(true)
        return
      }

      onForceOpenChange(false)
      window.location.reload()
    } catch (error) {
      console.error('Failed to apply PWA update', error)
      setIsApplyingUpdate(false)
    }
  }, [isApplyingUpdate, needRefresh, onForceOpenChange, updateServiceWorker])

  return (
    <RefreshedPrompt
      visible={visible}
      title={UPDATE_PROMPT_TITLE}
      description={UPDATE_PROMPT_DESCRIPTION}
      dismissLabel="Plus tard"
      confirmLabel="Mettre à jour"
      confirmBusy={isApplyingUpdate}
      onDismiss={dismissPrompt}
      onConfirm={applyUpdate}
    />
  )
}

export default function PwaUpdateManager({ forceOpen = false, onForceOpenChange }) {
  const isLocalRuntime = typeof window !== 'undefined' && isLocalPwaHost(window.location.hostname)

  if (isLocalRuntime) {
    return <LocalPwaManager forceOpen={forceOpen} onForceOpenChange={onForceOpenChange} />
  }

  return <ProductionPwaManager forceOpen={forceOpen} onForceOpenChange={onForceOpenChange} />
}
