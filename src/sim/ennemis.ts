// Les monstres des marges. Chacun force un geste différent.

export type TypeEnnemi = "gribouille" | "carre" | "avion" | "araignee" | "tache" | "petite" | "gomme" | "mere" | "compas";

export interface FicheEnnemi {
  nom: string;
  pluriel: string;
  pv: number;
  vitesse: number;
  rayon: number;
  /** Dégâts à la tour quand il l'atteint (il s'y écrase). */
  degats: number;
  /** Dégâts par seconde contre un mur. */
  ronge: number;
  /** Coût dans le budget d'une vague. */
  cout: number;
  /** Première vague où il apparaît. */
  vague: number;
  /** Taille d'un groupe [min, max]. */
  groupe: [number, number];
  vole?: boolean;
  boss?: boolean;
  /** Une ligne pour la fiche « Comment jouer ». */
  conseil: string;
}

export const ENNEMIS: Record<TypeEnnemi, FicheEnnemi> = {
  gribouille: {
    nom: "gribouille", pluriel: "gribouilles", pv: 14, vitesse: 34, rayon: 10, degats: 6, ronge: 8, cout: 1, vague: 1, groupe: [4, 8],
    conseil: "Le tout-venant. Un mur le bloque, la tour s'en charge.",
  },
  carre: {
    nom: "carré", pluriel: "carrés", pv: 60, vitesse: 20, rayon: 14, degats: 15, ronge: 14, cout: 4, vague: 2, groupe: [1, 3],
    conseil: "Lent et solide. Fais-le attendre derrière un mur.",
  },
  avion: {
    nom: "avion en papier", pluriel: "avions en papier", pv: 10, vitesse: 70, rayon: 9, degats: 8, ronge: 0, cout: 2, vague: 3, groupe: [2, 5], vole: true,
    conseil: "Passe par-dessus les murs. Rature-le.",
  },
  araignee: {
    nom: "araignée", pluriel: "araignées", pv: 18, vitesse: 58, rayon: 10, degats: 7, ronge: 10, cout: 2, vague: 4, groupe: [3, 6],
    conseil: "Rapide et zigzague. La colle la calme.",
  },
  tache: {
    nom: "tache", pluriel: "taches", pv: 26, vitesse: 28, rayon: 12, degats: 8, ronge: 42, cout: 3, vague: 6, groupe: [1, 3],
    conseil: "Dissout les murs et se divise en mourant.",
  },
  petite: {
    nom: "petite tache", pluriel: "petites taches", pv: 8, vitesse: 40, rayon: 7, degats: 3, ronge: 16, cout: 1, vague: 99, groupe: [1, 1],
    conseil: "Ce qui reste d'une tache.",
  },
  gomme: {
    nom: "gomme", pluriel: "gommes", pv: 48, vitesse: 24, rayon: 13, degats: 12, ronge: 400, cout: 5, vague: 8, groupe: [1, 2],
    conseil: "Efface murs et colle sur son passage. Abats-la en premier.",
  },
  mere: {
    nom: "la Tache Mère", pluriel: "la Tache Mère", pv: 900, vitesse: 13, rayon: 32, degats: 60, ronge: 90, cout: 0, vague: 99, groupe: [1, 1], boss: true,
    conseil: "Boss de la vague 10. Sème des taches, éclate en six.",
  },
  compas: {
    nom: "l'Araignée-Compas", pluriel: "l'Araignée-Compas", pv: 1700, vitesse: 26, rayon: 28, degats: 80, ronge: 60, cout: 0, vague: 99, groupe: [1, 1], boss: true,
    conseil: "Boss de la vague 20. Zigzague et pond des araignées.",
  },
};

/** Multiplicateur de PV selon la vague. */
export const echellePv = (vague: number) => 1 + 0.16 * (vague - 1) + 0.012 * (vague - 1) ** 2;
