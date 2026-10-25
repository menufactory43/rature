// Le stylo bille : chaque trait tremble un peu et se redessine huit fois par seconde (la ligne « vit »).
import type { V } from "../sim/geom";
import { hash3 } from "../sim/rng";

export const BLEU = "#22408f";
export const ROUGE = "#c4302b";
export const CRAYON = "rgba(60,62,75,0.55)";
export const PAPIER = "#f6efdc";
export const LIGNE_CAHIER = "rgba(80,120,190,0.16)";

let tic = 0;
/** Fige le tremblé pour l'image (temps en secondes). */
export function regler(temps: number): void {
  tic = Math.floor(temps * 8);
}

const tremble = (graine: number, i: number, amp: number) => (hash3(graine, i, tic) - 0.5) * 2 * amp;

/** Le stylo en main : remplace le bleu par défaut (chaque famille de tour a sa couleur de stylo). */
let stylo: string | null = null;
export function avecStylo(couleur: string | null, dessin: () => void): void {
  const avant = stylo;
  stylo = couleur;
  try {
    dessin();
  } finally {
    stylo = avant;
  }
}

export interface Trait {
  couleur?: string;
  epaisseur?: number;
  graine?: number;
  amp?: number;
  ferme?: boolean;
  alpha?: number;
  /** Remplissage (couleur) en plus du trait. */
  fond?: string;
  /** Faux : pas de petit pâté au départ (les côtés d'une boîte n'en ont qu'un). */
  pate?: boolean;
}

