/**
 * Synchronisation des matchs et classements : lit les fiches équipes, interroge
 * le site de la FFHB et écrit un fichier de résultats par équipe.
 *
 * Une équipe suit une ou plusieurs compétitions (championnat, coupe, plateaux) :
 * champ ffhb.competitions de sa fiche. Pour une adresse de compétition, toutes les poules
 * où joue le club sont suivies : phase 1, phase 2, tours de coupe.
 *
 * Pour ménager le site de la FFHB :
 * - une poule terminée depuis plus de 7 jours est reprise telle qu'enregistrée ;
 * - une poule déjà vérifiée sans le club n'est plus relue une fois commencée ;
 * - seules les journées récentes et à venir sont relues.
 *
 * Le téléchargement est passé en paramètre : les tests le remplacent par des pages
 * enregistrées. En cas d'erreur, les données déjà enregistrées sont gardées.
 */
import { readdir, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import {
  adresseCompetition,
  adresseJournee,
  assemblerPoule,
  estAdressePoule,
  extraireComposants,
  journeesARelire,
  lirePagePoule,
  lireRencontres,
  listerPoules,
  pouleTerminee,
} from './lire.mjs';

/** Identifiant FFHB du club (AS Bruffière). Une équipe peut le remplacer par ffhb.structure. */
export const STRUCTURE_CLUB = '1798';

export async function lireJson(chemin) {
  try {
    return JSON.parse(await readFile(chemin, 'utf8'));
  } catch {
    return undefined;
  }
}

/** AAAA-MM-JJ (UTC, suffisant pour comparer à quelques jours près). */
const jourIso = (date) => date.toISOString().slice(0, 10);

/**
 * @param {{
 *   telecharger: (adresse: string) => Promise<string>,
 *   dossierEquipes?: string,
 *   dossierResultats?: string,
 *   maintenant?: Date,
 *   complet?: boolean,
 *   pauseMs?: number,
 *   avertir?: (message: string) => void,
 *   journal?: (message: string) => void,
 * }} options
 * @returns {Promise<{ modifies: string[], avertissements: string[] }>}
 */
export async function synchroniser({
  telecharger,
  dossierEquipes = 'src/content/equipes',
  dossierResultats = 'src/data/resultats',
  maintenant = new Date(),
  complet = false,
  pauseMs = 400,
  avertir = (m) => console.warn(m),
  journal = (m) => console.log(m),
}) {
  const avertissements = [];
  const signaler = (message) => {
    avertissements.push(message);
    avertir(message);
  };
  const pause = () => (pauseMs > 0 ? new Promise((r) => setTimeout(r, pauseMs)) : Promise.resolve());
  const aujourdhui = jourIso(maintenant);

  /** Journées d'une poule dont la page principale vient d'être lue. */
  async function lireJournees(source, adresse, page, ancienne) {
    if (ancienne && ancienne.id !== page.id) ancienne = undefined;
    const aRelire = journeesARelire(page.journees, complet ? [] : (ancienne?.journeesLues ?? []), maintenant);
    const lues = new Map();
    for (const numero of aRelire) {
      if (numero === page.journeeAffichee) {
        lues.set(numero, page.rencontres);
        continue;
      }
      await pause();
      try {
        const html = await telecharger(adresseJournee(adresse, numero));
        lues.set(numero, lireRencontres(extraireComposants(html), page.equipe.id));
      } catch (erreur) {
        // Journée gardée telle qu'enregistrée : elle sera relue au prochain passage.
        signaler(`${page.nom}, journée ${numero} : ${erreur.message}`);
      }
    }
    return assemblerPoule({ source, adresse }, page, lues, ancienne);
  }

  /**
   * Toutes les poules du club pour une adresse de la fiche équipe.
   * - Adresse de poule : cette poule seule (si elle a disparu, on cherche dans la compétition).
   * - Adresse de compétition : chaque poule où joue le club.
   * @returns {Promise<{ poules: any[], sansClub: string[] }>}
   */
  async function synchroniserSource(source, club, anciennes, sansClubAvant) {
    let erreurDirecte;
    if (estAdressePoule(source)) {
      const ancienne = anciennes[0];
      if (!complet && ancienne && pouleTerminee(ancienne.journees, maintenant)) return { poules: [ancienne], sansClub: [] };
      try {
        const page = lirePagePoule(await telecharger(source), club);
        return { poules: [await lireJournees(source, source, page, ancienne)], sansClub: [] };
      } catch (erreur) {
        erreurDirecte = erreur;
      }
    }

    const competition = adresseCompetition(source);
    const candidates = listerPoules(extraireComposants(await telecharger(competition)), competition);
    const poules = [];
    const sansClub = [];

    for (const candidate of candidates) {
      const ancienne = anciennes.find((p) => p.id === candidate.id);
      // Poule déjà vérifiée sans le club, et commencée : sa composition ne bouge plus.
      if (!complet && sansClubAvant.includes(candidate.id) && candidate.debut && candidate.debut <= aujourdhui) {
        sansClub.push(candidate.id);
        continue;
      }
      // Poule du club terminée : reprise telle quelle, sans téléchargement.
      if (!complet && ancienne && pouleTerminee(ancienne.journees, maintenant)) {
        poules.push(ancienne);
        continue;
      }
      await pause();
      let page;
      try {
        page = lirePagePoule(await telecharger(candidate.adresse), club);
      } catch (erreur) {
        if (/introuvable/.test(erreur.message)) {
          sansClub.push(candidate.id);
        } else {
          signaler(`${candidate.nom} : ${erreur.message}`);
          if (ancienne) poules.push(ancienne);
        }
        continue;
      }
      poules.push(await lireJournees(source, candidate.adresse, page, ancienne));
    }

    if (poules.length === 0) {
      throw new Error(erreurDirecte ? `${erreurDirecte.message}, et équipe du club introuvable dans ${competition}` : `équipe du club introuvable dans ${competition}`);
    }
    if (erreurDirecte) {
      signaler(`${source} : ${erreurDirecte.message}. Poule${poules.length > 1 ? 's' : ''} utilisée${poules.length > 1 ? 's' : ''} : ${poules.map((p) => p.adresse).join(', ')}`);
    }
    return { poules, sansClub };
  }

  await mkdir(dossierResultats, { recursive: true });
  const fichiers = (await readdir(dossierEquipes)).filter((f) => f.endsWith('.json')).sort();
  const suivies = new Set();
  const modifies = [];

  for (const fichier of fichiers) {
    const id = fichier.replace(/\.json$/, '');
    const equipe = await lireJson(join(dossierEquipes, fichier));
    const sources = equipe?.ffhb?.competitions ?? [];
    if (sources.length === 0) continue;
    suivies.add(id);

    const club = { structure: equipe.ffhb.structure ?? STRUCTURE_CLUB, libelle: equipe.ffhb.libelle };
    const chemin = join(dossierResultats, `${id}.json`);
    const ancien = await lireJson(chemin);

    const poules = [];
    const sansClub = {};
    for (const source of sources) {
      const anciennes = (ancien?.poules ?? []).filter((p) => p.source === source);
      const sansClubAvant = ancien?.sansClub?.[source] ?? [];
      try {
        const r = await synchroniserSource(source, club, anciennes, sansClubAvant);
        poules.push(...r.poules);
        if (r.sansClub.length) sansClub[source] = r.sansClub;
      } catch (erreur) {
        signaler(`${equipe.nom} : ${erreur.message}. Données précédentes conservées.`);
        poules.push(...anciennes);
        if (sansClubAvant.length) sansClub[source] = sansClubAvant;
      }
      await pause();
    }

    if (poules.length === 0) continue;
    const contenu = { poules, sansClub };
    if (ancien && JSON.stringify({ poules: ancien.poules, sansClub: ancien.sansClub ?? {} }) === JSON.stringify(contenu)) {
      journal(`${equipe.nom} : inchangé`);
      continue;
    }
    await writeFile(chemin, `${JSON.stringify({ majLe: maintenant.toISOString(), ...contenu }, null, 2)}\n`);
    modifies.push(id);
    const nb = poules.reduce((total, p) => total + p.rencontres.length, 0);
    journal(`${equipe.nom} : mis à jour (${nb} matchs, ${poules.length} poule${poules.length > 1 ? 's' : ''})`);
  }

  // Équipe qui n'est plus suivie : ses données sont supprimées, pour ne pas afficher de vieux matchs.
  for (const fichier of await readdir(dossierResultats)) {
    const id = fichier.replace(/\.json$/, '');
    if (fichier.endsWith('.json') && !suivies.has(id)) {
      await rm(join(dossierResultats, fichier));
      modifies.push(id);
      journal(`${id} : plus suivie, données supprimées`);
    }
  }

  return { modifies, avertissements };
}
