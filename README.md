# Site de l'ASBD Vendée Handball

Site statique construit avec [Astro](https://docs.astro.build/fr/) et TypeScript, hébergé sur l'offre mutualisée OVH du club.
Le contenu (équipes, pages) vit dans `src/content/`, à part du code.

État : **étape 2 du plan de développement**, mise en place du projet et de la chaîne de déploiement.
L'accueil est une page provisoire qui sert à valider le déploiement sur le sous-domaine de test.

## Prérequis

- Node.js **22.12 ou plus récent** (24 LTS conseillé, voir `.nvmrc`) : `node -v`
- Git
- VS Code avec l'extension Astro (proposée à l'ouverture du dossier)

## Commandes

| Commande          | Effet                                                        |
| ----------------- | ------------------------------------------------------------ |
| `npm install`     | Installe les dépendances (première fois, ou après un pull)   |
| `npm run dev`     | Site local sur http://localhost:4321, rechargé à chaque modif |
| `npm run check`   | Vérifie TypeScript et les données du contenu                 |
| `npm run build`   | Construit le site dans `dist/`                               |
| `npm run preview` | Sert le contenu de `dist/` en local                          |
| `npm run verify`  | `check` puis `build`, comme la GitHub Action                 |

## Organisation

```text
src/
  content.config.ts   schémas du contenu : une donnée obligatoire manquante fait échouer le build
  content/
    equipes/          un fichier JSON par équipe (seniors-m.json...)
    pages/            pages en Markdown (mentions-legales.md → /mentions-legales/)
  config/
    site.ts           nom, adresse, réseaux, réglage noindex
    navigation.ts     menu principal
  layouts/            gabarit commun (balises meta, en-tête, pied de page)
  components/         en-tête, pied de page
  pages/              les modèles de pages, sans texte en dur
  styles/global.css   variables de couleurs, polices et espacements
public/               copié tel quel : .htaccess (redirections), robots.txt, favicon
.github/workflows/    déploiement automatique
```

Règle du contenu : **un champ vide n'affiche rien**. On laisse vide plutôt que d'écrire « en cours ».

## Déploiement

Chaque push sur `main` lance la GitHub Action `.github/workflows/deploy.yml` :
vérification, build, puis publication de `dist/` sur la branche `deploy`.
L'hébergement OVH suit la branche `deploy`. Si une étape échoue, rien n'est publié.

### Mise en place (une seule fois)

1. Créer le dépôt GitHub (privé), puis depuis ce dossier :
   ```sh
   git init -b main
   git add .
   git commit -m "Mise en place du projet Astro"
   git remote add origin git@github.com:<compte>/site-asbd-handball.git
   git push -u origin main
   ```
   Le premier push crée la branche `deploy` (onglet Actions de GitHub pour suivre).
2. Dans GitHub, **Settings > Actions > General > Workflow permissions** : cocher *Read and write permissions*.
   Relancer l'Action si elle a échoué faute de droits.
3. Dans OVH, **Web Cloud > Hébergements > (l'hébergement) > onglet Mes sites** : ajouter `test.labruffierehandball.com` vers un nouveau dossier **vide** (ex. `site-astro`), avec SSL coché.
4. Sur la ligne du sous-domaine, bouton **⁝ > Associer Git** : dépôt `git@github.com:<compte>/site-asbd-handball.git`, branche `deploy`. Ajouter la clé SSH affichée par OVH dans GitHub : de préférence dans le dépôt (**Settings > Deploy keys**, lecture seule) ; si OVH renvoie une erreur, dans le profil (**Settings > SSH and GPG keys**), comme l'indique la doc OVH. Valider avec **Appliquez la configuration** : la colonne Git doit passer à « Activé ».
5. Dans GitHub, **Settings > Webhooks** : ajouter l'URL donnée par OVH, type `application/json`, événement *Just the push event*.
6. Dans **Recent Deliveries**, renvoyer l'événement `ping` : un code 200 indique que ça marche.
7. Ouvrir `test.labruffierehandball.com` : la page « Nouveau site en construction » doit afficher la date du dernier build.

Si l'option Git n'apparaît pas dans le menu ⁝ de l'onglet Mes sites, le dépôt automatique est impossible par cette voie : solution de secours, envoyer `dist/` par FTP.

### Le jour de la bascule

Suivre la procédure du dossier de cadrage, et **passer `noindex` à `false`** dans `src/config/site.ts`.

## Revenir en arrière

- Sur le nouveau site : `git revert <commit>` puis push ; l'Action republie la version précédente.
- Vers l'ancien WordPress (tant qu'il existe) : refaire pointer le domaine vers l'ancien dossier dans le Multisite.

## Tâches courantes

À compléter à l'étape 7 : changer un effectif, ajouter un partenaire, ajouter une page.
