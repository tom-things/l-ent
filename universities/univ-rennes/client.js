// Université de Rennes — client-safe configuration.
// Everything in this file is bundled into the browser build: no secrets here.
// This is the reference implementation forks should copy (see docs/ADDING_A_UNIVERSITY.md).
import logo from './assets/logo.svg'
import lockup from './assets/lockup.svg'
import lockupDark from './assets/lockup-dark.svg'
import { getAppIcon } from './app-icons/index.js'
import {
  id,
  branding,
  casOrigin,
  entOrigin,
  features,
  gradesCopy,
  planningServiceUrl,
  portalEntryPath,
  university,
} from './shared.js'

export default {
  id,

  university,

  branding: {
    ...branding,
    logo,
    // Bespoke "l'ent × Université de Rennes" artwork for the sidebar/header.
    // Universities without one get an auto-composed l'ent + logo lockup.
    lockup,
    lockupDark,
  },

  // Optional help links (login page + account modal); omit an entry to hide it.
  links: {
    forgotPassword: 'https://docinfo.univ-rennes1.fr/documentation/compte-jai-oublie-mon-mot-de-passe',
    activateAccount: 'https://sesame.univ-rennes1.fr/motdepasse/public/activate',
    manageAccount: 'https://sesame.univ-rennes.fr/comptes/',
  },

  origins: {
    ent: entOrigin,
    cas: casOrigin,
  },

  auth: {
    portalEntryPath,
  },

  features,

  planning: {
    serviceUrl: planningServiceUrl,
  },

  // Optional: detection of the student's establishment (faculty/campus) from
  // their ADE tree path, plus per-establishment feature gating. Omit the whole
  // block for universities with a single establishment.
  establishments: {
    // Ordered substring rules, matched against the lowercased ADE tree path.
    detectFromAdeTree: [
      { includes: ['iut lannion'], id: 'iutlan' },
      { includes: ['iut saint-brieuc'], id: 'iutsaib' },
      { includes: ['iut saint-malo'], id: 'iutsai' },
      { includes: ['osur'], id: 'ods' },
      { includes: ['odontologie'], id: 'ufro' },
      { includes: ['pharmacie'], id: 'ufrp' },
      { includes: ['médecine', 'medecine'], id: 'ufrm' },
      { includes: ['faculté des sciences', 'faculte des sciences', 'istic'], id: 'ufrs' },
      { includes: ['droit', 'science politique'], id: 'fdse' },
    ],
    fallbackId: 'other',
    byId: {
      iutlan: {
        label: 'IUT de Lannion',
        gradeWidgets: true,
        nextClassWidget: true,
        extraServices: [
          {
            id: 'lent-iutlan-loxya',
            title: 'Loxya',
            description: 'Location de matériel audiovisuel',
            href: 'https://iut-lannion.loxya.app/external/login',
            target: '_blank',
          },
        ],
      },
    },
  },

  services: {
    // (title) => icon URL | null, for the applications grid.
    getAppIcon,
    // Keyword → category map applied to ENT service titles.
    categories: [
      { label: 'Scolarité', keywords: ['notes', 'dossier étudiant', 'apogée', 'contrat pédagogique', 'stages', 'évaluation orthographique', 'contrats étudiants'] },
      { label: 'Communication', keywords: ['messagerie', 'annuaire', 'listes de diffusion', 'webconférence', 'webconference'] },
      { label: 'Pédagogie', keywords: ['moodle', 'foad', 'mooc', 'modules auto-formatifs', 'création de modules', 'téléformation', 'klaxoon'] },
      { label: 'Ressources', keywords: ['mediaserver', 'nudgis', 'ori-oai', 'portail des thèses', 'recherche documentaire', 'documentation des services', 'espaces de stockage', 'mise en ligne', 'loxya'] },
      { label: 'Compte', keywords: ['sésame', 'sesame', 'compte informatique', 'mfa', 'authentification', "crédits d'impression"] },
      { label: 'Outils', keywords: ['microsoft 365', 'esup signature', 'emplois du temps', 'assistance'] },
    ],
    // Optional hook: hide an ENT application entirely (Rennes hides the
    // ScoDoc "notes" portlet for IUT Lannion while grade access is closed).
    isUnavailableApplication(application = {}) {
      const haystack = [
        application.id,
        application.fname,
        application.title,
        application.name,
        application.description,
        application.href,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return haystack.includes('notes') && (haystack.includes('lannion') || haystack.includes('iutlan'))
    },
  },

  grades: gradesCopy,
}
