/**
 * Réglages généraux du site.
 */
export const site = {
  nom: 'ASBD Vendée Handball',
  nomCourt: 'ASBD Handball',
  description:
    "Club de handball de La Bruffière, en Vendée : équipes, matchs, licences et contact.",
  adresse: {
    rue: '1 rue des Salles',
    codePostal: '85530',
    ville: 'La Bruffière',
  },
  /** Laisser vide tant que l'adresse n'est pas confirmée : rien ne s'affiche. */
  email: '',
  reseaux: {
    instagram: '',
    facebook: '',
  },
  /**
   * true tant que le site n'est en ligne que sur le sous-domaine de test :
   * les moteurs de recherche ne l'indexent pas.
   * À passer à false le jour de la bascule (voir README).
   */
  noindex: true,
};
