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
  layouts/            gabarit commun (balises meta, polices, en-tête, pied de page)
  components/         en-tête, pied de page
    ui/               composants du design system (bouton, carte d'équipe, champ...)
  assets/             images traitées au build (logo)
  pages/              les modèles de pages, sans texte en dur
  styles/tokens.css   design system : couleurs, polices, tailles, espacements
  styles/global.css   styles de base des éléments HTML
public/               copié tel quel : .htaccess (redirections), robots.txt, favicon
.github/workflows/    déploiement automatique
```

Le design system est visible sur la page `/design-system/` (absente du menu). Un composant n'écrit jamais une couleur ou une taille en dur : il utilise les variables de `tokens.css`.

Règle du contenu : **un champ vide n'affiche rien**. On laisse vide plutôt que d'écrire « en cours ».

## Règle de sécurité

Le dépôt est **public** : ne jamais y mettre de mot de passe, de clé ou d'adresse privée. Les secrets (ex. mot de passe d'envoi des formulaires) vivent dans un fichier placé directement sur le serveur, hors de Git.

## Déploiement

Chaque push sur `main` lance la GitHub Action `.github/workflows/deploy.yml` :
vérification, build, puis publication de `dist/` sur la branche `deploy`.
L'hébergement OVH suit la branche `deploy`. Si une étape échoue, rien n'est publié.

### Mise en place (une seule fois)

1. Créer le dépôt GitHub (public, voir Règle de sécurité), puis depuis ce dossier :
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
3. Dans OVH, **Web Cloud > Hébergements > (l'hébergement) > onglet Mes sites** : ajouter `astro-test.labruffierehandball.com` vers un nouveau dossier **vide** (ici `astro`), sans module pré-installé.
4. Sur la ligne du site, bouton **⁝ > Associer Git** : dépôt `https://github.com/adam-epiard/site-asbd-handball.git` (dépôt public : pas de clé SSH), branche `deploy`, puis **Appliquer la configuration**. La colonne Git doit passer à « Activé ».
   Avec un dépôt privé (adresse `git@github.com:…` + clé SSH), l'intégration OVH a échoué en novembre 2026 (« Load key … invalid format ») : rester en public, ou déployer par FTP depuis la GitHub Action.
5. Dans GitHub, **Settings > Webhooks** : ajouter l'URL donnée par OVH, type `application/json`, événement *Just the push event*.
6. Dans **Recent Deliveries**, renvoyer l'événement `ping` : un code 200 indique que ça marche.
7. Ouvrir `astro-test.labruffierehandball.com` : la page « Nouveau site en construction » doit afficher la date du dernier build.

Si l'option Git n'apparaît pas dans le menu ⁝ de l'onglet Mes sites, le dépôt automatique est impossible par cette voie : solution de secours, envoyer `dist/` par FTP.

### Le jour de la bascule

Suivre la procédure du dossier de cadrage, et **passer `noindex` à `false`** dans `src/config/site.ts`.

## Vidéo du bandeau d'accueil

La vidéo est **floutée et compressée à l'avance** : environ 2 Mo, et sans calcul pour le téléphone.
Utiliser un flou gaussien (`gblur`) et une qualité élevée (`-crf 22`) : un flou fort compressé trop fort fait apparaître des blocs.
Vidéo d'iPhone en HDR : ajouter une conversion des couleurs (`zscale` + `tonemap`), sinon l'image paraît délavée.
Avec [ffmpeg](https://ffmpeg.org/), depuis le dossier du projet (clip de 10 à 20 s, sans son) :

```sh
# Grand écran (720p) et téléphone (480p), floutés, sans piste audio
ffmpeg -i source.mp4 -t 15 -an -vf "fps=25,scale=1280:-2,gblur=sigma=14:steps=3" -c:v libx264 -preset veryfast -crf 22 -x264-params aq-mode=3 -pix_fmt yuv420p -movflags +faststart public/video/bandeau-720.mp4
ffmpeg -i source.mp4 -t 15 -an -vf "fps=25,scale=854:-2,gblur=sigma=10:steps=3" -c:v libx264 -preset veryfast -crf 24 -x264-params aq-mode=3 -pix_fmt yuv420p -movflags +faststart public/video/bandeau-480.mp4
# Image fixe affichée avant la lecture
ffmpeg -ss 1 -i public/video/bandeau-720.mp4 -frames:v 1 -c:v libwebp -quality 70 public/video/bandeau.webp
```

Puis décommenter `videoAccueil` dans `src/config/site.ts`.
La vidéo ne se lance pas si le visiteur a réduit les animations ou active l'économie de données : l'image fixe s'affiche à la place.

## Revenir en arrière

- Sur le nouveau site : `git revert <commit>` puis push ; l'Action republie la version précédente.
- Vers l'ancien WordPress (tant qu'il existe) : refaire pointer le domaine vers l'ancien dossier dans le Multisite.

## Tâches courantes

À compléter à l'étape 7 : changer un effectif, ajouter un partenaire, ajouter une page.
