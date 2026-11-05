// @ts-check
import { defineConfig } from 'astro/config';

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
});
