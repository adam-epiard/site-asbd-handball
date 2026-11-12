// @ts-check
import { defineConfig, fontProviders } from 'astro/config';

// https://docs.astro.build/en/reference/configuration-reference/
export default defineConfig({
  // Adresse définitive du site : sert aux URL canoniques et au futur sitemap.
  site: 'https://labruffierehandball.com',

  // Une page = un dossier avec index.html (/matchs/index.html),
  // ce qui garde les adresses actuelles du WordPress avec la barre finale.
  trailingSlash: 'always',
  build: {
    format: 'directory',
  },

  // Astro 7 compresse le HTML façon JSX par défaut : les espaces entre
  // éléments en ligne peuvent disparaître. On garde l'ancien comportement.
  compressHTML: true,

  // Polices téléchargées au build et servies depuis le site (pas d'appel à Google
  // chez le visiteur, donc rien à déclarer côté RGPD).
  // https://docs.astro.build/en/guides/fonts/
  fonts: [
    {
      // Titres et chiffres : étroite et grasse, esprit tableau de score.
      name: 'Big Shoulders',
      cssVariable: '--font-titre',
      provider: fontProviders.fontsource(),
      weights: ['700 900'],
      styles: ['normal'],
      subsets: ['latin'],
      fallbacks: ['Arial Narrow', 'sans-serif'],
    },
    {
      // Texte courant : lisible et chaleureuse.
      name: 'Archivo',
      cssVariable: '--font-texte',
      provider: fontProviders.fontsource(),
      weights: ['400 700'],
      styles: ['normal', 'italic'],
      subsets: ['latin'],
      fallbacks: ['system-ui', 'sans-serif'],
    },
  ],
});
