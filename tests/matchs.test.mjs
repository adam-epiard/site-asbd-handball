/**
 * Tests des outils de matchs (src/lib/matchs-outils.ts) : node --test tests/*.test.mjs
 * Node lit le TypeScript directement (types effacés), sans compilation.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  construire,
  dateParis,
  dernierResultat,
  estCoupe,
  jourParis,
  libelleHeure,
  libelleSemaine,
  lundiDe,
  matchsAVenir,
  matchsPasses,
  nomEquipe,
  ordre,
  parCoupe,
  parSemaine,
  prochainMatch,
  semaineAMontrer,
} from '../src/lib/matchs-outils.ts';

const equipe = { id: 'seniors-f', nom: 'Seniors F', lien: '/equipe-feminine/seniors-f/' };

/** Un match : jour AAAA-MM-JJ, heure HH:MM ou null, scores [club, adversaire] ou null. */
function match(jour, heure, scores = null, aDomicile = true) {
  const club = { nom: 'AS BRUFFIERE', club: true, score: scores?.[0] ?? null };
  const adversaire = { nom: 'TRIGNAC HB', club: false, score: scores?.[1] ?? null };
  return construire({
    id: `${jour}-${heure}`,
    equipe,
    date: heure ? dateParis(`${jour}T${heure}`) : null,
    jour,
    horaireInconnu: !heure,
    journee: 1,
    competition: 'D1FPL',
    coupe: false,
    tour: null,
    pouleId: null,
    domicile: aDomicile ? club : adversaire,
    exterieur: aDomicile ? adversaire : club,
  });
}

test('dateParis : heure d’hiver et heure d’été', () => {
  assert.equal(dateParis('2026-11-21T20:30').toISOString(), '2026-11-21T19:30:00.000Z');
  assert.equal(dateParis('2027-04-10T20:30').toISOString(), '2027-04-10T18:30:00.000Z');
  assert.equal(libelleHeure(dateParis('2026-11-21T20:30')), '20:30');
});

test('jourParis : un match à 23h30 à Paris reste le bon jour', () => {
  assert.equal(jourParis(new Date('2026-11-21T22:30:00Z')), '2026-11-21');
  assert.equal(jourParis(new Date('2026-11-21T23:30:00Z')), '2026-11-22');
});

test('lundiDe', () => {
  assert.equal(lundiDe('2026-11-21'), '2026-11-16'); // samedi
  assert.equal(lundiDe('2026-11-22'), '2026-11-16'); // dimanche
  assert.equal(lundiDe('2026-11-16'), '2026-11-16'); // lundi
});

test('nomEquipe : préfixes FFHB retirés, ASBD pour le club', () => {
  assert.equal(nomEquipe({ nom: 'U11F85 C.HAUT BOCAGE*PHB 1', club: false }), 'HAUT BOCAGE*PHB 1');
  assert.equal(nomEquipe({ nom: 'D1M 85 C.LES HERBIERS* SEVRE 1', club: false }), 'LES HERBIERS* SEVRE 1');
  assert.equal(nomEquipe({ nom: 'U15F85 E.LUCON*MAGNILS', club: false }), 'LUCON*MAGNILS');
  assert.equal(nomEquipe({ nom: 'HBAC STE PAZANNE', club: false }), 'HBAC STE PAZANNE');
  assert.equal(nomEquipe({ nom: 'HT BOCAGE*PHB', club: false }), 'HT BOCAGE*PHB');
  assert.equal(nomEquipe({ nom: 'AS BRUFFIERE DEFONTAINE VHB', club: true }), 'ASBD');
  assert.equal(nomEquipe({ nom: 'AS BRUFFIERE 2', club: true }), 'ASBD 2');
});

test('estCoupe', () => {
  assert.equal(estCoupe('COUPE DE VENDEE U15F 85 TROPHEE JP BART'), true);
  assert.equal(estCoupe('Coupe PDL'), true);
  assert.equal(estCoupe('U15F 85'), false);
  assert.equal(estCoupe('PLATEAUX ECOLE DE HAND (U8)'), false);
  assert.equal(estCoupe(null), false);
});

test('construire : résultat vu du club, à domicile ou à l’extérieur', () => {
  assert.equal(match('2026-11-14', '21:00', [26, 24], false).resultat, 'victoire');
  assert.equal(match('2026-11-14', '21:00', [26, 24], false).aDomicile, false);
  assert.equal(match('2026-11-14', '21:00', [20, 25]).resultat, 'defaite');
  assert.equal(match('2026-11-14', '21:00', [19, 19]).resultat, 'nul');
  assert.equal(match('2026-12-05', '20:30').resultat, null);
  assert.equal(match('2026-12-05', '20:30').joue, false);
});

