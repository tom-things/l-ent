import iutlanLogo from '../assets/uni_logos/iutlan.svg'
import iutsaibLogo from '../assets/uni_logos/iutsaib.svg'
import iutsaiLogo from '../assets/uni_logos/iutsai.svg'
import ufrsLogo from '../assets/uni_logos/ufrs.svg'
import ufrmLogo from '../assets/uni_logos/ufrm.svg'
import ufrpLogo from '../assets/uni_logos/ufrp.svg'
import ufroLogo from '../assets/uni_logos/ufro.svg'
import fdseLogo from '../assets/uni_logos/fdse.svg'
import odsLogo from '../assets/uni_logos/ods.svg'
import univRennesLogo from '../assets/uni_logos/univ-rennes.svg'

const ESTABLISHMENTS = [
  { id: 'iutlan', name: 'IUT de Lannion', logo: iutlanLogo },
  { id: 'iutsaib', name: 'IUT de Saint-Brieuc', logo: iutsaibLogo },
  { id: 'iutsai', name: 'IUT de Saint-Malo', logo: iutsaiLogo },
  { id: 'ufrs', name: 'UFR Sciences', logo: ufrsLogo },
  { id: 'ufrm', name: 'UFR Médecine', logo: ufrmLogo },
  { id: 'ufrp', name: 'UFR Pharmacie', logo: ufrpLogo },
  { id: 'ufro', name: 'UFR Odontologie', logo: ufroLogo },
  { id: 'fdse', name: 'Fac. Droit et Sc. politique', logo: fdseLogo },
  { id: 'ods', name: 'OSUR', logo: odsLogo },
  { id: 'other', name: 'Autre', logo: univRennesLogo },
]

export const ESTABLISHMENT_KEY = 'l-ent:establishment'

export function getStoredEstablishment() {
  try {
    return localStorage.getItem(ESTABLISHMENT_KEY) || null
  } catch {
    return null
  }
}

function OnboardingPage({ userName, onSelect }) {
  function handleSelect(establishment) {
    try {
      localStorage.setItem(ESTABLISHMENT_KEY, establishment.id)
    } catch {
      // Storage unavailable
    }
    onSelect(establishment.id)
  }

  return (
    <section className="flex-1 flex items-center justify-center bg-bg p-8 min-h-0 max-sm:p-5" aria-label="Choix de l'établissement">
      <div className="flex flex-col gap-8 w-full max-w-[800px]">
        <div className="flex flex-col gap-3">
          <h1 className="text-[3.5rem] font-bold leading-[0.9] text-text m-0 max-sm:text-[2.25rem]">
            Hello, {userName || 'étudiant'}
          </h1>
          <p className="text-lg font-medium leading-[1.2] text-text-muted m-0 font-body max-sm:text-base">
            Configurons ton ENT, sélectionne ton établissement affilié à l'université de Rennes
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          {ESTABLISHMENTS.map((establishment, index) => (
            <button
              key={establishment.id}
              type="button"
              className="onboarding-card app-card-enter flex items-center gap-3 h-[88px] p-3 bg-widget-bg border border-white rounded-[22px] cursor-pointer text-left font-inherit transition-all duration-150 ease-in-out hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-2 max-sm:h-[76px]"
              style={{ animationDelay: `${index * 40}ms` }}
              onClick={() => handleSelect(establishment)}
            >
              <span className="flex items-center justify-center w-[62px] h-[62px] shrink-0 overflow-hidden max-sm:w-[50px] max-sm:h-[50px]">
                <img
                  src={establishment.logo}
                  alt=""
                  className="max-w-full max-h-full object-contain dark:invert"
                />
              </span>
              <span className="text-[1.1rem] font-semibold text-text leading-[1.1] max-sm:text-base">{establishment.name}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}

export default OnboardingPage
