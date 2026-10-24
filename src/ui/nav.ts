// Le changement d'écran, partagé par tous les écrans sans dépendance circulaire.
import type { Page } from "../sim/pages";

export type Ecran = "titre" | "aide" | "campagne" | "talents" | "trousse" | "partie" | "reglages";

export const nav = {
  ecran: "titre" as Ecran,
  aller(e: Ecran): void {
    nav.avantChangement?.();
    nav.ecran = e;
  },
  /** Appelé juste avant de changer d'écran (main y photographie la page pour la tourner). */
  avantChangement: null as (() => void) | null,
  /** Lance une page de la campagne (branché par main). */
  ouvrirPage: null as ((p: Page) => void) | null,
};
