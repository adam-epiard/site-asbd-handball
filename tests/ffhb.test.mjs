/**
 * Tests de la lecture des pages FFHB : node --test tests/
 * Les fichiers de tests/fixtures/ reprennent le format exact des pages de ffhandball.fr
 * (novembre 2026), réduit à quelques équipes.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  adresseJournee,
  assemblerPoule,
  decoderEntites,
  extraireComposants,
  journeesARelire,
  lirePagePoule,
  lireRencontres,
  trouverEquipeClub,
  estAdressePoule,
  adresseCompetition,
  listerPoules,
  slugCompetition,
  pouleTerminee,
} from '../scripts/ffhb/lire.mjs';
import { synchroniser } from '../scripts/ffhb/synchro.mjs';
import { baseSaison, equipeQuiSuit, trouverCompetitionsDuClub } from '../scripts/ffhb/trouver.mjs';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const fixture = (nom) => readFileSync(new URL(`./fixtures/${nom}`, import.meta.url), 'utf8');
const pagePoule = fixture('ffhb-poule.html');
const pageJournee7 = fixture('ffhb-journee-7.html');
const club = { structure: '1798' };

/** Un composant encodé comme sur le site de la FFHB (JSON puis entités HTML). */
function composant(nom, donnees) {
  const json = JSON.stringify(donnees).replaceAll('/', '\\/').replaceAll('&', '&amp;').replaceAll('"', '&quot;');
  return `<smartfire-component name='${nom}' attributes="${json}"></smartfire-component>`;
}

/** Poule de phase 1 terminée (brassage U12 M), avec un match du club. */
const pouleBrassage = {
  id: '50',
  ext_pouleId: '192722',
  phaseId: '7',
  libelle: 'U12M 85 PHASE 1 BRASSAGE POULE B',
  journees: JSON.stringify([{ journee_numero: 1, date_debut: '2026-09-19', date_fin: '2026-09-20' }]),
};
const pagePhase1 = [
  composant('page-header', { title: 'U12M 85' }),
  composant('competitions---poule-selector', {
    selected_poule: pouleBrassage,
    phases: [{ id: '7', libelle: 'U12M 85 PHASE 1 BRASSAGE', classement: '1' }],
    equipe_options: [
      { id: '5000', structureId: '1798', libelle: 'AS BRUFFIERE DEFONTAINE VHB' },
      { id: '5001', structureId: '1234', libelle: 'MONTAIGU VHB' },
    ],
  }),
  composant('competitions---journee-selector', { poule: pouleBrassage, selected_numero_journee: '1' }),
  composant('competitions---rencontre-list', {
    rencontres: [
      {
        id: '900', journeeNumero: '1', date: '2026-09-19T14:00:00+02:00',
        equipe1Id: '5000', equipe1Libelle: 'AS BRUFFIERE DEFONTAINE VHB', equipe1Score: '12', equipe1ScoreMT: '6',
        equipe2Id: '5001', equipe2Libelle: 'MONTAIGU VHB', equipe2Score: '9', equipe2ScoreMT: '5',
      },
    ],
  }),
  composant('competitions---mini-classement-or-ads', {
    classements: [{ equipeId: '5000', place: '1', point: '3', joue: '1', gagne: '1', nul: '0', perdu: '0', butPlus: '12', butMoins: '9', diff: '3', equipe_libelle: 'AS BRUFFIERE DEFONTAINE VHB' }],
  }),
].join('\n');

test('decoderEntites : entités nommées et numériques', () => {
  assert.equal(decoderEntites('{&quot;a&quot;:&quot;L&#039;&amp;&#8211;&#x41;&quot;}'), '{"a":"L\'&–A"}');
});

test('extraireComposants : composants competitions--- et en-tête de page', () => {
  const c = extraireComposants(pagePoule);
  assert.deepEqual(Object.keys(c).sort(), [
    'competitions---journee-selector',
    'competitions---mini-classement-or-ads',
    'competitions---poule-selector',
    'competitions---rencontre-list',
    'page-header',
  ]);
});

