// Les tours, au stylo bleu : une silhouette par type, des crans pour le niveau, un fanion pour la spécialisation.
// Si le joueur a dessiné l'apparence d'une tour dans sa trousse, son dessin remplace la silhouette.
import type { V } from "../sim/geom";
import { modeleAffiche, type Glyphe } from "../sim/glyphes";
import type { TypeTour } from "../sim/tours";
import { hash3 } from "../sim/rng";
import { BLEU, CRAYON, ROUGE, avecStylo, cercle, ecrire, hachures, rectangle, trait } from "./encre";

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

/** Le contour du socle de chaque tour (fermé), pour le dessiner, le repasser au niveau 2 et le hachurer au niveau 3. */
function socle(type: TypeTour, x: number, y: number, rot: number): V[] {
  const rond = (r: number, n = 18) => Array.from({ length: n }, (_, i) => ({ x: x + Math.cos((i / n) * Math.PI * 2) * r, y: y + Math.sin((i / n) * Math.PI * 2) * r }));
  switch (type) {
    case "roquette":
      return [{ x, y: y - 13 }, { x: x - 12, y: y + 9 }, { x: x + 12, y: y + 9 }];
    case "correction":
      return [{ x: x - 10, y: y - 10 }, { x: x + 10, y: y - 10 }, { x: x + 10, y: y + 10 }, { x: x - 10, y: y + 10 }];
    case "spirale":
      return rond(12);
    case "scie":
      return Array.from({ length: 10 }, (_, i) => {
        const a = -Math.PI / 2 + (i * Math.PI) / 5 + rot;
        const r = i % 2 ? 5.5 : 12;
        return { x: x + Math.cos(a) * r, y: y + Math.sin(a) * r };
      });
    case "encrier":
      return [{ x: x - 11, y: y - 3 }, { x: x - 11, y: y + 9 }, { x: x + 11, y: y + 9 }, { x: x + 11, y: y - 3 }, { x: x + 5, y: y - 7 }, { x: x - 5, y: y - 7 }];
    default:
      return rond(11);
  }
}

/** La couleur du stylo de chaque famille : on reconnaît une tour d'un coup d'œil, même de loin. */
export const STYLOS: Record<TypeTour, string> = {
  plume: BLEU,
  roquette: "#26262e",
  foudre: "#5b3a9e",
  correction: "#1d3a8a",
  spirale: "#1e7a4f",
  scie: "#3a3a44",
  encrier: "#13708a",
};

export function dessinerTour(ctx: CanvasRenderingContext2D, v: VueTour): void {
  avecStylo(STYLOS[v.type], () => dessinerTourAuStylo(ctx, v));
}

