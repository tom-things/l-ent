# Ajouter votre université

l'ent est conçu pour être forké : toute la configuration propre à une université vit dans un seul dossier, `universities/<id>/`. Le reste du code (frontend React, backend Express) est générique.

Trois exemples sont fournis :

- **`universities/univ-rennes/`** — l'implémentation de référence, complète (CAS + ADE + Planning GWT + Moodle + établissements + icônes de services).
- **`universities/example-minimal/`** — le strict minimum (ENT uPortal + CAS). Bon point de départ : copiez-le, renommez-le, remplissez vos valeurs.
- **`universities/univ-exemple/`** — université fictive de démonstration : origins factices, mais compte démo (`demo@l-ent.app` / `lent-demo`) et widgets activés. Sert à tester le flux d'ajout et le routage par sous-domaine de bout en bout.

## Démarrage rapide

```bash
cp -r universities/example-minimal universities/univ-exemple
# éditez universities/univ-exemple/{shared,client,server}.js (id, origins, branding)
UNIVERSITY=univ-exemple npm run dev      # développement
UNIVERSITY=univ-exemple npm run build    # build frontend
UNIVERSITY=univ-exemple npm start        # production
```

> **Important** : `UNIVERSITY` doit être identique au build et au run — le bundle frontend est généré pour une seule université. Sans variable, `univ-rennes` est utilisée. Copiez `.env.example` pour référence.

### Hébergement multi-université (sous-domaines)

Une même instance peut servir plusieurs universités (voir README, section « Multi-université par sous-domaine ») : `npm run build:all` puis `MULTI_TENANT=1 npm start`. Votre université est alors accessible sur le sous-domaine `<id-sans-tirets>.<domaine>` ; pour utiliser d'autres hostnames, exportez-les dans `shared.js` :

```js
export const hostnames = ['rennes.lent.example', 'ent-rennes.example.fr']
```

## Les trois fichiers d'une université

| Fichier | Chargé par | Contenu |
| --- | --- | --- |
| `shared.js` | Node **et** navigateur | Données pures partagées : id, origins publics, flags de features, textes de branding. **Aucun import d'asset** (le serveur Node doit pouvoir l'importer). |
| `client.js` | Navigateur uniquement (alias Vite `@university`) | Config complète côté client : branding + logo, liens d'aide, catégories/icônes de services, établissements. Peut importer des images. |
| `server.js` | Node uniquement | Origins internes (CAS, ADE, Moodle, Planning), paramètres du flux d'auth, clés ADE rétro-ingéniérées. **Jamais envoyé au navigateur.** |

## Champs de configuration

### Obligatoires

- `id` — identifiant du dossier (kebab-case).
- `origins.ent` — origine du portail ENT (uPortal). Le proxy local ne relaie que cet hôte.
- `origins.cas` (serveur + client) — origine du SSO CAS. Le flux de connexion implémenté est **CAS 2.0 avec formulaire** (scraping des champs `execution`/`_eventId`), le standard Jasig/Apereo utilisé par la plupart des universités françaises.
- `auth.portalEntryPath` — page d'atterrissage uPortal (souvent `/f/services/normal/render.uP`). Sert de point d'entrée de connexion, de `Referer` par défaut et de preuve d'authentification.
- `branding` — `appName`, `defaultTitle`, `seoTitle`, `seoDescription`, `logo` (+ `logoAlt`, `loginFooterLine`, `about.*`). Utilisé par la page de connexion, la sidebar, le SEO, le manifest PWA et `index.html` (placeholders `%LENT_*%`).
  - `lockup` / `lockupDark` (optionnels, `client.js` uniquement) — visuel combiné « l'ent × université » affiché dans la sidebar et le header (comme Rennes). Sans eux, le logo l'ent et votre `logo` sont composés côte à côte automatiquement.
- `features` — l'interrupteur général (voir ci-dessous).

### Features (dégradation gracieuse)

```js
export const features = {
  ade: false,        // API mobile ADE Campus (widget "prochain cours", arbres, emplois du temps)
  planning: false,   // Planning GWT (adesoft) — lien "Planning" + résolution du prochain cours
  moodle: false,     // relais de connexion Moodle via Shibboleth WAYF
  grades: false,     // notes ScoDoc — true | false | 'disabled' (pastille visible, données démo)
  weather: { enabled: true, defaultCity: 'Paris' },
  demo: true,        // compte de démonstration (demo@l-ent.app)
}
```

