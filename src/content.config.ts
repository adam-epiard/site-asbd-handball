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
 * Un match saisi à la main. La date est l'heure de Paris, sans fuseau : 2026-11-21T20:30
 * (ou 2026-11-21 si l'horaire n'est pas connu). Sans score, le match est « à venir ».
 */
const matchManuel = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/, 'Format attendu : 2026-11-21T20:30'),
  adversaire: z.string().min(1),
  domicile: z.boolean().default(true),
  competition: z.string().min(1).optional(),
  scoreClub: z.number().int().nonnegative().optional(),
  scoreAdversaire: z.number().int().nonnegative().optional(),
});

const camp = z.object({
  nom: z.string(),
  club: z.boolean(),
  score: z.number().int().nullable(),
  scoreMT: z.number().int().nullable(),
});

/**
 * Matchs et classements récupérés sur le site de la FFHB, un fichier par équipe
 * (même nom que la fiche équipe). Écrits par scripts/ffhb-sync.mjs : ne pas modifier à la main.
 */
const resultats = defineCollection({
  loader: glob({ base: './src/data/resultats', pattern: '*.json' }),
  schema: z.object({
    majLe: z.iso.datetime(),
    poules: z.array(
      z.object({
        id: z.string(),
        nom: z.string(),
        /** Nom de la compétition : « U15F 85 », « COUPE DE VENDEE U15F 85 TROPHEE JP BART »... */
        competition: z.string().nullable().default(null),
        /** Phase (brassage, phase 2, tour de coupe) ; classement : false si la phase n'a pas de classement. */
        phase: z.object({ nom: z.string(), classement: z.boolean() }).nullable().default(null),
        source: z.url(),
        adresse: z.url(),
        equipe: z.string(),
        journees: z.array(z.object({ numero: z.number().int(), debut: z.string(), fin: z.string() })),
        classement: z.array(
          z.object({
            place: z.number().int().nullable(),
            equipe: z.string(),
            club: z.boolean(),
            points: z.number().int().nullable(),
            joues: z.number().int().nullable(),
            gagnes: z.number().int().nullable(),
            nuls: z.number().int().nullable(),
            perdus: z.number().int().nullable(),
            butsPour: z.number().int().nullable(),
            butsContre: z.number().int().nullable(),
            difference: z.number().int().nullable(),
          }),
        ),
        journeesLues: z.array(z.number().int()),
        rencontres: z.array(
          z.object({
            id: z.string(),
            journee: z.number().int().nullable(),
            date: z.string().nullable(),
            domicile: camp,
            exterieur: camp,
          }),
        ),
      }),
    ),
    /** Poules vérifiées sans le club, par adresse suivie : elles ne sont plus relues. */
    sansClub: z.record(z.string(), z.array(z.string())).default({}),
  }),
});

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
      /**
       * Matchs et classements récupérés sur le site de la FFHB (npm run sync).
       * competitions : adresses des compétitions de l'équipe (championnat, coupe, plateaux).
       * Toutes les poules où joue le club sont suivies : phase 1, phase 2, tours de coupe.
       * npm run ffhb:trouver liste les compétitions du club et leurs adresses.
       */
      ffhb: z
        .object({
          competitions: z.array(z.url()).min(1),
          /** Club FFHB de l'équipe, si ce n'est pas l'AS Bruffière (entente portée par un autre club). */
          structure: z.string().regex(/^\d+$/).optional(),
          /** Nom exact de l'équipe à la FFHB, si le club a deux équipes dans la même poule. */
          libelle: z.string().min(1).optional(),
        })
        .optional(),
      /** Matchs saisis à la main : tournois, plateaux, matchs absents du site de la FFHB. */
      matchs: z.array(matchManuel).default([]),
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
    /** Phrase d'accroche sous le titre, dans l'en-tête de la page. Vide : rien ne s'affiche. */
    intro: z.string().min(1).optional(),
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

/**
 * Photo d'en-tête des pages internes. L'id de chaque entrée est l'adresse de la page
 * (ex. "/histoire/"). Pas d'entrée : l'en-tête reste noir, avec le motif du terrain.
 */
const entetes = defineCollection({
  loader: file('src/content/entetes.json'),
  schema: ({ image }) =>
    z.object({
      photo: image(),
      /** Texte alternatif obligatoire : la photo est fournie avec sa description. */
      alt: z.string().min(1),
    }),
});

export const collections = { equipes, pages, membres, partenaires, resultats, entetes };