function dessinerTourAuStylo(ctx: CanvasRenderingContext2D, v: VueTour): void {
  const { x, y, temps } = v;
  const g = (v.id ?? 1) * 13;
  const tic = Math.floor(temps * 8);
  // Au repos, la tour respire un peu
  const angle = v.angle + ((v.recul ?? 0) > 0 ? 0 : Math.sin(temps * 1.6 + g) * 0.05);
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const recul = (v.recul ?? 0) * 3;
  const p = (u: number, w: number) => ({ x: x + c * (u - recul) - s * w, y: y + s * (u - recul) + c * w });
  const perso = apparences[v.type];
  const sp = v.spec;
  if (perso?.length) {
    for (const [i, t] of perso.entries()) trait(ctx, t.map((q) => ({ x: x + q.x * 14, y: y + q.y * 14 })), { epaisseur: 1.8, graine: g + i, amp: 0.4 });
  } else {
    const base = socle(v.type, x, y, v.type === "scie" ? temps * (sp === 2 ? 3 : 1.2) : 0);
    trait(ctx, base, { ferme: true, epaisseur: v.type === "spirale" ? 1.2 : 2, graine: g, fond: "rgba(246,239,220,0.95)", couleur: v.type === "spirale" ? "rgba(34,64,143,0.6)" : BLEU });
    // Niveau 2 : le contour repassé une deuxième fois ; niveau 3 : hachuré
    if (v.niveau >= 2) trait(ctx, base.map((q) => ({ x: q.x + 0.8, y: q.y - 0.8 })), { ferme: true, epaisseur: 1, graine: g + 40, amp: 1 });
    if (v.niveau >= 3) hachures(ctx, base, "rgba(34,64,143,0.22)", 3.5, -0.8);
  }
  switch (v.type) {
    case "plume": {
      const bec = (w: number, l: number) => {
        trait(ctx, [p(2, w - 5), p(l, w), p(2, w + 5)], { ferme: true, epaisseur: 1.8, graine: g + 1 + w, fond: "rgba(34,64,143,0.25)" });
        trait(ctx, [p(6, w), p(l - 2, w)], { epaisseur: 1, graine: g + 2 + w });
      };
      if (sp === 1) for (const w of [-5, 0, 5]) bec(w, 17);
      else if (sp === 2) {
        bec(0, 25);
        cercle(ctx, p(13, 0).x, p(13, 0).y, 3, { epaisseur: 1.2, graine: g + 3 });
      } else bec(0, 18);
      // L'éclair de bouche quand elle tire
      if ((v.recul ?? 0) > 0.6) for (const d of [-0.5, 0, 0.5]) {
        const a = angle + d;
        const o = p(sp === 2 ? 27 : 20, 0);
        trait(ctx, [o, { x: o.x + Math.cos(a) * 6, y: o.y + Math.sin(a) * 6 }], { epaisseur: 1.4, graine: g + 9, amp: 0.2 });
      }
      break;
    }
    case "roquette": {
      const l = sp === 2 ? 17 : 14;
      const w = sp === 2 ? 6 : 4;
      trait(ctx, [p(-4, -w), p(l, -w), p(l, w), p(-4, w)], { ferme: true, epaisseur: 1.8, graine: g + 1, fond: "rgba(34,64,143,0.25)" });
      trait(ctx, [p(l, -w), p(l + 5, 0), p(l, w)], { epaisseur: 1.6, graine: g + 2 });
      if ((v.recul ?? 0) > 0.3) trait(ctx, [p(-4, -w * 0.6), p(-10 - Math.random() * 4, 0), p(-4, w * 0.6)], { couleur: ROUGE, epaisseur: 1.4, fond: "rgba(196,48,43,0.35)", graine: g + 3 });
      if (sp === 1) for (const k of [-1, 1]) {
        // De petites flammes peintes sur le socle
        const fx = x + k * 6;
        const h = 4 + Math.sin(temps * 9 + k) * 1.2;
        trait(ctx, [{ x: fx - 2.5, y: y + 8 }, { x: fx, y: y + 8 - h }, { x: fx + 2.5, y: y + 8 }], { couleur: ROUGE, epaisseur: 1.2, fond: "rgba(196,48,43,0.35)", graine: g + 5 + k });
      }
      break;
    }
    case "foudre": {
      trait(ctx, [{ x: x + 2, y: y - 9 }, { x: x - 4, y: y + 1 }, { x: x + 3, y: y }, { x: x - 2, y: y + 9 }], { epaisseur: 2, graine: g + 1, couleur: sp === 2 ? ROUGE : BLEU });
      if (sp === 2) trait(ctx, [{ x: x + 6, y: y - 7 }, { x: x + 3, y: y - 1 }, { x: x + 6, y: y - 1 }, { x: x + 3, y: y + 5 }], { epaisseur: 1.3, graine: g + 6, couleur: ROUGE });
      trait(ctx, [p(10, 0), p(17, 0)], { epaisseur: 1.4, graine: g + 2 });
      cercle(ctx, p(18, 0).x, p(18, 0).y, 2.2, { epaisseur: 1.2, graine: g + 3 });
      if (sp === 1) {
        // Un petit nuage d'orage au-dessus
        const nuage: V[] = [];
        for (let i = 0; i <= 16; i++) {
          const a = Math.PI + (i / 16) * Math.PI;
          const bosse = 1 + 0.25 * Math.abs(Math.sin(i * 1.2));
          nuage.push({ x: x + Math.cos(a) * 11 * bosse, y: y - 16 + Math.sin(a) * 5 * bosse });
        }
        trait(ctx, nuage, { ferme: true, epaisseur: 1.3, graine: g + 7, fond: "rgba(60,62,75,0.15)" });
      }
      // Ça crépite : une étincelle qui saute autour, de temps en temps
      if (hash3(g, tic, 3) < 0.45) {
        const a = hash3(g, tic, 4) * Math.PI * 2;
        const o = { x: x + Math.cos(a) * 12, y: y + Math.sin(a) * 12 };
        trait(ctx, [o, { x: o.x + Math.cos(a + 0.8) * 4, y: o.y + Math.sin(a + 0.8) * 4 }, { x: o.x + Math.cos(a) * 7, y: o.y + Math.sin(a) * 7 }], { epaisseur: 1, graine: g + tic, amp: 0.3 });
      }
      break;
    }
    case "correction": {
      // Le stylo fait le geste d'écrire
      const ecrit = Math.sin(temps * 5 + g) * 1.2 + (v.recul ?? 0) * -4;
      if (sp === 2) {
        // Le tampon
        trait(ctx, [p(4, -5), p(16, -5), p(16, 5), p(4, 5)], { ferme: true, epaisseur: 1.6, graine: g + 1, fond: "rgba(196,48,43,0.35)", couleur: ROUGE });
        trait(ctx, [p(16, 0), p(23, 0)], { epaisseur: 2.4, graine: g + 2 });
        cercle(ctx, p(24, 0).x, p(24, 0).y, 3, { epaisseur: 1.4, graine: g + 4, fond: BLEU });
      } else {
        const coul = sp === 1 ? ROUGE : BLEU;
        trait(ctx, [p(0 + ecrit, -2.5), p(22 + ecrit, -1.5), p(22 + ecrit, 1.5), p(0 + ecrit, 2.5)], { ferme: true, epaisseur: 1.6, graine: g + 1, fond: sp === 1 ? "rgba(196,48,43,0.4)" : "rgba(34,64,143,0.2)", couleur: coul });
        trait(ctx, [p(22 + ecrit, -1.5), p(26 + ecrit, 0), p(22 + ecrit, 1.5)], { epaisseur: 1.3, graine: g + 5, couleur: coul });
      }
      trait(ctx, [{ x: x - 6, y: y + 1 }, { x: x - 2, y: y + 5 }, { x: x + 6, y: y - 5 }], { couleur: ROUGE, epaisseur: 2, graine: g + 2 });
      break;
    }
    case "spirale": {
      const pts: V[] = [];
      const tours = sp === 1 ? 6 : 5;
      for (let i = 0; i <= 34; i++) {
        const a = (i / 34) * Math.PI * tours + temps * (sp === 2 ? 3.5 : 2);
        const r = 1.5 + (i / 34) * 10;
        pts.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r });
      }
      trait(ctx, pts, { epaisseur: 1.8, graine: g + 1, amp: 0.3, couleur: sp === 2 ? ROUGE : BLEU });
      if (sp === 1) for (const k of [-6, 1, 7]) {
        // La glu qui coule
        const h = 4 + ((temps * 0.7 + k * 0.13) % 1) * 6;
        trait(ctx, [{ x: x + k, y: y + 10 }, { x: x + k, y: y + 10 + h }], { epaisseur: 2.2, graine: g + k, amp: 0.2 });
        cercle(ctx, x + k, y + 11 + h, 1.6, { fond: BLEU, epaisseur: 1, graine: g + k + 1 });
      }
      if (sp === 2) for (let k = 0; k < 3; k++) {
        // L'acide fait des bulles
        const u = (temps * 0.9 + k / 3) % 1;
        cercle(ctx, x + Math.sin(k * 2.1 + temps) * 8, y - 8 - u * 14, 1.5 + u * 1.5, { couleur: ROUGE, epaisseur: 1, alpha: 1 - u, graine: g + 20 + k });
      }
      break;
    }
    case "scie": {
      cercle(ctx, x, y, 3, { epaisseur: 1.4, graine: g + 1, fond: sp === 2 ? ROUGE : BLEU });
      if (sp === 1) cercle(ctx, x, y, 17, { epaisseur: 0.8, graine: g + 2, alpha: 0.5 });
      break;
    }
    case "encrier": {
      if (!perso) rectangle(ctx, x - 4, y - 12, 8, 5, { epaisseur: 1.6, graine: g + 1 });
      // Le niveau d'encre qui ondule, et des bulles qui montent
      const h = 4 + Math.sin(temps * 2) * 1 + (v.niveau - 1) * 1.2;
      trait(ctx, [{ x: x - 9, y: y + 8 - h }, { x: x - 3, y: y + 7 - h }, { x: x + 3, y: y + 9 - h }, { x: x + 9, y: y + 8 - h }, { x: x + 9, y: y + 8 }, { x: x - 9, y: y + 8 }], { ferme: true, epaisseur: 1, graine: g + 2, fond: "rgba(34,64,143,0.55)" });
      const u = (temps * 0.6 + g * 0.01) % 1;
      cercle(ctx, x + Math.sin(u * 9) * 2, y - 13 - u * 12, 1.2 + u * 1.3, { epaisseur: 1, alpha: 1 - u, graine: g + 3 });
      if (sp === 1) ecrire(ctx, "%", x + 13, y - 10, { taille: 13, couleur: ROUGE, rotation: 0.2 });
      if (sp === 2) {
        // Une plume d'oie plantée dans l'encrier
        trait(ctx, [{ x: x + 1, y: y - 9 }, { x: x + 9, y: y - 26 }], { epaisseur: 1.2, graine: g + 6 });
        trait(ctx, [{ x: x + 3, y: y - 14 }, { x: x + 3, y: y - 22 }, { x: x + 9, y: y - 27 }, { x: x + 12, y: y - 20 }, { x: x + 6, y: y - 13 }], { ferme: true, couleur: ROUGE, epaisseur: 1.3, fond: "rgba(196,48,43,0.3)", graine: g + 7 });
      }
      break;
    }
  }
  // Les crans du niveau, ou l'étoile rouge de la spécialisation
  if (sp) {
    const e: V[] = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 ? 2 : 4.5;
      e.push({ x: x + 12 + Math.cos(a) * r, y: y - 12 + Math.sin(a) * r });
    }
    trait(ctx, e, { ferme: true, epaisseur: 1, couleur: ROUGE, fond: "rgba(196,48,43,0.6)", graine: g + 8, amp: 0.2 });
  } else {
    for (let k = 0; k < v.niveau; k++) trait(ctx, [{ x: x - 6 + k * 6, y: y + 16 }, { x: x - 4 + k * 6, y: y + 19 }], { epaisseur: 1.6, graine: g + 9 + k, couleur: CRAYON });
  }
}
