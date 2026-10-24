// La reconnaissance des symboles qui font apparaître les tours : l'algorithme « $1 Unistroke » (Wobbrock, Wilson, Li, 2007).
// Le tracé est rééchantillonné, tourné vers son angle caractéristique, mis à l'échelle et centré, puis comparé à des
// modèles ; le plus proche gagne s'il est assez proche.
import type { V } from "./geom";
import { polylineLength, resample } from "./geom";

export type Glyphe = "cercle" | "triangle" | "eclair" | "coche" | "spirale" | "etoile" | "coupe";

const N = 64;
const TAILLE = 250;
const DEMI_DIAGONALE = 0.5 * Math.sqrt(2 * TAILLE * TAILLE);
const ANGLE = (45 * Math.PI) / 180;
const PRECISION = (2 * Math.PI) / 180;
const PHI = 0.5 * (-1 + Math.sqrt(5));

const centre = (pts: V[]): V => ({ x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length });

function tourner(pts: V[], a: number): V[] {
  const c = centre(pts);
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  return pts.map((p) => ({ x: (p.x - c.x) * cos - (p.y - c.y) * sin + c.x, y: (p.x - c.x) * sin + (p.y - c.y) * cos + c.y }));
}

function echelle(pts: V[]): V[] {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
  }
  const w = Math.max(maxX - minX, 1e-6);
  const h = Math.max(maxY - minY, 1e-6);
  return pts.map((p) => ({ x: (p.x * TAILLE) / w, y: (p.y * TAILLE) / h }));
}

function centrer(pts: V[]): V[] {
  const c = centre(pts);
  return pts.map((p) => ({ x: p.x - c.x, y: p.y - c.y }));
}

function normaliser(trace: V[]): V[] {
  let pts = resample(trace, polylineLength(trace) / (N - 1));
  while (pts.length < N) pts.push({ ...pts[pts.length - 1] });
  pts = pts.slice(0, N);
  const c = centre(pts);
  pts = tourner(pts, -Math.atan2(c.y - pts[0].y, c.x - pts[0].x));
  return centrer(echelle(pts));
}

function distanceChemin(a: V[], b: V[]): number {
  let d = 0;
  for (let i = 0; i < a.length; i++) d += Math.hypot(a[i].x - b[i].x, a[i].y - b[i].y);
  return d / a.length;
}

function distanceAuMieux(pts: V[], modele: V[]): number {
  let a = -ANGLE;
  let b = ANGLE;
  let x1 = PHI * a + (1 - PHI) * b;
  let f1 = distanceChemin(tourner(pts, x1), modele);
  let x2 = (1 - PHI) * a + PHI * b;
  let f2 = distanceChemin(tourner(pts, x2), modele);
  while (Math.abs(b - a) > PRECISION) {
    if (f1 < f2) {
      b = x2; x2 = x1; f2 = f1;
      x1 = PHI * a + (1 - PHI) * b;
      f1 = distanceChemin(tourner(pts, x1), modele);
    } else {
      a = x1; x1 = x2; f1 = f2;
      x2 = (1 - PHI) * a + PHI * b;
      f2 = distanceChemin(tourner(pts, x2), modele);
    }
  }
  return Math.min(f1, f2);
}

// --- Les modèles, tracés en code ---

const arc = (n: number, f: (t: number) => V) => Array.from({ length: n + 1 }, (_, i) => f(i / n));
const lignes = (pts: [number, number][]) => {
  const out: V[] = [];
  for (let i = 1; i < pts.length; i++) for (let k = 0; k < 10; k++) out.push({ x: pts[i - 1][0] + ((pts[i][0] - pts[i - 1][0]) * k) / 10, y: pts[i - 1][1] + ((pts[i][1] - pts[i - 1][1]) * k) / 10 });
  out.push({ x: pts[pts.length - 1][0], y: pts[pts.length - 1][1] });
  return out;
};

