// La mise en page selon l'écran : le cahier en portrait (téléphone), la carte et une bande d'outils à côté
// (iPhone Duo fermé, tablette debout), ou le cahier ouvert sur deux pages (iPhone Duo déplié, ordinateur).
import { reglages } from "../reglages";
import { H, HAUT, PAGE_H, W } from "./base";

export type Mise = "portrait" | "bande" | "ouvert";

/** La largeur de la bande d'outils, en unités de la page. */
export const BANDE = 100;
/** Le panneau du cahier ouvert : une page de la même taille que la carte. */
export const PANNEAU_W = 400;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Vue {
  mise: Mise;
  dpr: number;
  /** Le cadre 400×870 des menus, vers les pixels de l'écran. */
  menu: DOMMatrix;
  /** Les fenêtres posées sur la partie (fiche, pause, fin), dans le même cadre 400×870. */
  dessus: DOMMatrix;
  /** La carte, en coordonnées du cadre (la page va de HAUT à HAUT + PAGE_H). */
  carte: DOMMatrix;
  /** La bande ou la page de droite, depuis son coin en haut à gauche. */
  panneau: DOMMatrix;
  /** Les feuilles du cahier en partie et en menu, en pixels CSS (une, ou deux de part et d'autre du pli). */
  feuilles: Rect[];
  feuillesMenu: Rect[];
  /** Le pli du cahier ouvert, en pixels CSS. */
  pli: number | null;
  /** L'échelle de la carte (pixels CSS par unité). */
  s: number;
  /** L'échelle des menus. */
  m: number;
}

/** Le bord de bureau qu'on laisse voir autour du cahier, même sur un téléphone. */
export const MARGE = 6;
/** De chaque côté du pli, une bande de papier où l'on ne met rien (le pli de l'écran du Duo). */
export const RELIURE = 14;

const mat = (dpr: number, x: number, y: number, s: number) => new DOMMatrix([dpr * s, 0, 0, dpr * s, dpr * x, dpr * y]);

export function miseDe(cw: number, ch: number): Mise {
  const r = cw / ch;
  return r < 0.62 ? "portrait" : r < 1.05 ? "bande" : "ouvert";
}

function calculerDans(cw: number, ch: number, dpr: number): Vue {
  const mise = miseDe(cw, ch);
  // Le cadre des menus, centré dans tout l'écran
  const m0 = Math.min((cw - MARGE * 2) / W, (ch - MARGE * 2) / H);
  const ox0 = (cw - W * m0) / 2;
  const oy0 = (ch - H * m0) / 2;
  const centre = mat(dpr, ox0, oy0, m0);
  const seul = [{ x: ox0, y: oy0, w: W * m0, h: H * m0 }];
  if (mise === "portrait") return { mise, dpr, menu: centre, dessus: centre, carte: centre, panneau: centre, feuilles: seul, feuillesMenu: seul, pli: null, s: m0, m: m0 };
  if (mise === "bande") {
    const s = Math.min((cw - MARGE * 2) / (W + BANDE), (ch - MARGE * 2) / PAGE_H);
    const x0 = (cw - (W + BANDE) * s) / 2;
    const y0 = (ch - PAGE_H * s) / 2;
    // Les gauchers ont la bande sous le pouce gauche
    const xc = reglages.gaucher ? x0 + BANDE * s : x0;
    const xb = reglages.gaucher ? x0 : x0 + W * s;
    return {
      mise, dpr, menu: centre, dessus: centre,
      carte: mat(dpr, xc, y0 - HAUT * s, s),
      panneau: mat(dpr, xb, y0, s),
      feuilles: [{ x: x0, y: y0, w: (W + BANDE) * s, h: PAGE_H * s }],
      feuillesMenu: seul, pli: null, s, m: m0,
    };
  }
  // Le cahier ouvert : la carte sur la page de gauche, le panneau sur celle de droite, rien sur le pli
  const pli = cw / 2;
  const s = Math.min((pli - MARGE - RELIURE) / W, (ch - MARGE * 2) / PAGE_H);
  const y0 = (ch - PAGE_H * s) / 2;
  const xc = pli - RELIURE - W * s;
  const xp = pli + RELIURE;
  // Les menus : une page de 400×870 de chaque côté
  const m = Math.min((pli - MARGE - RELIURE) / W, (ch - MARGE * 2) / H);
  const ym = (ch - H * m) / 2;
  return {
    mise, dpr,
    menu: mat(dpr, pli - RELIURE - W * m, ym, m),
    dessus: mat(dpr, xp + (W * s - W * (PAGE_H * s / H)) / 2, y0, (PAGE_H * s) / H),
    carte: mat(dpr, xc, y0 - HAUT * s, s),
    panneau: mat(dpr, xp, y0, s),
    feuilles: [
      { x: xc, y: y0, w: W * s + RELIURE, h: PAGE_H * s },
      { x: pli, y: y0, w: W * s + RELIURE, h: PAGE_H * s },
    ],
    feuillesMenu: [
      { x: pli - RELIURE - W * m, y: ym, w: W * m + RELIURE, h: H * m },
      { x: pli, y: ym, w: W * m + RELIURE, h: H * m },
    ],
    pli, s, m,
  };
}

/** Les marges de sûreté de l'écran (l'encoche, la barre du bas), en pixels CSS. */
export interface Encoches {
  haut: number;
  droite: number;
  bas: number;
  gauche: number;
}

/** La mise en page dans la partie sûre de l'écran : le bureau déborde dessous, le cahier reste à l'abri de l'encoche. */
export function calculer(cw: number, ch: number, dpr: number, e: Encoches = { haut: 0, droite: 0, bas: 0, gauche: 0 }): Vue {
  const v = calculerDans(cw - e.gauche - e.droite, ch - e.haut - e.bas, dpr);
  const decaler = (m: DOMMatrix) => {
    const n = DOMMatrix.fromMatrix(m);
    n.e += e.gauche * dpr;
    n.f += e.haut * dpr;
    return n;
  };
  const rects = (r: Rect[]) => r.map((f) => ({ ...f, x: f.x + e.gauche, y: f.y + e.haut }));
  return {
    ...v,
    menu: decaler(v.menu), dessus: decaler(v.dessus), carte: decaler(v.carte), panneau: decaler(v.panneau),
    feuilles: rects(v.feuilles), feuillesMenu: rects(v.feuillesMenu), pli: v.pli === null ? null : v.pli + e.gauche,
  };
}

/** La page de droite des menus en cahier ouvert : où elle commence (pixels CSS). */
export function pageDroiteMenu(v: Vue): DOMMatrix {
  const f = v.feuillesMenu[1];
  return mat(v.dpr, f.x + RELIURE, f.y, v.m);
}
