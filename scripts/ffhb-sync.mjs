/**
 * Synchronisation des matchs et classements depuis le site de la FFHB.
 *
 *   npm run sync                 met à jour src/data/resultats/
 *   npm run sync -- --complet    relit toutes les journées (sinon : les récentes et à venir)
 *
 * Pour chaque équipe de src/content/equipes/ qui a un champ ffhb.competitions, lit les pages
 * de ses poules et enregistre src/data/resultats/<équipe>.json.
 * Un fichier n'est réécrit que si les données ont changé : l'Action GitHub
 * ne reconstruit le site que dans ce cas.
 *
 * Le script se termine toujours sans erreur : un problème côté FFHB ne doit pas
 * bloquer la mise en ligne du site. Les problèmes sont signalés en avertissements.
 */
import { synchroniser } from './ffhb/synchro.mjs';

const enAction = Boolean(process.env.GITHUB_ACTIONS);

async function telecharger(adresse) {
  const reponse = await fetch(adresse, {
    headers: {
      'User-Agent': 'SiteASBD/1.0 (+https://labruffierehandball.com) synchronisation des matchs du club',
      Accept: 'text/html',
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!reponse.ok) throw new Error(`HTTP ${reponse.status} pour ${adresse}`);
  return reponse.text();
}

const avertir = (message) => console.warn(enAction ? `::warning::${message}` : `ATTENTION : ${message}`);

try {
  const { modifies, avertissements } = await synchroniser({
    telecharger,
    complet: process.argv.includes('--complet'),
    avertir,
  });
  console.log(`\n${modifies.length} fichier(s) modifié(s), ${avertissements.length} avertissement(s).`);
} catch (erreur) {
  avertir(`Synchronisation interrompue : ${erreur.message}`);
}
