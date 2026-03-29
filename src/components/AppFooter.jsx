import { useState } from 'react'
import { Icon } from '@iconify/react'
import AboutModal from './AboutModal'

/* global __BUILD_HASH__ */

function AppFooter() {
  const [aboutOpen, setAboutOpen] = useState(false)

  return (
    <footer className="flex items-center justify-center gap-[6px] pt-2 pb-6 px-6 text-text-muted text-[12px]">
      <span className="font-mono">
        {import.meta.env.DEV ? 'dev' : `build ${typeof __BUILD_HASH__ !== 'undefined' ? __BUILD_HASH__ : 'dev'}`}
      </span>
      <button
        type="button"
        className="inline-flex items-center justify-center border-0 bg-transparent text-text-muted transition-colors duration-120 hover:text-text cursor-pointer p-0"
        onClick={() => setAboutOpen(true)}
        aria-label="À propos"
      >
        <Icon icon="carbon:information" className="h-[14px] w-[14px]" />
      </button>
      <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </footer>
  )
}

export default AppFooter
