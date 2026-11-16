<?php
/**
 * Tests du script des formulaires. Lancer : php tests/formulaire.test.php
 * Partie 1 : fonctions pures. Partie 2 : requêtes HTTP sur un serveur PHP local.
 */
declare(strict_types=1);

require __DIR__ . '/../public/api/formulaire-lib.php';

$echecs = 0;
function verifier(bool $condition, string $nom): void
{
    global $echecs;
    if ($condition) {
        echo "  ok   $nom\n";
    } else {
        $echecs++;
        echo "  ÉCHEC $nom\n";
    }
}

$contactValide = ['nom' => 'Jeanne Dupont', 'email' => 'jeanne@exemple.fr', 'objet' => 'Essai U11', 'message' => 'Bonjour, ma fille voudrait essayer.'];
$partenaireValide = ['nom' => 'Paul Martin', 'societe' => 'Garage Martin', 'email' => 'paul@garage.fr', 'telephone' => '02 51 00 00 00', 'message' => ''];

echo "Fonctions\n";
verifier(valider(nettoyer($contactValide, 'contact'), 'contact') === [], 'contact valide');
verifier(valider(nettoyer($partenaireValide, 'partenaire'), 'partenaire') === [], 'partenaire valide (message facultatif)');
verifier(isset(valider(nettoyer(['nom' => ''] + $contactValide, 'contact'), 'contact')['nom']), 'nom obligatoire');
verifier(isset(valider(nettoyer(['email' => 'pas-un-email'] + $contactValide, 'contact'), 'contact')['email']), 'e-mail invalide');
verifier(isset(valider(nettoyer(['message' => str_repeat('a', 5001)] + $contactValide, 'contact'), 'contact')['message']), 'message trop long');
verifier(isset(valider(nettoyer(['telephone' => 'appelez-moi'] + $partenaireValide, 'partenaire'), 'partenaire')['telephone']), 'téléphone avec lettres refusé');
verifier(!isset(nettoyer($contactValide + ['champ_inconnu' => 'x'], 'contact')['champ_inconnu']), 'champs inconnus ignorés');

// test_injection_entetes
verifier(isset(valider(nettoyer(['email' => "a@b.fr\r\nBcc: x@y.fr"] + $contactValide, 'contact'), 'contact')['email']), 'injection dans l\'e-mail refusée');
$email = construireEmail(nettoyer(['nom' => "Jeanne\r\nBcc: x@y.fr", 'objet' => "Salut\nBcc: z@y.fr"] + $contactValide, 'contact'), 'contact');
verifier(!preg_match('/\r|\n/', $email['sujet']), 'sujet sans retour à la ligne');
verifier(!preg_match('/^Bcc:/mi', $email['entetes']), 'aucun en-tête Bcc injecté');

// test_sujet_utf8
$email = construireEmail(nettoyer(['objet' => 'Inscription école de hand ⚽'] + $contactValide, 'contact'), 'contact');
verifier(str_contains($email['sujet'], '=?UTF-8?B?') && !preg_match('/[^\x20-\x7E]/', $email['sujet']), 'sujet encodé en UTF-8 (ASCII seulement)');
verifier(mb_decode_mimeheader($email['sujet']) === 'Contact site : Inscription école de hand ⚽', 'sujet décodé identique');
verifier(str_contains($email['entetes'], 'Reply-To: jeanne@exemple.fr'), 'Reply-To = visiteur');
verifier(str_contains($email['entetes'], 'Content-Type: text/plain; charset=UTF-8'), 'texte brut UTF-8');
verifier(str_contains($email['corps'], 'Bonjour, ma fille voudrait essayer.'), 'message dans le corps');
$emailPart = construireEmail(nettoyer($partenaireValide, 'partenaire'), 'partenaire');
verifier(str_contains($emailPart['corps'], 'Garage Martin') && mb_decode_mimeheader($emailPart['sujet']) === 'Devenir partenaire : Garage Martin', 'e-mail partenaire');

// test_piege et délai
$maintenant = 1_000_000;
verifier(estSpam(['site_web' => 'http://spam'], $maintenant), 'piège rempli = spam');
verifier(estSpam(['site_web' => '', 'ouvert_le' => (string) ($maintenant - 1000)], $maintenant), 'envoi en moins de 3 s = spam');
verifier(!estSpam(['site_web' => '', 'ouvert_le' => (string) ($maintenant - 5000)], $maintenant), 'envoi après 5 s = ok');
verifier(!estSpam(['site_web' => ''], $maintenant), 'sans horodatage (sans JS) = ok');

