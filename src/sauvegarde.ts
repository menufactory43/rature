// Ce qui reste d'une page à l'autre : les meilleurs résultats, et si le tuto a été vu.

import { enregistrer as enregistrerProgression, sauvegarde } from "./progression";

export interface Resultat {
  vagues: number;
  note: number;
}

const lire = <T>(cle: string, defaut: T): T => {
  try {
    return JSON.parse(localStorage.getItem(cle) ?? "") as T;
  } catch {
    return defaut;
  }
};

/** La graine de la page du jour, la même pour tout le monde. */
export function grainePageDuJour(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function meilleur(cle: string): Resultat | null {
  return lire<Record<string, Resultat>>("rature.meilleurs", {})[cle] ?? null;
}

/** Enregistre un résultat ; renvoie vrai si c'est un record. */
export function enregistrer(cle: string, r: Resultat): boolean {
  const tous = lire<Record<string, Resultat>>("rature.meilleurs", {});
  const avant = tous[cle];
  const record = !avant || r.vagues > avant.vagues || (r.vagues === avant.vagues && r.note > avant.note);
  if (record) {
    tous[cle] = r;
    localStorage.setItem("rature.meilleurs", JSON.stringify(tous));
  }
  return record;
}

// Le tuto vu voyage avec la sauvegarde (iCloud) : un « appris » de plus
export const tutoVu = () => localStorage.getItem("rature.tuto") === "vu" || sauvegarde.appris.includes("tuto");
export function marquerTutoVu(): void {
  localStorage.setItem("rature.tuto", "vu");
  if (!sauvegarde.appris.includes("tuto")) {
    sauvegarde.appris.push("tuto");
    enregistrerProgression();
  }
}
