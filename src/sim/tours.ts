// Les tours : un symbole à dessiner, trois niveaux, puis deux spécialisations au choix.
import type { Glyphe } from "./glyphes";

export type TypeTour = "plume" | "roquette" | "foudre" | "correction" | "spirale" | "scie" | "encrier";

export interface Stats {
  degats: number;
  /** Secondes entre deux tirs. */
  intervalle: number;
  portee: number;
  /** Rayon d'explosion (roquettes). */
  zone?: number;
  /** Monstres traversés par un tir (plume perforante). */
  perce?: number;
  /** Rebonds de la foudre. */
  rebonds?: number;
  /** Étourdissement (s). */
  etourdit?: number;
  /** Ralentissement dans l'aura (spirale), de 0 à 1. */
  ralenti?: number;
  /** Englue (arrêt complet) toutes les 3 s pendant tant de secondes. */
  englue?: number;
  /** Dégâts par seconde dans l'aura ou au sol (napalm, acide). */
  dps?: number;
  /** Fraction d'armure retirée (acide). */
  rongeArmure?: number;
  lames?: number;
  orbite?: number;
  ignoreArmure?: boolean;
  /** Chance de critique ×4, et seuil d'exécution (fraction des PV). */
  critique?: number;
  execute?: number;
  /** Marque : dégâts subis +30 % pendant 4 s. */
  marque?: boolean;
  /** Encre par seconde (encrier). */
  encre?: number;
  /** Intérêts à chaque vague (fraction de l'encre, plafonnés à 60). */
  interets?: number;
  /** Prime bonus des monstres tués autour. */
  primeBonus?: number;
}

export interface Specialisation {
  nom: string;
  texte: string;
  cout: number;
  stats: Stats;
}

export interface FicheTour {
  nom: string;
  glyphe: Glyphe;
  role: string;
  /** Prix de pose, puis des niveaux 2 et 3. */
  couts: [number, number, number];
  niveaux: [Stats, Stats, Stats];
  specs: [Specialisation, Specialisation];
  /** Voit les furtifs de loin. */
  voitFurtifs?: boolean;
  /** Ne tire pas (aura, lames, encre). */
  passive?: boolean;
}

export const PORTEE_INFINIE = 2000;