test('extraireComposants : JSON cassé → erreur explicite', () => {
  const html = `<smartfire-component name='competitions---rencontre-list' attributes="{&quot;oups">`;
  assert.throws(() => extraireComposants(html), /rencontre-list illisible/);
});

test('lirePagePoule : poule, équipe du club, journées, classement, rencontres', () => {
  const p = lirePagePoule(pagePoule, club);
  assert.equal(p.id, '193573');
  assert.equal(p.nom, 'D1FPL ; POULE C');
  assert.deepEqual(p.equipe, { id: '1818724', nom: 'AS BRUFFIERE' });
  assert.deepEqual(p.journees, [
    { numero: 5, debut: '2026-11-07', fin: '2026-11-08' },
    { numero: 6, debut: '2026-11-14', fin: '2026-11-15' },
    { numero: 7, debut: '2026-12-05', fin: '2026-12-06' },
  ]);
  assert.equal(p.journeeAffichee, 6);

  assert.equal(p.classement.length, 3);
  assert.deepEqual(p.classement[2], {
    place: 9,
    equipe: 'AS BRUFFIERE',
    club: true,
    points: 9,
    joues: 6,
    gagnes: 2,
    nuls: 0,
    perdus: 3,
    butsPour: 94,
    butsContre: 130,
    difference: -36,
  });
  assert.equal(p.classement[0].club, false);

  // Seule la rencontre du club est gardée, à l'extérieur ici.
  assert.equal(p.rencontres.length, 1);
  assert.deepEqual(p.rencontres[0], {
    id: '2',
    journee: 6,
    date: '2026-11-14T21:00:00+01:00',
    domicile: { nom: 'ASC LA MONTAGNE', club: false, score: 24, scoreMT: 16 },
    exterieur: { nom: 'AS BRUFFIERE', club: true, score: 26, scoreMT: 12 },
  });
});

test('lireRencontres : match à venir → scores null', () => {
  const r = lireRencontres(extraireComposants(pageJournee7), '1818724');
  assert.equal(r.length, 1);
  assert.equal(r[0].domicile.club, true);
  assert.equal(r[0].domicile.score, null);
  assert.equal(r[0].exterieur.scoreMT, null);
});

test('trouverEquipeClub : absente, ambiguë, ou précisée par le libellé', () => {
  const equipes = [
    { id: '1', structureId: '1798', libelle: 'AS BRUFFIERE 1' },
    { id: '2', structureId: '1798', libelle: 'AS BRUFFIERE 2' },
  ];
  assert.throws(() => trouverEquipeClub([], club), /introuvable/);
  assert.throws(() => trouverEquipeClub(equipes, club), /Plusieurs équipes/);
  assert.deepEqual(trouverEquipeClub(equipes, { structure: '1798', libelle: 'AS BRUFFIERE 2' }), {
    id: '2',
    nom: 'AS BRUFFIERE 2',
  });
});

test('lirePagePoule : page sans les composants attendus → erreur', () => {
  assert.throws(() => lirePagePoule('<html></html>', club), /poule-selector absent/);
});

test('adresseJournee', () => {
  assert.equal(adresseJournee('https://x.fr/poule-1/', 7), 'https://x.fr/poule-1/journee-7/');
  assert.equal(adresseJournee('https://x.fr/poule-1', 7), 'https://x.fr/poule-1/journee-7/');
});

test('journeesARelire : récentes, à venir et jamais lues', () => {
  const journees = [
    { numero: 5, fin: '2026-11-08' },
    { numero: 6, fin: '2026-11-15' },
    { numero: 7, fin: '2026-12-06' },
  ];
  const maintenant = new Date('2026-11-16T12:00:00+01:00');
  // J5 lue et terminée depuis plus de 7 jours : reprise. J6 récente, J7 à venir : relues.
  assert.deepEqual(journeesARelire(journees, [5, 6, 7], maintenant), [6, 7]);
  // Premier passage : tout est lu.
  assert.deepEqual(journeesARelire(journees, [], maintenant), [5, 6, 7]);
});

