/**
 * Lecture des pages de compétition du site de la FFHB (ffhandball.fr).
 *
 * Chaque page contient ses données en JSON, dans des balises
 * <smartfire-component name="..." attributes="{...}"> : on lit ce JSON
 * plutôt que le texte affiché, plus fragile.
 * Fonctions pures, sans réseau : testées par tests/ffhb.test.mjs.
 *
 * Attention : ce n'est pas une interface officielle. Si la FFHB change ses pages,
 * ces fonctions lèvent une erreur et la synchronisation garde les données précédentes.
 */

/** Décode les entités HTML d'un attribut (&quot; &amp; &#039; &#8211;...). */
export function decoderEntites(texte) {
  return texte.replace(/&(#x[0-9a-f]+|#\d+|quot|amp|apos|lt|gt);/gi, (_, code) => {
    const c = code.toLowerCase();
    if (c === 'quot') return '"';
    if (c === 'amp') return '&';
    if (c === 'apos') return "'";
    if (c === 'lt') return '<';
    if (c === 'gt') return '>';
    const n = c.startsWith('#x') ? parseInt(c.slice(2), 16) : parseInt(c.slice(1), 10);
    return String.fromCodePoint(n);
  });
}

/**
 * Données JSON des composants « competitions--- » d'une page, et de son en-tête (page-header).
 * @param {string} html
 * @returns {Record<string, any>} nom du composant → attributs
 */
