<?php
/**
 * Fonctions des formulaires du site (contact, devenir partenaire).
 * Fonctions pures, sans effet de bord : testées par tests/formulaire.test.php.
 * Ce fichier ne contient aucun secret : le dépôt est public.
 */
declare(strict_types=1);

const DESTINATAIRE = 'communication@labruffierehandball.com';
const EXPEDITEUR = 'communication@labruffierehandball.com';
const NOM_EXPEDITEUR = "Site de l'ASBD";
const DELAI_MINIMUM_MS = 3000;

/** Champs par formulaire : [obligatoire, longueur maximale, libellé]. */
const FORMULAIRES = [
    'contact' => [
        'nom' => [true, 100, 'Nom'],
        'email' => [true, 254, 'E-mail'],
        'objet' => [true, 150, 'Objet'],
        'message' => [true, 5000, 'Message'],
    ],
    'partenaire' => [
        'nom' => [true, 100, 'Nom'],
        'societe' => [true, 150, 'Société'],
        'email' => [true, 254, 'E-mail'],
        'telephone' => [false, 30, 'Téléphone'],
        'message' => [false, 5000, 'Message'],
    ],
];

/** Garde seulement les champs connus du formulaire, sans espaces autour. */
function nettoyer(array $brut, string $formulaire): array
{
    $donnees = [];
    foreach (array_keys(FORMULAIRES[$formulaire]) as $champ) {
        $valeur = $brut[$champ] ?? '';
        $donnees[$champ] = is_string($valeur) ? trim($valeur) : '';
    }
    return $donnees;
}

/** Renvoie les erreurs par champ ; tableau vide si tout est valide. */
function valider(array $donnees, string $formulaire): array
{
    $erreurs = [];
    foreach (FORMULAIRES[$formulaire] as $champ => [$obligatoire, $max, $libelle]) {
        $valeur = $donnees[$champ] ?? '';
        if ($valeur === '') {
            if ($obligatoire) {
                $erreurs[$champ] = "Indiquez votre " . mb_strtolower($libelle) . ".";
            }
            continue;
        }
        if (mb_strlen($valeur) > $max) {
            $erreurs[$champ] = "$libelle trop long : $max caractères au maximum.";
            continue;
        }
        if ($champ === 'email' && (preg_match('/[\r\n]/', $valeur) || !filter_var($valeur, FILTER_VALIDATE_EMAIL))) {
            $erreurs[$champ] = 'Cette adresse e-mail est incomplète. Exemple : prenom.nom@gmail.com';
        }
        if ($champ === 'telephone' && !preg_match('/^[0-9 +().-]{6,30}$/', $valeur)) {
            $erreurs[$champ] = 'Ce numéro contient des caractères inattendus. Exemple : 06 12 34 56 78';
        }
    }
    return $erreurs;
}

/** Un robot remplit le champ piège ou envoie trop vite après l'ouverture de la page. */
function estSpam(array $brut, int $maintenantMs): bool
{
    if (trim((string) ($brut['site_web'] ?? '')) !== '') {
        return true;
    }
    $ouvertLe = (string) ($brut['ouvert_le'] ?? '');
    if ($ouvertLe !== '' && ctype_digit($ouvertLe)) {
        return $maintenantMs - (int) $ouvertLe < DELAI_MINIMUM_MS;
    }
    // Sans JavaScript, pas d'horodatage : seul le champ piège protège.
    return false;
}

/** Une seule ligne, sans caractère de contrôle. */
function surUneLigne(string $texte): string
{
    return trim((string) preg_replace('/[\x00-\x1F\x7F]+/u', ' ', $texte));
}

/** Prépare l'e-mail envoyé au club. */
function construireEmail(array $donnees, string $formulaire): array
{
    $nom = surUneLigne($donnees['nom']);
    if ($formulaire === 'contact') {
        $sujet = 'Contact site : ' . surUneLigne($donnees['objet']);
        $intro = "Nouveau message depuis le formulaire de contact du site.";
    } else {
        $sujet = 'Devenir partenaire : ' . surUneLigne($donnees['societe']);
        $intro = "Nouvelle demande de partenariat depuis le site.";
    }

    $lignes = [$intro, ''];
    foreach (FORMULAIRES[$formulaire] as $champ => [, , $libelle]) {
        if ($champ === 'message' || $donnees[$champ] === '') {
            continue;
        }
        $lignes[] = "$libelle : " . surUneLigne($donnees[$champ]);
    }
    if ($donnees['message'] !== '') {
        $lignes[] = '';
        $lignes[] = 'Message :';
        $lignes[] = str_replace(["\r\n", "\r"], "\n", $donnees['message']);
    }
    $lignes[] = '';
    $lignes[] = '--';
    $lignes[] = 'Répondez directement à cet e-mail pour écrire à ' . $nom . '.';

    // L'adresse du visiteur a été validée (aucun retour à la ligne possible).
    $entetes = implode("\r\n", [
        'From: ' . mb_encode_mimeheader(NOM_EXPEDITEUR, 'UTF-8') . ' <' . EXPEDITEUR . '>',
        'Reply-To: ' . $donnees['email'],
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: 8bit',
        'X-Mailer: Site ASBD',
    ]);

    return [
        'sujet' => mb_encode_mimeheader($sujet, 'UTF-8', 'B', "\r\n"),
        'corps' => implode("\n", $lignes),
        'entetes' => $entetes,
    ];
}
