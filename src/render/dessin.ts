// Le dessin de la page : le cahier, la tour, les monstres, les murs, la colle, les effets.
import { ENNEMIS, type TypeEnnemi } from "../sim/ennemis";
import type { V } from "../sim/geom";
import { HAUTEUR, LARGEUR, PORTEE, positionScie, type Ennemi, type Jeu } from "../sim/jeu";
import { hash3 } from "../sim/rng";
import { bordDePage } from "../sim/jeu";
import { BLEU, CRAYON, LIGNE_CAHIER, PAPIER, ROUGE, cercle, ecrire, hachures, pointsCercle, rectangle, trait } from "./encre";

/** Le papier quadrillé (Seyès simplifié), une marge rouge, une auréole de café. Dessiné une fois. */
export function papier(largeur: number, hauteur: number, echelle: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.ceil(largeur * echelle);
  c.height = Math.ceil(hauteur * echelle);
  const ctx = c.getContext("2d")!;
  ctx.scale(echelle, echelle);
  ctx.fillStyle = PAPIER;
  ctx.fillRect(0, 0, largeur, hauteur);
  // Grain du papier
  for (let i = 0; i < (largeur * hauteur) / 90; i++) {
    ctx.fillStyle = `rgba(120,100,60,${hash3(i, 3, 0) * 0.05})`;
    ctx.fillRect(hash3(i, 1, 0) * largeur, hash3(i, 2, 0) * hauteur, 1, 1);
  }
  ctx.lineWidth = 0.6;
  for (let y = 8; y < hauteur; y += 8) {
    ctx.strokeStyle = y % 32 === 0 ? "rgba(80,120,190,0.3)" : LIGNE_CAHIER;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(largeur, y);
    ctx.stroke();
  }
  ctx.strokeStyle = LIGNE_CAHIER;
  for (let x = 8; x < largeur; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, hauteur);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(200,60,60,0.45)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(34, 0);
  ctx.lineTo(34, hauteur);
  ctx.stroke();
  // Une auréole de café, quelque part en bas à gauche
  ctx.strokeStyle = "rgba(150,105,55,0.13)";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(largeur * 0.18, hauteur * 0.82, 46, 0.3, Math.PI * 2 - 0.2);
  ctx.stroke();
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(largeur * 0.18 + 2, hauteur * 0.82 + 1, 41, 0, Math.PI * 2);
  ctx.stroke();
  return c;
}

// --- Les monstres ---

function yeux(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fache: boolean, couleur: string): void {
  ctx.fillStyle = couleur;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(x + s * r * 0.35, y - r * 0.15, Math.max(1.2, r * 0.11), 0, Math.PI * 2);
    ctx.fill();
    if (fache)
      trait(ctx, [{ x: x + s * r * 0.6, y: y - r * 0.5 }, { x: x + s * r * 0.15, y: y - r * 0.3 }], { couleur, epaisseur: 1.4, amp: 0.3 });
  }
}

