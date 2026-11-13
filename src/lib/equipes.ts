/**
 * Fonctions communes autour des équipes.
 */
import { getCollection, type CollectionEntry } from 'astro:content';

export type Equipe = CollectionEntry<'equipes'>;

const libellesCategorie = {
  feminine: 'Féminines',
  masculine: 'Masculines',
  mixte: 'Mixte',
} as const;

const ordreJours = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

/** Toutes les équipes, dans l'ordre d'affichage. */
export async function getEquipes(): Promise<Equipe[]> {
  const equipes = await getCollection('equipes');
  return equipes.sort((a, b) => a.data.ordre - b.data.ordre);
}

/** Adresse de la page d'une équipe, avec la barre finale. */
export function lienEquipe(equipe: Equipe): string {
  return `/${equipe.data.chemin}/`;
}

export function libelleCategorie(equipe: Equipe): string {
  return libellesCategorie[equipe.data.categorie];
}

/** Petite ligne d'information : niveau ou années de naissance. */
export function infoEquipe(equipe: Equipe): string | undefined {
  const { niveau, naissances } = equipe.data;
  if (niveau && naissances) return `${niveau} · nés en ${naissances}`;
  if (niveau) return niveau;
  if (naissances) return `Nés en ${naissances}`;
  return undefined;
}

/** Jour avec majuscule (mercredi → Mercredi). */
export function libelleJour(jour: string): string {
  return jour.charAt(0).toUpperCase() + jour.slice(1);
}

export function rangJour(jour: string): number {
  return ordreJours.indexOf(jour);
}
