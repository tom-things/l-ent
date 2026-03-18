import annuaire from './annuaire.png'
import assistance from './assistance.png'
import compteInformatique from './compte-informatique.png'
import contratPedagogique from './contrat-pedagogique.png'
import contratsEtudiants from './contrats-etudiants.png'
import creationModules from './creation-modules.png'
import creditsImpression from './credits-impression.png'
import documentationServices from './documentation-services.png'
import dossierEtudiant from './dossier-etudiant.png'
import emploisDuTemps from './emplois-du-temps.png'
import espacesStockage from './espaces-stockage.png'
import esupSignature from './esup-signature.png'
import evaluationOrthographique from './evaluation-orthographique.png'
import klaxoon from './klaxoon.png'
import listesDiffusion from './listes-diffusion.png'
import mediaserver from './mediaserver.png'
import messagerie from './messagerie.png'
import mfa from './mfa.png'
import microsoft365 from './microsoft-365.png'
import miseEnLigneFichier from './mise-en-ligne-fichier.png'
import modulesSciences from './modules-sciences.png'
import moocEnseignants from './mooc-enseignants.png'
import moodle from './moodle.png'
import oriOai from './ori-oai.png'
import portailTheses from './portail-theses.png'
import stages from './stages.png'
import teleformationUnjf from './teleformation-unjf.png'
import iutlanNotes9 from './iutlan-notes9.png'
import sesame from './sesame.png'
import webconference from './webconference.png'

const APP_ICONS = {
  'moodle - foad': moodle,
  'emplois du temps': emploisDuTemps,
  'messagerie': messagerie,
  'annuaire': annuaire,
  'contrat pédagogique': contratPedagogique,
  'crédits d\'impression': creditsImpression,
  'dossier étudiant (apogée)': dossierEtudiant,
  'compte informatique': compteInformatique,
  'authentification multifacteur (mfa)': mfa,
  'microsoft 365': microsoft365,
  'esup signature': esupSignature,
  'mise en ligne d\'un fichier': miseEnLigneFichier,
  'stages (apogée)': stages,
  'webconférence': webconference,
  'mediaserver nudgis (ubicast)': mediaserver,
  'espaces de stockage': espacesStockage,
  'assistance': assistance,
  'ori-oai - search': oriOai,
  'portail des thèses': portailTheses,
  'gestion des contrats étudiants': contratsEtudiants,
  'listes de diffusion - étudiants': listesDiffusion,
  'klaxoon': klaxoon,
  'mooc pour les enseignants et tuteurs': moocEnseignants,
  'évaluation orthographique': evaluationOrthographique,
  'modules auto-formatifs pour les sciences dures': modulesSciences,
  'création de modules auto-formatifs interactifs': creationModules,
  'téléformation unjf': teleformationUnjf,
  'documentation des services numériques': documentationServices,
  'notes iut lannion': iutlanNotes9,
  'sésame': sesame,
  'sesame': sesame,
  'sésame - comptes et données personnelles': sesame,
}

export function getAppIcon(title = '') {
  return APP_ICONS[title.trim().toLowerCase()] || null
}
