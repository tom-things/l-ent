# l'ent marketing booklet

## Audience

- Étudiants qui découvrent ou testent le projet.
- Encadrants, enseignants ou responsables numériques qui veulent comprendre la proposition de valeur.
- Collaborateurs potentiels qui évaluent la solidité du produit et son potentiel d'évolution.

## Objective

Présenter **l'ent** comme une interface alternative, claire et crédible pour regrouper l'expérience ENT de l'Université de Rennes dans un seul produit mobile-first.

## Narrative arc

1. Ouvrir sur la promesse de marque : toute la fac au même endroit.
2. Montrer le problème : une vie étudiante dispersée entre plusieurs interfaces et services.
3. Montrer la réponse : un dashboard unifié, pensé pour l'usage réel.
4. Mettre en avant l'expérience mobile et la PWA.
5. Illustrer la richesse du catalogue de services.
6. Rassurer sur la confidentialité et la manière dont les données transitent.
7. Asseoir la crédibilité technique et open source.
8. Conclure sur l'intérêt du projet et son potentiel.

## Slide list

1. Couverture / promesse de marque
2. Le constat : fragmentation, friction, manque de lisibilité
3. La réponse : notes, planning, services, favoris
4. Mobile-first : PWA, onboarding, accès rapide
5. Catalogue de services : aperçu de l'écosystème universitaire
6. Confidentialité par conception
7. Architecture et stack
8. Conclusion / potentiel du projet

## Source plan

- `README.md` pour le positionnement général, les fonctionnalités et la stack.
- `API_GUIDE.md` pour le fonctionnement de l'authentification et du proxy ENT.
- `src/components/LoginPage.jsx` et `src/components/AboutModal.jsx` pour la promesse produit et le ton.
- `src/seo.js` pour la formulation SEO et la liste courte des bénéfices.
- `src/assets/...` pour les visuels de marque, le hero étudiant, l'icône et les captures PWA.

## Visual system

- Format portrait type livret.
- Palette issue du projet : crème, noir doux, vert lime, aqua pâle, brun très foncé.
- Hiérarchie forte, grands titres, cartes arrondies, nombreux espaces respirants.
- Mélange de visuels produits existants et de composants natifs PowerPoint éditables.

## Asset plan

- `src/assets/login/illustration.png` pour la couverture et les pages éditoriales.
- `src/assets/favicon.png` pour le repère de marque.
- `src/assets/mobile-pwa-invite.png` pour la page mobile.
- Un sous-ensemble d'icônes d'apps universitaires pour la page catalogue.

## Editability plan

- Tout le texte, les encadrés, les schémas et les légendes restent éditables dans PowerPoint.
- Les images existantes du projet servent de support visuel, mais pas de support texte.
