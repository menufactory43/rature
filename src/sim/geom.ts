// Géométrie du cahier : points, segments, tracés.
import { hypot } from "./maths";

export interface V {
  x: number;
  y: number;
}

export const dist = (a: V, b: V) => hypot(a.x - b.x, a.y - b.y);

/** Distance d'un point à un segment [a, b]. */
export function pointSegDist(p: V, a: V, b: V): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  let t = l2 === 0 ? 0 : ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Distance d'un point au tracé le plus proche d'une ligne brisée. */
export function polylineDist(p: V, pts: V[]): number {
  if (pts.length === 1) return dist(p, pts[0]);
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) best = Math.min(best, pointSegDist(p, pts[i - 1], pts[i]));
  return best;
}

export function polylineLength(pts: V[]): number {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += dist(pts[i - 1], pts[i]);
  return l;
}

/** Aire (positive) d'un polygone, formule du lacet. */
export function polygonArea(pts: V[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    a += p.x * q.y - q.x * p.y;
  }
  return Math.abs(a) / 2;
}

export function pointInPolygon(p: V, poly: V[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Rééchantillonne une ligne brisée à pas régulier (garde le premier et le dernier point). */
export function resample(pts: V[], step: number): V[] {
  if (pts.length < 2) return pts.map((p) => ({ x: p.x, y: p.y }));
  const out: V[] = [{ x: pts[0].x, y: pts[0].y }];
  let reste = step;
  for (let i = 1; i < pts.length; i++) {
    let a = pts[i - 1];
    const b = pts[i];
    let seg = dist(a, b);
    while (seg >= reste) {
      const t = reste / seg;
      const n = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      out.push(n);
      a = n;
      seg -= reste;
      reste = step;
    }
    reste -= seg;
  }
  const last = pts[pts.length - 1];
  if (dist(out[out.length - 1], last) > step * 0.3) out.push({ x: last.x, y: last.y });
  return out;
}

/** Coupe une ligne brisée à une longueur donnée. */
export function truncate(pts: V[], maxLen: number): V[] {
  const out: V[] = pts.length ? [pts[0]] : [];
  let l = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = dist(pts[i - 1], pts[i]);
    if (l + d > maxLen) {
      const t = (maxLen - l) / d;
      out.push({ x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t });
      return out;
    }
    l += d;
    out.push(pts[i]);
  }
  return out;
}
