/**
 * Recherche de toutes les compétitions où joue le club : on parcourt les compétitions
 * du comité de Vendée, de la ligue des Pays de la Loire et de la Coupe de France,
 * et on regarde dans quelles
 * poules l'équipe du club apparaît.
 *
 * Sert à remplir le champ ffhb.competitions des fiches équipes, et à repérer une compétition
 * qui n'est suivie par aucune équipe (une coupe qui commence en cours de saison).
 */
import { adresseCompetition, extraireComposants, listerPoules, slugCompetition } from './lire.mjs';

/** Pages qui listent les compétitions : comité de Vendée, ligue des Pays de la Loire, Coupe de France. */
export const STRUCTURES = [
  { type: 'departemental', page: 'o-comite-de-vendee-115' },
  { type: 'regional', page: 'o-ligue-des-pays-de-la-loire-19' },
  { type: 'coupe-de-france', page: null },
];

/** Base des adresses d'une saison, tirée d'une adresse FFHB : …/competitions/saison-2026-2027-22/ */
export function baseSaison(adresse) {
  const m = adresse.match(/^(https:\/\/www\.ffhandball\.fr\/competitions\/saison-[\w-]+\/)/);
  return m ? m[1] : undefined;
}

/**
 * @param {{
 *   telecharger: (adresse: string) => Promise<string>,
 *   saison: string,
 *   structure: string,
 *   pauseMs?: number,
 *   signaler?: (message: string) => void,
 * }} options
 * @returns {Promise<{ competition: string, adresse: string, poules: { nom: string, adresse: string, equipe: string }[] }[]>}
 */
export async function trouverCompetitionsDuClub({ telecharger, saison, structure, pauseMs = 400, signaler = () => {} }) {
  const pause = () => (pauseMs > 0 ? new Promise((r) => setTimeout(r, pauseMs)) : Promise.resolve());
  const trouvees = [];

  for (const { type, page } of STRUCTURES) {
    let competitions = [];
    try {
      const liste = page ? `${saison}${type}/${page}/` : `${saison}${type}/`;
      const menu = extraireComposants(await telecharger(liste))['competitions---competition-main-menu'];
      competitions = menu?.competitions ?? [];
    } catch (erreur) {
      signaler(`Liste des compétitions (${page ?? type}) : ${erreur.message}`);
      continue;
    }

    for (const c of competitions) {
      const adresse = `${saison}${type}/${slugCompetition(c.libelle, c.ext_competitionId)}/`;
      await pause();
      let candidates;
      try {
        candidates = listerPoules(extraireComposants(await telecharger(adresse)), adresse);
      } catch (erreur) {
        signaler(`${c.libelle} : ${erreur.message}`);
        continue;
      }
      const poules = [];
      for (const p of candidates) {
        await pause();
        try {
          const selecteur = extraireComposants(await telecharger(p.adresse))['competitions---poule-selector'];
          const equipes = (selecteur?.equipe_options ?? []).filter((e) => String(e.structureId) === String(structure));
          for (const e of equipes) poules.push({ nom: p.nom, adresse: p.adresse, equipe: e.libelle });
        } catch (erreur) {
          signaler(`${c.libelle}, ${p.nom} : ${erreur.message}`);
        }
      }
      if (poules.length) trouvees.push({ competition: c.libelle, adresse: adresseCompetition(adresse), poules });
    }
  }
  return trouvees;
}

/**
 * Équipe du site qui suit une compétition (par son adresse, avec ou sans poule).
 * @param {{ id: string, poules: string[] }[]} equipes
 */
export function equipeQuiSuit(equipes, adresseCompetitionFfhb) {
  return equipes.find((e) => e.poules.some((p) => adresseCompetition(p) === adresseCompetitionFfhb))?.id;
}
