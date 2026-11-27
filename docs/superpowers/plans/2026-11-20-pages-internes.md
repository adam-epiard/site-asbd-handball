# Pages internes vivantes : plan de réalisation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Donner aux pages internes un en-tête commun aux couleurs du club et mettre en scène le contenu d'Histoire, Licences, Entraînements, Contact, Nous trouver et des pages équipes.

**Architecture:** Un composant `EnteteRubrique` (fond noir, motif terrain, photo facultative lue dans `src/content/entetes.json`) remplace les `h1` des pages internes. Les traitements propres à une page restent dans la page (CSS scopé), ou dans `[page].astro` via une classe par page pour le Markdown. La logique pure (tri des horaires, rubrique du menu, normalisation d'adresse) va dans `src/lib/pages-outils.ts`, testée avec `node --test`.

**Tech Stack:** Astro 7 statique, collections de contenu (`file()`, `glob()`), CSS scopé, `node --test` (Node lit le TypeScript directement).

**Spec:** `docs/superpowers/specs/2026-11-20-pages-internes-design.md`

## Global Constraints

- Aucune nouvelle dépendance.
- Uniquement les variables de `src/styles/tokens.css`. Aucune couleur en dur, sauf `rgb(0 0 0 / x)` pour le voile photo (déjà utilisé dans `Bandeau.astro`).
- Un champ vide n'affiche rien (pas de texte d'attente, pas de bloc vide).
- Un seul `h1` par page ; motif `aria-hidden` ; aucune animation nouvelle ; contrastes AA (sur fond noir : texte et liens blancs, jamais `--rouge-fonce`).
- Mobile : gouttière 16 px (`--gouttiere`), aucun défilement horizontal à 375 px.
- Pas de dégradé décoratif, d'effet de verre, d'ombre flottante, d'emoji ni d'icône générique.
- Le texte des fichiers Markdown ne change pas (seuls balisage, frontmatter et titres de décennie sont ajoutés).
- Commentaires et noms en français, comme le reste du code.
- `npm run verify` passe à la fin de chaque tâche.

## Review Focus

1. Une page sans intro, sans lien ni photo : l'en-tête reste propre (pas de marge vide, pas de `<p>` vide).
2. Adresse avec ou sans barre finale (`/histoire` vs `/histoire/`) : la photo d'en-tête est trouvée dans les deux cas. Test dans la tâche 1.
3. Horaire mal saisi dans un JSON d'équipe (« 18h30-20h », « 9h ») : le tri ne plante pas et le créneau reste affiché. Test dans la tâche 1.
4. Équipe sans aucun match (synchro FFHB vide) : la page équipe n'affiche ni bloc vide en haut ni titre « Matchs » orphelin. Vérifié dans la tâche 7.
5. Téléphone 375 px : frise Histoire, parcours Licences et semaine Entraînements sans débordement horizontal. Vérifié dans chaque tâche visuelle.

---

### Task 1: Outils purs et leurs tests

**Files:**
- Create: `src/lib/pages-outils.ts`
- Test: `tests/pages.test.mjs`

