/**
 * Outils purs autour des matchs : dates à l'heure de Paris, noms d'équipes,
 * sélection du prochain match, regroupement par semaine.
 * Aucune dépendance à Astro : testés directement par tests/matchs.test.mjs.
 */

export const FUSEAU = 'Europe/Paris';

export interface Camp {
  nom: string;
  club: boolean;
  score: number | null;
}

export interface Match {
  id: string;
  equipe: { id: string; nom: string; lien: string };
  /** Date et heure. null si la FFHB n'a pas encore fixé l'horaire. */
  date: Date | null;
  /** Jour du match (AAAA-MM-JJ, heure de Paris), connu même sans horaire. */
  jour: string;
  /** Pas encore d'horaire : seul le week-end est connu (dates de la journée). */
  horaireInconnu: boolean;
  journee: number | null;
  /** Compétition affichée : nom de la coupe, ou nom de la poule de championnat. */
  competition: string | null;
  /** Match de coupe. */
  coupe: boolean;
  /** Tour ou tournoi (nom de la poule FFHB) : « COUPE PDLL FEM DEP ; 1E TOUR »... */
  tour: string | null;
  /** Poule FFHB du match (null pour un match saisi à la main). */
  pouleId: string | null;
  domicile: Camp;
  exterieur: Camp;
  /** Le club joue à domicile. */
  aDomicile: boolean;
  /** Les deux scores sont connus. */
  joue: boolean;
  resultat: 'victoire' | 'nul' | 'defaite' | null;
}

export interface LigneClassement {
  place: number | null;
  equipe: string;
  club: boolean;
  points: number | null;
  joues: number | null;
  gagnes: number | null;
  nuls: number | null;
  perdus: number | null;
  difference: number | null;
}

// ---------- Dates à l'heure de Paris ----------

const formatJour = new Intl.DateTimeFormat('en-CA', { timeZone: FUSEAU, year: 'numeric', month: '2-digit', day: '2-digit' });

/** AAAA-MM-JJ du jour à Paris. */
export function jourParis(date: Date): string {
  return formatJour.format(date);
}

/** Décalage de Paris par rapport à UTC à cet instant, en minutes (60 l'hiver, 120 l'été). */
function decalageParis(instant: Date): number {
  const parties = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: FUSEAU,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
      .formatToParts(instant)
      .map((p) => [p.type, p.value]),
  );
  const local = Date.UTC(+parties.year, +parties.month - 1, +parties.day, +parties.hour, +parties.minute);
  return Math.round((local - instant.getTime()) / 60000);
}

/** « 2026-11-21T20:30 » à l'heure de Paris → instant. */
export function dateParis(texte: string): Date {
  const [jour, heure = '12:00'] = texte.split('T');
  const [a, m, j] = jour.split('-').map(Number);
  const [h, min] = heure.split(':').map(Number);
  const approx = new Date(Date.UTC(a, m - 1, j, h, min));
  return new Date(approx.getTime() - decalageParis(approx) * 60000);
}

/** Lundi de la semaine d'un jour (AAAA-MM-JJ). */
export function lundiDe(jour: string): string {
  const d = new Date(`${jour}T12:00:00Z`);
  const decalage = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - decalage);
  return d.toISOString().slice(0, 10);
}