/** Les formes de référence (à l'endroit) ; chacune sert dans les deux sens de tracé et avec plusieurs départs. */
export const FORMES: Record<Glyphe, V[][]> = {
  cercle: [0, 1, 2, 3].map((k) => arc(40, (t) => ({ x: Math.cos(t * Math.PI * 2 + (k * Math.PI) / 2), y: Math.sin(t * Math.PI * 2 + (k * Math.PI) / 2) }))),
  triangle: [
    lignes([[0, -1], [-0.9, 0.7], [0.9, 0.7], [0, -1]]),
    lignes([[-0.9, 0.7], [0.9, 0.7], [0, -1], [-0.9, 0.7]]),
    lignes([[0.9, 0.7], [0, -1], [-0.9, 0.7], [0.9, 0.7]]),
  ],
  eclair: [
    lignes([[0, 0], [1, 0], [0, 1], [1, 1]]),
    lignes([[0.6, 0], [0.15, 0.55], [0.85, 0.45], [0.4, 1]]),
  ],
  coche: [lignes([[0, 0.55], [0.35, 1], [1, 0]]), lignes([[0, 0.6], [0.3, 1], [1, -0.3]])],
  spirale: [
    arc(60, (t) => ({ x: Math.cos(t * Math.PI * 5) * (0.1 + t), y: Math.sin(t * Math.PI * 5) * (0.1 + t) })),
    arc(60, (t) => ({ x: Math.cos(t * Math.PI * 4) * (0.15 + t), y: Math.sin(t * Math.PI * 4) * (0.15 + t) })),
  ],
  etoile: [0, 1, 2, 3, 4].map((k) => lignes(Array.from({ length: 6 }, (_, i) => {
    const a = -Math.PI / 2 + (((i + k) * 2) % 5) * ((Math.PI * 2) / 5);
    return [Math.cos(a), Math.sin(a)] as [number, number];
  }))),
  coupe: [
    [...lignes([[0, 0], [0, 0.55]]), ...arc(20, (t) => ({ x: 0.5 - Math.cos(t * Math.PI) * 0.5, y: 0.55 + Math.sin(t * Math.PI) * 0.45 })), ...lignes([[1, 0.55], [1, 0]])],
    arc(30, (t) => ({ x: 0.5 - Math.cos(t * Math.PI) * 0.5, y: Math.sin(t * Math.PI) })),
  ],
};

interface Modele {
  glyphe: Glyphe;
  pts: V[];
}

const MODELES: Modele[] = [];
for (const [glyphe, formes] of Object.entries(FORMES) as [Glyphe, V[][]][]) {
  for (const f of formes) {
    MODELES.push({ glyphe, pts: normaliser(f) });
    MODELES.push({ glyphe, pts: normaliser([...f].reverse()) });
    // En miroir aussi : on trace un éclair ou une coche dans un sens ou dans l'autre
    if (glyphe === "eclair" || glyphe === "coche" || glyphe === "spirale") {
      const miroir = f.map((p) => ({ x: -p.x, y: p.y }));
      MODELES.push({ glyphe, pts: normaliser(miroir) });
      MODELES.push({ glyphe, pts: normaliser([...miroir].reverse()) });
    }
  }
}

export interface Reconnaissance {
  glyphe: Glyphe;
  /** De 0 (rien à voir) à 1 (parfait). */
  score: number;
  /** L'écart avec le second choix, pour écarter les tracés ambigus. */
  marge: number;
}

export function reconnaitre(trace: V[]): Reconnaissance | null {
  if (trace.length < 5 || polylineLength(trace) < 20) return null;
  const pts = normaliser(trace);
  const meilleurs = new Map<Glyphe, number>();
  for (const m of MODELES) {
    const d = distanceAuMieux(pts, m.pts);
    if (d < (meilleurs.get(m.glyphe) ?? Infinity)) meilleurs.set(m.glyphe, d);
  }
  const tri = [...meilleurs.entries()].sort((a, b) => a[1] - b[1]);
  const score = 1 - tri[0][1] / DEMI_DIAGONALE;
  const second = 1 - tri[1][1] / DEMI_DIAGONALE;
  return { glyphe: tri[0][0], score, marge: score - second };
}

/** Le dessin du symbole pour le pense-bête et les pages d'apprentissage (coordonnées dans [-1, 1]). */
export function modeleAffiche(g: Glyphe): V[] {
  const f = FORMES[g][0];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of f) {
    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
  }
  const s = 2 / Math.max(maxX - minX, maxY - minY);
  return f.map((p) => ({ x: (p.x - (minX + maxX) / 2) * s, y: (p.y - (minY + maxY) / 2) * s }));
}