export function extraireComposants(html) {
  const composants = {};
  const motif = /<smartfire-component\s+name=(['"])(competitions---[a-z0-9-]+|page-header)\1\s+attributes="([^"]*)"/g;
  for (const [, , nom, attributs] of html.matchAll(motif)) {
    if (nom in composants) continue;
    try {
      composants[nom] = JSON.parse(decoderEntites(attributs));
    } catch {
      throw new Error(`Composant ${nom} illisible (JSON invalide)`);
    }
  }
  return composants;
}

/** "26" → 26 ; null, "" ou texte → null. */
function nombre(valeur) {
  if (valeur === null || valeur === undefined || valeur === '') return null;
  const n = Number(valeur);
  return Number.isFinite(n) ? n : null;
}

function exiger(composants, nom) {
  const c = composants[nom];
  if (!c) throw new Error(`Composant ${nom} absent de la page`);
  return c;
}

/**
 * L'équipe du club dans la poule.
 * @param {any[]} equipes options du sélecteur d'équipes
 * @param {{ structure: string, libelle?: string }} club
 */
export function trouverEquipeClub(equipes, club) {
  const candidates = equipes.filter((e) => String(e.structureId) === String(club.structure));
  const choisie = club.libelle ? candidates.find((e) => e.libelle === club.libelle) : candidates[0];
  if (!choisie) throw new Error(`Équipe du club (structure ${club.structure}) introuvable dans la poule`);
  if (!club.libelle && candidates.length > 1) {
    throw new Error(
      `Plusieurs équipes du club dans la poule (${candidates.map((e) => e.libelle).join(', ')}) : préciser ffhb.libelle`,
    );
  }
  return { id: String(choisie.id), nom: choisie.libelle };
}

/** Rencontres d'une page, limitées à celles de l'équipe du club. */
export function lireRencontres(composants, idClub) {
  const liste = exiger(composants, 'competitions---rencontre-list');
  return (liste.rencontres ?? [])
    .filter((r) => String(r.equipe1Id) === idClub || String(r.equipe2Id) === idClub)
    .map((r) => ({
      id: String(r.id),
      journee: nombre(r.journeeNumero),
      date: r.date ?? null,
      domicile: {
        nom: r.equipe1Libelle,
        club: String(r.equipe1Id) === idClub,
        score: nombre(r.equipe1Score),
        scoreMT: nombre(r.equipe1ScoreMT),
      },
      exterieur: {
        nom: r.equipe2Libelle,
        club: String(r.equipe2Id) === idClub,
        score: nombre(r.equipe2Score),
        scoreMT: nombre(r.equipe2ScoreMT),
      },
    }));
}

/**
 * Lecture complète de la page principale d'une poule :
 * nom, journées (numéro et dates), classement, rencontres de la journée affichée.
 * @param {string} html
 * @param {{ structure: string, libelle?: string }} club
 */
export function lirePagePoule(html, club) {
  const composants = extraireComposants(html);
  const selecteur = exiger(composants, 'competitions---poule-selector');
  const poule = selecteur.selected_poule ?? exiger(composants, 'competitions---journee-selector').poule;
  if (!poule) throw new Error('Poule absente de la page');

  const equipe = trouverEquipeClub(selecteur.equipe_options ?? [], club);
  const journees = (typeof poule.journees === 'string' ? JSON.parse(poule.journees) : poule.journees ?? []).map((j) => ({
    numero: Number(j.journee_numero),
    debut: j.date_debut,
    fin: j.date_fin,
  }));

  const mini = composants['competitions---mini-classement-or-ads'];
  const classement = (mini?.classements ?? [])
    .map((l) => ({
      place: nombre(l.place),
      equipe: l.equipe_libelle,
      club: String(l.equipeId) === equipe.id,
      points: nombre(l.point),
      joues: nombre(l.joue),
      gagnes: nombre(l.gagne),
      nuls: nombre(l.nul),
      perdus: nombre(l.perdu),
      butsPour: nombre(l.butPlus),
      butsContre: nombre(l.butMoins),
      difference: nombre(l.diff),
    }))
    .sort((a, b) => (a.place ?? 99) - (b.place ?? 99));

  const phase = (selecteur.phases ?? []).find((p) => String(p.id) === String(poule.phaseId));

  return {
    id: String(poule.ext_pouleId),
    nom: poule.libelle,
    /** Nom de la compétition (en-tête de la page) : « U15F 85 », « COUPE DE VENDEE U15F 85... ». */
    competition: composants['page-header']?.title ?? null,
    /** Phase de la poule ; classement : false pour une phase sans classement. */
    phase: phase ? { nom: phase.libelle, classement: String(phase.classement) !== '0' } : null,
    equipe,
    journees,
    journeeAffichee: nombre(composants['competitions---journee-selector']?.selected_numero_journee),
    classement,
    rencontres: lireRencontres(composants, equipe.id),
  };
}

/** Adresse de la page d'une journée : …/poule-193573/journee-7/ */
export function adresseJournee(adressePoule, numero) {
  return `${adressePoule.replace(/\/+$/, '')}/journee-${numero}/`;
}

/** L'adresse désigne-t-elle une poule précise (…/poule-193573/) ? */
export function estAdressePoule(adresse) {
  return /\/poule-\d+\/?$/.test(adresse);
}

/** Adresse de la compétition, sans la poule : …/u12m-85-32674/ */
export function adresseCompetition(adresse) {
  return `${adresse.replace(/\/+$/, '').replace(/\/poule-\d+$/, '')}/`;
}

/**
 * Poules d'une compétition, dans l'ordre du site (phase 1, puis phase 2...).
 * debut : premier jour de la poule (AAAA-MM-JJ), ou null si ses journées ne sont pas encore fixées.
 * @returns {{ id: string, adresse: string, nom: string, debut: string | null }[]}
 */
export function listerPoules(composants, adresse) {
  const selecteur = exiger(composants, 'competitions---poule-selector');
  const base = adresseCompetition(adresse);
  return (selecteur.poules ?? []).map((p) => {
    let journees = [];
    try {
      journees = typeof p.journees === 'string' ? JSON.parse(p.journees) : (p.journees ?? []);
    } catch {
      // Dates illisibles : la poule sera vérifiée à chaque passage.
    }
    const debuts = journees.map((j) => j.date_debut).filter(Boolean).sort();
    return { id: String(p.ext_pouleId), adresse: `${base}poule-${p.ext_pouleId}/`, nom: p.libelle, debut: debuts[0] ?? null };
  });
}

/**
 * Partie d'adresse d'une compétition, comme sur le site de la FFHB :
 * « COUPE U12 M85 -  TROPHEE JP BART », 33804 → coupe-u12-m85-trophee-jp-bart-33804
 */
export function slugCompetition(libelle, id) {
  const slug = libelle
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${slug}-${id}`;
}

/** Toutes les journées de la poule sont terminées depuis plus de `delaiJours`. */
export function pouleTerminee(journees, maintenant, delaiJours = 7) {
  if (journees.length === 0) return false;
  const limite = maintenant.getTime() - delaiJours * 24 * 3600 * 1000;
  return journees.every((j) => new Date(`${j.fin}T23:59:59`).getTime() < limite);
}

/**
 * Journées à relire. Une journée terminée depuis plus de `delaiJours` et déjà lue
 * est reprise des données enregistrées : les scores ne bougent plus.
 * @param {{ numero: number, fin: string }[]} journees
 * @param {number[]} dejaLues journées présentes dans les données enregistrées
 * @param {Date} maintenant
 */
export function journeesARelire(journees, dejaLues, maintenant, delaiJours = 7) {
  const limite = maintenant.getTime() - delaiJours * 24 * 3600 * 1000;
  return journees
    .filter((j) => !dejaLues.includes(j.numero) || new Date(`${j.fin}T23:59:59`).getTime() > limite)
    .map((j) => j.numero);
}

/**
 * Données d'une poule à enregistrer : rencontres fraîches + rencontres reprises
 * des journées non relues, triées par date.
 * @param {{ source: string, adresse: string }} adresses adresse indiquée dans la fiche équipe, et poule trouvée
 * @param {ReturnType<typeof lirePagePoule>} page
 * @param {Map<number, any[]>} rencontresLues journée → rencontres lues à l'instant
 * @param {any | undefined} ancienne poule enregistrée précédemment (ignorée si c'est une autre poule)
 */
export function assemblerPoule({ source, adresse }, page, rencontresLues, ancienne) {
  if (ancienne && ancienne.id !== page.id) ancienne = undefined;
  const parJournee = new Map();
  for (const r of ancienne?.rencontres ?? []) {
    if (r.journee !== null) parJournee.set(r.journee, [...(parJournee.get(r.journee) ?? []), r]);
  }
  for (const [numero, rencontres] of rencontresLues) parJournee.set(numero, rencontres);

  const journeesLues = [...new Set([...(ancienne?.journeesLues ?? []), ...rencontresLues.keys()])]
    .filter((n) => page.journees.some((j) => j.numero === n))
    .sort((a, b) => a - b);

  const rencontres = [...parJournee.entries()]
    .filter(([numero]) => journeesLues.includes(numero))
    .flatMap(([, liste]) => liste)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));

  return {
    id: page.id,
    nom: page.nom,
    competition: page.competition,
    phase: page.phase,
    source,
    adresse,
    equipe: page.equipe.nom,
    journees: page.journees,
    classement: page.classement,
    journeesLues,
    rencontres,
  };
}