function ajouterJours(jour: string, n: number): string {
  const d = new Date(`${jour}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** « samedi 21 novembre » */
export function libelleJourMatch(jour: string): string {
  return new Date(`${jour}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
}

/** « sam. 21 nov. » */
export function libelleJourCourt(jour: string): string {
  return new Date(`${jour}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/** « 20:30 » */
export function libelleHeure(date: Date): string {
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: FUSEAU });
}

/** « 16/11/2026 à 13:00 » */
export function libelleMaj(date: Date): string {
  return `${date.toLocaleDateString('fr-FR', { timeZone: FUSEAU })} à ${libelleHeure(date)}`;
}

// ---------- Noms d'équipes ----------

/** Nom court du club, affiché à la place du nom FFHB de nos équipes. */
export const NOM_CLUB = 'ASBD';

/**
 * Nom lisible d'une équipe. La FFHB préfixe parfois la catégorie et le type d'entente :
 * « U11F85 C.HAUT BOCAGE*PHB 1 » → « HAUT BOCAGE*PHB 1 ».
 * Pour le club : « ASBD », suivi du numéro d'équipe s'il y en a un.
 */
export function nomEquipe(camp: { nom: string; club: boolean }): string {
  if (camp.club) {
    const numero = camp.nom.match(/\s(\d)$/)?.[1];
    return numero ? `${NOM_CLUB} ${numero}` : NOM_CLUB;
  }
  return camp.nom
    .replace(/^(?:U\d{1,2}\s?[MFX]?|[DR]\d{1,2}\s?[MF]?)\s?\d{2}\s+(?=\S)/, '')
    .replace(/^[CE]\.(?=\S)/, '')
    .trim();
}

// ---------- Construction des matchs ----------

/** Une compétition de coupe : « COUPE DE VENDEE U15F 85... », « Coupe PDL ». */
export function estCoupe(nom: string | null | undefined): boolean {
  return Boolean(nom && /\bcoupe\b/i.test(nom));
}

function resultatDuClub(club: Camp, adversaire: Camp): Match['resultat'] {
  if (club.score === null || adversaire.score === null) return null;
  if (club.score > adversaire.score) return 'victoire';
  if (club.score < adversaire.score) return 'defaite';
  return 'nul';
}

export function construire(
  base: Omit<Match, 'aDomicile' | 'joue' | 'resultat'>,
): Match {
  const aDomicile = base.domicile.club;
  const club = aDomicile ? base.domicile : base.exterieur;
  const adversaire = aDomicile ? base.exterieur : base.domicile;
  return {
    ...base,
    aDomicile,
    joue: base.domicile.score !== null && base.exterieur.score !== null,
    resultat: resultatDuClub(club, adversaire),
  };
}

/** Ordre chronologique : jour, puis heure. */
export function ordre(a: Match, b: Match): number {
  return a.jour.localeCompare(b.jour) || (a.date?.getTime() ?? 0) - (b.date?.getTime() ?? 0);
}

// ---------- Sélections ----------

/** Un match est « passé » le lendemain de son jour, même sans score saisi. */
function estPasse(m: Match, aujourdhui: string): boolean {
  return m.joue || m.jour < aujourdhui;
}

/** Prochain match pas encore joué (aujourd'hui compris). */
export function prochainMatch(matchs: Match[], maintenant = new Date()): Match | undefined {
  const aujourdhui = jourParis(maintenant);
  return matchs.find((m) => !estPasse(m, aujourdhui));
}

/** Dernier match dont le score est connu. */
export function dernierResultat(matchs: Match[]): Match | undefined {
  return matchs.findLast((m) => m.joue);
}

export function matchsAVenir(matchs: Match[], maintenant = new Date()): Match[] {
  const aujourdhui = jourParis(maintenant);
  return matchs.filter((m) => !estPasse(m, aujourdhui));
}

/** Matchs passés, du plus récent au plus ancien. */
export function matchsPasses(matchs: Match[], maintenant = new Date()): Match[] {
  const aujourdhui = jourParis(maintenant);
  return matchs.filter((m) => estPasse(m, aujourdhui)).reverse();
}

export interface Semaine {
  lundi: string;
  dimanche: string;
  matchs: Match[];
}

/** Regroupe des matchs par semaine (lundi → dimanche), dans l'ordre reçu. */
export function parSemaine(matchs: Match[]): Semaine[] {
  const semaines: Semaine[] = [];
  for (const m of matchs) {
    const lundi = lundiDe(m.jour);
    let s = semaines.find((x) => x.lundi === lundi);
    if (!s) {
      s = { lundi, dimanche: ajouterJours(lundi, 6), matchs: [] };
      semaines.push(s);
    }
    s.matchs.push(m);
  }
  return semaines;
}

/**
 * La semaine à mettre en avant sur l'accueil : la semaine en cours si le club joue,
 * sinon la prochaine semaine avec des matchs.
 */
export function semaineAMontrer(matchs: Match[], maintenant = new Date()): (Semaine & { enCours: boolean }) | undefined {
  const lundiCourant = lundiDe(jourParis(maintenant));
  const semaines = parSemaine(matchs);
  const courante = semaines.find((s) => s.lundi === lundiCourant);
  if (courante) return { ...courante, enCours: true };
  const prochaine = semaines.find((s) => s.lundi > lundiCourant);
  return prochaine ? { ...prochaine, enCours: false } : undefined;
}

export interface Coupe {
  nom: string;
  tours: { nom: string | null; matchs: Match[] }[];
}

/**
 * Matchs de coupe regroupés par coupe, puis par tour (ou tournoi), dans l'ordre chronologique.
 * Les coupes sont dans l'ordre de leur premier match.
 */
export function parCoupe(matchs: Match[]): Coupe[] {
  const coupes: Coupe[] = [];
  for (const m of [...matchs].filter((x) => x.coupe).sort(ordre)) {
    const nom = m.competition ?? 'Coupe';
    let coupe = coupes.find((c) => c.nom === nom);
    if (!coupe) {
      coupe = { nom, tours: [] };
      coupes.push(coupe);
    }
    let tour = coupe.tours.find((t) => t.nom === m.tour);
    if (!tour) {
      tour = { nom: m.tour, matchs: [] };
      coupe.tours.push(tour);
    }
    tour.matchs.push(m);
  }
  return coupes;
}

/**
 * Titre d'une semaine de matchs : « week-end du 21 au 22 novembre » si tous les matchs
 * sont le samedi ou le dimanche, sinon « semaine du 16 au 22 novembre ».
 */
export function libelleSemaine(semaine: Semaine): string {
  const samedi = ajouterJours(semaine.lundi, 5);
  const weekEnd = semaine.matchs.every((m) => m.jour >= samedi);
  return `${weekEnd ? 'week-end' : 'semaine'} ${intervalle(weekEnd ? samedi : semaine.lundi, semaine.dimanche)}`;
}

/** « du 21 au 22 novembre », « du 30 novembre au 1er décembre » */
function intervalle(debut: string, fin: string): string {
  const jour = (j: string) => (Number(j.slice(8, 10)) === 1 ? '1er' : String(Number(j.slice(8, 10))));
  const mois = (j: string) => new Date(`${j}T12:00:00Z`).toLocaleDateString('fr-FR', { month: 'long', timeZone: 'UTC' });
  return mois(debut) === mois(fin) ? `du ${jour(debut)} au ${jour(fin)} ${mois(fin)}` : `du ${jour(debut)} ${mois(debut)} au ${jour(fin)} ${mois(fin)}`;
}
