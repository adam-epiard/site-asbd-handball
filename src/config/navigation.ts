/**
 * Menu principal. Les adresses reprennent celles du site WordPress,
 * pour ne casser aucun lien existant (sauf les redirections du .htaccess).
 */
export interface LienMenu {
  label: string;
  /** Absent pour un groupe qui ne fait qu'ouvrir un sous-menu. */
  href?: string;
  enfants?: LienMenu[];
}

export const menu: LienMenu[] = [
  { label: 'Accueil', href: '/' },
  {
    label: 'Le club',
    enfants: [
      { label: 'Histoire', href: '/histoire/' },
      { label: 'Membres', href: '/membres/' },
      { label: 'Nos partenaires', href: '/nos-partenaires/' },
      { label: 'Galerie', href: '/galerie/' },
      { label: 'Boutique', href: '/boutique/' },
    ],
  },
  {
    label: 'Nos équipes',
    enfants: [
      { label: 'Équipes féminines', href: '/equipe-feminine/' },
      { label: 'Équipes masculines', href: '/equipe-masculine/' },
      { label: 'École de hand', href: '/ecole-de-hand/' },
      { label: 'Baby hand', href: '/baby-hand/' },
      { label: 'Loisirs', href: '/loisirs/' },
    ],
  },
  { label: 'Matchs', href: '/matchs/' },
  { label: 'Entraînements', href: '/entrainement/' },
  { label: 'Licences', href: '/licences/' },
  { label: 'Nous trouver', href: '/ou-nous-trouver/' },
  { label: 'Contact', href: '/contact/' },
];
