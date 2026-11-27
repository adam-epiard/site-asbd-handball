# Site de l'ASBD Vendée Handball

Site statique construit avec [Astro](https://docs.astro.build/fr/) et TypeScript, hébergé sur l'offre mutualisée OVH du club.
Le contenu (équipes, pages) vit dans `src/content/`, à part du code.

État : **étape 2 du plan de développement**, mise en place du projet et de la chaîne de déploiement.
L'accueil est une page provisoire qui sert à valider le déploiement sur le sous-domaine de test.

## Prérequis

- Node.js **22.18 ou plus récent** (24 LTS conseillé, voir `.nvmrc`) : `node -v`
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
| `npm run sync`    | Récupère les matchs et classements sur le site de la FFHB    |
| `npm run ffhb:trouver` | Liste les compétitions où joue le club (championnat, coupes, plateaux) |
| `npm test`        | Tests de la lecture FFHB et des matchs                       |
| `npm run verify`  | Tests, `check` puis `build`, comme la GitHub Action          |

## Organisation

```text
src/
  content.config.ts   schémas du contenu : une donnée obligatoire manquante fait échouer le build
  content/
    equipes/          un fichier JSON par équipe (seniors-m.json...)
    pages/            pages en Markdown (mentions-legales.md → /mentions-legales/)
  data/resultats/     matchs et classements FFHB, écrits par npm run sync (ne pas modifier à la main)
  lib/matchs.ts       matchs réunis (FFHB + saisis à la main), prochain match, semaine...
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
  components/matchs/  blocs matchs : carte, liste, classement, matchs de la semaine
public/               copié tel quel : .htaccess (redirections), robots.txt, favicon
scripts/              synchronisation FFHB (ffhb-sync.mjs, ffhb/)
tests/                tests (node --test) et pages FFHB d'exemple
.github/workflows/    déploiement automatique (et synchronisation programmée)
```

Le design system est visible sur la page `/design-system/` (absente du menu). Un composant n'écrit jamais une couleur ou une taille en dur : il utilise les variables de `tokens.css`.

Règle du contenu : **un champ vide n'affiche rien**. On laisse vide plutôt que d'écrire « en cours ».

## Règle de sécurité

Le dépôt est **public** : ne jamais y mettre de mot de passe, de clé ou d'adresse privée. Les secrets (ex. mot de passe d'envoi des formulaires) vivent dans un fichier placé directement sur le serveur, hors de Git.

## Déploiement

Chaque push sur `main` lance la GitHub Action `.github/workflows/deploy.yml` :
tests, récupération des matchs FFHB, vérification, build, puis publication de `dist/` sur la branche `deploy`.
L'Action tourne aussi seule chaque nuit et le week-end (voir [Matchs et classements](#matchs-et-classements)).
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

## Formulaires (contact, devenir partenaire)

Les formulaires envoient vers `public/api/formulaire.php`, un petit script PHP exécuté par l'hébergement OVH, qui envoie l'e-mail au club avec la fonction `mail()` (aucun mot de passe stocké).

- Destinataire, expéditeur et champs : en tête de `public/api/formulaire-lib.php`.
- Anti-spam : champ piège invisible (`site_web`) et refus des envois en moins de 3 secondes.
- PHP ne tourne pas avec `npm run dev` : l'envoi réel se teste sur le site de test.
- Tests du script : `php tests/formulaire.test.php` (PHP 8.3 en ligne de commande).
- Si aucun e-mail n'arrive : vérifier dans OVH, onglet **Plus > Scripts e-mail**, que l'envoi d'e-mails par script est actif.

## Matchs et classements

Les matchs, scores et classements viennent du **site de la FFHB** (ffhandball.fr). Ils sont **enregistrés dans le dépôt** (`src/data/resultats/`) : le site ne dépend d'aucun service extérieur pour s'afficher.

- `npm run sync` lit, pour chaque équipe qui a un champ `ffhb`, les pages de ses compétitions et écrit `src/data/resultats/<équipe>.json`. Pour ménager le site de la FFHB, les poules terminées et les journées anciennes ne sont pas relues (`npm run sync -- --complet` pour tout relire).
- La GitHub Action le fait seule : chaque nuit vers 4 h 40, le vendredi soir, et le samedi et le dimanche toutes les 2 h ; le lundi, elle cherche aussi les nouvelles compétitions du club. Quand des données changent, elle les commite sur `main` (« Résultats FFHB : mise à jour automatique ») et republie le site. Penser à faire `git pull` avant de travailler.
- Le site recalcule « prochain match » et « matchs de la semaine » à chaque build, donc au moins chaque nuit.
- Si la FFHB ne répond pas ou change ses pages, les dernières données sont gardées et l'Action affiche un avertissement (onglet Actions, résumé du passage). Rien ne casse.

### Suivre une équipe

Dans la fiche de l'équipe (`src/content/equipes/…json`), les adresses de **toutes ses compétitions** : championnat, coupes, plateaux.

