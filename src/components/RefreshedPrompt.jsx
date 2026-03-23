import { useCallback, useState } from 'react'
import mobileInviteImg from '../assets/mobile-pwa-invite.png'

export default function RefreshedPrompt({ visible, onDismiss }) {
  const [animatingOut, setAnimatingOut] = useState(false)

  const dismiss = useCallback(() => {
    setAnimatingOut(true)
    setTimeout(() => {
      setAnimatingOut(false)
      onDismiss()
    }, 280)
  }, [onDismiss])

  if (!visible) return null

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-backdrop ${animatingOut ? 'animate-[pwa-backdrop-out_280ms_ease-in_forwards]' : 'animate-[pwa-backdrop-in_280ms_ease-out]'}`}
        onClick={dismiss}
      />
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] ${animatingOut ? 'animate-[pwa-slide-out_280ms_ease-in_forwards]' : 'animate-[pwa-slide-in_350ms_cubic-bezier(0.16,1,0.3,1)]'}`}
      >
        <div className="max-w-[420px] mx-auto rounded-[20px] bg-widget-bg border border-border overflow-hidden shadow-[0_-8px_40px_var(--color-shadow)]">
          <img
            src={mobileInviteImg}
            alt="l'ent est rafraîchi"
            className="w-full"
          />
          <div className="px-5 pt-4 pb-4 flex flex-col gap-2">
            <h2 className="m-0 text-[1.15rem] font-bold text-text leading-tight">
              l'ent a changé de look
            </h2>
            <p className="m-0 text-[0.9rem] text-text-muted font-body leading-snug">
              L'interface que tu connaissais a été entièrement repensée pour être plus claire, plus rapide et plus agréable au quotidien. Mêmes services, nouvelle expérience.
            </p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="w-full py-3.5 border-t border-border bg-transparent text-text font-body font-semibold text-[0.95rem] active:bg-bg-subtle transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </>
  )
}
