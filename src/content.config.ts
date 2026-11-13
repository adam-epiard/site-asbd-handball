/**
 * Schémas du contenu du site.
 *
 * Le contenu vit dans src/content/, à part du code : changer un effectif
 * ne demande de toucher qu'à un fichier JSON, jamais à un composant.
 * Une donnée obligatoire manquante fait échouer le build : rien n'est
 * déployé et la version en ligne ne change pas.
 * Règle : un champ vide n'affiche rien. On laisse vide plutôt que d'écrire « en cours ».
 */
import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { z } from 'astro/zod';

/**
 * Intégration Scorenco. Deux formats existent chez Scorenco :
 * - widget récent : identifiant + type (team, ranking, week-events...)
 * - ancien widget en iframe : adresse complète
 */
const scorenco = z.union([
  z.object({ widget: z.string().regex(/^\d+$/), type: z.string().min(1) }),
  z.object({ iframe: z.url() }),
]);

const jours = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'] as const;

/** Une équipe : un fichier JSON par équipe dans src/content/equipes/. */
const equipes = defineCollection({
  loader: glob({ base: './src/content/equipes', pattern: '**/*.json' }),
  schema: ({ image }) =>
    z.object({
      nom: z.string().min(1),
      /** Adresse de la page, sans barre au début ni à la fin (ex. equipe-feminine/seniors-f). */
      chemin: z.string().regex(/^[a-z0-9_-]+(\/[a-z0-9_-]+)*$/),
      categorie: z.enum(['feminine', 'masculine', 'mixte']),
      /** Ordre d'affichage dans les listes (plus petit = plus haut). */
      ordre: z.number().int().default(100),
      niveau: z.string().min(1).optional(),
      /** Années de naissance, pour les jeunes (ex. 2016-17-18). */
      naissances: z.string().min(1).optional(),
      photo: z
        .object({
          src: image(),
          /** Texte alternatif obligatoire dès qu'une photo est fournie. */
          alt: z.string().min(1),
        })
        .optional(),
      /**
       * Afficher la liste des joueurs. false par défaut : pour les équipes jeunes,
       * seuls les coachs apparaissent tant que le club n'a pas l'accord des parents.
       */
      afficherJoueurs: z.boolean().default(false),
      joueurs: z
        .array(
          z.object({
            numero: z.number().int().nonnegative().optional(),
            nom: z.string().min(1),
          }),
        )
        .default([]),
      coachs: z.array(z.string().min(1)).default([]),
      entrainements: z
        .array(
          z.object({
            jour: z.enum(jours),
            horaire: z.string().min(1),
          }),
        )
        .default([]),
      scorenco: z
        .object({
          matchs: scorenco.optional(),
          classement: scorenco.optional(),
        })
        .default({}),
      /** Page de l'équipe sur le site de la FFHB, lien de secours. */
      lienFfhb: z.url().optional(),
    }),
});

/** Pages de contenu en Markdown : histoire, licences, mentions légales... */
const pages = defineCollection({
  loader: glob({ base: './src/content/pages', pattern: '**/*.md' }),
  schema: z.object({
    titre: z.string().min(1),
    /** Description unique, reprise dans la balise meta et les aperçus. */
    description: z.string().min(1).max(160),
  }),
});

/** Bureau et commissions du club. */
const membres = defineCollection({
  loader: file('src/content/membres.json'),
  schema: z.object({
    nom: z.string().min(1),
    role: z.string().min(1).optional(),
    groupe: z.enum(['bureau', 'commissions']),
    ordre: z.number().int().default(100),
  }),
});

/** Partenaires du club. Sans logo, le nom s'affiche. */
const partenaires = defineCollection({
  loader: file('src/content/partenaires.json'),
  schema: ({ image }) =>
    z.object({
      nom: z.string().min(1),
      logo: image().optional(),
      site: z.url().optional(),
      ordre: z.number().int().default(100),
    }),
});

export const collections = { equipes, pages, membres, partenaires };