/** Un tracé au stylo par une suite de points. */
export function trait(ctx: CanvasRenderingContext2D, pts: V[], o: Trait = {}): void {
  if (pts.length < 2) return;
  const g = o.graine ?? 1;
  const amp = o.amp ?? 0.7;
  ctx.save();
  ctx.globalAlpha *= o.alpha ?? 1;
  const couleur = stylo && (!o.couleur || o.couleur === BLEU) ? stylo : o.couleur ?? BLEU;
  const w = o.epaisseur ?? 2;
  ctx.strokeStyle = couleur;
  ctx.lineWidth = w;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) {
    const x = pts[i].x + tremble(g, i * 2, amp);
    const y = pts[i].y + tremble(g, i * 2 + 1, amp);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  if (o.ferme) ctx.closePath();
  if (o.fond) {
    ctx.fillStyle = stylo && o.fond === BLEU ? stylo : o.fond;
    ctx.fill();
  }
  ctx.stroke();
  if (w >= 1.5) {
    // La bille laisse moins d'encre au milieu du sillon : un reflet clair le long du trait
    ctx.strokeStyle = "rgba(255,250,235,0.22)";
    ctx.lineWidth = w * 0.32;
    ctx.stroke();
    // Et parfois un petit pâté au départ, là où la bille s'est posée (fixe, pour ne pas clignoter)
    if (!o.ferme && o.pate !== false && hash3(g, 97, 0) < 0.45) {
      ctx.fillStyle = couleur;
      ctx.beginPath();
      ctx.arc(pts[0].x, pts[0].y, w * 0.62, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** Les points d'un cercle tremblé. */
export function pointsCercle(x: number, y: number, r: number, graine: number, bosse = 0.08): V[] {
  const n = Math.max(10, Math.min(48, Math.round(r * 0.9)));
  const pts: V[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = r * (1 + (hash3(graine, i, 0) - 0.5) * 2 * bosse);
    pts.push({ x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr });
  }
  return pts;
}

export function cercle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, o: Trait = {}): void {
  // Un grand cercle reste rond : la bosse ne dépasse pas 3 px
  trait(ctx, pointsCercle(x, y, r, o.graine ?? 1, Math.min(0.08, 3 / r)), { ferme: true, ...o });
}

export function rectangle(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, o: Trait = {}): void {
  trait(ctx, [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }], { ferme: true, ...o });
}

/** Hachures dans un polygone (l'encre qu'on étale). */
export function hachures(ctx: CanvasRenderingContext2D, poly: V[], couleur: string, pas = 6, angle = -0.7, epaisseur = 1): void {
  if (poly.length < 3) return;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of poly) {
    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
  }
  ctx.save();
  ctx.beginPath();
  poly.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
  ctx.clip();
  ctx.strokeStyle = couleur;
  ctx.lineWidth = epaisseur;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const r = Math.hypot(maxX - minX, maxY - minY) / 2 + 2;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  ctx.beginPath();
  for (let k = -r; k <= r; k += pas) {
    const ox = cx - dy * k;
    const oy = cy + dx * k;
    ctx.moveTo(ox - dx * r + tremble(k | 0, 1, 0.6), oy - dy * r);
    ctx.lineTo(ox + dx * r, oy + dy * r + tremble(k | 0, 2, 0.6));
  }
  ctx.stroke();
  ctx.restore();
}

export type Police = "main" | "titre";

export interface Ecrit {
  taille?: number;
  couleur?: string;
  align?: CanvasTextAlign;
  police?: Police;
  rotation?: number;
  alpha?: number;
  base?: CanvasTextBaseline;
}

export function ecrire(ctx: CanvasRenderingContext2D, texte: string, x: number, y: number, o: Ecrit = {}): number {
  ctx.save();
  ctx.globalAlpha *= o.alpha ?? 1;
  const taille = o.taille ?? 18;
  ctx.font = o.police === "titre" ? `700 ${taille}px Caveat, cursive` : `${taille}px "Patrick Hand", cursive`;
  ctx.fillStyle = o.couleur ?? BLEU;
  ctx.textAlign = o.align ?? "center";
  ctx.textBaseline = o.base ?? "middle";
  ctx.translate(x, y);
  if (o.rotation) ctx.rotate(o.rotation);
  ctx.fillText(texte, 0, 0);
  const w = ctx.measureText(texte).width;
  ctx.restore();
  return w;
}

/** Écrit un texte qui tient dans une largeur, retour à la ligne compris. Renvoie la hauteur occupée. */
/** Les lignes d'un texte coupé à la largeur donnée (sans le dessiner). */
export function couper(ctx: CanvasRenderingContext2D, texte: string, largeur: number, o: Ecrit = {}): string[] {
  const taille = o.taille ?? 16;
  ctx.save();
  ctx.font = o.police === "titre" ? `700 ${taille}px Caveat, cursive` : `${taille}px "Patrick Hand", cursive`;
  const mots = texte.split(" ");
  const lignes: string[] = [];
  let l = "";
  for (const m of mots) {
    const essai = l ? l + " " + m : m;
    if (ctx.measureText(essai).width > largeur && l) {
      lignes.push(l);
      l = m;
    } else l = essai;
  }
  if (l) lignes.push(l);
  ctx.restore();
  return lignes;
}

export function paragraphe(ctx: CanvasRenderingContext2D, texte: string, x: number, y: number, largeur: number, o: Ecrit = {}): number {
  const taille = o.taille ?? 16;
  const lignes = couper(ctx, texte, largeur, o);
  const h = taille * 1.2;
  lignes.forEach((li, i) => ecrire(ctx, li, x, y + i * h, { ...o, base: "top" }));
  return lignes.length * h;
}

// --- L'interface à main levée ---
// Les boutons, les cadres et les cartes ne sont pas tirés à la règle : chaque côté est un coup de stylo un peu bombé,
// qui dépasse des coins, et le papier qu'ils entourent n'est pas tout à fait rectangle. Tout dépend de la graine :
// la forme ne bouge pas d'une image à l'autre, seul le tremblé du stylo vit.

const alea = (g: number, i: number) => hash3(g, i, 7) - 0.5;

/** Les quatre coins d'une boîte dessinée à main levée, un peu déplacés. */
function coinsMain(x: number, y: number, w: number, h: number, g: number): V[] {
  const d = Math.min(2.6, Math.min(w, h) * 0.07);
  // Une boîte n'est jamais tout à fait d'aplomb : un degré de travers au plus
  const a = alea(g, 9) * 0.035;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const tourner = (px: number, py: number): V => ({ x: cx + (px - cx) * Math.cos(a) - (py - cy) * Math.sin(a), y: cy + (px - cx) * Math.sin(a) + (py - cy) * Math.cos(a) });
  return [
    tourner(x + alea(g, 1) * d, y + alea(g, 2) * d),
    tourner(x + w + alea(g, 3) * d, y + alea(g, 4) * d),
    tourner(x + w + alea(g, 5) * d, y + h + alea(g, 6) * d),
    tourner(x + alea(g, 7) * d, y + h + alea(g, 8) * d),
  ];
}

/** Un côté : de a vers b, bombé d'un côté ou de l'autre, avec une petite ondulation de la main. */
function coteMain(a: V, b: V, g: number, avant = 0, apres = 0): V[] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l = Math.hypot(dx, dy) || 1;
  const ux = dx / l;
  const uy = dy / l;
  const bombe = alea(g, 11) * 2 * Math.min(4, l * 0.02);
  const onde = Math.min(0.6, l * 0.004);
  const phase = hash3(g, 12, 7) * 6.28;
  const n = Math.max(3, Math.round(l / 14));
  const pts: V[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const s = -avant + t * (l + avant + apres);
    const k = s / l;
    const off = bombe * Math.sin(Math.PI * Math.min(1, Math.max(0, k))) + onde * Math.sin(phase + k * 9);
    pts.push({ x: a.x + ux * s - uy * off, y: a.y + uy * s + ux * off });
  }
  return pts;
}