test('prochainMatch, dernierResultat, à venir, passés', () => {
  const matchs = [
    match('2026-11-07', '20:00', [17, 25]),
    match('2026-11-14', '21:00', [26, 24]),
    match('2026-11-15', '15:00'), // passé, score jamais saisi
    match('2026-11-21', '20:30'),
    match('2027-01-09', null), // horaire pas encore fixé
  ].sort(ordre);
  const maintenant = new Date('2026-11-16T12:00:00+01:00');
  assert.equal(prochainMatch(matchs, maintenant).jour, '2026-11-21');
  assert.equal(dernierResultat(matchs).jour, '2026-11-14');
  assert.deepEqual(
    matchsAVenir(matchs, maintenant).map((m) => m.jour),
    ['2026-11-21', '2027-01-09'],
  );
  assert.deepEqual(
    matchsPasses(matchs, maintenant).map((m) => m.jour),
    ['2026-11-15', '2026-11-14', '2026-11-07'],
  );
  // Le jour du match, il est encore « à venir » tant que le score n'est pas connu.
  assert.equal(prochainMatch(matchs, new Date('2026-11-21T22:00:00+01:00')).jour, '2026-11-21');
});

test('parSemaine et semaineAMontrer', () => {
  const matchs = [match('2026-11-14', '21:00', [26, 24]), match('2026-11-21', '20:30'), match('2026-11-22', '15:00')];
  const semaines = parSemaine(matchs);
  assert.deepEqual(
    semaines.map((s) => [s.lundi, s.dimanche, s.matchs.length]),
    [
      ['2026-11-09', '2026-11-15', 1],
      ['2026-11-16', '2026-11-22', 2],
    ],
  );
  // Lundi 16 : la semaine en cours a des matchs.
  const enCours = semaineAMontrer(matchs, new Date('2026-11-16T09:00:00+01:00'));
  assert.equal(enCours.lundi, '2026-11-16');
  assert.equal(enCours.enCours, true);
  // Lundi 23 : rien cette semaine ni après → rien.
  assert.equal(semaineAMontrer(matchs, new Date('2026-11-23T09:00:00+01:00')), undefined);
  // Lundi 9 décembre sans match, prochain match plus tard : semaine suivante.
  const plusTard = semaineAMontrer([match('2026-12-19', '20:00')], new Date('2026-12-07T09:00:00+01:00'));
  assert.equal(plusTard.lundi, '2026-12-14');
  assert.equal(plusTard.enCours, false);
});

test('libelleSemaine : week-end ou semaine, changement de mois', () => {
  const [s1] = parSemaine([match('2026-11-21', '20:30'), match('2026-11-22', '15:00')]);
  assert.equal(libelleSemaine(s1), 'week-end du 21 au 22 novembre');
  const [s2] = parSemaine([match('2026-11-20', '20:30'), match('2026-11-21', '15:00')]);
  assert.equal(libelleSemaine(s2), 'semaine du 16 au 22 novembre');
  const [s3] = parSemaine([match('2027-05-30', '15:00')]);
  assert.equal(libelleSemaine(s3), 'week-end du 29 au 30 mai');
  const [s4] = parSemaine([match('2026-11-29', '15:00')]);
  assert.equal(libelleSemaine(s4), 'week-end du 28 au 29 novembre');
  const [s5] = parSemaine([match('2027-05-01', '15:00')]);
  assert.equal(libelleSemaine(s5), 'week-end du 1er au 2 mai');
  const [s6] = parSemaine([match('2026-10-31', '15:00')]);
  assert.equal(libelleSemaine(s6), 'week-end du 31 octobre au 1er novembre');
});

test('parCoupe : une entrée par coupe, puis par tour, dans l\'ordre des matchs', () => {
  const coupe = (jour, competition, tour, scores = null) => ({ ...match(jour, '15:00', scores), coupe: true, competition, tour });
  const matchs = [
    match('2026-11-14', '21:00', [26, 24]), // championnat : ignoré
    coupe('2026-12-12', 'COUPE DE VENDEE', 'TOUR 2'),
    coupe('2026-11-21', 'COUPE DE FRANCE DEP', '1ER TOUR', [20, 18]),
    coupe('2026-11-22', 'COUPE DE VENDEE', 'TOURNOI A LA FERRIERE'),
    coupe('2026-11-22', 'COUPE DE VENDEE', 'TOURNOI A LA FERRIERE'),
  ];
  const r = parCoupe(matchs);
  assert.deepEqual(
    r.map((c) => [c.nom, c.tours.map((t) => [t.nom, t.matchs.length])]),
    [
      ['COUPE DE FRANCE DEP', [['1ER TOUR', 1]]],
      ['COUPE DE VENDEE', [['TOURNOI A LA FERRIERE', 2], ['TOUR 2', 1]]],
    ],
  );
  assert.deepEqual(parCoupe([match('2026-11-14', '21:00')]), []);
});
