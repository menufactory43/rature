// Ce qui reste d'une partie à l'autre : étoiles, défis, records, talents, dessins de la trousse. Tout dans le navigateur.
import { plugin } from "./natif";
import type { V } from "./sim/geom";
import { TALENTS_NEUTRES, type Talents } from "./sim/jeu";
import { PAGES, type Page } from "./sim/pages";
import type { TypeTour } from "./sim/tours";
import { TYPES_POUVOIRS, POUVOIRS, type Pouvoir } from "./sim/pouvoirs";

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
  /** Les monstres déjà présentés par leur post-it. */
  vus: string[];
  /** Le plus de vagues tenues à l'interro surprise. */
  interro: number;
  /** Les succès obtenus (les identifiants de Game Center). */
  succes: string[];
  /** Le dernier cartable emporté sur chaque page : les tours, et le pouvoir. */
  cartables: Record<string, { tours: TypeTour[]; pouvoir: Pouvoir | null }>;
  /** Les autocollants collés sur la couverture du cahier : où, et de travers comment. */
  couverture: Record<string, { x: number; y: number; r: number }>;
}

const CLE = "rature.sauvegarde.v2";

function vide(): Sauvegarde {
  return { etoiles: {}, defis: {}, sansFin: {}, talents: {}, apparences: {}, jour: {}, appris: [], vus: [], interro: 0, succes: [], cartables: {}, couverture: {} };
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
  const json = JSON.stringify(sauvegarde);
  try {
    localStorage.setItem(CLE, json);
  } catch {
    // Navigation privée pleine : tant pis, la partie continue
  }
  // Sur l'iPhone, une copie dans l'app et une dans iCloud : rien ne se perd, même en changeant de téléphone
  void plugin?.ecrire({ cle: "sauvegarde", valeur: json }).catch(() => {});
}

const lireJson = (s: string | null | undefined): Partial<Sauvegarde> | null => {
  if (!s) return null;
  try {
    return JSON.parse(s) as Partial<Sauvegarde>;
  } catch {
    return null;
  }
};

const plusDeVagues = (a?: { vagues: number; vies: number }, b?: { vagues: number; vies: number }) =>
  !a ? b : !b ? a : b.vagues > a.vagues || (b.vagues === a.vagues && b.vies > a.vies) ? b : a;

/** Deux sauvegardes en une : le meilleur de chacune (étoiles, records, ce qui a été vu). Les talents et les dessins
 * viennent de celle qui en a le plus, ou de la première. */
export function fusionner(a: Sauvegarde, bp: Partial<Sauvegarde>): Sauvegarde {
  const b = { ...vide(), ...bp };
  const max = (x: Record<string, number>, y: Record<string, number>) => {
    const r = { ...x };
    for (const [k, v] of Object.entries(y)) r[k] = Math.max(r[k] ?? 0, v);
    return r;
  };
  const jour = { ...a.jour };
  for (const [k, v] of Object.entries(b.jour)) jour[k] = plusDeVagues(jour[k], v)!;
  const points = (s: Sauvegarde) => Object.values(s.talents).reduce((t, n) => t + (n ?? 0), 0);
  return {
    etoiles: max(a.etoiles, b.etoiles),
    defis: Object.fromEntries([...Object.keys(a.defis), ...Object.keys(b.defis)].map((k) => [k, !!(a.defis[k] || b.defis[k])])),
    sansFin: max(a.sansFin, b.sansFin),
    talents: points(b) > points(a) ? { ...b.talents } : { ...a.talents },
    apparences: { ...b.apparences, ...a.apparences },
    jour,
    appris: [...new Set([...a.appris, ...b.appris])],
    vus: [...new Set([...a.vus, ...b.vus])],
    interro: Math.max(a.interro, b.interro),
    succes: [...new Set([...a.succes, ...b.succes])],
    cartables: { ...b.cartables, ...a.cartables },
    couverture: { ...b.couverture, ...a.couverture },
  };
}

/** Au démarrage de l'app iPhone : on réunit la sauvegarde du navigateur, celle de l'app et celle d'iCloud. */
export async function synchroniser(): Promise<void> {
  if (!plugin) return;
  const avant = JSON.stringify(sauvegarde);
  const r = await plugin.lire({ cle: "sauvegarde" }).catch(() => null);
  if (!r) return;
  for (const autre of [lireJson(r.local), lireJson(r.nuage)]) if (autre) sauvegarde = fusionner(sauvegarde, autre);
  if (JSON.stringify(sauvegarde) !== avant || r.nuage !== avant) enregistrer();
  // Un autre appareil a joué : on prend ce qu'il a gagné
  void plugin.addListener("nuage", (d) => {
    const autre = d.cle === "sauvegarde" ? lireJson(d.valeur) : null;
    if (!autre) return;
    const ancien = JSON.stringify(sauvegarde);
    sauvegarde = fusionner(sauvegarde, autre);
    if (JSON.stringify(sauvegarde) !== ancien) enregistrer();
  });
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

export const pouvoirsDebloques = (): Pouvoir[] => TYPES_POUVOIRS.filter((k) => pageGagnee(POUVOIRS[k].apres));

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
