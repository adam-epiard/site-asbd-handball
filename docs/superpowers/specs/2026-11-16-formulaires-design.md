# Formulaires Contact et Devenir partenaire — design

Validé avec Adam le 13/11/2026 (« ok go » le 16/11).

## Intention

Remplacer Contact Form 7 du WordPress par deux formulaires légers, sans plugin ni service tiers,
qui envoient les messages au club. Étape 5 du plan de développement (dossier de cadrage).

## Objectifs

- **Contact** (`/contact/`) : nom, e-mail, objet, message.
- **Devenir partenaire** (`/devenir-partenaire/`) : nom, société, e-mail, téléphone (facultatif), message (facultatif).
- Les messages arrivent sur `communication@labruffierehandball.com`, avec l'adresse du visiteur en `Reply-To`.
- Le visiteur voit un succès clair, ou une erreur claire **sans perdre sa saisie**, avec l'adresse du club en secours.
- Fonctionne sans JavaScript (envoi classique + redirection) ; avec JavaScript, envoi sans rechargement.

## Non-objectifs

- Pas de stockage des messages sur le serveur (ni base, ni fichier).
- Pas de captcha au départ.
- Pas d'accusé de réception envoyé au visiteur (évite que le script serve à envoyer des e-mails à n'importe qui).

## Anti-objectifs

- Aucun secret dans le dépôt (dépôt public).
- Pas d'en-tête d'e-mail injectable (retours à la ligne dans les champs refusés).

## Contraintes

- Hébergement OVH mutualisé (PHP 8.3, fonction `mail()`), site statique Astro.
- PHP ne tourne pas dans `npm run dev` : envoi réel testable seulement sur astro-test.
- Composants du design system à réutiliser : `Champ`, `Bouton`, `Alerte`.

## Approches envisagées

| Approche | Retenue | Pourquoi |
|---|---|---|
| Script PHP sur OVH + `mail()` | **Oui** | Prévu au dossier, aucun service tiers, aucun secret |
| PHP + SMTP authentifié | Non | Mot de passe à stocker sur le serveur, plus complexe |
| Service tiers (Formspree, Web3Forms...) | Non | Dépendance externe, limites gratuites, données chez un tiers |

## Décisions

- Un seul script `public/api/formulaire.php`, qui sert les deux formulaires (champ caché `formulaire` = `contact` | `partenaire`).
- Adresse d'expédition du domaine (`site@labruffierehandball.com`), destinataire en constante dans le script.
- Anti-spam : champ piège invisible + délai minimum de 3 s entre l'affichage et l'envoi (horodatage dans un champ caché).
- Réponse : JSON si la requête le demande (`Accept: application/json`), sinon redirection 303 vers la page avec `?envoi=ok` ou `?envoi=erreur`.
- Mention RGPD sous chaque formulaire.

## Laissé au constructeur

- Limites de longueur exactes, textes d'erreur, mise en forme de l'e-mail (texte brut UTF-8).