**Interfaces:**
- Produces:
  - `minutesDebut(horaire: string): number`, les minutes depuis minuit de l'heure de début. `Number.POSITIVE_INFINITY` si illisible (le créneau passe en fin de liste).
  - `normaliserChemin(chemin: string): string`, avec une barre au début et à la fin.
  - `rubriqueDe(chemin: string, menu: LienMenu[]): string | undefined`, le `label` du groupe de menu qui contient un enfant de ce `href`, sinon `undefined`. Importe `menu`/`LienMenu` depuis `../config/navigation.ts` (pas d'import `astro:*`, pour rester testable avec Node).

- [ ] **Step 1: Écrire les tests**

```js
import { minutesDebut, normaliserChemin, rubriqueDe } from '../src/lib/pages-outils.ts';
import { menu } from '../src/config/navigation.ts';

test('minutesDebut lit les formats du club', () => {
  assert.equal(minutesDebut('18h - 19h30'), 1080);
  assert.equal(minutesDebut('13h45 - 15h'), 825);
  assert.equal(minutesDebut('9h'), 540);
  assert.equal(minutesDebut('18h30-20h'), 1110);
  assert.equal(minutesDebut('horaire à venir'), Number.POSITIVE_INFINITY);
});

test('normaliserChemin ajoute les barres', () => {
  assert.equal(normaliserChemin('histoire'), '/histoire/');
  assert.equal(normaliserChemin('/histoire'), '/histoire/');
  assert.equal(normaliserChemin('/histoire/'), '/histoire/');
  assert.equal(normaliserChemin('/'), '/');
});

test('rubriqueDe trouve le groupe du menu', () => {
  assert.equal(rubriqueDe('/histoire/', menu), 'Le club');
  assert.equal(rubriqueDe('/equipe-feminine', menu), 'Nos équipes');
  assert.equal(rubriqueDe('/contact/', menu), undefined);
});
```

- [ ] **Step 2: Lancer les tests et constater l'échec.** Run: `node --test tests/pages.test.mjs`. Expected: FAIL (module introuvable).
- [ ] **Step 3: Implémenter les trois fonctions dans `src/lib/pages-outils.ts`.** `minutesDebut` lit le premier motif `(\d{1,2})h(\d{2})?`. `rubriqueDe` compare des chemins normalisés.
- [ ] **Step 4: Relancer.** Run: `npm test`. Expected: tous les tests PASS (y compris ffhb et matchs).
- [ ] **Step 5: Commit** `git add src/lib/pages-outils.ts tests/pages.test.mjs && git commit -m "Pages internes : outils de tri des horaires et de rubrique"`

### Task 2: Composant `EnteteRubrique`, collection `entetes` et champ `intro`

**Files:**
- Create: `src/components/ui/EnteteRubrique.astro`, `src/content/entetes.json` (contenu : `[]`), `src/assets/entetes/` (vide, avec un `.gitkeep`)
- Modify: `src/content.config.ts` (collection `entetes` ; champ `intro` sur `pages`), `src/components/ui/TraitsTerrain.astro` (commentaire d'usage), `src/pages/design-system.astro` (exemple), `README.md` (nouvelle section « Photo d'en-tête de page » après « Vidéo du bandeau d'accueil »)

**Interfaces:**
- Consumes: `normaliserChemin`, `rubriqueDe` (tâche 1).
- Produces:
  - Collection `entetes` : `file('src/content/entetes.json')`, schéma `({ image }) => z.object({ photo: image(), alt: z.string().min(1) })`. L'`id` de chaque entrée est l'adresse de la page (ex. `"/histoire/"`).
  - Collection `pages` : `intro: z.string().min(1).optional()`.
  - `EnteteRubrique` props : `{ titre: string; intro?: string; rubrique?: string | false; lien?: { href: string; label: string } }`. `rubrique` absent → `rubriqueDe(Astro.url.pathname, menu)` ; `false` → pas de repère. La photo est cherchée automatiquement dans `entetes` par `normaliserChemin(Astro.url.pathname)`. Rend un `<header class="entete-rubrique">` avec le `h1`. Le contenu de la page suit dans ses propres `<section>`.

- [ ] **Step 1: Ajouter les collections dans `content.config.ts` et créer `entetes.json` avec `[]`.** Run: `npx astro check`. Expected: 0 erreur. Si le loader `file()` refuse un tableau vide, mettre une entrée d'exemple n'est pas acceptable (elle s'afficherait) : à la place, garder `[]` et tolérer l'avertissement, ou rendre la recherche tolérante (`getCollection('entetes').catch(() => [])`).
- [ ] **Step 2: Écrire `EnteteRubrique.astro`.**
  - Fond `--noir`, texte `--blanc`, liseré bas `4px solid var(--rouge)` (comme `.bandeau`).
  - Repère de rubrique : petite ligne en `--taille-sm`, graisse moyenne, gris clair (`#e6e6e6`, valeur déjà utilisée dans `Bandeau.astro`).
  - `h1` blanc, intro `--taille-lg` gris clair, lien blanc souligné.
  - `TraitsTerrain couleur="rouge"` sans `anime`, en position absolue à droite sur ≥ 60rem (largeur ~28rem, calé en bas), réduit (~14rem) et calé en bas à droite sur téléphone, derrière le texte (`z-index`).
  - `padding-block` autour de `--espace-7`/`--espace-8` : nettement plus bas que le bandeau d'accueil.
  - Photo : `<Image>` en `object-fit: cover` sur toute la surface, voile `linear-gradient(90deg, rgb(0 0 0 / 0.72) 0%, rgb(0 0 0 / 0.45) 60%, rgb(0 0 0 / 0.3) 100%)` (le même que `Bandeau.astro`), motif masqué quand il y a une photo.
- [ ] **Step 3: Ajouter une section « En-tête de page » dans `design-system.astro`, avec et sans intro.** Run: `npm run dev`, ouvrir `/design-system/` à 1280 px et à 375 px. Expected: titre lisible, motif sans chevauchement illisible, aucun défilement horizontal.
- [ ] **Step 4: Mettre à jour le commentaire de `TraitsTerrain`** (« bandeau d'accueil, en-tête des pages internes, cartes sans photo, page 404 ») **et écrire la section du README.** Le README explique comment ajouter une photo : mettre l'image dans `src/assets/entetes/`, ajouter `{ "id": "/histoire/", "photo": "../assets/entetes/histoire.jpg", "alt": "…" }` dans `src/content/entetes.json`. Vérifier le chemin relatif réel en testant avec une image temporaire, puis la retirer.
- [ ] **Step 5: Vérifier.** Run: `npm run verify`. Expected: PASS.
- [ ] **Step 6: Commit** `"Pages internes : en-tête commun aux couleurs du club"`

### Task 3: Brancher l'en-tête sur toutes les pages internes

**Files (Modify):** `src/pages/[page].astro`, `membres.astro`, `nos-partenaires.astro`, `devenir-partenaire.astro`, `galerie.astro`, `boutique.astro`, `entrainement.astro`, `ou-nous-trouver.astro`, `contact.astro`, `matchs.astro`, `404.astro`, `message-envoye.astro`, `message-non-envoye.astro`, `src/components/PageRubrique.astro`. Les pages équipes sont traitées dans la tâche 7.

**Interfaces:**
- Consumes: `EnteteRubrique` (tâche 2), champ `intro` de `pages`.

- [ ] **Step 1: Dans chaque page, remplacer le `TitreSection niveau="h1"` ou le `<h1>` brut par `<EnteteRubrique>`** avec les mêmes titre, intro et lien. Retirer le padding haut devenu double. Pour 404 et les deux pages de message : `rubrique={false}`. `[page].astro` passe `intro={page.data.intro}`.
- [ ] **Step 2: Ajouter `intro` au frontmatter de `histoire.md` et `licences.md`.** Y déplacer le premier paragraphe actuel, mot pour mot, et le retirer du corps.
- [ ] **Step 3: Contrôler qu'il ne reste aucun `h1` en double.** Run: `npm run build`, puis `grep -c "<h1" dist/*/index.html dist/index.html`. Expected: `1` pour chaque page.
- [ ] **Step 4: Vérifier visuellement** Histoire, Licences, Contact, Matchs, Membres, 404 à 1280 et 375 px. Expected: en-tête noir partout, rien de cassé en dessous.
- [ ] **Step 5: Vérifier** (`npm run verify`) **et commit** `"Pages internes : en-tête commun sur toutes les pages"`

### Task 4: Histoire en frise

**Files:**
- Modify: `src/content/pages/histoire.md`, `src/pages/[page].astro` (classe `contenu--histoire` quand `page.id === 'histoire'`, plus son CSS)

- [ ] **Step 1: Ajouter les titres de décennie dans `histoire.md`.** Des `##` avant la première année de chaque décennie : « Les années 70 », « Les années 80 », « Les années 90 », « Les années 2000 », « Les années 2010 », « Les années 2020 ».
- [ ] **Step 2: Baliser les temps forts 1977, 1980, 1992, 2005, 2007.** Chaque bloc année + paragraphes est entouré de `<div class="temps-fort">` et `</div>`, **avec une ligne vide après l'ouverture et avant la fermeture** (sinon le Markdown intérieur n'est pas rendu). Ajouter en tête du fichier un commentaire HTML `<!-- … -->` qui explique ce balisage aux bénévoles et la limite de 5 temps forts.
- [ ] **Step 3: Écrire le CSS de `.contenu--histoire`.**
  - À partir de 48rem : colonne de texte avec une gouttière gauche d'environ 9rem et un trait vertical fin (`--ligne`) dans cette gouttière.
  - Chaque `h3` (année) est placé dans la gouttière, aligné sur son premier paragraphe : police titre, ~3rem, `--rouge-fonce`, chiffres tabulaires. Le style actuel des `h3` (bordure haute) est retiré pour cette page.
  - `h2` de décennie : pleine largeur, sobres.
  - `.temps-fort` : fond `--gris-salle`, liseré gauche `4px solid var(--rouge)`, padding, `--rayon`.
  - Sous 48rem : année au-dessus du texte, sans gouttière.
- [ ] **Step 4: Vérifier visuellement** à 1280 et 375 px. Expected: années alignées, 1993 (deux paragraphes) bien rendu, 5 temps forts visibles, pas de débordement.
- [ ] **Step 5: Vérifier** (`npm run verify`) **et commit** `"Histoire : présentation en frise"`

### Task 5: Licences en parcours

**Files:**
- Modify: `src/content/pages/licences.md`, `src/pages/[page].astro` (classe `contenu--licences` quand `page.id === 'licences'`, plus son CSS)

- [ ] **Step 1: Dans `licences.md`, mettre en gras le chiffre de chaque réduction.** `- **50 %** sur la licence pour les coachs` et `- **50 %** pour les bénévoles…`. Le texte ne change pas.
- [ ] **Step 2: Écrire le CSS de `.contenu--licences`.**
  - **Réductions** (`> ul`) : grille de tuiles (2 colonnes dès 30rem), fond `--gris-salle`, `--rayon`, `strong` en `display:block`, police titre ~`--taille-h2`, `--rouge`.
  - **Étapes** (`> ol`) : `list-style: none` plus compteur CSS. Chaque `li` a un numéro dans un rond (~2.75rem, fond `--rouge`, texte blanc, police titre) à gauche, et un trait vertical `--ligne` qui relie les ronds (aucun trait après le dernier).
  - `li:first-child` en carte : bordure `--trait`, liseré gauche rouge, padding.
  - `li:last-child` : rond noir avec une coche dessinée en CSS (bordures), pas d'emoji.
  - La sous-liste du point 4 garde des puces simples.
- [ ] **Step 3: Vérifier visuellement** à 1280 et 375 px. Expected: 8 numéros visibles, trait continu, étape 1 en carte, tuiles « 50 % » lisibles, Mentions légales inchangée.
- [ ] **Step 4: Vérifier** (`npm run verify`) **et commit** `"Licences : étapes en parcours et réductions en tuiles"`

### Task 6: Entraînements, Contact, Nous trouver

**Files:**
- Modify: `src/pages/entrainement.astro`, `src/pages/contact.astro`, `src/pages/ou-nous-trouver.astro`

**Interfaces:**
- Consumes: `minutesDebut` (tâche 1).

- [ ] **Step 1: Entraînements, tri des créneaux.** Trier chaque liste de `parJour` par `minutesDebut(horaire)`. Expected au build : mercredi affiche 13h45, 15h, 16h30, 18h, 20h.
- [ ] **Step 2: Entraînements, semaine en colonnes.**
  - La grille `.semaine` passe à une colonne par jour présent (`repeat(N, 1fr)` dès 48rem, empilée en dessous).
  - Chaque créneau devient un bloc : horaire en police titre ~1.5rem, nom de l'équipe en lien, catégorie écrite en `--taille-sm` (via `libelleCategorie`).
  - Liseré gauche 4px par catégorie : `--rouge` (féminine), `--noir` (masculine), `--ligne` (mixte).
  - Ajouter une légende au-dessus de la grille.
  - Le tableau par équipe reste en dessous, sans changement.
- [ ] **Step 3: Contact.** Les cartes `.contact` reçoivent `border-left: 4px solid var(--rouge)` et le même rayon que `.membre` dans `membres.astro`. Les titres `h2` des cartes passent en police titre. Le formulaire ne change pas.
- [ ] **Step 4: Nous trouver.** Grille 2 colonnes dès 60rem : à gauche un bloc d'infos (adresse en police titre ~`--taille-h3`, lien « Ouvrir dans Google Maps » avec la même URL que le `secours` existant, lien vers les horaires), à droite la carte. Empilés sur téléphone, infos d'abord. Uniquement des données de `site`.
- [ ] **Step 5: Vérifier visuellement** les trois pages à 1280 et 375 px, **puis** `npm run verify`. Expected: PASS.
- [ ] **Step 6: Commit** `"Entraînements, Contact, Nous trouver : mise en scène du contenu"`

### Task 7: Pages équipes

**Files:**
- Modify: `src/pages/[...equipe].astro`, `src/components/matchs/MatchsEquipe.astro`

**Interfaces:**
- `MatchsEquipe` gagne une prop `titre?: string | false` (défaut `'Matchs'` ; `false` = pas de `h2`, la section prend `aria-label`) et une prop `id?: string` pour `titreId`.
- Le prochain match est **toujours calculé** pour l'exclusion du calendrier (`exclure`), mais n'est affiché que si `'prochain'` est dans `blocs`.

- [ ] **Step 1: Modifier `MatchsEquipe`** comme décrit ci-dessus. Les onglets ne s'affichent que si `calendrier`, `classement` ou `coupes` est demandé ; `SourceFfhb` seulement dans ce cas aussi. Expected : `aDesDonnees` reste faux s'il n'y a rien à montrer pour les blocs demandés.
- [ ] **Step 2: Dans `[...equipe].astro`, placer le duo sous l'en-tête et le reste en bas.** Juste sous l'en-tête : `<MatchsEquipe equipe={equipe} blocs={['prochain','dernier']} titre={false} id="a-suivre" />`. En bas : `<MatchsEquipe equipe={equipe} blocs={['calendrier','classement','coupes']} />`.
- [ ] **Step 3: Passer l'en-tête d'équipe au fond noir** (`.entete-equipe`) : texte et lien retour blancs, `Etiquette variante="rouge"`, info en gris clair, motif rouge inchangé. La photo reste à droite.
- [ ] **Step 4: Présenter Entraînements et Coachs en cartes** : fond `--gris-salle`, `--rayon`, padding `--espace-5`.
- [ ] **Step 5: Vérifier** Seniors F (photo + matchs), U12 M (sans photo) et Baby hand (probablement sans matchs) à 1280 et 375 px. Expected: le prochain match n'est pas répété dans le calendrier ; aucun bloc vide ni « Matchs » orphelin pour une équipe sans données ; ids uniques (pas de doublon de `matchs-<id>`).
- [ ] **Step 6: Vérifier** (`npm run verify`) **et commit** `"Pages équipes : en-tête noir et prochain match en haut"`

### Task 8: Contrôle final

- [ ] **Step 1: Vérifier.** Run: `npm run verify`. Expected: PASS.
- [ ] **Step 2: Captures pleine page** à 1280 et 375 px de : Histoire, Licences, Entraînements, Contact, Nous trouver, Seniors F, U12 M, Membres, 404. Expected: aucun défilement horizontal (`document.documentElement.scrollWidth <= innerWidth`), un seul `h1`, rien d'interdit par les contraintes globales.
- [ ] **Step 3: Montrer les captures à l'utilisateur.**
