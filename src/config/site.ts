/**
 * Réglages généraux du site.
 */

/** Vidéo de fond d'un bandeau (fichiers dans public/video/). */
export interface VideoBandeau {
  /** Vidéo pour grand écran (ex. /video/bandeau-720.mp4). */
  src: string;
  /** Version plus légère pour téléphone. */
  srcPetit?: string;
  /** Image fixe affichée avant la lecture, ou à la place de la vidéo. */
  poster: string;
}

interface ReglagesSite {
  nom: string;
  nomCourt: string;
  description: string;
  adresse: { rue: string; codePostal: string; ville: string };
  email: string;
  emailLicences: string;
  reseaux: { instagram: string; facebook: string };
  noindex: boolean;
  /** Vidéo du bandeau d'accueil ; absente = bandeau sur fond blanc. */
  videoAccueil?: VideoBandeau;
}

export const site: ReglagesSite = {
  nom: 'ASBD Vendée Handball',
  nomCourt: 'ASBD Handball',
  description:
    "Club de handball de La Bruffière, en Vendée : équipes, matchs, licences et contact.",
  adresse: {
    rue: '1 rue des Salles',
    codePostal: '85530',
    ville: 'La Bruffière',
  },
  /** Adresse de contact affichée sur le site. Vide = rien ne s'affiche. */
  email: 'communication@labruffierehandball.com',
  /** Adresse du club à la FFHB, pour les licences. */
  emailLicences: '6285014@ffhandball.net',
  reseaux: {
    instagram: 'https://www.instagram.com/asbd_handball/',
    facebook: 'https://www.facebook.com/asbdhandball',
  },
  /**
   * true tant que le site n'est en ligne que sur le sous-domaine de test :
   * les moteurs de recherche ne l'indexent pas.
   * À passer à false le jour de la bascule (voir README).
   */
  noindex: true,
  // Vidéo du club (IMG_2390 + 10 premières secondes de IMG_2391),
  // préparée comme indiqué dans le README.
  videoAccueil: {
    src: '/video/bandeau-720.mp4',
    srcPetit: '/video/bandeau-480.mp4',
    poster: '/video/bandeau.webp',
  },
};
