// L'encre qui a coulé sur la page : des flaques calculées au pixel près. Les gouttes voisines se fondent en une seule
// flaque aux bords lisses (comme des métaballes), l'encre s'accumule et fonce au bord en séchant, l'intérieur est
// marbré, une fine bavure gagne les fibres du papier autour, et le bord bombé de l'encre encore humide accroche la
// lumière de la lampe. Calculé une fois (le décor de la page est mis en cache), ou une fois par variante (les éclats).
import { hash3 } from "../sim/rng";

/** Une goutte : son centre et son rayon visible, en unités de la page. */
export interface Goutte {
  x: number;
  y: number;
  r: number;
}

export interface Teinte {
  /** Le cœur de la flaque, plus clair. */
  coeur: [number, number, number];
  /** Le bord, où l'encre s'est accumulée. */
  bord: [number, number, number];
  opacite: number;
  /** Le reflet humide (0 : encre sèche). */
  brillance: number;
}

export const ENCRE_BLEUE: Teinte = { coeur: [58, 78, 168], bord: [16, 22, 70], opacite: 0.8, brillance: 0.55 };
export const ENCRE_ROUGE: Teinte = { coeur: [214, 78, 66], bord: [128, 20, 20], opacite: 0.72, brillance: 0.25 };

const SEUIL = 0.5;
/** Rayon d'influence d'une goutte pour un rayon visible r (le seuil tombe à 0,54 du rayon d'influence). */
const INFLUENCE = 1 / Math.sqrt(1 - Math.sqrt(SEUIL));

