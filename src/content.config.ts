/**
 * Schémas du contenu du site.
 *
 * Le contenu vit dans src/content/, à part du code : changer un effectif
 * ne demande de toucher qu'à un fichier JSON, jamais à un composant.
 * Une donnée obligatoire manquante fait échouer le build : rien n'est
 * déployé et la version en ligne ne change pas.
 */
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/** Une équipe : un fichier JSON par équipe dans src/content/equipes/. */
const equipes = defineCollection({
  loader: glob({ base: './src/content/equipes', pattern: '**/*.json' }),
  schema: ({ image }) =>
    z.object({
      nom: z.string().min(1),
      categorie: z.enum(['feminine', 'masculine', 'mixte']),
      niveau: z.string().min(1).optional(),
      /** Ordre d'affichage dans les listes (plus petit = plus haut). */
      ordre: z.number().int().default(100),
      photo: z
        .object({
          src: image(),
          /** Texte alternatif obligatoire dès qu'une photo est fournie. */
          alt: z.string().min(1),
        })
        .optional(),
      /**
       * Joueurs : laissé vide pour les équipes jeunes tant que le club
       * n'a pas confirmé l'accord des parents (voir dossier de cadrage).
       */
      joueurs: z
        .array(
          z.object({
            numero: z.number().int().positive().optional(),
            nom: z.string().min(1),
          }),
        )
        .default([]),
      coachs: z.array(z.string().min(1)).default([]),
      /** Identifiants des widgets Scorenco de l'équipe. */
      scorenco: z
        .object({
          matchs: z.string().min(1).optional(),
          classement: z.string().min(1).optional(),
        })
        .optional(),
      /** Page de l'équipe sur le site de la FFHB, lien de secours. */
      lienFfhb: z.url().optional(),
    }),
});

/** Pages de contenu en Markdown : histoire, licences, entraînement... */
const pages = defineCollection({
  loader: glob({ base: './src/content/pages', pattern: '**/*.md' }),
  schema: z.object({
    titre: z.string().min(1),
    /** Description unique, reprise dans la balise meta et les aperçus. */
    description: z.string().min(1).max(160),
  }),
});

export const collections = { equipes, pages };