test('assemblerPoule : reprend les journées non relues, remplace les autres', () => {
  const page = lirePagePoule(pagePoule, club);
  const ancienne = {
    id: '193573',
    journeesLues: [5, 6, 7],
    rencontres: [
      { id: 'a', journee: 5, date: '2026-11-07T20:00:00+01:00' },
      { id: 'b', journee: 6, date: '2026-11-14T21:00:00+01:00', ancien: true },
      { id: 'z', journee: 4, date: '2026-10-10T20:00:00+01:00' },
    ],
  };
  const lues = new Map([
    [6, page.rencontres],
    [7, lireRencontres(extraireComposants(pageJournee7), page.equipe.id)],
  ]);
  const p = assemblerPoule({ source: 'https://x.fr/comp/', adresse: 'https://x.fr/poule-193573/' }, page, lues, ancienne);
  assert.deepEqual(
    p.rencontres.map((r) => r.id),
    ['a', '2', '3'],
  );
  // J4 n'existe plus dans la poule : retirée.
  assert.deepEqual(p.journeesLues, [5, 6, 7]);
  assert.equal(p.equipe, 'AS BRUFFIERE');
  assert.equal(p.adresse, 'https://x.fr/poule-193573/');
  assert.equal(p.source, 'https://x.fr/comp/');
  assert.equal(p.journees.length, 3);
});

test('assemblerPoule : données d\'une autre poule ignorées', () => {
  const page = lirePagePoule(pagePoule, club);
  const ancienne = { id: '999', journeesLues: [5], rencontres: [{ id: 'vieux', journee: 5, date: '2026-11-07' }] };
  const p = assemblerPoule({ source: 's', adresse: 'a' }, page, new Map([[6, page.rencontres]]), ancienne);
  assert.deepEqual(p.journeesLues, [6]);
  assert.deepEqual(p.rencontres.map((r) => r.id), ['2']);
});

test('adresses de poule et de compétition', () => {
  const comp = 'https://www.ffhandball.fr/competitions/saison-2026-2027-22/departemental/u12m-85-32674/';
  assert.equal(estAdressePoule(`${comp}poule-199621/`), true);
  assert.equal(estAdressePoule(comp), false);
  assert.equal(adresseCompetition(`${comp}poule-199621/`), comp);
  assert.equal(adresseCompetition(comp.slice(0, -1)), comp);
});

test('listerPoules : ordre du site, avec le premier jour de chaque poule', () => {
  const html = composant('competitions---poule-selector', {
    poules: [
      { ext_pouleId: '1', libelle: 'BRASSAGE A', journees: JSON.stringify([{ date_debut: '2026-09-26' }, { date_debut: '2026-09-19' }]) },
      { ext_pouleId: '2', libelle: 'DIVISION 1', journees: '[]' },
    ],
  });
  assert.deepEqual(listerPoules(extraireComposants(html), 'https://x.fr/comp/poule-1/'), [
    { id: '1', adresse: 'https://x.fr/comp/poule-1/', nom: 'BRASSAGE A', debut: '2026-09-19' },
    { id: '2', adresse: 'https://x.fr/comp/poule-2/', nom: 'DIVISION 1', debut: null },
  ]);
});

test('slugCompetition : comme les adresses du site de la FFHB', () => {
  assert.equal(slugCompetition('COUPE U12 M85 -  TROPHEE JP BART', '33804'), 'coupe-u12-m85-trophee-jp-bart-33804');
  assert.equal(slugCompetition('D1FPL ; DIVISION 1 FEMININE TERRITORIALE', '32321'), 'd1fpl-division-1-feminine-territoriale-32321');
  assert.equal(slugCompetition('PLATEAUX ECOLE DE HAND (U8)', '33450'), 'plateaux-ecole-de-hand-u8-33450');
  assert.equal(slugCompetition('Coupe Vendée Féminine', '1'), 'coupe-vendee-feminine-1');
});