export function monstre(ctx: CanvasRenderingContext2D, type: TypeEnnemi, x: number, y: number, r: number, graine: number, age: number, couleur = ROUGE, angle = 0): void {
  const o = { couleur, epaisseur: 1.8, graine };
  switch (type) {
    case "gribouille": {
      cercle(ctx, x, y, r, o);
      yeux(ctx, x, y, r, false, couleur);
      trait(ctx, [-0.4, -0.2, 0, 0.2, 0.4].map((k) => ({ x: x + k * r, y: y + r * 0.3 + (0.16 - k * k) * r * 0.7 })), { ...o, epaisseur: 1.4 });
      break;
    }
    case "carre": {
      rectangle(ctx, x - r, y - r * 0.85, r * 2, r * 1.7, o);
      yeux(ctx, x, y, r, true, couleur);
      trait(ctx, [{ x: x - r * 0.4, y: y + r * 0.4 }, { x: x + r * 0.4, y: y + r * 0.4 }], { ...o, epaisseur: 1.4 });
      break;
    }
    case "avion": {
      const c = Math.cos(angle);
      const s = Math.sin(angle);
      const p = (u: number, v: number) => ({ x: x + c * u - s * v, y: y + s * u + c * v });
      trait(ctx, [p(r * 1.3, 0), p(-r, r * 0.9), p(-r * 0.5, 0), p(-r, -r * 0.9)], { ...o, ferme: true, fond: "rgba(196,48,43,0.08)" });
      trait(ctx, [p(r * 1.3, 0), p(-r * 0.5, 0)], { ...o, epaisseur: 1.1 });
      break;
    }
    case "araignee": {
      for (let k = 0; k < 8; k++) {
        const cote = k < 4 ? -1 : 1;
        const i = k % 4;
        const a = (i - 1.5) * 0.45 + Math.sin(age * 14 + k) * 0.18;
        trait(ctx, [
          { x, y },
          { x: x + cote * r * 1.1 * Math.cos(a), y: y + r * 1.1 * Math.sin(a) - r * 0.3 },
          { x: x + cote * r * 1.6 * Math.cos(a), y: y + r * 1.4 * Math.sin(a) + r * 0.2 },
        ], { couleur, epaisseur: 1.2, graine: graine + k, amp: 0.3 });
      }
      cercle(ctx, x, y, r * 0.6, { ...o, fond: couleur });
      break;
    }
    case "tache":
    case "petite":
    case "mere": {
      const pts = pointsCercle(x, y, r, graine, 0.25);
      trait(ctx, pts, { ...o, ferme: true, fond: "rgba(196,48,43,0.22)", epaisseur: type === "mere" ? 2.6 : 1.8 });
      hachures(ctx, pts, "rgba(196,48,43,0.35)", type === "mere" ? 5 : 4);
      if (type !== "petite") {
        yeux(ctx, x, y, r * 0.8, true, couleur);
        if (type === "mere") {
          ecrire(ctx, "♛", x, y - r - 8, { couleur, taille: 20 });
        }
      }
      break;
    }
    case "gomme": {
      const pts = [{ x: x - r * 1.2, y: y - r * 0.6 }, { x: x + r * 1.2, y: y - r * 0.6 }, { x: x + r * 1.2, y: y + r * 0.6 }, { x: x - r * 1.2, y: y + r * 0.6 }];
      trait(ctx, pts, { ...o, ferme: true });
      const moitie = [pts[0], { x: x - r * 0.1, y: y - r * 0.6 }, { x: x - r * 0.1, y: y + r * 0.6 }, pts[3]];
      hachures(ctx, moitie, "rgba(196,48,43,0.5)", 3, 0.8);
      trait(ctx, [moitie[1], moitie[2]], o);
      ecrire(ctx, "GOMME", x + r * 0.55, y, { couleur, taille: 7 });
      break;
    }
    case "compas": {
      // Un compas qui marche sur ses deux pointes
      const ecart = r * (0.7 + Math.sin(age * 6) * 0.25);
      cercle(ctx, x, y - r * 0.9, r * 0.32, { ...o, fond: "rgba(196,48,43,0.2)" });
      trait(ctx, [{ x, y: y - r * 0.6 }, { x: x - ecart, y: y + r }], { ...o, epaisseur: 3 });
      trait(ctx, [{ x, y: y - r * 0.6 }, { x: x + ecart, y: y + r }], { ...o, epaisseur: 3 });
      trait(ctx, [{ x: x - ecart * 0.5, y: y + r * 0.2 }, { x: x + ecart * 0.5, y: y + r * 0.2 }], { ...o, epaisseur: 1.4 });
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + age;
        trait(ctx, [{ x, y: y - r * 0.9 }, { x: x + Math.cos(a) * r * 0.75, y: y - r * 0.9 + Math.sin(a) * r * 0.55 }], { couleur, epaisseur: 1, graine: graine + k, amp: 0.3 });
      }
      yeux(ctx, x, y - r * 0.9, r * 0.32, true, PAPIER);
      break;
    }
  }
}

function ennemi(ctx: CanvasRenderingContext2D, e: Ennemi, j: Jeu): void {
  const f = ENNEMIS[e.type];
  const couleur = e.touche > 0 ? "#ff7a59" : ROUGE;
  const angle = Math.atan2(j.tour.y - e.y, j.tour.x - e.x);
  const tremble = e.bloque ? Math.sin(e.age * 40) * 0.8 : 0;
  monstre(ctx, e.type, e.x + tremble, e.y, e.r, e.id, e.age, couleur, angle);
  if (e.englue) hachures(ctx, pointsCercle(e.x, e.y, e.r + 3, e.id), "rgba(34,64,143,0.35)", 4, 0.5);
  if (e.pv < e.pvMax) {
    const w = f.boss ? 60 : e.r * 2;
    const y = e.y - e.r - (f.boss ? 14 : 6);
    trait(ctx, [{ x: e.x - w / 2, y }, { x: e.x + w / 2, y }], { couleur: CRAYON, epaisseur: 1, amp: 0.2 });
    trait(ctx, [{ x: e.x - w / 2, y }, { x: e.x - w / 2 + (w * Math.max(0, e.pv)) / e.pvMax, y }], { couleur: ROUGE, epaisseur: f.boss ? 3 : 2, amp: 0.2 });
  }
}

