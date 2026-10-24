// Le changement d'écran, partagé par tous les écrans sans dépendance circulaire.
import type { Page } from "../sim/pages";

export type Ecran = "titre" | "aide" | "campagne" | "talents" | "trousse" | "partie";

export const nav = {
  ecran: "titre" as Ecran,
  aller(e: Ecran): void {
    nav.ecran = e;
  },
  /** Lance une page de la campagne (branché par main). */
  ouvrirPage: null as ((p: Page) => void) | null,
};
