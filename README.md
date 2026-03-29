![l'ent](src/assets/login/lentlogo_outline.svg)

Interface alternative pour le portail ENT de l'Université de Rennes.  
Regroupe notes, emploi du temps et services dans une seule page.

> Client non officiel, indépendant et non affilié à l'Université de Rennes.  
> La majorité du backend a été développée avec l'aide d'outils d'IA. S'attendre à un code peu optimisé !

---

## Contexte

Le portail ENT de l'Université de Rennes expose les données étudiantes (notes, planning, services) à travers plusieurs interfaces séparées. l'ent les agrège dans un dashboard unique, utilisable sur mobile comme sur desktop.

## Fonctionnalités

- Affichage de la moyenne générale, moyenne de promo et dernière note (Notes9)
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


| Variable         | Description                     | Requis           |
| ---------------- | ------------------------------- | ---------------- |
| `PORT`           | Port du serveur (défaut : 3000) | Non              |
| `SESSION_SECRET` | Clé de signature des sessions   | Oui (production) |

## Sécurité & confidentialité

- l'ent ne maintient pas de base de données applicative dédiée pour stocker les comptes étudiants.
- Les données sont récupérées à la demande depuis les services de l'Université de Rennes : CAS, ENT, ADE, Planning et Notes9.
- Les identifiants ENT ne sont pas stockés côté navigateur et ne sont pas sérialisés dans le cookie de session.
- Pour conserver la compatibilité avec ADE, les identifiants peuvent être gardés temporairement en mémoire côté serveur pendant la session active, puis supprimés à la déconnexion ou à l'expiration de session.
- Les caches sensibles côté client sont vidés à la déconnexion et lors d'un échec de rafraîchissement de session.
- Le menu debug est réservé au mode développement et n'est pas exposé dans le build de production.
- Le point d'entrée de connexion est protégé par un rate limiting basique contre les tentatives répétées.
- Le projet vise une surface de stockage minimale, mais un déploiement sérieux nécessite tout de même HTTPS et une variable `SESSION_SECRET` forte en production.


## Architecture

```
l-ent/
├── server.js              # Serveur Express, auth CAS, proxy
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
│   │   ├── WidgetAverageGrade.jsx
│   │   ├── WidgetLatestGrade.jsx
│   │   ├── WidgetNextClass.jsx
│   │   ├── AvailableApplications.jsx
│   │   ├── OnboardingPage.jsx
│   │   ├── AccountModal.jsx
│   │   └── ...
│   └── assets/
└── public/
```

## Intégrations

l'ent communique avec les systèmes suivants :

- **CAS SSO** : authentification centralisée
- **Portail ENT** : layout, portlets, marketplace
- **ADE Campus** : emploi du temps (sessions chiffrées)
- **Planning** : planning détaillé via GWT RPC
- **Notes9** : notes et moyennes
- **Open-Meteo** : météo (API libre)

## Contribution

1. Forkez le projet
2. Créez une branche (`git checkout -b feat/ma-fonctionnalite`)
3. Committez (`git commit -m 'feat: ajouter ma fonctionnalité'`)
4. Pushez (`git push origin feat/ma-fonctionnalite`)
5. Ouvrez une Pull Request

## Licence

[GNU Affero General Public License v3.0](LICENSE)

Toute version modifiée déployée publiquement doit rendre son code source disponible.

## Crédits

Fait par [@tom-things](https://github.com/tom-things) avec l'envie de simplifier la vie des étudiants <3
