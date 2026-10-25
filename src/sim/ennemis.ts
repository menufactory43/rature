// Les monstres des marges. Chacun exige une réponse différente.

export type TypeEnnemi =
  | "gribouille" | "carre" | "avion" | "araignee" | "tache" | "petite" | "gomme"
  | "postit" | "fantome" | "tippex" | "punaise"
  | "mere" | "compas" | "taille";

export interface FicheEnnemi {
  nom: string;
  pluriel: string;
  pv: number;
  vitesse: number;
  rayon: number;
  /** Vies retirées s'il atteint le Cœur. */
  vies: number;
  /** Dégâts par seconde contre un mur ou une tour qui lui barre la route. */
  ronge: number;
  /** Encre gagnée en le tuant. */
  prime: number;
  /** Coût dans le budget d'une vague (0 : n'apparaît pas seul). */
  cout: number;
  groupe: [number, number];
  /** Retire autant de dégâts à chaque coup (minimum 25 % du coup). */
  armure?: number;
  /** Absorbe autant de dégâts avant que les PV baissent. */
  bouclier?: number;
  vole?: boolean;
  /** Invisible pour les tours, sauf la Correction et les tours à moins de 50 px. */
  furtif?: boolean;
  /** Soigne les monstres autour (fraction des PV max par seconde). */
  soigne?: number;
  /** Va droit sur la tour la plus proche pour la ronger. */
  chasseur?: boolean;
  /** Dévore les tours qu'il frôle (dégâts par seconde). */
  devore?: number;
  efface?: boolean;
  boss?: boolean;
  conseil: string;
}

export const ENNEMIS: Record<TypeEnnemi, FicheEnnemi> = {
  gribouille: { nom: "lettre", pluriel: "lettres", pv: 16, vitesse: 34, rayon: 10, vies: 1, ronge: 8, prime: 3, cout: 1, groupe: [4, 8],
    conseil: "Le tout-venant : des minuscules qui trottinent en bande." },
  carre: { nom: "majuscule", pluriel: "majuscules", pv: 70, vitesse: 20, rayon: 14, vies: 2, ronge: 14, prime: 8, cout: 4, groupe: [1, 3], armure: 4,
    conseil: "Repassée dix fois : les petits coups glissent dessus. Il faut des gros dégâts." },
  avion: { nom: "avion de dictée", pluriel: "avions de dictée", pv: 14, vitesse: 62, rayon: 9, vies: 1, ronge: 0, prime: 4, cout: 2, groupe: [2, 5], vole: true,
    conseil: "Vole droit au Cœur, par-dessus tout. Rature-le." },
  araignee: { nom: "zède", pluriel: "zèdes", pv: 20, vitesse: 56, rayon: 10, vies: 1, ronge: 10, prime: 4, cout: 2, groupe: [3, 6],
    conseil: "Un z nerveux : rapide, il zigzague. La colle et la spirale le calment." },
  tache: { nom: "faute", pluriel: "fautes", pv: 30, vitesse: 28, rayon: 12, vies: 1, ronge: 42, prime: 6, cout: 3, groupe: [1, 3],
    conseil: "Ronge les murs. Raturée, elle éclate en lettres qui continuent seules." },
  petite: { nom: "lettre perdue", pluriel: "lettres perdues", pv: 9, vitesse: 40, rayon: 7, vies: 1, ronge: 16, prime: 1, cout: 0, groupe: [1, 1],
    conseil: "Ce qui reste d'une faute raturée." },
  gomme: { nom: "lettre gommée", pluriel: "lettres gommées", pv: 55, vitesse: 24, rayon: 13, vies: 2, ronge: 400, prime: 10, cout: 5, groupe: [1, 2], efface: true,
    conseil: "Efface murs et colle sur son passage." },
  postit: { nom: "parenthèse", pluriel: "parenthèses", pv: 30, vitesse: 30, rayon: 12, vies: 1, ronge: 10, prime: 8, cout: 3, groupe: [2, 4], bouclier: 60,
    conseil: "Sa parenthèse encaisse les premiers coups, comme un bouclier. Il faut de la cadence." },
  fantome: { nom: "h muet", pluriel: "h muets", pv: 26, vitesse: 38, rayon: 10, vies: 1, ronge: 8, prime: 7, cout: 3, groupe: [2, 4], furtif: true,
    conseil: "Furtif : seules la Correction et les tours toutes proches le voient. Une rature le révèle." },
  tippex: { nom: "plus", pluriel: "plus", pv: 45, vitesse: 26, rayon: 12, vies: 1, ronge: 8, prime: 10, cout: 4, groupe: [1, 2], soigne: 0.05,
    conseil: "Soigne les mots autour de lui. À rayer en premier." },
  punaise: { nom: "point d'exclamation", pluriel: "points d'exclamation", pv: 35, vitesse: 40, rayon: 9, vies: 1, ronge: 18, prime: 7, cout: 3, groupe: [2, 4], chasseur: true,
    conseil: "Fonce sur la tour la plus proche et la ronge. Protège tes tours avec des murs." },
  mere: { nom: "le Mot-Serpent", pluriel: "le Mot-Serpent", pv: 1400, vitesse: 13, rayon: 32, vies: 10, ronge: 90, prime: 150, cout: 0, groupe: [1, 1], armure: 2, boss: true,
    conseil: "Un mot à rallonge : sème des fautes en rampant et éclate en six." },
  compas: { nom: "l'Esperluette", pluriel: "l'Esperluette", pv: 2400, vitesse: 24, rayon: 28, vies: 10, ronge: 60, prime: 200, cout: 0, groupe: [1, 1], armure: 4, boss: true,
    conseil: "Zigzague et pond des zèdes." },
  taille: { nom: "l'Œ blindé", pluriel: "l'Œ blindé", pv: 3600, vitesse: 16, rayon: 30, vies: 12, ronge: 120, prime: 250, cout: 0, groupe: [1, 1], armure: 8, devore: 60, boss: true,
    conseil: "Lourdement blindé. Dévore les tours qu'il frôle." },
};

/** Multiplicateur de PV selon la vague. */
export const echellePv = (vague: number) => 1 + 0.09 * (vague - 1) + 0.004 * (vague - 1) ** 2;

export const TYPES_COURANTS: TypeEnnemi[] = ["gribouille", "carre", "avion", "araignee", "tache", "gomme", "postit", "fantome", "tippex", "punaise"];