/** Un bruit doux (valeurs interpolées sur une grille), pour marbrer et froisser les bords. */
function bruit(x: number, y: number, g: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash3(xi, yi, g);
  const b = hash3(xi + 1, yi, g);
  const c = hash3(xi, yi + 1, g);
  const d = hash3(xi + 1, yi + 1, g);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

const lisse = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Peint des gouttes d'encre en une flaque. `s` : pixels par unité de page. Renvoie l'image et l'endroit où la poser
 * (en unités de page), ou null s'il n'y a rien.
 */
export function flaque(gouttes: Goutte[], s: number, t: Teinte, graine = 1): { image: HTMLCanvasElement; x: number; y: number; w: number; h: number } | null {
  if (!gouttes.length) return null;
  const marge = 6;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const g of gouttes) {
    const R = g.r * INFLUENCE;
    x0 = Math.min(x0, g.x - R - marge);
    y0 = Math.min(y0, g.y - R - marge);
    x1 = Math.max(x1, g.x + R + marge);
    y1 = Math.max(y1, g.y + R + marge);
  }
  const w = Math.ceil((x1 - x0) * s);
  const h = Math.ceil((y1 - y0) * s);
  const champ = new Float32Array(w * h);
  // Le champ : chaque goutte y verse (1 − d²/R²)², les flaques voisines se rejoignent là où leurs champs s'ajoutent
  for (const g of gouttes) {
    const R = g.r * INFLUENCE * s;
    const cx = (g.x - x0) * s;
    const cy = (g.y - y0) * s;
    const ax = Math.max(0, Math.floor(cx - R));
    const bx = Math.min(w - 1, Math.ceil(cx + R));
    const ay = Math.max(0, Math.floor(cy - R));
    const by = Math.min(h - 1, Math.ceil(cy + R));
    const r2 = R * R;
    for (let py = ay; py <= by; py++) {
      const dy = py - cy;
      for (let px = ax; px <= bx; px++) {
        const dx = px - cx;
        const q = (dx * dx + dy * dy) / r2;
        if (q < 1) champ[py * w + px] += (1 - q) * (1 - q);
      }
    }
  }
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(w, h);
  const d = img.data;
  const pas = 1 / s;
  // La pente du champ donne la forme bombée du bord : la lampe est en haut à gauche
  const val = (px: number, py: number) => champ[Math.min(h - 1, Math.max(0, py)) * w + Math.min(w - 1, Math.max(0, px))];
  for (let py = 0; py < h; py++) {
    const uy = y0 + py * pas;
    for (let px = 0; px < w; px++) {
      const ux = x0 + px * pas;
      const brut = champ[py * w + px];
      if (brut < 0.18) continue;
      // Le bord se froisse un peu : un bruit lent qui déplace le seuil
      const v = brut + (bruit(ux * 0.22, uy * 0.22, graine) - 0.5) * 0.22 + (bruit(ux * 0.9, uy * 0.9, graine + 3) - 0.5) * 0.06;
      const i = (py * w + px) * 4;
      if (v >= SEUIL - 0.02) {
        const prof = Math.min(1, (v - SEUIL) / 0.55);
        // L'encre fonce au bord (elle s'y accumule en séchant : un liseré net), avec une seconde auréole plus loin,
        // et le cœur est marbré à grande échelle, comme une encre qui a séché inégalement
        const bord = 1 - lisse(0.02, 0.14, prof);
        const aureole = Math.exp(-(((prof - 0.32) / 0.05) ** 2)) * 0.35;
        const marbre = (bruit(ux * 0.09, uy * 0.09, graine + 7) - 0.5) * 0.8 + (bruit(ux * 0.3, uy * 0.3, graine + 9) - 0.5) * 0.25;
        const k = Math.min(1, Math.max(0, bord * 0.95 + aureole + marbre * 0.45 + prof * 0.12));
        let r = t.coeur[0] + (t.bord[0] - t.coeur[0]) * k;
        let g = t.coeur[1] + (t.bord[1] - t.coeur[1]) * k;
        let b = t.coeur[2] + (t.bord[2] - t.coeur[2]) * k;
        let a = t.opacite + bord * (1 - t.opacite) * 0.9 + aureole * 0.1 + marbre * 0.1 + prof * 0.06;
        // Le reflet humide : sur le bord bombé tourné vers la lampe
        if (t.brillance > 0 && prof < 0.6) {
          const nx = val(px + 1, py) - val(px - 1, py);
          const ny = val(px, py + 1) - val(px, py - 1);
          const n = Math.hypot(nx, ny) || 1;
          const lum = Math.max(0, (nx * 0.7 + ny * 0.7) / n);
          const reflet = Math.pow(lum, 3) * t.brillance * (1 - lisse(0.04, 0.5, prof));
          r += (255 - r) * reflet;
          g += (255 - g) * reflet;
          b += (255 - b) * reflet;
        }
        // Le bord net mais lissé (un pixel d'anticrénelage)
        a *= lisse(SEUIL - 0.02, SEUIL + 0.02 + 0.03 / s, v);
        d[i] = r;
        d[i + 1] = g;
        d[i + 2] = b;
        d[i + 3] = Math.min(1, Math.max(0, a)) * 255;
      } else if (v > SEUIL - 0.16) {
        // La bavure dans les fibres du papier : un voile clair, piqué
        const fibre = hash3(px, py, graine) * 0.6 + bruit(ux * 2.2, uy * 2.2, graine + 11) * 0.8;
        const a = 0.13 * (1 - (SEUIL - v) / 0.16) * fibre;
        d[i] = t.coeur[0];
        d[i + 1] = t.coeur[1];
        d[i + 2] = t.coeur[2];
        d[i + 3] = Math.min(1, a) * 255;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  return { image: c, x: x0, y: y0, w: w / s, h: h / s };
}

/** Des éclaboussures autour d'une flaque : de petites gouttes projetées, plus nombreuses près du bord. */
export function eclabousser(centre: Goutte, n: number, graine: number): Goutte[] {
  const res: Goutte[] = [];
  for (let k = 0; k < n; k++) {
    const a = hash3(graine, k, 21) * Math.PI * 2;
    const loin = centre.r * (1.15 + hash3(graine, k, 22) * 0.9);
    res.push({ x: centre.x + Math.cos(a) * loin, y: centre.y + Math.sin(a) * loin, r: 0.7 + hash3(graine, k, 23) * 1.6 });
  }
  return res;
}

/** Une coulure sous une flaque : un filet qui s'amincit, puis une goutte au bout. */
export function coulure(x: number, y: number, longueur: number, epaisseur: number): Goutte[] {
  const res: Goutte[] = [];
  const n = Math.max(3, Math.round(longueur / 2));
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    res.push({ x: x + Math.sin(t * 2.4) * 0.8, y: y + t * longueur, r: epaisseur * (1 - t * 0.45) });
  }
  res.push({ x: x + Math.sin(2.4) * 0.8, y: y + longueur + epaisseur * 0.6, r: epaisseur * 1.35 });
  return res;
}

const variantes = new Map<string, ReturnType<typeof flaque>>();

/** Une tache rouge laissée par un monstre raturé : quelques variantes peintes une fois, tournées et posées. */
export function eclatRouge(graine: number, s: number): NonNullable<ReturnType<typeof flaque>> {
  const v = graine % 6;
  const cle = `${v}/${s}`;
  let f = variantes.get(cle);
  if (!f) {
    const g = 1000 + v * 17;
    const gouttes: Goutte[] = [{ x: 0, y: 0, r: 7 }];
    for (let k = 0; k < 3; k++) {
      const a = hash3(g, k, 1) * Math.PI * 2;
      gouttes.push({ x: Math.cos(a) * 4.5, y: Math.sin(a) * 4.5, r: 3 + hash3(g, k, 2) * 2.5 });
    }
    gouttes.push(...eclabousser({ x: 0, y: 0, r: 7 }, 7, g));
    f = flaque(gouttes, s, ENCRE_ROUGE, g);
    variantes.set(cle, f);
  }
  return f!;
}
