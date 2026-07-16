// Server-side config for the minimal example university.
import { id, casOrigin, entOrigin, features, gradesCopy, portalEntryPath } from './shared.js'

export default {
  id,
  features,

  origins: {
    ent: entOrigin,
    cas: casOrigin,
    // Services this university does not have (their features are off too).
    ade: null,
    moodle: null,
    planning: null,
  },

  auth: {
    portalEntryPath,
  },

  grades: gradesCopy,
}
