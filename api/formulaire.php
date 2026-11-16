<?php
/**
 * Point d'entrée des formulaires : POST /api/formulaire.php
 * - Avec « Accept: application/json » (envoi en JavaScript) : réponse JSON.
 * - Sinon (navigateur sans JavaScript) : redirection vers une page de confirmation.
 */
declare(strict_types=1);

require __DIR__ . '/formulaire-lib.php';

$enJson = str_contains($_SERVER['HTTP_ACCEPT'] ?? '', 'application/json');

function repondre(bool $enJson, int $code, array $corps): never
{
    if ($enJson) {
        http_response_code($code);
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
        echo json_encode($corps, JSON_UNESCAPED_UNICODE);
    } else {
        header('Location: ' . ($corps['ok'] ? '/message-envoye/' : '/message-non-envoye/'), true, 303);
    }
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    repondre($enJson, 405, ['ok' => false]);
}

$formulaire = (string) ($_POST['formulaire'] ?? '');
if (!array_key_exists($formulaire, FORMULAIRES)) {
    repondre($enJson, 400, ['ok' => false]);
}

// Un robot reçoit une réponse normale, pour ne pas lui apprendre à contourner le filtre.
if (estSpam($_POST, (int) floor(microtime(true) * 1000))) {
    repondre($enJson, 200, ['ok' => true]);
}

$donnees = nettoyer($_POST, $formulaire);
$erreurs = valider($donnees, $formulaire);
if ($erreurs !== []) {
    repondre($enJson, 422, ['ok' => false, 'erreurs' => $erreurs]);
}

$email = construireEmail($donnees, $formulaire);
$envoye = mail(DESTINATAIRE, $email['sujet'], $email['corps'], $email['entetes'], '-f' . EXPEDITEUR);

repondre($enJson, $envoye ? 200 : 500, ['ok' => $envoye]);
