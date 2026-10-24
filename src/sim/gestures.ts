// Ce que devient un tracé, reconnu au lever du doigt :
//   petit symbole        → une TOUR de ce type (cercle, triangle, éclair, coche, spirale, étoile, coupe)
//   grand trait lent     → un MUR (la horde le ronge, ou le contourne)
//   trait sec et rapide  → une RATURE (frappe tout ce qu'elle touche)
//   grande boucle fermée → de la COLLE (ralentit tout ce qui est dedans)
import { dist, polygonArea, polylineLength, type V } from "./geom";
import { reconnaitre, type Glyphe } from "./glyphes";

export type Geste = "tour" | "mur" | "rature" | "cercle" | "rien";

export interface Pt extends V {
  /** Instant en millisecondes. */
  t: number;
}

export interface Classement {
  geste: Geste;
  glyphe?: Glyphe;
}

export const LONGUEUR_MIN = 16;
/** Un symbole tient dans ce carré (px). */
export const TAILLE_SYMBOLE = 85;
export const RATURE_DUREE_MAX = 260;
export const RATURE_VITESSE_MIN = 1.3;
export const SCORE_MIN = 0.75;

export function boite(pts: V[]): { x: number; y: number; w: number; h: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export function classer(pts: Pt[]): Classement {
  if (pts.length < 2) return { geste: "rien" };
  const l = polylineLength(pts);
  if (l < LONGUEUR_MIN) return { geste: "rien" };
  const b = boite(pts);
  const petit = Math.max(b.w, b.h) <= TAILLE_SYMBOLE;
  const droit = dist(pts[0], pts[pts.length - 1]) / l > 0.8;
  const duree = Math.max(1, pts[pts.length - 1].t - pts[0].t);
  // Un symbole se dessine : pas en un coup de poignet
  if (petit && !droit && l >= 45 && duree >= 180) {
    const r = reconnaitre(pts);
    if (r && r.score >= SCORE_MIN && r.marge >= 0.03) return { geste: "tour", glyphe: r.glyphe };
  }
  const ferme = dist(pts[0], pts[pts.length - 1]) < Math.max(28, l * 0.2);
  if (ferme && l >= 110 && polygonArea(pts) >= 1800) return { geste: "cercle" };
  if (duree <= RATURE_DUREE_MAX || l / duree >= RATURE_VITESSE_MIN) return { geste: "rature" };
  return { geste: "mur" };
}