export const TOURS: Record<TypeTour, FicheTour> = {
  plume: {
    nom: "Plume", glyphe: "cercle", role: "Tir rapide, une cible.", couts: [45, 40, 70],
    niveaux: [
      { degats: 6, intervalle: 0.55, portee: 110 },
      { degats: 9, intervalle: 0.5, portee: 120 },
      { degats: 13, intervalle: 0.45, portee: 130 },
    ],
    specs: [
      { nom: "Mitrailleuse", texte: "Cadence ×3.", cout: 150, stats: { degats: 9, intervalle: 0.15, portee: 130 } },
      { nom: "Perforante", texte: "Gros tirs qui traversent 4 monstres, plus de portée.", cout: 150, stats: { degats: 30, intervalle: 0.8, portee: 170, perce: 4 } },
    ],
  },
  roquette: {
    nom: "Roquettes", glyphe: "triangle", role: "Explosion de zone.", couts: [70, 60, 100],
    niveaux: [
      { degats: 14, intervalle: 1.6, portee: 120, zone: 30 },
      { degats: 22, intervalle: 1.6, portee: 125, zone: 34 },
      { degats: 34, intervalle: 1.5, portee: 130, zone: 38 },
    ],
    specs: [
      { nom: "Napalm", texte: "Le sol brûle 2,5 s après l'explosion.", cout: 200, stats: { degats: 34, intervalle: 1.5, portee: 130, zone: 38, dps: 22 } },
      { nom: "Obus", texte: "Explosion énorme, plus lente.", cout: 220, stats: { degats: 90, intervalle: 2.6, portee: 150, zone: 60 } },
    ],
  },
  foudre: {
    nom: "Foudre", glyphe: "eclair", role: "Saute de monstre en monstre.", couts: [80, 70, 110],
    niveaux: [
      { degats: 12, intervalle: 1.4, portee: 110, rebonds: 3 },
      { degats: 18, intervalle: 1.4, portee: 115, rebonds: 4 },
      { degats: 26, intervalle: 1.2, portee: 120, rebonds: 5 },
    ],
    specs: [
      { nom: "Orage", texte: "8 rebonds, plus souvent.", cout: 230, stats: { degats: 26, intervalle: 0.9, portee: 125, rebonds: 8 } },
      { nom: "Surtension", texte: "Plus fort, et étourdit 0,6 s.", cout: 230, stats: { degats: 40, intervalle: 1.2, portee: 120, rebonds: 5, etourdit: 0.6 } },
    ],
  },
  correction: {
    nom: "Correction", glyphe: "coche", role: "Portée infinie, gros dégâts, voit les furtifs.", couts: [90, 80, 130], voitFurtifs: true,
    niveaux: [
      { degats: 40, intervalle: 2.2, portee: PORTEE_INFINIE },
      { degats: 65, intervalle: 2.2, portee: PORTEE_INFINIE },
      { degats: 100, intervalle: 2.0, portee: PORTEE_INFINIE },
    ],
    specs: [
      { nom: "Stylo rouge", texte: "25 % de critiques ×4, achève sous 12 % de PV (pas les boss).", cout: 260, stats: { degats: 120, intervalle: 2.0, portee: PORTEE_INFINIE, critique: 0.25, execute: 0.12 } },
      { nom: "Tampon", texte: "Marque la cible : +30 % de dégâts subis 4 s, et l'étourdit.", cout: 240, stats: { degats: 100, intervalle: 1.8, portee: PORTEE_INFINIE, marque: true, etourdit: 0.3 } },
    ],
  },
  spirale: {
    nom: "Spirale", glyphe: "spirale", role: "Aura qui ralentit.", couts: [55, 50, 80], passive: true,
    niveaux: [
      { degats: 0, intervalle: 1, portee: 60, ralenti: 0.35 },
      { degats: 0, intervalle: 1, portee: 70, ralenti: 0.45 },
      { degats: 0, intervalle: 1, portee: 80, ralenti: 0.55 },
    ],
    specs: [
      { nom: "Glu", texte: "Ralentit plus, et englue tout 0,6 s toutes les 3 s.", cout: 170, stats: { degats: 0, intervalle: 1, portee: 85, ralenti: 0.65, englue: 0.6 } },
      { nom: "Acide", texte: "Ronge l'armure de moitié et brûle (18/s).", cout: 190, stats: { degats: 0, intervalle: 1, portee: 80, ralenti: 0.45, dps: 18, rongeArmure: 0.5 } },
    ],
  },
  scie: {
    nom: "Scie", glyphe: "etoile", role: "Des lames tournent autour d'elle.", couts: [65, 60, 90], passive: true,
    niveaux: [
      { degats: 0, intervalle: 1, portee: 46, lames: 2, orbite: 36, dps: 26 },
      { degats: 0, intervalle: 1, portee: 46, lames: 3, orbite: 36, dps: 34 },
      { degats: 0, intervalle: 1, portee: 50, lames: 3, orbite: 40, dps: 46 },
    ],
    specs: [
      { nom: "Tourbillon", texte: "6 lames sur une orbite bien plus large.", cout: 200, stats: { degats: 0, intervalle: 1, portee: 66, lames: 6, orbite: 56, dps: 40 } },
      { nom: "Broyeuse", texte: "Dégâts énormes, ignore l'armure.", cout: 220, stats: { degats: 0, intervalle: 1, portee: 50, lames: 3, orbite: 40, dps: 110, ignoreArmure: true } },
    ],
  },
  encrier: {
    nom: "Encrier", glyphe: "coupe", role: "Produit de l'encre.", couts: [75, 70, 110], passive: true,
    niveaux: [
      { degats: 0, intervalle: 1, portee: 0, encre: 1.2 },
      { degats: 0, intervalle: 1, portee: 0, encre: 2 },
      { degats: 0, intervalle: 1, portee: 0, encre: 3 },
    ],
    specs: [
      { nom: "Banque", texte: "Intérêts : +8 % de ton encre à chaque vague (60 maximum).", cout: 220, stats: { degats: 0, intervalle: 1, portee: 0, encre: 3, interets: 0.08 } },
      { nom: "Plume d'or", texte: "Les monstres tués à moins de 120 px rapportent +50 %.", cout: 200, stats: { degats: 0, intervalle: 1, portee: 120, encre: 3, primeBonus: 0.5 } },
    ],
  },
};

export const TYPES_TOURS = Object.keys(TOURS) as TypeTour[];
export const tourDuGlyphe = (g: Glyphe): TypeTour => TYPES_TOURS.find((t) => TOURS[t].glyphe === g)!;

/** Les stats d'une tour selon son niveau (1 à 3) et sa spécialisation (0 : aucune, 1 ou 2). */
export function statsTour(type: TypeTour, niveau: number, spec: number): Stats {
  const f = TOURS[type];
  return spec ? f.specs[spec - 1].stats : f.niveaux[Math.max(0, Math.min(2, niveau - 1))];
}

/** Le prix de l'étape suivante, ou null si la tour est au maximum. */
export function prochainCout(type: TypeTour, niveau: number, spec: number): number | null {
  if (spec) return null;
  if (niveau < 3) return TOURS[type].couts[niveau];
  return null;
}

export const RAYON_TOUR = 13;
export const pvTour = (niveau: number, spec: number) => 60 + 30 * (spec ? 4 : niveau);
