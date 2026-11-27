/**
 * Outils purs des pages internes : tri des horaires et rubrique du menu.
 * Aucun import « astro:* », pour rester testable directement avec Node.
 */
import type { LienMenu } from '../config/navigation.ts';

/** Minutes depuis minuit de l'heure de début (« 18h - 19h30 » → 1080). Infini si illisible. */
export function minutesDebut(horaire: string): number {
  const m = /(\d{1,2})h(\d{2})?/i.exec(horaire);
  if (!m) return Number.POSITIVE_INFINITY;
  return Number(m[1]) * 60 + (m[2] ? Number(m[2]) : 0);
}

/** Chemin avec une barre au début et à la fin. */
export function normaliserChemin(chemin: string): string {
  let c = chemin;
  if (!c.startsWith('/')) c = '/' + c;
  if (!c.endsWith('/')) c += '/';
  return c;
}

/** Libellé du groupe de menu qui contient ce chemin, sinon undefined. */
export function rubriqueDe(chemin: string, menu: LienMenu[]): string | undefined {
  const cible = normaliserChemin(chemin);
  return menu.find((groupe) =>
    groupe.enfants?.some((e) => e.href !== undefined && normaliserChemin(e.href) === cible),
  )?.label;
}