test('pouleTerminee', () => {
  const maintenant = new Date('2026-11-16T12:00:00+01:00');
  assert.equal(pouleTerminee([{ fin: '2026-10-04' }, { fin: '2026-10-11' }], maintenant), true);
  assert.equal(pouleTerminee([{ fin: '2026-10-04' }, { fin: '2026-11-15' }], maintenant), false);
  assert.equal(pouleTerminee([], maintenant), false);
});

test('lirePagePoule : compétition (en-tête) et phase', () => {
  const p = lirePagePoule(pagePoule, club);
  assert.equal(p.competition, 'D1FPL ; DIVISION 1 FÉMININE');
  assert.equal(p.phase, null);
  const p1 = lirePagePoule(pagePhase1, club);
  assert.equal(p1.competition, 'U12M 85');
  assert.deepEqual(p1.phase, { nom: 'U12M 85 PHASE 1 BRASSAGE', classement: true });
});

// ---------- Synchronisation complète, avec un faux site FFHB ----------

const POULE = 'https://ffhb.test/comp/poule-193573/';
const COMPETITION = 'https://ffhb.test/comp/';
const journeeVide = composant('competitions---rencontre-list', { rencontres: [] });

function preparer(equipes) {
  const dossier = mkdtempSync(join(tmpdir(), 'ffhb-'));
  const dossierEquipes = join(dossier, 'equipes');
  const dossierResultats = join(dossier, 'resultats');
  mkdirSync(dossierEquipes);
  for (const [id, contenu] of Object.entries(equipes)) {
    writeFileSync(join(dossierEquipes, `${id}.json`), JSON.stringify(contenu));
  }
  return { dossier, dossierEquipes, dossierResultats };
}

/** Faux téléchargement : pages connues, sinon « HTTP 404 ». */
function fauxSite(pages) {
  const demandees = [];
  const telecharger = async (adresse) => {
    demandees.push(adresse);
    if (!(adresse in pages)) throw new Error(`HTTP 404 pour ${adresse}`);
    return pages[adresse];
  };
  return { telecharger, demandees };
}

const pagesNormales = {
  [POULE]: pagePoule,
  [`${POULE}journee-5/`]: journeeVide,
  [`${POULE}journee-7/`]: pageJournee7,
};
const options = (dossiers, site, extra = {}) => ({
  ...dossiers,
  telecharger: site.telecharger,
  maintenant: new Date('2026-11-16T12:00:00+01:00'),
  pauseMs: 0,
  avertir: () => {},
  journal: () => {},
  ...extra,
});

test('synchroniser : écrit les résultats, puis ne réécrit rien si rien ne change', async () => {
  const d = preparer({ 'seniors-f': { nom: 'Seniors F', ffhb: { competitions: [POULE] } }, loisirs: { nom: 'Loisirs' } });
  try {
    const site = fauxSite(pagesNormales);
    const r1 = await synchroniser(options(d, site));
    assert.deepEqual(r1.modifies, ['seniors-f']);
    assert.deepEqual(r1.avertissements, []);
    const donnees = JSON.parse(readFileSync(join(d.dossierResultats, 'seniors-f.json'), 'utf8'));
    assert.equal(donnees.majLe, '2026-11-16T11:00:00.000Z');
    assert.equal(donnees.poules[0].adresse, POULE);
    assert.deepEqual(donnees.poules[0].rencontres.map((r) => r.journee), [6, 7]);
    assert.equal(existsSync(join(d.dossierResultats, 'loisirs.json')), false);
    // La journée affichée sur la page principale (J6) n'est pas téléchargée une 2e fois.
    assert.equal(site.demandees.includes(`${POULE}journee-6/`), false);

    const r2 = await synchroniser(options(d, fauxSite(pagesNormales), { maintenant: new Date('2026-11-17T12:00:00+01:00') }));
    assert.deepEqual(r2.modifies, []);
  } finally {
    rmSync(d.dossier, { recursive: true, force: true });
  }
});

