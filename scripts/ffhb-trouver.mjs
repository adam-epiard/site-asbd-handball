/**
 * Liste toutes les compétitions où joue le club, avec l'équipe du site qui les suit.
 *
 *   npm run ffhb:trouver                 liste complète (environ 1 à 2 minutes)
 *   npm run ffhb:trouver -- --verifier   n'affiche que les compétitions suivies par aucune équipe
 *
 * Pour suivre une compétition : copier son adresse dans le champ ffhb.competitions de la fiche équipe.
 * La saison est celle des adresses déjà présentes dans les fiches équipes.
 */
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { lireJson, STRUCTURE_CLUB } from './ffhb/synchro.mjs';
import { baseSaison, equipeQuiSuit, trouverCompetitionsDuClub } from './ffhb/trouver.mjs';

const DOSSIER_EQUIPES = 'src/content/equipes';
const verifier = process.argv.includes('--verifier');
const enAction = Boolean(process.env.GITHUB_ACTIONS);
const avertir = (message) => console.warn(enAction ? `::warning::${message}` : `ATTENTION : ${message}`);

async function telecharger(adresse) {
  const reponse = await fetch(adresse, {
    headers: { 'User-Agent': 'SiteASBD/1.0 (+https://labruffierehandball.com) synchronisation des matchs du club' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!reponse.ok) throw new Error(`HTTP ${reponse.status} pour ${adresse}`);
  return reponse.text();
}

try {
  const equipes = [];
  for (const f of (await readdir(DOSSIER_EQUIPES)).filter((f) => f.endsWith('.json'))) {
    const e = await lireJson(join(DOSSIER_EQUIPES, f));
    equipes.push({ id: f.replace(/\.json$/, ''), poules: e?.ffhb?.competitions ?? [] });
  }
  const saison = equipes.flatMap((e) => e.poules).map(baseSaison).find(Boolean);
  if (!saison) throw new Error('aucune adresse FFHB dans les fiches équipes : impossible de savoir quelle saison chercher');

  console.log(`Recherche des compétitions du club, ${saison}\n`);
  const competitions = await trouverCompetitionsDuClub({ telecharger, saison, structure: STRUCTURE_CLUB, signaler: avertir });

  let nonSuivies = 0;
  for (const c of competitions) {
    const equipe = equipeQuiSuit(equipes, c.adresse);
    if (!equipe) nonSuivies += 1;
    if (verifier) {
      if (!equipe) avertir(`Le club joue en « ${c.competition} », suivie par aucune équipe du site : ${c.adresse}`);
      continue;
    }
    console.log(`${c.competition}  →  ${equipe ? `suivie par ${equipe}` : 'SUIVIE PAR AUCUNE ÉQUIPE'}`);
    console.log(`  ${c.adresse}`);
    for (const p of c.poules) console.log(`    · ${p.nom} (${p.equipe})`);
    console.log('');
  }
  console.log(`${competitions.length} compétition(s) trouvée(s), ${nonSuivies} suivie(s) par aucune équipe.`);
} catch (erreur) {
  avertir(`Recherche interrompue : ${erreur.message}`);
}