// --- La tour ---

export function tour(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, temps: number, niv: Jeu["niv"] | null): void {
  // Les dents de la couronne
  const dents: V[] = [];
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    const r = i % 2 ? 32 : 36;
    dents.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r });
  }
  trait(ctx, dents, { ferme: true, epaisseur: 1.2, couleur: "rgba(34,64,143,0.55)", graine: 3 });
  cercle(ctx, x, y, 24, { epaisseur: 2.4, graine: 4, fond: "rgba(246,239,220,0.9)" });
  cercle(ctx, x, y, 15, { epaisseur: 1.6, graine: 5 });
  // Les créneaux
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2;
    rectangle(ctx, x + Math.cos(a) * 19 - 2.5, y + Math.sin(a) * 19 - 2.5, 5, 5, { epaisseur: 1.2, graine: 10 + i, amp: 0.3 });
  }
  // Le canon
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const p = (u: number, v: number) => ({ x: x + c * u - s * v, y: y + s * u + c * v });
  trait(ctx, [p(0, -4.5), p(26, -3.5), p(26, 3.5), p(0, 4.5)], { ferme: true, epaisseur: 2, graine: 20, fond: "rgba(34,64,143,0.15)" });
  cercle(ctx, x, y, 7, { epaisseur: 2, graine: 21, fond: PAPIER });
  // Les armes montées
  if (niv?.roquette) rectangle(ctx, x - 30, y + 18, 8, 12, { epaisseur: 1.4, graine: 30, fond: "rgba(34,64,143,0.2)" });
  if (niv?.foudre) trait(ctx, [{ x: x + 26, y: y - 26 }, { x: x + 21, y: y - 19 }, { x: x + 27, y: y - 17 }, { x: x + 22, y: y - 9 }], { epaisseur: 1.6, graine: 31 });
  ecrire(ctx, "ma tour", x - 44, y - 40, { couleur: CRAYON, taille: 13, rotation: -0.15 });
  trait(ctx, [{ x: x - 30, y: y - 33 }, { x: x - 22, y: y - 28 }], { couleur: CRAYON, epaisseur: 1, graine: 40 + Math.floor(temps) });
}

function scie(ctx: CanvasRenderingContext2D, p: V, temps: number): void {
  const pts: V[] = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + temps * 9;
    const r = i % 2 ? 6 : 10;
    pts.push({ x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r });
  }
  trait(ctx, pts, { ferme: true, epaisseur: 1.5, graine: 50, fond: "rgba(34,64,143,0.12)" });
}

// --- La scène ---

/** Les directions d'arrivée de la prochaine vague, en flèches rouges au bord de la page. */
export function fleches(ctx: CanvasRenderingContext2D, j: Jeu): void {
  for (const a of j.plan.fronts) {
    const p = bordDePage(a, -26);
    const q = bordDePage(a, -60);
    const c = Math.atan2(q.y - p.y, q.x - p.x);
    const pulse = 1 + Math.sin(j.temps * 6) * 0.15;
    trait(ctx, [p, q], { couleur: ROUGE, epaisseur: 2.5 * pulse, graine: 60 });
    trait(ctx, [
      { x: q.x - Math.cos(c - 0.5) * 12, y: q.y - Math.sin(c - 0.5) * 12 },
      q,
      { x: q.x - Math.cos(c + 0.5) * 12, y: q.y - Math.sin(c + 0.5) * 12 },
    ], { couleur: ROUGE, epaisseur: 2.5 * pulse, graine: 61 });
  }
}

export interface Brouillon {
  pts: V[];
  /** Ce que le geste deviendrait si on levait le doigt maintenant. */
  geste: string;
}