test('synchroniser : site FFHB indisponible → données gardées et avertissement', async () => {
  const d = preparer({ 'seniors-f': { nom: 'Seniors F', ffhb: { competitions: [POULE] } } });
  try {
    await synchroniser(options(d, fauxSite(pagesNormales)));
    const avant = readFileSync(join(d.dossierResultats, 'seniors-f.json'), 'utf8');
    const r = await synchroniser(options(d, fauxSite({})));
    assert.deepEqual(r.modifies, []);
    assert.equal(r.avertissements.length, 1);
    assert.match(r.avertissements[0], /Seniors F : .*Données précédentes conservées/);
    assert.equal(readFileSync(join(d.dossierResultats, 'seniors-f.json'), 'utf8'), avant);
  } finally {
    rmSync(d.dossier, { recursive: true, force: true });
  }
});

const autrePoule = composant('competitions---poule-selector', {
  selected_poule: { ext_pouleId: '1', libelle: 'AUTRE', journees: '[]' },
  equipe_options: [{ id: '9', structureId: '1234', libelle: 'AUTRE CLUB' }],
});
/** Compétition à deux phases : brassage (poule 192722, avec le club), puis D1 (poule 193573, avec le club), et une poule sans le club. */
const pageCompetition = composant('competitions---poule-selector', {
  poules: [
    { ext_pouleId: '192722', libelle: 'BRASSAGE B', journees: JSON.stringify([{ date_debut: '2026-09-19' }]) },
    { ext_pouleId: '1', libelle: 'AUTRE', journees: JSON.stringify([{ date_debut: '2026-11-07' }]) },
    { ext_pouleId: '193573', libelle: 'D1FPL ; POULE C', journees: JSON.stringify([{ date_debut: '2026-11-07' }]) },
  ],
});
const pagesCompetition = {
  ...pagesNormales,
  [COMPETITION]: pageCompetition,
  [`${COMPETITION}poule-1/`]: autrePoule,
  [`${COMPETITION}poule-192722/`]: pagePhase1,
};

test('synchroniser : adresse de compétition → toutes les poules du club (phase 1 et phase 2)', async () => {
  const d = preparer({ 'u12-m': { nom: 'U12 M', ffhb: { competitions: [COMPETITION] } } });
  try {
    const r = await synchroniser(options(d, fauxSite(pagesCompetition)));
    assert.deepEqual(r.modifies, ['u12-m']);
    assert.deepEqual(r.avertissements, []);
    const donnees = JSON.parse(readFileSync(join(d.dossierResultats, 'u12-m.json'), 'utf8'));
    assert.deepEqual(
      donnees.poules.map((p) => [p.id, p.source, p.phase?.nom ?? null]),
      [
        ['192722', COMPETITION, 'U12M 85 PHASE 1 BRASSAGE'],
        ['193573', COMPETITION, null],
      ],
    );
    assert.equal(donnees.poules[0].rencontres.length, 1);
    assert.deepEqual(donnees.sansClub, { [COMPETITION]: ['1'] });
  } finally {
    rmSync(d.dossier, { recursive: true, force: true });
  }
});

test('synchroniser : au passage suivant, poule terminée et poule sans le club ne sont pas relues', async () => {
  const d = preparer({ 'u12-m': { nom: 'U12 M', ffhb: { competitions: [COMPETITION] } } });
  try {
    await synchroniser(options(d, fauxSite(pagesCompetition)));
    const site = fauxSite(pagesCompetition);
    const r = await synchroniser(options(d, site, { maintenant: new Date('2026-11-17T12:00:00+01:00') }));
    assert.deepEqual(r.modifies, []);
    assert.equal(site.demandees.includes(`${COMPETITION}poule-192722/`), false); // phase 1 terminée
    assert.equal(site.demandees.includes(`${COMPETITION}poule-1/`), false); // sans le club, commencée
    assert.equal(site.demandees.includes(POULE), true); // phase en cours
  } finally {
    rmSync(d.dossier, { recursive: true, force: true });
  }
});