// Partie 2 : HTTP
echo "HTTP\n";
$dossier = sys_get_temp_dir() . '/formulaire-test-' . getmypid();
@mkdir($dossier);
$boite = "$dossier/mails.txt";
$faux = "$dossier/sendmail.sh";
file_put_contents($faux, "#!/bin/sh\ncat >> $boite\necho '---FIN---' >> $boite\n");
chmod($faux, 0755);
$fauxEchec = "$dossier/sendmail-echec.sh";
file_put_contents($fauxEchec, "#!/bin/sh\ncat > /dev/null\nexit 1\n");
chmod($fauxEchec, 0755);

function demarrer(string $sendmail, int $port): mixed
{
    $racine = realpath(__DIR__ . '/../public');
    $cmd = sprintf('exec php -d sendmail_path=%s -S 127.0.0.1:%d -t %s', escapeshellarg($sendmail), $port, escapeshellarg($racine));
    $proc = proc_open($cmd, [1 => ['file', '/dev/null', 'w'], 2 => ['file', '/dev/null', 'w']], $pipes);
    usleep(400_000);
    return $proc;
}

function requete(int $port, string $methode, array $champs, bool $json): array
{
    $ch = curl_init("http://127.0.0.1:$port/api/formulaire.php");
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST => $methode,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_HEADER => true,
        CURLOPT_HTTPHEADER => $json ? ['Accept: application/json'] : ['Accept: text/html'],
        CURLOPT_NOPROXY => '*',
    ]);
    if ($methode === 'POST') {
        curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($champs));
    }
    $reponse = (string) curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $tailleEntetes = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    return [$code, substr($reponse, 0, $tailleEntetes), substr($reponse, $tailleEntetes)];
}

$port = 8791;
$serveur = demarrer($faux, $port);
$base = ['formulaire' => 'contact', 'site_web' => ''] + $contactValide;

// test_methode_et_formulaire
[$code] = requete($port, 'GET', [], true);
verifier($code === 405, 'GET refusé (405)');
[$code] = requete($port, 'POST', ['formulaire' => 'inconnu'] + $base, true);
verifier($code === 400, 'formulaire inconnu (400)');

@unlink($boite);
[$code, , $corps] = requete($port, 'POST', $base, true);
verifier($code === 200 && json_decode($corps, true)['ok'] === true, 'envoi valide (200, ok)');
verifier(substr_count((string) @file_get_contents($boite), '---FIN---') === 1, 'un e-mail envoyé');
verifier(str_contains((string) @file_get_contents($boite), 'To: communication@labruffierehandball.com'), 'destinataire du club');

[$code, , $corps] = requete($port, 'POST', ['email' => 'faux'] + $base, true);
verifier($code === 422 && isset(json_decode($corps, true)['erreurs']['email']), 'e-mail invalide (422)');

@unlink($boite);
[$code] = requete($port, 'POST', ['site_web' => 'spam'] + $base, true);
verifier($code === 200 && !file_exists($boite), 'piège : réponse ok, aucun e-mail');

[$code, $entetes] = requete($port, 'POST', $base, false);
verifier($code === 303 && str_contains($entetes, 'Location: /message-envoye/'), 'sans JS : redirection vers /message-envoye/');
[$code, $entetes] = requete($port, 'POST', ['email' => 'faux'] + $base, false);
verifier($code === 303 && str_contains($entetes, 'Location: /message-non-envoye/'), 'sans JS : erreur vers /message-non-envoye/');
proc_terminate($serveur);

// test_echec_envoi
$serveur = demarrer($fauxEchec, $port + 1);
[$code, , $corps] = requete($port + 1, 'POST', $base, true);
verifier($code === 500 && json_decode($corps, true)['ok'] === false, 'échec de mail() (500)');
proc_terminate($serveur);

array_map('unlink', glob("$dossier/*") ?: []);
@rmdir($dossier);

echo $echecs === 0 ? "OK\n" : "$echecs échec(s)\n";
exit($echecs === 0 ? 0 : 1);
