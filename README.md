![l'ent](src/assets/login/lentlogo_outline.svg)

Interface alternative pour les portails ENT des universités françaises.  
Regroupe notes, emploi du temps et services dans une seule page.

Université supportée : **Université de Rennes**. Le projet est conçu pour être modulaire et accepter facilement de nouvelles universités et écoles : toute la partie spécifique à une université tient dans un seul dossier de configuration. **[Ajoutez la vôtre →](#-ajoutez-votre-université)**

> Client non officiel, indépendant et non affilié aux universités concernées.  
> La majorité du backend a été développée avec l'aide d'outils d'IA. S'attendre à un code peu optimisé !

---

## Contexte

Les portails ENT (uPortal + CAS, le standard des universités françaises) exposent les données étudiantes (notes, planning, services) à travers plusieurs interfaces séparées et datées. l'ent les agrège dans un dashboard unique, utilisable sur mobile comme sur desktop.

## 🎓 Ajoutez votre université

Si votre université utilise un ENT uPortal derrière un CAS (probablement le cas), l'ajouter ne demande **aucune modification du code**; uniquement un dossier de configuration :

```bash
cp -r universities/example-minimal universities/univ-lavotre
# remplissez universities/univ-lavotre/{shared,client,server}.js
# (nom, logo, URL de l'ENT et du CAS le reste est optionnel)
UNIVERSITY=univ-lavotre npm run dev
```

- Chaque feature (ADE, planning, Moodle, notes…) est **optionnelle** : ce que votre université n'a pas est proprement masqué.
- `universities/univ-rennes/` sert d'implémentation de référence complète, `universities/univ-exemple/` de démo jouable (compte `demo@l-ent.app` / `lent-demo`).
- Une fois testée avec un vrai compte étudiant, **ouvrez une Pull Request** : votre université peut être hébergée sur l'instance officielle, sur son propre sous-domaine (voir plus bas) ou déployez votre fork vous-même.

Guide pas-à-pas : **[docs/ADDING_A_UNIVERSITY.md](docs/ADDING_A_UNIVERSITY.md)**

## Fonctionnalités

- Affichage temporairement désactivé de la moyenne générale, moyenne de promo et dernière note
- Prochain cours et planning via ADE Campus et Planning GWT
- Accès aux 30+ applications universitaires avec recherche et favoris
- Météo locale (Open-Meteo)
- Mode clair / sombre
- PWA installable (iOS, Android)
- Onboarding pour sélectionner année, groupe TD et TP

> Attention : Le projet a uniquement été testé pour le BUT MMI à Lannion et peut ne pas fonctionner correctement pour les autres formations de l'Université de Rennes

## Stack


| Couche   | Technologies                     |
| -------- | -------------------------------- |
| Frontend | React 19, Tailwind CSS 4, Vite 7 |
| Backend  | Node.js, Express 5               |
| PWA      | vite-plugin-pwa, Service Worker  |


## Installation

Prérequis : Node.js 18+, npm.

```bash
git clone https://github.com/tom-things/l-ent.git
cd l-ent
npm install
npm run dev
```

### Production

```bash
npm run build
npm run start
```

Le serveur Express écoute sur le port `3000` (configurable via `PORT`).

### Variables d'environnement


| Variable         | Description                                                        | Requis           |
| ---------------- | ------------------------------------------------------------------ | ---------------- |
| `PORT`           | Port du serveur (défaut : 3000)                                    | Non              |
| `SESSION_SECRET` | Clé de signature des sessions                                      | Oui (production) |
| `UNIVERSITY`     | Université active, ou tenant par défaut (défaut : `univ-rennes`)   | Non              |
| `MULTI_TENANT`   | `1` : sert plusieurs universités, routées par sous-domaine         | Non              |
| `TENANTS`        | Universités servies/buildées en multi-tenant (ids séparés par `,`) | Non              |

## Multi-université par sous-domaine

Une seule instance peut servir plusieurs universités, chacune sur son sous-domaine (`univrennes.lent.example`, `univnantes.lent.example`…) :

```bash
npm run build:all                 # un bundle par université → dist/<id>/
MULTI_TENANT=1 npm start          # routage par hostname
```

Une requête est associée à l'université dont le premier label du hostname égale son id sans tirets (`univ-rennes` → `univrennes.…`), ou dont le hostname figure dans l'export optionnel `hostnames` de son `shared.js`. Les hôtes inconnus (dont le domaine racine) retombent sur `UNIVERSITY`. Les cookies de session étant limités à l'hôte, chaque sous-domaine est isolé.

Sur Render (plan gratuit) : build command `npm install && npm run build:all`, start command `MULTI_TENANT=1 node server.js`, puis ajoutez chaque sous-domaine comme *custom domain* du service (un CNAME + une entrée Render par université ; un certificat TLS classique est émis par hostname, pas besoin de wildcard).

## Sécurité & confidentialité

- l'ent ne maintient pas de base de données applicative dédiée pour stocker les comptes étudiants.
- Les données sont récupérées à la demande depuis les services de l'université configurée : CAS, ENT, ADE et Planning.
- Les identifiants ENT ne sont pas stockés côté navigateur et ne sont pas sérialisés dans le cookie de session.
- Pour conserver la compatibilité avec ADE, les identifiants peuvent être gardés temporairement en mémoire côté serveur pendant la session active, puis supprimés à la déconnexion ou à l'expiration de session.
- Les caches sensibles côté client sont vidés à la déconnexion et lors d'un échec de rafraîchissement de session.
- Le menu debug est réservé au mode développement et n'est pas exposé dans le build de production.
- Le point d'entrée de connexion est protégé par un rate limiting basique contre les tentatives répétées.
- Le projet vise une surface de stockage minimale, mais un déploiement sérieux nécessite tout de même HTTPS et une variable `SESSION_SECRET` forte en production.


## Architecture

```
l-ent/
├── universities/          # ★ Une université = un dossier de config
│   ├── univ-rennes/       #   Référence complète (Rennes)
│   ├── univ-exemple/      #   Université fictive de démonstration
│   └── example-minimal/   #   Squelette minimal à copier
├── server.js              # Lanceur production (mono ou multi-tenant)
├── server/
│   └── entAuthApp.js      # Backend partagé prod/dev : auth CAS, proxy, API
├── adeApi.js              # Client ADE (emploi du temps)
├── planningRpc.js         # Client RPC planning (GWT)
├── adeUpcomingResolver.js # Résolution des prochains cours
├── src/
│   ├── App.jsx            # Composant racine, auth
│   ├── entApi.js          # Client API portail ENT
│   ├── weatherApi.js      # API météo
│   ├── profileStorage.js  # Préférences utilisateur
│   ├── components/
│   │   ├── WidgetContainer.jsx
│   │   ├── WidgetNextClass.jsx
│   │   ├── AvailableApplications.jsx
│   │   ├── OnboardingPage.jsx
│   │   └── ...
│   └── assets/
└── public/
```

La config d'une université est lue côté serveur (`universities/<id>/server.js`) et injectée côté frontend via l'alias Vite `@university` (`universities/<id>/client.js`). Aucun autre fichier ne contient de valeur propre à une université.

## Intégrations

l'ent communique avec les systèmes suivants :

- **CAS SSO** : authentification centralisée
- **Portail ENT** : layout, portlets, marketplace
- **ADE Campus** : emploi du temps (sessions chiffrées)
- **Planning** : planning détaillé via GWT RPC
- **Notes** : fonctionnalité temporairement désactivée
- **Open-Meteo** : météo (API libre)

## Contribution

1. Forkez le projet
2. Créez une branche (`git checkout -b feat/univ-lavotre` ou `feat/ma-fonctionnalite`)
3. Committez (`git commit -m 'feat: ajouter mon université'`)
4. Pushez (`git push origin feat/univ-lavotre`)
5. Ouvrez une Pull Request

## Licence

[GNU Affero General Public License v3.0](LICENSE)

Toute version modifiée déployée publiquement doit rendre son code source disponible.

## Crédits

Fait par [@tom-things](https://github.com/tom-things)