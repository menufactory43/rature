// Le champ de flux : depuis chaque case, la direction la moins coûteuse vers le Cœur.
// Une case libre coûte 1, un mur coûte le temps de le ronger, une tour coûte très cher, un obstacle est infranchissable.
import { CASE, COLS, LIGNES, caseDe, indice, type Carte } from "./carte";
import type { V } from "./geom";
import { hypot } from "./maths";

export const COUT_TOUR = 400;

export class Champ {
  readonly dist = new Float32Array(COLS * LIGNES);
  /** Surcoût par case (murs, tours), reconstruit avant chaque calcul. */
  readonly surcout = new Float32Array(COLS * LIGNES);

  constructor(readonly carte: Carte) {}

  calculer(): void {
    const { bloque, cafe, coeur } = this.carte;
    const dist = this.dist;
    dist.fill(Infinity);
    const tas = new Tas();
    // Les cases du Cœur (rayon 16 px)
    for (let l = 0; l < LIGNES; l++) {
      for (let c = 0; c < COLS; c++) {
        const x = (c + 0.5) * CASE;
        const y = (l + 0.5) * CASE;
        if (hypot(x - coeur.x, y - coeur.y) <= 16) {
          const i = indice(c, l);
          dist[i] = 0;
          tas.pousser(i, 0);
        }
      }
    }
    const voisins = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
    while (tas.taille) {
      const [i, d] = tas.extraire();
      if (d > dist[i]) continue;
      const c = i % COLS;
      const l = (i - c) / COLS;
      for (const [dc, dl, pas] of voisins) {
        const nc = c + dc;
        const nl = l + dl;
        if (nc < 0 || nl < 0 || nc >= COLS || nl >= LIGNES) continue;
        const j = indice(nc, nl);
        if (bloque[j]) continue;
        // Pas de diagonale qui rase un obstacle
        if (dc && dl && (bloque[indice(c + dc, l)] || bloque[indice(c, l + dl)])) continue;
        const nd = d + pas * (1 + (cafe[j] ? 0.6 : 0) + this.surcout[i] * 0.5 + this.surcout[j] * 0.5);
        if (nd < dist[j]) {
          dist[j] = nd;
          // La valeur rangée (arrondie en 32 bits), sinon la comparaison au dépilage la croit périmée
          tas.pousser(j, dist[j]);
        }
      }
    }
  }

  /** La distance au Cœur (en cases) depuis un point, pour classer les monstres « premier » ou « dernier ». */
  distance(p: V): number {
    const d = this.dist[caseDe(p.x, p.y)];
    return Number.isFinite(d) ? d : 1e6;
  }

  /** La direction à suivre depuis un point : vers la case voisine la plus proche du Cœur. */
  direction(p: V): V {
    const c0 = Math.floor(p.x / CASE);
    const l0 = Math.floor(p.y / CASE);
    // Hors de la page : on rentre par le bord le plus proche
    if (c0 < 0 || l0 < 0 || c0 >= COLS || l0 >= LIGNES) {
      const cible = { x: Math.max(CASE, Math.min(COLS * CASE - CASE, p.x)), y: Math.max(CASE, Math.min(LIGNES * CASE - CASE, p.y)) };
      const n = hypot(cible.x - p.x, cible.y - p.y) || 1;
      return { x: (cible.x - p.x) / n, y: (cible.y - p.y) / n };
    }
    const ici = this.dist[indice(c0, l0)];
    let best = ici;
    let bx = 0;
    let by = 0;
    for (let dl = -1; dl <= 1; dl++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (!dc && !dl) continue;
        const c = c0 + dc;
        const l = l0 + dl;
        if (c < 0 || l < 0 || c >= COLS || l >= LIGNES) continue;
        const d = this.dist[indice(c, l)];
        if (d < best) {
          best = d;
          bx = (c + 0.5) * CASE - p.x;
          by = (l + 0.5) * CASE - p.y;
        }
      }
    }
    if (best === ici || !Number.isFinite(best)) {
      // Déjà au plus bas (ou coincé) : droit vers le Cœur
      bx = this.carte.coeur.x - p.x;
      by = this.carte.coeur.y - p.y;
    }
    const n = hypot(bx, by) || 1;
    return { x: bx / n, y: by / n };
  }

  /** Le chemin qu'on suivrait depuis un point (pour le tracer au crayon). */
  trajet(depart: V, maxPas = 400): V[] {
    const pts: V[] = [{ ...depart }];
    let p = { ...depart };
    for (let k = 0; k < maxPas; k++) {
      const d = this.direction(p);
      p = { x: p.x + d.x * CASE, y: p.y + d.y * CASE };
      pts.push(p);
      if (hypot(p.x - this.carte.coeur.x, p.y - this.carte.coeur.y) < 14) break;
    }
    return pts;
  }
}

/** Un tas binaire minimal (file de priorité). */
class Tas {
  private i: number[] = [];
  private p: number[] = [];
  get taille() {
    return this.i.length;
  }
  pousser(i: number, p: number): void {
    this.i.push(i);
    this.p.push(p);
    let k = this.i.length - 1;
    while (k > 0) {
      const parent = (k - 1) >> 1;
      if (this.p[parent] <= this.p[k]) break;
      this.echanger(k, parent);
      k = parent;
    }
  }
  extraire(): [number, number] {
    const r: [number, number] = [this.i[0], this.p[0]];
    const di = this.i.pop()!;
    const dp = this.p.pop()!;
    if (this.i.length) {
      this.i[0] = di;
      this.p[0] = dp;
      let k = 0;
      for (;;) {
        const a = 2 * k + 1;
        const b = a + 1;
        let m = k;
        if (a < this.i.length && this.p[a] < this.p[m]) m = a;
        if (b < this.i.length && this.p[b] < this.p[m]) m = b;
        if (m === k) break;
        this.echanger(k, m);
        k = m;
      }
    }
    return r;
  }
  private echanger(a: number, b: number): void {
    [this.i[a], this.i[b]] = [this.i[b], this.i[a]];
    [this.p[a], this.p[b]] = [this.p[b], this.p[a]];
  }
}
