import { useEffect } from 'react'
import { Icon } from '@iconify/react'

/* global __BUILD_HASH__ */

function AboutModal({ open, onClose }) {
  useEffect(() => {
    if (!open) return undefined
    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null
  return (
    <div
      className="weather-modal-backdrop fixed inset-0 z-40 flex items-center justify-center bg-backdrop p-5 animate-modal-backdrop-in max-sm:p-[14px]"
      onClick={onClose}
      role="presentation"
    >
      <section
        className="w-[min(440px,100%)] rounded-[22px] border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] animate-modal-card-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex flex-col gap-[15px] p-[21px]">
          <div className="flex items-center justify-between">
            <h2 id="about-modal-title" className="m-0 font-body text-[22px] font-bold leading-[1.1] tracking-[-0.28px]">
              À propos
            </h2>
            <button
              type="button"
              className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-full border border-[rgba(27,27,27,0.16)] bg-[#f3f1eb] p-0 text-[var(--color-text)] transition-colors duration-[120ms] hover:bg-[#edebe5] dark:border-[var(--color-border)] dark:bg-[var(--color-bg-muted)] dark:hover:bg-[var(--color-bg-subtle)]"
              onClick={onClose}
              aria-label="Fermer"
            >
              <Icon icon="carbon:close" className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="flex flex-col gap-3 font-body text-[15px] leading-[1.45]">
            <p className="m-0">
              <strong>l&apos;ent</strong> est un client alternatif aux services numériques de l&apos;Université de Rennes.
            </p>
            <p className="m-0 text-text-secondary">
              Client non officiel, indépendant et non affilié à l&apos;Université de Rennes. Ce projet ne stocke aucune donnée personnelle et se contente de relayer les services existants dans une interface repensée.
            </p>
            <p className="m-0">
              Code source disponible sur{' '}
              <a
                href="https://github.com/tom-things/l-ent"
                className="text-text underline underline-offset-2"
                target="_blank"
                rel="noopener noreferrer"
              >
                GitHub
              </a>
            </p>
            <p className="m-0 text-text-muted text-[13px]">
              <a
                href="https://tomthings.fr"
                className="text-text-muted underline underline-offset-2"
                target="_blank"
                rel="noopener noreferrer"
              >
                Fait par un étudiant de l&apos;IUT de Lannion
              </a>
            </p>
            <p className="m-0 text-text-muted text-[12px] font-mono">
              {import.meta.env.DEV ? 'dev' : `build ${typeof __BUILD_HASH__ !== 'undefined' ? __BUILD_HASH__ : 'dev'}`}
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}

export default AboutModal