/** Le contour du papier d'une boîte (pour le remplir sans angle droit parfait). */
function contourMain(c: V[], g: number): V[] {
  return [0, 1, 2, 3].flatMap((i) => coteMain(c[i], c[(i + 1) % 4], g + i * 13).slice(0, -1));
}

function remplir(ctx: CanvasRenderingContext2D, pts: V[], couleur: string): void {
  ctx.fillStyle = couleur;
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
  ctx.fill();
}

/** Une boîte à main levée : quatre coups de stylo qui débordent un peu aux coins. */
export function boite(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, o: Trait = {}): void {
  const g = o.graine ?? 1;
  const c = coinsMain(x, y, w, h, g);
  if (o.fond) remplir(ctx, contourMain(c, g), stylo && o.fond === BLEU ? stylo : o.fond);
  // Le dépassement aux coins : franc sur une grande boîte, discret sur une petite case
  const dep = Math.min(5, Math.min(w, h) * 0.09);
  for (let i = 0; i < 4; i++) {
    const avant = (0.2 + hash3(g, 20 + i, 7) * 0.8) * dep * (i === 0 ? 0.3 : 1);
    const apres = (0.1 + hash3(g, 30 + i, 7) * 0.9) * dep;
    trait(ctx, coteMain(c[i], c[(i + 1) % 4], g + i * 13, avant, apres), { amp: 0.35, ...o, fond: undefined, ferme: false, graine: g + i * 13, pate: i === 0 });
  }
  // Un trait appuyé (bouton principal, cadre important) : on repasse par-dessus, pas tout à fait au même endroit
  if ((o.epaisseur ?? 2) >= 2.2 && Math.min(w, h) > 24) {
    const c2 = coinsMain(x, y, w, h, g + 101);
    for (let i = 0; i < 4; i++) trait(ctx, coteMain(c2[i], c2[(i + 1) % 4], g + 101 + i * 13), { amp: 0.35, ...o, fond: undefined, ferme: false, epaisseur: (o.epaisseur ?? 2) * 0.45, alpha: (o.alpha ?? 1) * 0.6, graine: g + 101 + i * 13, pate: false });
  }
}

/** Une feuille de papier (carte, fiche, menu) : son ombre portée, puis le papier, aux bords pas tout à fait droits. */
export function feuille(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, couleur: string, graine: number, ombre = 0.16): void {
  const c = coinsMain(x, y, w, h, graine);
  const contour = contourMain(c, graine);
  if (ombre > 0) remplir(ctx, contour.map((p) => ({ x: p.x + 3, y: p.y + 5 })), `rgba(40,30,10,${ombre})`);
  remplir(ctx, contour, couleur);
}

/** Une ligne à main levée (un séparateur, un souligné long) : bombée, ondulée, jamais à la règle. */
export function ligne(ctx: CanvasRenderingContext2D, a: V, b: V, o: Trait = {}): void {
  trait(ctx, coteMain(a, b, o.graine ?? 1), { amp: 0.3, ...o });
}
