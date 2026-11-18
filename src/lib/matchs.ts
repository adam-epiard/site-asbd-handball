/**
 * Matchs et classements des équipes du club.
 *
 * Deux sources, réunies en une seule liste de matchs :
 * - les données FFHB (src/data/resultats/, écrites par npm run sync) ;
 * - les matchs saisis à la main dans la fiche équipe (champ `matchs`).
 *
 * Tout est calculé au moment du build : « à venir » et « joué » dépendent de la date
 * du build. L'Action GitHub reconstruit le site chaque jour, et après chaque changement de données.
 * Les dates sont toujours affichées à l'heure de Paris.
 */
import { getCollection, type CollectionEntry } from 'astro:content';
import { getEquipes, lienEquipe, type Equipe } from './equipes';
import { construire, dateParis, estCoupe, jourParis, NOM_CLUB, ordre, type Camp, type LigneClassement, type Match } from './matchs-outils';

export * from './matchs-outils';

type Resultats = CollectionEntry<'resultats'>;

// ---------- Construction des matchs ----------

function matchsFfhb(resultats: Resultats | undefined, equipe: Match['equipe']): Match[] {
  if (!resultats) return [];
  return resultats.data.poules.flatMap((poule) =>
    poule.rencontres.map((r) => {
      const date = r.date ? new Date(r.date) : null;
      const journee = poule.journees.find((j) => j.numero === r.journee);
      return construire({
        id: `ffhb-${r.id}`,
        equipe,
        date,
        // Sans horaire : on place le match au 1er jour de sa journée (souvent le samedi).
        jour: date ? jourParis(date) : (journee?.debut ?? '9999-12-31'),
        horaireInconnu: !date,
        journee: r.journee,
        competition: estCoupe(poule.competition) ? poule.competition : poule.nom,
        coupe: estCoupe(poule.competition),
        tour: poule.nom,
        pouleId: poule.id,
        domicile: { nom: r.domicile.nom, club: r.domicile.club, score: r.domicile.score },
        exterieur: { nom: r.exterieur.nom, club: r.exterieur.club, score: r.exterieur.score },
      });
    }),
  );
}

function matchsManuels(e: Equipe, equipe: Match['equipe']): Match[] {
  return e.data.matchs.map((m, i) => {
    const avecHeure = m.date.includes('T');
    const date = avecHeure ? dateParis(m.date) : null;
    const club: Camp = { nom: NOM_CLUB, club: true, score: m.scoreClub ?? null };
    const adversaire: Camp = { nom: m.adversaire, club: false, score: m.scoreAdversaire ?? null };
    return construire({
      id: `manuel-${e.id}-${i}`,
      equipe,
      date,
      jour: m.date.slice(0, 10),
      horaireInconnu: !avecHeure,
      journee: null,
      competition: m.competition ?? null,
      coupe: estCoupe(m.competition),
      tour: null,
      pouleId: null,
      domicile: m.domicile ? club : adversaire,
      exterieur: m.domicile ? adversaire : club,
    });
  });
}

let cache: Promise<Map<string, { matchs: Match[]; resultats?: Resultats }>> | undefined;

/** Matchs de toutes les équipes, par identifiant d'équipe (lu une seule fois par build). */
function chargerTout() {
  cache ??= (async () => {
    const [equipes, resultats] = await Promise.all([getEquipes(), getCollection('resultats')]);
    const parEquipe = new Map<string, { matchs: Match[]; resultats?: Resultats }>();
    for (const e of equipes) {
      const r = resultats.find((x) => x.id === e.id);
      const infos = { id: e.id, nom: e.data.nom, lien: lienEquipe(e) };
      parEquipe.set(e.id, { matchs: [...matchsFfhb(r, infos), ...matchsManuels(e, infos)].sort(ordre), resultats: r });
    }
    return parEquipe;
  })();
  return cache;
}

/** Matchs d'une équipe, du plus ancien au plus récent. */
export async function matchsEquipe(equipe: Equipe): Promise<Match[]> {
  return (await chargerTout()).get(equipe.id)?.matchs ?? [];
}

