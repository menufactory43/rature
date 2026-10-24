// Les pouvoirs : un bouton pour s'armer, puis un geste sur la page. Gratuits, mais longs à recharger.

export type Pouvoir = "regle" | "lasso" | "gomme";

export interface FichePouvoir {
  nom: string;
  /** Secondes de recharge. */
  recharge: number;
  /** Ce qu'il faut dessiner, une fois armé. */
  consigne: string;
  conseil: string;
  /** La page à gagner pour l'avoir. */
  apres: string;
}

export const POUVOIRS: Record<Pouvoir, FichePouvoir> = {
  regle: {
    nom: "la règle", recharge: 35, apres: "1-1",
    consigne: "Trace une ligne droite : la règle s'abat dessus.",
    conseil: "Frappe et assomme tout ce qui se trouve sous la règle.",
  },
  lasso: {
    nom: "le lasso", recharge: 50, apres: "1-3",
    consigne: "Entoure des monstres : ils restent prisonniers.",
    conseil: "Les prisonniers ne bougent plus et prennent plus cher. Les boss s'échappent vite.",
  },
  gomme: {
    nom: "la gomme", recharge: 75, apres: "2-2",
    consigne: "Frotte une zone : la gomme efface ce qui s'y trouve.",
    conseil: "De gros dégâts sur une petite zone, et les boucliers partent avec.",
  },
};

export const TYPES_POUVOIRS = Object.keys(POUVOIRS) as Pouvoir[];

/** Longueur utile de la règle (px). */
export const LONGUEUR_REGLE = 300;
/** Demi-largeur de la règle (px). */
export const LARGEUR_REGLE = 16;
