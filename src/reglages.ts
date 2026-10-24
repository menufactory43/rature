// Les réglages du joueur, gardés dans le navigateur.

export interface Reglages {
  /** Volume de la musique, de 0 à 1. */
  musique: number;
  /** Volume des bruitages, de 0 à 1. */
  effets: number;
  vibrations: boolean;
  /** Les pouvoirs passent à gauche du bandeau, sous le pouce gauche. */
  gaucher: boolean;
  /** Moins de secousses, d'éclairs et de particules. */
  effetsReduits: boolean;
}

const CLE = "rature.reglages";

function charger(): Reglages {
  const defaut: Reglages = { musique: 0.6, effets: 0.9, vibrations: true, gaucher: false, effetsReduits: false };
  try {
    return { ...defaut, ...(JSON.parse(localStorage.getItem(CLE) ?? "") as Partial<Reglages>) };
  } catch {
    return defaut;
  }
}

export const reglages: Reglages = charger();
const abonnes: (() => void)[] = [];

/** Prévenu à chaque changement (le son ajuste ses volumes). */
export const surChangement = (f: () => void) => abonnes.push(f);

export function changer<K extends keyof Reglages>(k: K, v: Reglages[K]): void {
  reglages[k] = v;
  try {
    localStorage.setItem(CLE, JSON.stringify(reglages));
  } catch {
    // Navigation privée pleine : le réglage vaut pour cette session
  }
  for (const f of abonnes) f();
}
