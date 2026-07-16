// Server-side config for Université Exemple (demo university).
// The ADE/planning origins are fake: demo sessions are answered with demo
// payloads before any upstream call, and real logins fail cleanly.
import {
  id,
  casOrigin,
  entOrigin,
  features,
  gradesCopy,
  planningServiceUrl,
  portalEntryPath,
} from './shared.js'

export default {
  id,
  features,

  origins: {
    ent: entOrigin,
    cas: casOrigin,
    ade: 'https://campus-app.univ-exemple.example',
    moodle: null,
    planning: 'https://planning.univ-exemple.example',
  },

  auth: {
    portalEntryPath,
  },

  ade: {
    etab: 'EX',
    passwordKey: '0000000000000000',
    passwordIv: '0000000000000000',
    appHeaders: {
      Accept: 'application/json',
      'content-type': 'application/json',
      session: 'null',
    },
  },

  planning: {
    serviceUrl: planningServiceUrl,
    gwtClientId: 'demo',
  },

  grades: gradesCopy,
}
