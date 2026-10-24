// Les tours, au stylo bleu : une silhouette par type, des crans pour le niveau, un fanion pour la spécialisation.
// Si le joueur a dessiné l'apparence d'une tour dans sa trousse, son dessin remplace la silhouette.
import type { V } from "../sim/geom";
import { modeleAffiche, type Glyphe } from "../sim/glyphes";
import type { TypeTour } from "../sim/tours";
import { BLEU, CRAYON, PAPIER, ROUGE, cercle, ecrire, rectangle, trait } from "./encre";

/** Les dessins de la trousse : des traits dans [-1, 1], par type de tour. */
let apparences: Partial<Record<TypeTour, V[][]>> = {};
export function reglerApparences(a: Partial<Record<TypeTour, V[][]>>): void {
  apparences = a;
}

/** Le symbole à tracer, en petit (pense-bête, apprentissage). */
export function symbole(ctx: CanvasRenderingContext2D, g: Glyphe, x: number, y: number, taille: number, couleur = BLEU, epaisseur = 2, avance = 1): void {
  const pts = modeleAffiche(g).map((p) => ({ x: x + p.x * taille, y: y + p.y * taille }));
  const n = Math.max(2, Math.ceil(pts.length * avance));
  trait(ctx, pts.slice(0, n), { couleur, epaisseur, graine: g.length * 7, amp: 0.4 });
}

export interface VueTour {
  type: TypeTour;
  x: number;
  y: number;
  angle: number;
  niveau: number;
  spec: number;
  recul?: number;
  temps: number;
  id?: number;
}

