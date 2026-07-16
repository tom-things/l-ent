// Université de Rennes — server-side configuration.
// Never imported by client code: holds origins, auth-flow parameters and the
// reverse-engineered ADE mobile-app credentials.
import { id, casOrigin, entOrigin, features, gradesCopy, planningServiceUrl, portalEntryPath } from './shared.js'

export default {
  id,
  // Single source of truth for feature flags, shared with the client config.
  features,

  origins: {
    ent: entOrigin,
    cas: casOrigin,
    // Set any of these to null when the university has no such service —
    // the matching feature flag must be false too.
    ade: 'https://campus-app.univ-rennes.fr',
    moodle: 'https://foad.univ-rennes.fr',
    planning: 'https://planning.univ-rennes1.fr',
  },

  auth: {
    portalEntryPath,
  },

  moodle: {
    shibbolethLoginPath: '/auth/shibboleth/index.php',
    // Shibboleth WAYF entity id used to pre-select the university on the
    // federation discovery page.
    wayfEntityId: 'urn:mace:cru.fr:federation:univ-rennes1.fr',
  },

  // Credentials of the official "Campus" mobile app, required by the ADE
  // mobile API. Reverse-engineered per university (see docs/ADDING_A_UNIVERSITY.md).
  ade: {
    // Establishment code sent in the ADE login body.
    etab: 'UR',
    passwordKey: 'jfkgltshGD6_"hrj',
    passwordIv: 'fgghjhgkdthykhjg',
    appHeaders: {
      Accept: 'application/json',
      'content-type': 'application/json',
      session: 'null',
      'X-lang': 'fr',
      'X-nav-lang': 'fr-FR',
      'X-App-version': '2.4.5',
      'User-Agent': 'App-Campus-Mobile-2.4.5',
      DeviceId: 'null',
      DeviceVersion: '20030107',
      DeviceOs: 'Web',
      DeviceManufacturer: 'Google Inc.',
      DeviceModel: '',
    },
  },

  planning: {
    serviceUrl: planningServiceUrl,
    gwtClientId: 'Z0pqq18',
  },

  grades: gradesCopy,
}
