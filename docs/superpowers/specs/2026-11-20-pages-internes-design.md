# Donner de la vie aux pages internes : conception

Date : 2026-11-20
Statut : à valider

## Intention

L'accueil du site est vivant : vidéo, motif terrain, bande rouge, photos d'équipes,
alternance blanc / gris. Les pages internes, elles, se résument à un grand titre noir
sur fond blanc suivi de texte ou d'un tableau. On a l'impression de quitter le site
du club dès qu'on clique dans le menu.

Le but : que chaque page interne ait l'air de faire partie du même club, **sans faire
« site généré par IA »**, et que ça tienne **sans photos** (les photos des joueurs et
d'autres arriveront plus tard, sans date).

## Objectifs

- Toutes les pages internes ouvrent sur un en-tête commun aux couleurs du club.
- Les pages les plus vides (Histoire, Entraînements, Contact, Nous trouver) et les
  pages équipes mettent leur propre contenu en scène.
- Une photo ajoutée plus tard s'intègre en renseignant un champ, sans retoucher la mise en page.

## Non-objectifs

- Pas de refonte de l'accueil (il fonctionne).
- Pas de nouveau contenu rédactionnel (on met en scène l'existant).
- Pas de galerie photo ni de gestion d'images au-delà du champ photo de l'en-tête.

## Anti-objectifs (ce qui ferait échouer le projet même si « ça marche »)

- Dégradés décoratifs, effets de verre, ombres flottantes, icônes génériques ou emojis,
  illustrations « stock » : c'est ce qui donne l'air IA.
- Le motif terrain mis partout jusqu'à ne plus rien signifier.
- Une page plus difficile à lire ou à modifier qu'avant (le contenu reste dans
  les fichiers Markdown / JSON actuels).

## Contraintes

- Astro statique, aucune nouvelle dépendance.
- Uniquement les tokens de `src/styles/tokens.css` (rouge, rouge foncé, noir, gris salle,
  ligne…). Pas de nouvelle couleur.
- Règle du site : un champ vide n'affiche rien.
- Accessibilité : contrastes AA, un seul `h1` par page, motif en `aria-hidden`,
  pas d'animation si `prefers-reduced-motion`.
- Mobile d'abord : marges latérales de 16 px, pas de défilement horizontal de la page.
- `npm run verify` doit passer.
- Tout nouveau composant est montré sur `/design-system/`.

## Approches envisagées

1. **En-tête commun seul.** Rapide et cohérent, mais le corps des pages ne change pas :
   Histoire reste un long mur de texte.
2. **En-tête commun + traitement page par page selon le contenu.** Plus de travail, mais
   c'est le contenu mis en scène qui donne de la vie, pas la décoration. **Choisie.**
3. **Habillage décoratif global** (motif en fond de sections, bandes, textures). Écartée :
   décoration sans raison = look générique, et le motif perdrait son sens.

## Conception

Le travail se fait en deux temps : l'en-tête d'abord (visible partout), puis les pages une par une.

### 1. En-tête de page interne (`EnteteRubrique`, nouveau composant `src/components/ui/`)

```
┌────────────────────────────────────────────────┐  fond noir
│ LE CLUB                              ╭┄┄┄┄┄╮   │  repère : rubrique du menu
│ Histoire du club                    ┆ ╭─╮ ┆   │  h1 blanc, police titre
│ De 12 copains à plus de 130         ┆ │ │ ┆   │  intro gris clair
│ licenciés.                          ╰─┴─┴─╯   │  lignes de terrain rouges
└━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┘  liseré rouge 4 px
```

- **Fond noir** *(mon choix)*. Le noir vient du logo et fait le lien avec le pied de page.
  Sur l'accueil, le rouge reste réservé à la grande bande d'appel à l'action, donc
  l'en-tête ne lui fait pas concurrence.
- **Contenu** : repère de rubrique facultatif (ex. « Le club », « Nos équipes », dérivé du
  groupe du menu dans `src/config/navigation.ts`, ou passé en prop), `h1`, intro facultative,
  lien d'action facultatif (comme le `lien` actuel de `TitreSection`).
- **Motif** : `TraitsTerrain couleur="rouge"`, sans animation (l'animation reste propre à
  l'accueil), à droite sur grand écran, plus petit et calé en bas sur téléphone.
- **Photo facultative** (`photo?: { src, alt }`) : si elle est fournie, elle passe en fond
  avec un voile sombre, comme la vidéo de l'accueil, et le texte reste blanc. Sans photo,
  on garde le noir et le motif. Rien d'autre à changer le jour où une photo arrive.
- **Où se renseigne la photo** *(mon choix)* : un fichier unique `src/content/entetes.json`,
  chargé comme `partenaires.json` (collection `file()` avec `image()` et `alt` obligatoire),
  une entrée par adresse de page (ex. `{ "id": "/histoire/", "photo": "../assets/entetes/histoire.jpg", "alt": "…" }`).
  Les images vont dans `src/assets/entetes/` et sont optimisées au build, comme les photos d'équipes.
  `EnteteRubrique` cherche l'entrée correspondant à `Astro.url.pathname`. Un bénévole n'édite
  donc jamais de `.astro`. Le README explique comment ajouter une photo d'en-tête.
- Hauteur modérée, plus basse que le bandeau d'accueil : l'en-tête ne doit pas
  repousser le contenu loin sous la ligne de flottaison sur téléphone.

**Pages concernées** : toutes celles qui utilisent aujourd'hui `TitreSection niveau="h1"` ou un
`<h1>` brut : `[page].astro` (Histoire, Licences, Mentions légales), Membres, Nos partenaires,
Devenir partenaire, Galerie, Boutique, Entraînements, Nous trouver, Contact, Matchs, les
rubriques Équipes féminines / masculines (`PageRubrique`), 404, message envoyé / non envoyé.

Le commentaire de `TraitsTerrain` (« à utiliser avec parcimonie ») est mis à jour : le
motif apparaît désormais dans l'en-tête des pages internes, et c'est sa seule apparition
sur ces pages.

### 2. Histoire : une frise

- Mise en page en deux colonnes sur grand écran : l'année à gauche en très gros chiffres,
  style tableau de score (police titre, `--rouge-fonce`, chiffres tabulaires), le texte à droite.
  Une ligne verticale fine relie les années. Sur téléphone, l'année passe au-dessus du texte.
- Regroupement par décennie : le fichier Markdown reçoit des titres `##` (« Les années 70 »,
  « Les années 80 »…) avant les années.
- Quelques **temps forts** mis en avant avec un traitement plus marqué (fond gris salle,
  liseré rouge) : 1977 (création par 12 copains), 1980 (première soirée « Cassoulet »),
  1992 (création de l'école de handball), 2005 (victoire en finale du Challenge de Vendée),
  2007 (premier Tournoi sur gazon). Cinq au maximum, pour que l'emphase garde son sens.
  Ils doivent rester balisables en Markdown simple par un bénévole. Le balisage exact est
  laissé au développeur, qui le documente dans le fichier.
- **Intro de l'en-tête** *(mon choix)* : le schéma `pages` reçoit un champ facultatif `intro`
  dans le frontmatter, affiché dans `EnteteRubrique` par `[page].astro` (donc disponible aussi
  pour Licences et Mentions légales, qui l'utilisent ou non). Pour Histoire, le premier
  paragraphe actuel passe dans ce champ. Pas d'extraction automatique depuis le Markdown.
  Histoire garde la route partagée `[page].astro` ; le style frise s'applique via une classe
  posée quand `page.id === 'histoire'`.

### 3. Entraînements : une vraie semaine

- La « Semaine type » devient une grille de jours en colonnes (Mercredi, Vendredi,
  Samedi : seuls les jours qui ont des entraînements). Chaque créneau est un bloc avec
  l'horaire en gros et le nom de l'équipe.
- **Créneaux triés par heure de début** (aujourd'hui, mercredi affiche 18h, 15h, 20h, 16h30, 13h45 :
  c'est un défaut à corriger).
- Couleur par catégorie, uniquement avec les tokens : liseré gauche rouge pour les équipes
  féminines, noir pour les masculines, gris (`--ligne`) pour les mixtes, avec une légende.
  La catégorie est aussi écrite en toutes lettres : la couleur ne doit pas être la seule information.
- Le tableau par équipe reste en dessous : c'est la vue « je cherche mon équipe ».

### 4. Contact et Nous trouver

- **Contact** : les cartes de droite reçoivent un liseré rouge (comme les cartes Membres)
  et un titre plus net. Le formulaire ne change pas.
- **Nous trouver** : à côté de la carte (ou au-dessus sur téléphone), un bloc d'infos
  pratiques : adresse en gros, lien « Ouvrir dans Google Maps », lien vers les horaires.
  Uniquement des informations déjà présentes dans `src/config/site.ts`.

### 5. Pages équipes

- L'en-tête d'équipe existant (photo à droite ou motif) garde sa disposition, parce
  qu'une photo d'équipe en fond voilé cacherait les visages, mais passe au même fond noir
  que `EnteteRubrique` pour la cohérence.
- Le duo **Prochain match / Dernier résultat** que `MatchsEquipe` affiche déjà en bas de page
  remonte juste sous l'en-tête *(mon choix)*. Il n'apparaît qu'une fois ; le calendrier et le
  classement restent en bas et continuent d'exclure le prochain match (`exclure`). Le
  découpage de `MatchsEquipe` (deux composants ou une prop de position) est laissé au développeur.
- Entraînements et coachs restent en deux colonnes, présentés en carte.

### 6. Licences : un parcours en étapes

```
┌─────────────┐ ┌─────────────┐   Réductions : deux tuiles,
│    50 %     │ │    50 %     │   chiffre en police score rouge
│ pour les    │ │ bénévoles   │   sur fond gris salle
│ coachs      │ │ du bureau   │
└─────────────┘ └─────────────┘

 ⏱ Comptez une quinzaine de minutes     ← repère sous l'intro

 ①──  Envoyez un e-mail à 6285014@…     ← étape 1 mise en avant (carte, liseré rouge)
 │     nom, prénom, date de naissance…
 ②──  Confirmez votre adresse e-mail
 │
 ③──  …                                  ← numéros en gros (police titre, rouge),
 │                                         reliés par une ligne verticale
 ⑧──  Le club et la Ligue valident ✓
```

- Les étapes (liste numérotée du Markdown) deviennent un parcours vertical : numéro en gros
  dans un rond ou en chiffre de score, ligne qui relie les étapes, texte à droite. La dernière
  étape (validation) se termine sur une marque d'arrivée.
- L'étape 1 (l'e-mail à envoyer) est mise en avant : c'est la seule action que le visiteur
  doit faire lui-même pour démarrer.
- Les réductions deviennent deux tuiles côte à côte, « 50 % » en grand.
- L'intro passe dans l'en-tête (champ `intro`), avec « une quinzaine de minutes » en repère.
- Le contenu reste dans `licences.md`, sans changement de texte. Le style s'applique via une
  classe posée quand `page.id === 'licences'`, comme pour Histoire, pour ne pas toucher
  Mentions légales. Pas de pictogramme ⏱ en emoji : un petit pictogramme SVG simple ou rien.

### 7. Les autres pages

Membres, Partenaires, Galerie, Boutique, Mentions légales, Matchs, 404 et pages
de message : en-tête commun uniquement. Pas de traitement particulier dans ce projet.

## Laissé au développeur

- Le balisage Markdown des temps forts d'Histoire.
- Le découpage CSS exact et les tailles intermédiaires de l'en-tête, dans le cadre
  des tokens existants.
- Le remplacement ou non de `TitreSection niveau="h1"` (le composant reste pour les `h2`).
