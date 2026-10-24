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

export interface Trait {
  couleur?: string;
  epaisseur?: number;
  graine?: number;
  amp?: number;
  ferme?: boolean;
  alpha?: number;
  /** Remplissage (couleur) en plus du trait. */
  fond?: string;
}

/** Un tracé au stylo par une suite de points. */
export function trait(ctx: CanvasRenderingContext2D, pts: V[], o: Trait = {}): void {
  if (pts.length < 2) return;
  const g = o.graine ?? 1;
  const amp = o.amp ?? 0.7;
  ctx.save();
  ctx.globalAlpha *= o.alpha ?? 1;
  ctx.strokeStyle = o.couleur ?? BLEU;
  ctx.lineWidth = o.epaisseur ?? 2;
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
    ctx.fillStyle = o.fond;
    ctx.fill();
  }
  ctx.stroke();
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
export function paragraphe(ctx: CanvasRenderingContext2D, texte: string, x: number, y: number, largeur: number, o: Ecrit = {}): number {
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
  const h = taille * 1.2;
  lignes.forEach((li, i) => ecrire(ctx, li, x, y + i * h, { ...o, base: "top" }));
  return lignes.length * h;
}
