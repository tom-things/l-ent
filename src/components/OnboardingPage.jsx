import './OnboardingPage.css'

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
    <section className="onboarding" aria-label="Choix de l'établissement">
      <div className="onboarding__content">
        <div className="onboarding__header">
          <h1 className="onboarding__title">
            Hello, {userName || 'étudiant'}
          </h1>
          <p className="onboarding__subtitle">
            Configurons ton ENT, sélectionne ton établissement affilié à l'université de Rennes
          </p>
        </div>

        <div className="onboarding__grid">
          {ESTABLISHMENTS.map((establishment) => (
            <button
              key={establishment.id}
              type="button"
              className="onboarding__card"
              onClick={() => handleSelect(establishment)}
            >
              <span className="onboarding__card-logo">
                <img
                  src={establishment.logo}
                  alt=""
                  className="onboarding__card-logo-image"
                />
              </span>
              <span className="onboarding__card-name">{establishment.name}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}

export default OnboardingPage
