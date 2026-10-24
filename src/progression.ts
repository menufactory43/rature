// Ce qui reste d'une partie à l'autre : étoiles, défis, records, talents, dessins de la trousse. Tout dans le navigateur.
import type { V } from "./sim/geom";
import { TALENTS_NEUTRES, type Talents } from "./sim/jeu";
import { PAGES, type Page } from "./sim/pages";
import type { TypeTour } from "./sim/tours";

export type IdTalent = "encre" | "regen" | "murs" | "ratures" | "colle" | "rabais" | "vies" | "primes";

export interface FicheTalent {
  nom: string;
  texte: string;
  max: number;
  appliquer: (t: Talents, n: number) => void;
}

export const TALENTS: Record<IdTalent, FicheTalent> = {
  encre: { nom: "Trousse pleine", texte: "+25 d'encre au départ", max: 3, appliquer: (t, n) => (t.encreDepart += 25 * n) },
  regen: { nom: "Plume agile", texte: "+10 % d'encre qui revient", max: 3, appliquer: (t, n) => (t.regen *= 1 + 0.1 * n) },
  murs: { nom: "Encre épaisse", texte: "Murs +20 % plus solides", max: 3, appliquer: (t, n) => (t.murPv *= 1 + 0.2 * n) },
  ratures: { nom: "Coup de poignet", texte: "Ratures +20 % de dégâts", max: 3, appliquer: (t, n) => (t.ratureDegats *= 1 + 0.2 * n) },
  colle: { nom: "Colle forte", texte: "Colle +25 % plus longue", max: 2, appliquer: (t, n) => (t.colleDuree *= 1 + 0.25 * n) },
  rabais: { nom: "Fournitures", texte: "Tours 4 % moins chères", max: 3, appliquer: (t, n) => (t.coutTours *= 1 - 0.04 * n) },
  vies: { nom: "Cœur solide", texte: "+2 vies", max: 2, appliquer: (t, n) => (t.vies += 2 * n) },
  primes: { nom: "Bons points", texte: "Primes +8 %", max: 3, appliquer: (t, n) => (t.primes *= 1 + 0.08 * n) },
};
export const IDS_TALENTS = Object.keys(TALENTS) as IdTalent[];

export interface Sauvegarde {
  etoiles: Record<string, number>;
  defis: Record<string, boolean>;
  sansFin: Record<string, number>;
  talents: Partial<Record<IdTalent, number>>;
  apparences: Partial<Record<TypeTour, V[][]>>;
  jour: Record<string, { vagues: number; vies: number }>;
  /** Les tours dont on a vu la page d'apprentissage. */
  appris: string[];
}

const CLE = "rature.sauvegarde.v2";

function vide(): Sauvegarde {
  return { etoiles: {}, defis: {}, sansFin: {}, talents: {}, apparences: {}, jour: {}, appris: [] };
}

export let sauvegarde: Sauvegarde = charger();

function charger(): Sauvegarde {
  try {
    return { ...vide(), ...(JSON.parse(localStorage.getItem(CLE) ?? "") as Sauvegarde) };
  } catch {
    return vide();
  }
}

export function enregistrer(): void {
  try {
    localStorage.setItem(CLE, JSON.stringify(sauvegarde));
  } catch {
    // Navigation privée pleine : tant pis, la partie continue
  }
}

/** Pour les tests de bout en bout : repartir de zéro. */
export function effacer(): void {
  sauvegarde = vide();
  enregistrer();
}

// --- La campagne ---

export const pageGagnee = (id: string) => (sauvegarde.etoiles[id] ?? 0) > 0;

/** Une page est ouverte si c'est la première, ou si la précédente est gagnée. */
export function pageOuverte(p: Page): boolean {
  const i = PAGES.indexOf(p);
  return i <= 0 || pageGagnee(PAGES[i - 1].id);
}

export function toursDebloquees(): TypeTour[] {
  const t: TypeTour[] = ["plume"];
  for (const p of PAGES) if (pageGagnee(p.id) && p.debloque && p.debloque !== "colle") t.push(p.debloque);
  return t;
}

export const colleDebloquee = () => PAGES.some((p) => p.debloque === "colle" && pageGagnee(p.id));

export function noterPage(id: string, etoiles: number): boolean {
  const avant = sauvegarde.etoiles[id] ?? 0;
  if (etoiles > avant) {
    sauvegarde.etoiles[id] = etoiles;
    enregistrer();
    return true;
  }
  return false;
}

// --- Les talents ---

export const totalEtoiles = () => Object.values(sauvegarde.etoiles).reduce((s, n) => s + n, 0) + Object.values(sauvegarde.defis).filter(Boolean).length;
export const pointsDepenses = () => IDS_TALENTS.reduce((s, id) => s + (sauvegarde.talents[id] ?? 0), 0);
export const pointsLibres = () => totalEtoiles() - pointsDepenses();

export function talentsActifs(): Talents {
  const t = { ...TALENTS_NEUTRES };
  for (const id of IDS_TALENTS) {
    const n = sauvegarde.talents[id] ?? 0;
    if (n) TALENTS[id].appliquer(t, n);
  }
  return t;
}
