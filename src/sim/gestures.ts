// Les trois gestes du stylo, reconnus au lever du doigt :
//   tracé lent         → un MUR (la horde bute dessus et le ronge)
//   trait sec et rapide → une RATURE (frappe tous les monstres qu'elle touche)
//   boucle refermée     → de la COLLE (ralentit tout ce qui est dedans)
import { dist, polygonArea, polylineLength, type V } from "./geom";

export type Geste = "mur" | "rature" | "cercle" | "rien";

export interface Pt extends V {
  /** Instant en millisecondes. */
  t: number;
}

export const LONGUEUR_MIN = 16;
/** Une rature dure moins que ça (ms)… */
export const RATURE_DUREE_MAX = 260;
/** …ou va plus vite que ça (px/ms). */
export const RATURE_VITESSE_MIN = 1.3;

export function classer(pts: Pt[]): Geste {
  if (pts.length < 2) return "rien";
  const l = polylineLength(pts);
  if (l < LONGUEUR_MIN) return "rien";
  const ferme = dist(pts[0], pts[pts.length - 1]) < Math.max(28, l * 0.2);
  if (ferme && l >= 110 && polygonArea(pts) >= 1800) return "cercle";
  const duree = Math.max(1, pts[pts.length - 1].t - pts[0].t);
  if (duree <= RATURE_DUREE_MAX || l / duree >= RATURE_VITESSE_MIN) return "rature";
  return "mur";
}