/** Matchs de toutes les équipes, du plus ancien au plus récent. */
export async function tousLesMatchs(): Promise<Match[]> {
  return [...(await chargerTout()).values()].flatMap((e) => e.matchs).sort(ordre);
}

/** Date de la dernière synchronisation FFHB (la plus récente si plusieurs équipes). */
export async function derniereMaj(equipe?: Equipe): Promise<Date | null> {
  const tout = await chargerTout();
  const dates = [...tout.entries()]
    .filter(([id]) => !equipe || id === equipe.id)
    .map(([, e]) => e.resultats?.data.majLe)
    .filter((d): d is string => Boolean(d))
    .map((d) => new Date(d));
  return dates.length ? new Date(Math.max(...dates.map((d) => d.getTime()))) : null;
}

/** Page FFHB de l'équipe : le lien de la fiche équipe, sinon sa première compétition suivie. */
export async function lienFfhbEquipe(equipe: Equipe): Promise<string | undefined> {
  return equipe.data.lienFfhb ?? equipe.data.ffhb?.competitions[0];
}

export interface ClassementPoule {
  poule: string;
  phase: string | null;
  adresse: string;
  lignes: LigneClassement[];
}

/**
 * Classements de championnat de l'équipe, la phase la plus récente en premier
 * (les coupes et les phases sans classement sont laissées de côté).
 */
export async function classementsEquipe(equipe: Equipe): Promise<ClassementPoule[]> {
  const r = (await chargerTout()).get(equipe.id)?.resultats;
  const fin = (p: { journees: { fin: string }[] }) => p.journees.map((j) => j.fin).sort().at(-1) ?? '';
  return (r?.data.poules ?? [])
    .filter((p) => p.classement.length > 0 && p.phase?.classement !== false && !estCoupe(p.competition))
    .sort((a, b) => fin(b).localeCompare(fin(a)))
    .map((p) => ({ poule: p.nom, phase: p.phase?.nom ?? null, adresse: p.adresse, lignes: p.classement }));
}

export interface PhaseChampionnat {
  /** Identifiant de l'onglet : phase-1, phase-2... */
  id: string;
  /** « Phase 1 », « Phase 2 »... dans l'ordre chronologique. */
  titre: string;
  /** Nom FFHB de la phase : « U12M 85 PHASE 1 BRASSAGE ». */
  nom: string | null;
  poule: string;
  matchs: Match[];
  classement: ClassementPoule | null;
  /** Phase en cours : la dernière qui a commencé (ou la première si aucune n'a commencé). */
  enCours: boolean;
}

/**
 * Phases de championnat de l'équipe (brassage, phase 2...), une par poule à classement,
 * dans l'ordre chronologique. Les coupes et les plateaux sans classement n'en font pas partie.
 */
export async function phasesEquipe(equipe: Equipe, maintenant = new Date()): Promise<PhaseChampionnat[]> {
  const tout = (await chargerTout()).get(equipe.id);
  const poules = (tout?.resultats?.data.poules ?? [])
    .filter((p) => !estCoupe(p.competition) && p.phase?.classement !== false)
    .map((p) => ({ p, debut: p.journees.map((j) => j.debut).sort()[0] ?? '9999-12-31' }))
    .sort((a, b) => a.debut.localeCompare(b.debut));
  const aujourdhui = jourParis(maintenant);
  const commencees = poules.filter((x) => x.debut <= aujourdhui);
  const enCours = (commencees.at(-1) ?? poules[0])?.p.id;

  return poules.map(({ p }, i) => ({
    id: `phase-${i + 1}`,
    titre: `Phase ${i + 1}`,
    nom: p.phase?.nom ?? null,
    poule: p.nom,
    matchs: (tout?.matchs ?? []).filter((m) => m.pouleId === p.id),
    classement: p.classement.length > 0 ? { poule: p.nom, phase: p.phase?.nom ?? null, adresse: p.adresse, lignes: p.classement } : null,
    enCours: p.id === enCours,
  }));
}