Un feature à `false` : le serveur répond `{ disabled: true }` sur les endpoints concernés et le frontend masque les widgets/liens. Mettez aussi l'origin correspondant à `null` dans `server.js`.

### Optionnels

- `links` — `forgotPassword`, `activateAccount`, `manageAccount`. Absent → lien masqué.
- `establishments` — détection de la composante (IUT, UFR…) depuis l'arbre ADE et gating par composante :
  ```js
  establishments: {
    detectFromAdeTree: [{ includes: ['iut lannion'], id: 'iutlan' }],
    fallbackId: 'other',
    byId: {
      iutlan: {
        label: 'IUT de Lannion',
        gradeWidgets: true,       // widgets de notes
        nextClassWidget: true,    // widget prochain cours
        extraServices: [{ id: '…', title: '…', href: '…', target: '_blank' }],
      },
    },
  }
  ```
  Omettez le bloc entier si votre université n'a qu'un seul « établissement ».
- `services.getAppIcon(title)` — retourne l'icône d'une application ENT à partir de son titre (voir `universities/univ-rennes/app-icons/`). Retournez `null` pour l'icône générique.
- `services.categories` — mots-clés → catégories de la grille d'applications.
- `services.isUnavailableApplication(app)` — masque complètement certaines applications.
- `grades.serviceUrl` (client) — URL publique du service de notes (ScoDoc), ouverte via `/__ent_auth/launch` depuis les widgets et le lien « Mes notes » quand `features.grades === true`.
- `grades` (copy) — `unavailableTitle`, `unavailableDetail`, `disabledPillLabel` quand `features.grades === 'disabled'` ; `unavailableTitle`/`unavailableDetail` servent aussi de message d'erreur serveur quand ScoDoc ne répond pas.

### Serveur uniquement (`server.js`)

- `origins.ade` / `origins.moodle` / `origins.planning` — `null` si absent.
- `moodle.shibbolethLoginPath` + `moodle.wayfEntityId` — l'entityID Shibboleth de votre université sur la page WAYF de la fédération (visible dans l'URL `user_idp=` lors d'une connexion Moodle manuelle).
- `ade.etab`, `ade.passwordKey`, `ade.passwordIv`, `ade.appHeaders` — identité de l'app mobile « Campus » de votre université. **Ces valeurs se rétro-ingénient par campus** (interception du trafic de l'app mobile officielle) ; voir `API_GUIDE.md` et `src/knownEndpoints.js` pour la méthodologie utilisée à Rennes.
- `planning.gwtClientId` — identifiant client GWT du Planning adesoft (visible dans les requêtes RPC de `myplanning.jsp`).
- `grades.origin` — origine du ScoDoc (ex. `https://notes9.iutlan.univ-rennes1.fr`). Le serveur y rejoue la session CAS (`/services/doAuth.php`) puis lit `data.php?q=dataPremièreConnexion` et la photo étudiante. Requis quand `features.grades === true`.

## Checklist de validation

1. `npm run lint && UNIVERSITY=<id> npm run build` — le build doit passer.
2. `UNIVERSITY=<id> npm run dev` — page de connexion : logo, textes, liens d'aide corrects.
3. Connexion démo (`demo@l-ent.app` / `lent-demo`) si `features.demo` — dashboard, grille d'applications.
4. **Connexion réelle** avec un compte étudiant — c'est le seul test qui exerce CAS, le proxy ENT et les services activés.
5. `grep -ri '<votre-univ>' src/ server/` ne doit rien retourner : tout doit vivre dans `universities/<id>/`.

## Ce qui n'est pas couvert

Le backend suppose un ENT **uPortal** derrière un **CAS Apereo**. Si votre université utilise un autre portail (ex : Esup-Pod seul, ENT non-uPortal) ou un autre SSO (OIDC, SAML direct), il faudra adapter `server/entAuthApp.js` (fonction `performEntLogin` et endpoints `/__ent_auth/*`). Les contributions généralisant ces points sont bienvenues.