export function dessinerTour(ctx: CanvasRenderingContext2D, v: VueTour): void {
  const { x, y, angle, temps } = v;
  const g = (v.id ?? 1) * 13;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const recul = (v.recul ?? 0) * 3;
  const p = (u: number, w: number) => ({ x: x + c * (u - recul) - s * w, y: y + s * (u - recul) + c * w });
  const perso = apparences[v.type];
  if (perso?.length) {
    for (const [i, t] of perso.entries()) trait(ctx, t.map((q) => ({ x: x + q.x * 14, y: y + q.y * 14 })), { epaisseur: 1.8, graine: g + i, amp: 0.4 });
  }
  switch (v.type) {
    case "plume": {
      if (!perso) cercle(ctx, x, y, 11, { epaisseur: 2, graine: g, fond: "rgba(246,239,220,0.95)" });
      // La plume (bec de stylo) pointée vers la cible
      trait(ctx, [p(2, -5), p(18, 0), p(2, 5)], { ferme: true, epaisseur: 1.8, graine: g + 1, fond: "rgba(34,64,143,0.2)" });
      trait(ctx, [p(6, 0), p(16, 0)], { epaisseur: 1, graine: g + 2 });
      break;
    }
    case "roquette": {
      if (!perso) trait(ctx, [{ x, y: y - 13 }, { x: x - 12, y: y + 9 }, { x: x + 12, y: y + 9 }], { ferme: true, epaisseur: 2, graine: g, fond: "rgba(246,239,220,0.95)" });
      trait(ctx, [p(-4, -4), p(14, -4), p(14, 4), p(-4, 4)], { ferme: true, epaisseur: 1.8, graine: g + 1, fond: "rgba(34,64,143,0.25)" });
      trait(ctx, [p(14, -4), p(19, 0), p(14, 4)], { epaisseur: 1.6, graine: g + 2 });
      break;
    }
    case "foudre": {
      if (!perso) cercle(ctx, x, y, 11, { epaisseur: 2, graine: g, fond: "rgba(246,239,220,0.95)" });
      trait(ctx, [{ x: x + 2, y: y - 9 }, { x: x - 4, y: y + 1 }, { x: x + 3, y: y }, { x: x - 2, y: y + 9 }], { epaisseur: 2, graine: g + 1 });
      trait(ctx, [p(10, 0), p(17, 0)], { epaisseur: 1.4, graine: g + 2 });
      cercle(ctx, p(18, 0).x, p(18, 0).y, 2.2, { epaisseur: 1.2, graine: g + 3 });
      break;
    }
    case "correction": {
      if (!perso) rectangle(ctx, x - 10, y - 10, 20, 20, { epaisseur: 2, graine: g, fond: "rgba(246,239,220,0.95)" });
      trait(ctx, [p(0, -2.5), p(22, -1.5), p(22, 1.5), p(0, 2.5)], { ferme: true, epaisseur: 1.6, graine: g + 1, fond: "rgba(34,64,143,0.2)" });
      trait(ctx, [{ x: x - 6, y: y + 1 }, { x: x - 2, y: y + 5 }, { x: x + 6, y: y - 5 }], { couleur: ROUGE, epaisseur: 2, graine: g + 2 });
      break;
    }
    case "spirale": {
      const pts: V[] = [];
      for (let i = 0; i <= 30; i++) {
        const a = (i / 30) * Math.PI * 5 + temps * 2;
        const r = 1.5 + (i / 30) * 10;
        pts.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r });
      }
      if (!perso) cercle(ctx, x, y, 12, { epaisseur: 1.2, graine: g, fond: "rgba(246,239,220,0.9)", couleur: "rgba(34,64,143,0.6)" });
      trait(ctx, pts, { epaisseur: 1.8, graine: g + 1, amp: 0.3 });
      break;
    }
    case "scie": {
      if (!perso) {
        const pts: V[] = [];
        for (let i = 0; i < 10; i++) {
          const a = -Math.PI / 2 + (i * Math.PI) / 5;
          const r = i % 2 ? 5.5 : 12;
          pts.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r });
        }
        trait(ctx, pts, { ferme: true, epaisseur: 2, graine: g, fond: "rgba(246,239,220,0.95)" });
      }
      cercle(ctx, x, y, 3, { epaisseur: 1.4, graine: g + 1, fond: BLEU });
      break;
    }
    case "encrier": {
      if (!perso) {
        trait(ctx, [{ x: x - 11, y: y - 3 }, { x: x - 11, y: y + 9 }, { x: x + 11, y: y + 9 }, { x: x + 11, y: y - 3 }, { x: x + 5, y: y - 7 }, { x: x - 5, y: y - 7 }], { ferme: true, epaisseur: 2, graine: g, fond: "rgba(246,239,220,0.95)" });
        rectangle(ctx, x - 4, y - 12, 8, 5, { epaisseur: 1.6, graine: g + 1 });
      }
      // Le niveau d'encre qui ondule
      const h = 4 + Math.sin(temps * 2) * 1;
      trait(ctx, [{ x: x - 9, y: y + 8 - h }, { x: x - 3, y: y + 7 - h }, { x: x + 3, y: y + 9 - h }, { x: x + 9, y: y + 8 - h }, { x: x + 9, y: y + 8 }, { x: x - 9, y: y + 8 }], { ferme: true, epaisseur: 1, graine: g + 2, fond: "rgba(34,64,143,0.55)" });
      break;
    }
  }
  // Les crans du niveau, et le fanion de la spécialisation
  if (v.spec) {
    trait(ctx, [{ x: x + 9, y: y - 9 }, { x: x + 9, y: y - 22 }], { epaisseur: 1.4, graine: g + 7 });
    trait(ctx, [{ x: x + 9, y: y - 22 }, { x: x + 18, y: y - 19 }, { x: x + 9, y: y - 16 }], { ferme: true, epaisseur: 1.2, couleur: ROUGE, fond: "rgba(196,48,43,0.5)", graine: g + 8 });
    ecrire(ctx, v.spec === 1 ? "A" : "B", x + 13, y - 19, { taille: 8, couleur: PAPIER });
  } else {
    for (let k = 0; k < v.niveau; k++) trait(ctx, [{ x: x - 6 + k * 6, y: y + 16 }, { x: x - 4 + k * 6, y: y + 19 }], { epaisseur: 1.6, graine: g + 9 + k, couleur: CRAYON });
  }
}
