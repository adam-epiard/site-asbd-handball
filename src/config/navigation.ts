/**
 * Menu principal.
 *
 * PROVISOIRE : les adresses seront alignées sur celles du WordPress actuel
 * à l'étape 3 (modèles), pour conserver toutes les URL existantes.
 * D'ici là, les pages qui n'existent pas encore mènent à la 404.
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
    label: 'Équipes',
    enfants: [
      { label: 'Équipes féminines', href: '/equipe-feminine/' },
      { label: 'Équipes masculines', href: '/equipe-masculine/' },
    ],
  },
  { label: 'Matchs', href: '/matchs/' },
  {
    label: 'Le club',
    enfants: [
      { label: 'Histoire', href: '/histoire/' },
      { label: 'Membres', href: '/membres/' },
      { label: 'Partenaires', href: '/partenaires/' },
      { label: 'Galerie', href: '/galerie/' },
    ],
  },
  { label: 'Licences', href: '/licences/' },
  { label: 'Entraînement', href: '/entrainement/' },
  { label: 'Boutique', href: '/boutique/' },
  { label: 'Contact', href: '/contact/' },
];
