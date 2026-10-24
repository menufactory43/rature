// Ce que partagent tous les écrans : la mise en page, les boutons (refaits à chaque image), quelques éléments dessinés.
import * as audio from "../audio";
import { BLEU, CRAYON, ROUGE, ecrire, boite, trait } from "../render/encre";

export const W = 400;
/** Bandeau du haut, page (720), bandeau du bas (encre et pense-bête). */
export const HAUT = 60;
export const PAGE_H = 720;
export const BAS = 90;
export const H = HAUT + PAGE_H + BAS;

export interface Bouton {
  x: number;
  y: number;
  w: number;
  h: number;
  action: () => void;
  /** Faux pour une zone sans dessin (pas de surligneur quand on la touche). */
  visible?: boolean;
  /** La transformation au moment du dessin : le bouton se touche là où il a été dessiné. */
  m: DOMMatrix;
}

export const ui = {
  ctx: null as unknown as CanvasRenderingContext2D,
  boutons: [] as Bouton[],
  temps: 0,
  /** Le dernier bouton touché, pour le coup de surligneur. */
  appui: null as (Bouton & { depuis: number }) | null,
};

/** Un coup de surligneur jaune sur le bouton qu'on vient de toucher. */
export function dessinerAppui(): void {
  const a = ui.appui;
  if (!a) return;
  const t = (ui.temps - a.depuis) / 0.35;
  if (t >= 1) {
    ui.appui = null;
    return;
  }
  const ctx = ui.ctx;
  ctx.save();
  ctx.setTransform(a.m);
  ctx.globalAlpha = 0.55 * (1 - t);
  ctx.strokeStyle = "#f2d024";
  ctx.lineWidth = Math.min(16, a.h * 0.5);
  ctx.lineCap = "round";
  const avance = Math.min(1, t * 5);
  ctx.beginPath();
  ctx.moveTo(a.x + 6, a.y + a.h * 0.58);
  ctx.lineTo(a.x + 6 + (a.w - 12) * avance, a.y + a.h * 0.5);
  ctx.stroke();
  ctx.restore();
}

export interface OptionsBouton {
  principal?: boolean;
  taille?: number;
  sous?: string;
  inactif?: boolean;
  couleur?: string;
}

export function bouton(x: number, y: number, w: number, h: number, texte: string, action: () => void, o: OptionsBouton = {}): void {
  const ctx = ui.ctx;
  const couleur = o.inactif ? CRAYON : o.couleur ?? (o.principal ? ROUGE : BLEU);
  boite(ctx, x, y, w, h, { couleur, epaisseur: o.principal ? 2.4 : 1.8, graine: Math.round(x * 7 + y), fond: "rgba(246,239,220,0.94)" });
  if (o.sous) {
    ecrire(ctx, texte, x + w / 2, y + h / 2 - 8, { couleur, taille: o.taille ?? 22 });
    ecrire(ctx, o.sous, x + w / 2, y + h / 2 + 13, { couleur: CRAYON, taille: 13 });
  } else ecrire(ctx, texte, x + w / 2, y + h / 2 + 1, { couleur, taille: o.taille ?? 22 });
  if (!o.inactif) ui.boutons.push({ x, y, w, h, action, m: ctx.getTransform() });
}

/** Une zone touchable sans dessin. */
export function zone(x: number, y: number, w: number, h: number, action: () => void): void {
  ui.boutons.push({ x, y, w, h, action, visible: false, m: ui.ctx.getTransform() });
}

export function voile(alpha = 0.85): void {
  ui.ctx.fillStyle = `rgba(246,239,220,${alpha})`;
  // Débordant : la partie le découpe à la feuille où il se pose (la page de droite du cahier ouvert)
  ui.ctx.fillRect(-W, -H, W * 3, H * 3);
}

export function souligner(x: number, y: number, w: number, graine: number): void {
  trait(ui.ctx, [{ x: x - w / 2, y }, { x, y: y + 3 }, { x: x + w / 2, y: y - 1 }], { couleur: ROUGE, epaisseur: 2.2, graine });
}

export function boutonSon(x: number, y: number): void {
  bouton(x, y, 40, 32, audio.actif ? "♪" : "×♪", () => audio.basculer(), { taille: 18 });
}

export function titre(texte: string, y: number, taille = 44): void {
  ecrire(ui.ctx, texte, W / 2, y, { police: "titre", taille });
  ui.ctx.font = `700 ${taille}px Caveat, cursive`;
  souligner(W / 2, y + taille * 0.55, Math.min(320, ui.ctx.measureText(texte).width * 0.8), Math.round(y));
}

/** Le bouton sous un point en pixels de l'écran, le dernier dessiné passant devant. */
export function boutonSous(px: number, py: number): Bouton | null {
  for (let i = ui.boutons.length - 1; i >= 0; i--) {
    const b = ui.boutons[i];
    const p = b.m.inverse().transformPoint({ x: px, y: py });
    if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) return b;
  }
  return null;
}