```json
"ffhb": {
  "competitions": [
    "https://www.ffhandball.fr/competitions/saison-2026-2027-22/departemental/u12m-85-32674/",
    "https://www.ffhandball.fr/competitions/saison-2026-2027-22/departemental/coupe-u12-m85-trophee-jp-bart-33804/"
  ]
}
```

- Mettre l'adresse de la **compétition** (sans `poule-…` à la fin) : toutes les poules où joue le club sont suivies seules, **phase 1, phase 2 et tours de coupe** compris. Une adresse de poule précise marche aussi (cette poule seule).
- **Trouver les adresses** : `npm run ffhb:trouver` parcourt les compétitions du comité de Vendée, de la ligue des Pays de la Loire et de la Coupe de France, et liste celles où joue le club, avec l'équipe du site qui les suit (1 à 2 minutes).
- Chaque lundi, l'Action fait cette recherche et affiche un **avertissement** si le club joue dans une compétition suivie par aucune équipe (par exemple une coupe qui commence) : il suffit d'ajouter son adresse à la bonne fiche.
- Sur la page de l'équipe, deux onglets : **Championnat** (calendrier et classement ; avec plusieurs phases, un onglet par phase, la phase en cours ouverte) et **Coupes** (chaque coupe avec ses tours, ses résultats et le bilan du club). Ailleurs, les matchs de coupe portent l'étiquette « Coupe ».
- Deux équipes du club dans la même poule : ajouter `"libelle": "AS BRUFFIERE 2"` (nom exact à la FFHB).
- Équipe en entente portée par un autre club : ajouter `"structure": "<numéro FFHB du club>"`.
- **Nouvelle saison** : remplacer les adresses (la saison est dans l'adresse : `saison-2027-2028-23`), puis lancer `npm run ffhb:trouver`.
- Le nom du club s'affiche « ASBD » ; les préfixes ajoutés par la FFHB (« U11F85 C. ») sont retirés.

### Ajouter un match à la main

Tournoi, plateau, match amical, ou équipe absente du site de la FFHB : dans la fiche de l'équipe.

```json
"matchs": [
  { "date": "2026-12-12T14:00", "adversaire": "Montaigu", "domicile": true, "competition": "Tournoi de Noël" },
  { "date": "2026-11-28", "adversaire": "Les Herbiers", "domicile": false, "scoreClub": 12, "scoreAdversaire": 9 }
]
```

Heure de Paris. Sans heure, « horaire à venir » s'affiche. Sans score, le match est « à venir » ; il passe dans les résultats une fois les scores ajoutés.

### Blocs disponibles

Dans `src/components/matchs/`, réutilisables sur n'importe quelle page :

| Bloc | Rôle |
| ---- | ---- |
| `MatchsEquipe` | Bloc complet d'une page équipe : prochain match, dernier résultat, puis onglets Championnat (calendrier, classement) et Coupes (une partie par coupe, avec ses tours). `blocs={['prochain', 'classement']}` pour n'en garder qu'une partie |
| `MatchsSemaine` | Matchs du club de la semaine (accueil) |
| `CarteMatch` | Un match en grand : prochain match (fond noir) ou dernier résultat |
| `ListeMatchs` | Liste compacte, groupée par jour ou non, avec ou sans le nom de l'équipe |
| `Classement` | Tableau de classement, ligne du club en avant |
| `SourceFfhb` | Mention « Résultats de la FFHB, mis à jour le… » et lien de secours |
| `CalendrierClassement` | Calendrier (à venir, joués repliés) et classement côte à côte : une phase, ou tout le championnat |
| `ui/Onglets` | Onglets réutilisables (un slot par vue), imbricables (`variante="secondaire"`) ; `…#coupes` ou `…#phase-1` dans l'adresse ouvre l'onglet |

Les données se lisent avec les fonctions de `src/lib/matchs.ts` (`matchsEquipe`, `tousLesMatchs`, `prochainMatch`, `parSemaine`…).

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

## Photo d'en-tête de page

Chaque page interne a un en-tête noir avec le motif du terrain. Pour y mettre une photo à la place :

1. Déposer l'image dans `src/assets/entetes/` (paysage, au moins 1920 px de large).
2. Ajouter une entrée dans `src/content/entetes.json`, l'`id` étant l'adresse de la page :

```json
[
  { "id": "/histoire/", "photo": "../assets/entetes/histoire.jpg", "alt": "Description de la photo" }
]
```

Le texte alternatif (`alt`) est obligatoire. Un voile sombre assure la lisibilité du titre. Sans entrée, l'en-tête garde le motif du terrain.

## Revenir en arrière

- Sur le nouveau site : `git revert <commit>` puis push ; l'Action republie la version précédente.
- Vers l'ancien WordPress (tant qu'il existe) : refaire pointer le domaine vers l'ancien dossier dans le Multisite.

## Tâches courantes

À compléter à l'étape 7 : changer un effectif, ajouter un partenaire, ajouter une page.
