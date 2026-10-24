// Les améliorations, tirées à trois entre deux vagues. Elles ne valent que pour la page en cours : pas de progression idle.

export type IdAmelioration =
  | "appui" | "cadence" | "roquette" | "foudre" | "scie"
  | "encreEpaisse" | "encrier" | "plume" | "affutee" | "colle" | "reparation" | "econome";

export interface FicheAmelioration {
  nom: string;
  max: number;
  /** Description du niveau qu'on s'apprête à prendre (1 = premier). */
  texte: (niveau: number) => string;
  arme?: boolean;
}

export const AMELIORATIONS: Record<IdAmelioration, FicheAmelioration> = {
  appui: { nom: "Stylo appuyé", max: 5, texte: () => "+35 % de dégâts pour la tour" },
  cadence: { nom: "Poignet nerveux", max: 5, texte: () => "+30 % de cadence de tir" },
  roquette: { nom: "Roquettes", max: 3, arme: true, texte: (n) => (n === 1 ? "Une roquette explosive toutes les 3 s" : "Roquettes plus fortes, plus larges, plus souvent") },
  foudre: { nom: "Foudre en chaîne", max: 3, arme: true, texte: (n) => (n === 1 ? "Un éclair saute de monstre en monstre" : "+1 rebond, plus de dégâts") },
  scie: { nom: "Lame de scie", max: 3, arme: true, texte: (n) => (n === 1 ? "Une scie tourne autour de la tour" : "+1 lame, plus tranchante") },
  encreEpaisse: { nom: "Encre épaisse", max: 3, texte: () => "Murs +60 % de solidité" },
  encrier: { nom: "Grand encrier", max: 3, texte: () => "+35 d'encre maximum" },
  plume: { nom: "Plume rapide", max: 3, texte: () => "L'encre revient 35 % plus vite" },
  affutee: { nom: "Rature affûtée", max: 3, texte: () => "Ratures +50 % de dégâts" },
  colle: { nom: "Colle forte", max: 3, texte: () => "Colle plus lente, plus longue, et qui ronge" },
  reparation: { nom: "Correcteur", max: 5, texte: () => "Soigne 35 % de la tour, +15 PV max" },
  econome: { nom: "Trait économe", max: 3, texte: () => "Chaque geste coûte 15 % d'encre en moins" },
};

export const IDS_AMELIORATIONS = Object.keys(AMELIORATIONS) as IdAmelioration[];
