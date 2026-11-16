# Formulaires Contact et Devenir partenaire — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** deux formulaires qui envoient un e-mail au club via un script PHP sur OVH, sans service tiers ni secret.

**Architecture:** un script `public/api/formulaire.php` (copié tel quel dans `dist/`) valide et envoie avec `mail()`. Les fonctions pures vivent dans `formulaire-lib.php`, testées en CLI. Côté Astro, un composant `Formulaire.astro` enveloppe les `Champ` et améliore l'envoi en JavaScript (fetch + JSON) ; sans JavaScript, le script redirige vers des pages statiques de confirmation.

**Tech Stack:** PHP 8.3 (OVH mutualisé), Astro 7, TypeScript.

**Spec:** `docs/superpowers/specs/2026-11-16-formulaires-design.md`

## Global Constraints

- Destinataire : `communication@labruffierehandball.com` (constante PHP `DESTINATAIRE`).
- Expéditeur : `communication@labruffierehandball.com`, nom « Site de l'ASBD » (adresse du domaine, déjà existante : meilleure délivrabilité OVH). Visiteur en `Reply-To`.
- Aucun secret dans le dépôt (dépôt public).
- Anti-spam : champ piège `site_web` + délai minimum 3 000 ms (`ouvert_le`, horodatage en ms posé par JS ; absent = pas de contrôle de délai).
- Pas de stockage des messages. Pas d'accusé de réception au visiteur.
- Textes : sentence case, verbes d'action, pas de « Erreur : », pas de « s'il vous plaît ».

## Review Focus

- Retour à la ligne dans `nom`, `objet` ou `email` (injection d'en-têtes) → refusé ou neutralisé, jamais dans un en-tête brut. Test : `test_injection_entetes`.
- Accents et emoji dans le sujet → sujet encodé MIME UTF-8 lisible. Test : `test_sujet_utf8`.
- Requête GET ou formulaire inconnu → 405 / 400, aucun e-mail. Test : `test_methode_et_formulaire`.
- Robot qui remplit le piège → réponse « ok » (ne pas l'informer) mais aucun envoi. Test : `test_piege`.
- `mail()` qui échoue (scripts e-mail désactivés chez OVH) → erreur claire avec l'adresse du club, saisie conservée. Test : `test_echec_envoi` + vérification manuelle sur astro-test.

---

### Task 1 : fonctions PHP pures

**Files:** Create `public/api/formulaire-lib.php`, `tests/formulaire.test.php`

**Interfaces — Produces :**
- `const FORMULAIRES` : `['contact' => [champ => [obligatoire, max]], 'partenaire' => [...]]` — contact : `nom` (oui, 100), `email` (oui, 254), `objet` (oui, 150), `message` (oui, 5000) ; partenaire : `nom` (oui, 100), `societe` (oui, 150), `email` (oui, 254), `telephone` (non, 30), `message` (non, 5000).
- `function nettoyer(array $brut, string $formulaire): array` — garde seulement les champs connus, `trim`, chaîne vide si absent.
- `function valider(array $donnees, string $formulaire): array` — renvoie `[champ => message]`, vide si valide.
- `function estSpam(array $brut, int $maintenantMs): bool`
- `function construireEmail(array $donnees, string $formulaire): array` — `['sujet' => string, 'corps' => string, 'entetes' => string]`.

- [ ] Tests : champ obligatoire vide → message ; e-mail invalide ; trop long ; téléphone avec lettres refusé ; `test_injection_entetes` (CRLF dans email → invalide ; CRLF dans nom/objet → remplacé par espace dans sujet et corps) ; `test_sujet_utf8` (sujet commence par `=?UTF-8?`) ; `test_piege` (estSpam si `site_web` non vide) ; délai < 3000 ms → spam, `ouvert_le` absent → non spam ; en-têtes contiennent `Reply-To: <email visiteur>` et `Content-Type: text/plain; charset=UTF-8`.
- [ ] Run `php tests/formulaire.test.php` → échoue (fonctions absentes).
- [ ] Implémenter.
- [ ] Run → `OK` et code de sortie 0.

### Task 2 : point d'entrée HTTP

**Files:** Create `public/api/formulaire.php`, compléter `tests/formulaire.test.php` (tests HTTP via `php -S` + `sendmail_path` vers un fichier).

**Interfaces — Consumes :** Task 1. **Produces :**
- POST `/api/formulaire.php`, champs du formulaire + `formulaire`, `site_web`, `ouvert_le`.
- Si `Accept` contient `application/json` : 200 `{"ok":true}` ; 422 `{"ok":false,"erreurs":{...}}` ; 500 `{"ok":false}` ; 405 / 400 `{"ok":false}`.
- Sinon : 303 vers `/message-envoye/` ou `/message-non-envoye/`.

- [ ] Tests : `test_methode_et_formulaire` ; envoi valide → 200 + un e-mail capturé ; invalide → 422 avec `erreurs.email` ; piège → 200 sans e-mail ; sans JSON → 303 vers `/message-envoye/` ; `test_echec_envoi` (sendmail en échec → 500).
- [ ] Implémenter (`mail($dest, $sujet, $corps, $entetes, '-f' . EXPEDITEUR)`).
- [ ] Run → tout passe.

### Task 3 : composant Formulaire et Champ

**Files:** Create `src/components/Formulaire.astro` ; Modify `src/components/ui/Champ.astro`.

**Interfaces — Produces :** `<Formulaire nom="contact" | "partenaire" bouton="Envoyer le message">` + slot des `Champ`. Champ : ajoute `maxlength?: number`, rend toujours `<p class="champ__erreur" id="champ-{nom}-erreur" data-erreur hidden?>`.

- [ ] Formulaire rend : `<form method="post" action="/api/formulaire.php" novalidate={false}>`, champs cachés `formulaire`, `ouvert_le`, piège `site_web` (masqué, `tabindex=-1`, `autocomplete=off`, libellé « Ne pas remplir »), zone d'annonce `Alerte` vide (`aria-live`), bouton, mention RGPD.
- [ ] Script : pose `ouvert_le = Date.now()` au chargement ; à l'envoi, fetch JSON, bouton « Envoi en cours… » désactivé ; 200 → message de succès + reset ; 422 → erreurs sous les champs + focus sur le premier champ en erreur ; autre → message d'erreur avec lien mailto, saisie conservée.
- [ ] `npm run verify` passe.

### Task 4 : pages

**Files:** Modify `src/pages/contact.astro`, `src/pages/[page].astro` ; Create `src/pages/devenir-partenaire.astro`, `src/pages/message-envoye.astro`, `src/pages/message-non-envoye.astro`.

- [ ] Contact : formulaire (nom, e-mail, objet, message) en tête, coordonnées à côté.
- [ ] Devenir partenaire : texte de `src/content/pages/devenir-partenaire.md` (via `getEntry`) + formulaire partenaire ; `[page].astro` exclut l'id `devenir-partenaire`.
- [ ] Pages de confirmation `noindex`, lien de retour.
- [ ] Vérification visuelle en local (téléphone et ordinateur) ; envoi réel sur astro-test vers 2 messageries (par Adam).