export function scene(ctx: CanvasRenderingContext2D, j: Jeu, brouillon: Brouillon | null): void {
  // Les taches d'encre laissées par les morts
  for (const e of j.eclats) {
    const pts = pointsCercle(e.x, e.y, e.r, e.graine, 0.35);
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = ROUGE;
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.fill();
    ctx.restore();
  }
  // La portée de la tour, au crayon
  ctx.save();
  ctx.setLineDash([3, 9]);
  ctx.strokeStyle = "rgba(60,62,75,0.22)";
  ctx.beginPath();
  ctx.arc(j.tour.x, j.tour.y, PORTEE, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  if (j.phase === "prep") fleches(ctx, j);
  // La colle
  for (const c of j.colles) {
    const fin = Math.min(1, (c.vie - c.age) / 1);
    ctx.save();
    ctx.globalAlpha = fin;
    hachures(ctx, c.poly, "rgba(34,64,143,0.35)", 5, -0.6);
    hachures(ctx, c.poly, "rgba(34,64,143,0.2)", 9, 0.7);
    trait(ctx, c.poly, { ferme: true, epaisseur: 1.6, graine: c.id, alpha: 0.8 });
    ctx.restore();
  }
  // Les murs : chaque bout pâlit avec ses PV, le tout pâlit en séchant
  for (const m of j.murs) {
    const seche = Math.min(1, (m.vie - m.age) / 3);
    m.segs.forEach((s, i) => {
      if (s.pv <= 0) return;
      const r = s.pv / s.pvMax;
      trait(ctx, [s.a, s.b], { epaisseur: 2 + 2.4 * r, graine: m.id * 100 + i, alpha: seche * (0.35 + 0.65 * r), amp: 0.5 });
    });
  }
  tour(ctx, j.tour.x, j.tour.y, j.tour.angle, j.temps, j.niv);
  for (let k = 0; k < j.niv.scie; k++) scie(ctx, positionScie(j, k), j.temps);
  for (const e of j.ennemis) ennemi(ctx, e, j);
  // Les tirs
  for (const s of j.tirs) {
    const n = Math.hypot(s.vx, s.vy);
    const l = s.roquette ? 10 : 7;
    trait(ctx, [{ x: s.x - (s.vx / n) * l, y: s.y - (s.vy / n) * l }, { x: s.x, y: s.y }], { epaisseur: s.roquette ? 4 : 2, amp: 0.2 });
  }
  // Les effets
  for (const f of j.effets) {
    const t = f.age / f.vie;
    switch (f.type) {
      case "rature":
        trait(ctx, f.pts!, { epaisseur: 3, alpha: 1 - t, graine: f.graine, amp: 1 });
        break;
      case "eclair": {
        const pts: V[] = [];
        for (let i = 1; i < f.pts!.length; i++) {
          const a = f.pts![i - 1];
          const b = f.pts![i];
          for (let k = 0; k < 4; k++) pts.push({ x: a.x + ((b.x - a.x) * k) / 4 + (hash3(f.graine, i * 4 + k, 0) - 0.5) * 12, y: a.y + ((b.y - a.y) * k) / 4 + (hash3(f.graine, i * 4 + k, 1) - 0.5) * 12 });
        }
        pts.push(f.pts![f.pts!.length - 1]);
        trait(ctx, pts, { epaisseur: 2, alpha: 1 - t, graine: f.graine, amp: 2 });
        break;
      }
      case "boom": {
        const r = (f.r ?? 40) * (0.6 + t * 0.5);
        for (let k = 0; k < 12; k++) {
          const a = (k / 12) * Math.PI * 2 + hash3(f.graine, k, 0);
          trait(ctx, [{ x: f.x + Math.cos(a) * r * 0.4, y: f.y + Math.sin(a) * r * 0.4 }, { x: f.x + Math.cos(a) * r, y: f.y + Math.sin(a) * r }], { epaisseur: 2, alpha: 1 - t, graine: f.graine + k });
        }
        break;
      }
      case "chiffre":
        ecrire(ctx, f.texte!, f.x, f.y - t * 16, { couleur: BLEU, taille: 14, alpha: 1 - t * t });
        break;
      case "impact":
        ecrire(ctx, f.texte!, f.x, f.y - t * 20, { couleur: ROUGE, taille: 20, police: "titre", alpha: 1 - t });
        cercle(ctx, f.x, f.y, 10 + t * 20, { couleur: ROUGE, alpha: 1 - t, graine: f.graine });
        break;
      case "rate":
      case "sec":
        ecrire(ctx, f.texte!, f.x, f.y - 14 - t * 10, { couleur: CRAYON, taille: 16, alpha: 1 - t, rotation: -0.1 });
        break;
      case "casse":
        for (let k = 0; k < 5; k++) {
          const a = hash3(f.graine, k, 0) * Math.PI * 2;
          const d = 4 + t * 14;
          ctx.fillStyle = BLEU;
          ctx.globalAlpha = 1 - t;
          ctx.fillRect(f.x + Math.cos(a) * d, f.y + Math.sin(a) * d, 2, 2);
          ctx.globalAlpha = 1;
        }
        break;
    }
  }
  // Le trait en cours, avec ce qu'il va devenir
  if (brouillon && brouillon.pts.length > 1) {
    const couleur = brouillon.geste === "rien" ? CRAYON : BLEU;
    trait(ctx, brouillon.pts, { couleur, epaisseur: brouillon.geste === "mur" ? 3.5 : 2.4, amp: 0.4, graine: 7 });
  }
}

export { LARGEUR, HAUTEUR };
