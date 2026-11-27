/**
 * Tests des outils des pages internes (src/lib/pages-outils.ts) : node --test tests/*.test.mjs
 * Node lit le TypeScript directement (types effacés), sans compilation.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { minutesDebut, normaliserChemin, rubriqueDe } from '../src/lib/pages-outils.ts';
import { menu } from '../src/config/navigation.ts';

test('minutesDebut lit les formats du club', () => {
  assert.equal(minutesDebut('18h - 19h30'), 1080);
  assert.equal(minutesDebut('13h45 - 15h'), 825);
  assert.equal(minutesDebut('9h'), 540);
  assert.equal(minutesDebut('18h30-20h'), 1110);
  assert.equal(minutesDebut('18H30'), 1110);
  assert.equal(minutesDebut('horaire à venir'), Number.POSITIVE_INFINITY);
});

test('normaliserChemin ajoute les barres', () => {
  assert.equal(normaliserChemin('histoire'), '/histoire/');
  assert.equal(normaliserChemin('/histoire'), '/histoire/');
  assert.equal(normaliserChemin('/histoire/'), '/histoire/');
  assert.equal(normaliserChemin('/'), '/');
});

test('rubriqueDe trouve le groupe du menu', () => {
  assert.equal(rubriqueDe('/histoire/', menu), 'Le club');
  assert.equal(rubriqueDe('/equipe-feminine', menu), 'Nos équipes');
  assert.equal(rubriqueDe('/contact/', menu), undefined);
});