test('synchroniser : plusieurs compétitions pour une équipe (championnat et coupe)', async () => {
  const COUPE = 'https://ffhb.test/coupe/';
  const pageCoupe = composant('competitions---poule-selector', {
    poules: [{ ext_pouleId: '192722', libelle: 'TOUR 1', journees: JSON.stringify([{ date_debut: '2026-09-19' }]) }],
  });
  const d = preparer({ 'u12-m': { nom: 'U12 M', ffhb: { competitions: [POULE, COUPE] } } });
  try {
    const r = await synchroniser(options(d, fauxSite({ ...pagesNormales, [COUPE]: pageCoupe, [`${COUPE}poule-192722/`]: pagePhase1 })));
    assert.deepEqual(r.avertissements, []);
    const donnees = JSON.parse(readFileSync(join(d.dossierResultats, 'u12-m.json'), 'utf8'));
    assert.deepEqual(
      donnees.poules.map((p) => [p.source, p.adresse]),
      [
        [POULE, POULE],
        [COUPE, `${COUPE}poule-192722/`],
      ],
    );
  } finally {
    rmSync(d.dossier, { recursive: true, force: true });
  }
});

test('synchroniser : poule disparue (404) → cherchée dans la compétition, avec avertissement', async () => {
  const d = preparer({ 'u12-m': { nom: 'U12 M', ffhb: { competitions: ['https://ffhb.test/comp/poule-111/'] } } });
  try {
    const r = await synchroniser(options(d, fauxSite(pagesCompetition)));
    assert.deepEqual(r.modifies, ['u12-m']);
    assert.match(r.avertissements[0], /HTTP 404.*Poules utilisées : .*poule-192722\/, .*poule-193573\//);
  } finally {
    rmSync(d.dossier, { recursive: true, force: true });
  }
});

test('trouverCompetitionsDuClub : parcourt comité et ligue, garde les poules du club', async () => {
  const S = 'https://www.ffhandball.fr/competitions/saison-2026-2027-22/';
  const menu = (competitions) => composant('competitions---competition-main-menu', { competitions });
  const pages = {
    [`${S}departemental/o-comite-de-vendee-115/`]: menu([
      { libelle: 'U12M 85', ext_competitionId: '32674' },
      { libelle: 'D2M 85', ext_competitionId: '32668' },
    ]),
    [`${S}regional/o-ligue-des-pays-de-la-loire-19/`]: menu([]),
    [`${S}departemental/u12m-85-32674/`]: composant('competitions---poule-selector', { poules: [{ ext_pouleId: '192722', libelle: 'BRASSAGE B' }] }),
    [`${S}departemental/u12m-85-32674/poule-192722/`]: pagePhase1,
    [`${S}departemental/d2m-85-32668/`]: composant('competitions---poule-selector', { poules: [{ ext_pouleId: '1', libelle: 'AUTRE' }] }),
    [`${S}departemental/d2m-85-32668/poule-1/`]: autrePoule,
  };
  const r = await trouverCompetitionsDuClub({ telecharger: fauxSite(pages).telecharger, saison: S, structure: '1798', pauseMs: 0 });
  assert.deepEqual(r, [
    {
      competition: 'U12M 85',
      adresse: `${S}departemental/u12m-85-32674/`,
      poules: [{ nom: 'BRASSAGE B', adresse: `${S}departemental/u12m-85-32674/poule-192722/`, equipe: 'AS BRUFFIERE DEFONTAINE VHB' }],
    },
  ]);
  assert.equal(equipeQuiSuit([{ id: 'u12-m', poules: [`${S}departemental/u12m-85-32674/poule-200834/`] }], r[0].adresse), 'u12-m');
  assert.equal(baseSaison(`${S}departemental/u12m-85-32674/`), S);
});

test('synchroniser : équipe plus suivie → ses données sont supprimées', async () => {
  const d = preparer({ 'seniors-f': { nom: 'Seniors F' } });
  try {
    mkdirSync(d.dossierResultats);
    writeFileSync(join(d.dossierResultats, 'seniors-f.json'), '{"poules":[]}');
    const r = await synchroniser(options(d, fauxSite({})));
    assert.deepEqual(r.modifies, ['seniors-f']);
    assert.equal(existsSync(join(d.dossierResultats, 'seniors-f.json')), false);
  } finally {
    rmSync(d.dossier, { recursive: true, force: true });
  }
});
