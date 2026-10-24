// La page en jeu : obstacles, entrées, Cœur, chemins au crayon, murs, colle, tours, monstres, tirs et effets.
import type { Carte } from "../sim/carte";
import { ENNEMIS } from "../sim/ennemis";
import type { V } from "../sim/geom";
import { positionLame, stats, type Ennemi, type Jeu, type Tour } from "../sim/jeu";
import { hash3 } from "../sim/rng";
import { PORTEE_INFINIE, RAYON_TOUR } from "../sim/tours";
import { BLEU, CRAYON, PAPIER, ROUGE, cercle, ecrire, hachures, pointsCercle, trait } from "./encre";
import { monstre } from "./monstres";
import { dessinerTour } from "./tours";

/** Les obstacles et le Cœur ne bougent pas : on les dessine une fois par carte (sur le papier). */
export function decor(ctx: CanvasRenderingContext2D, carte: Carte): void {
  for (const b of carte.blocs) {
    const cx = b.x + 10;
    const cy = b.y + 10;
    const g = b.x * 31 + b.y * 17;
    if (b.type === "tache") {
      const pts = pointsCercle(cx, cy, 13, g, 0.3);
      ctx.fillStyle = "rgba(28,38,80,0.82)";
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.fill();
    } else if (b.type === "trou") {
      ctx.fillStyle = "rgba(60,50,40,0.18)";
      ctx.beginPath();
      ctx.arc(cx + 1.5, cy + 1.5, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#cfc4a8";
      ctx.beginPath();
      ctx.arc(cx, cy, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(60,50,40,0.35)";
      ctx.lineWidth = 1;
      ctx.stroke();
    } else {
      const pts = pointsCercle(cx, cy, 14, g, 0.25);
      ctx.fillStyle = "rgba(150,100,50,0.16)";
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.fill();
    }
  }
}

export function coeur(ctx: CanvasRenderingContext2D, x: number, y: number, taille: number, battement: number, graine = 5): void {
  const pts: V[] = [];
  const s = taille * (1 + battement * 0.15);
  for (let i = 0; i <= 40; i++) {
    const t = (i / 40) * Math.PI * 2;
    pts.push({ x: x + (s * 16 * Math.sin(t) ** 3) / 17, y: y - (s * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))) / 17 });
  }
  trait(ctx, pts, { couleur: ROUGE, epaisseur: 2.4, graine, fond: "rgba(196,48,43,0.25)" });
  hachures(ctx, pts, "rgba(196,48,43,0.4)", 4, -0.8);
}

function fleche(ctx: CanvasRenderingContext2D, de: V, vers: V, couleur: string, epaisseur: number, graine: number): void {
  const a = Math.atan2(vers.y - de.y, vers.x - de.x);
  trait(ctx, [de, vers], { couleur, epaisseur, graine });
  trait(ctx, [
    { x: vers.x - Math.cos(a - 0.5) * 10, y: vers.y - Math.sin(a - 0.5) * 10 },
    vers,
    { x: vers.x - Math.cos(a + 0.5) * 10, y: vers.y - Math.sin(a + 0.5) * 10 },
  ], { couleur, epaisseur, graine: graine + 1 });
}

function ennemi(ctx: CanvasRenderingContext2D, e: Ennemi): void {
  const f = ENNEMIS[e.type];
  const couleur = e.touche > 0 ? "#ff7a59" : ROUGE;
  const tremble = e.bloque ? Math.sin(e.age * 40) * 0.8 : 0;
  const cache = f.furtif && e.revele <= 0;
  ctx.save();
  if (cache) ctx.globalAlpha = 0.3;
  monstre(ctx, e.type, e.x + tremble, e.y, e.r, e.id, e.age, cache ? CRAYON : couleur, Math.atan2(e.vy, e.vx));
  ctx.restore();
  if (e.bouclier > 0) cercle(ctx, e.x, e.y, e.r + 4, { couleur: ROUGE, epaisseur: 1, alpha: 0.6, graine: e.id + 1 });
  if (e.englue > 0 || e.ralenti >= 0.5) hachures(ctx, pointsCercle(e.x, e.y, e.r + 3, e.id), "rgba(34,64,143,0.35)", 4, 0.5);
  if (e.etourdi > 0) for (let k = 0; k < 3; k++) {
    const a = e.age * 6 + (k * Math.PI * 2) / 3;
    ecrire(ctx, "*", e.x + Math.cos(a) * (e.r + 4), e.y - e.r - 2 + Math.sin(a) * 3, { taille: 11, couleur: BLEU });
  }
  if (e.marque > 0) ecrire(ctx, "✗", e.x + e.r, e.y - e.r, { taille: 12, couleur: ROUGE });
  if (e.pv < e.pvMax) {
    const w = f.boss ? 64 : Math.max(16, e.r * 2);
    const y = e.y - e.r - (f.boss ? 14 : 6);
    trait(ctx, [{ x: e.x - w / 2, y }, { x: e.x + w / 2, y }], { couleur: CRAYON, epaisseur: 1, amp: 0.2 });
    trait(ctx, [{ x: e.x - w / 2, y }, { x: e.x - w / 2 + (w * Math.max(0, e.pv)) / e.pvMax, y }], { couleur: ROUGE, epaisseur: f.boss ? 3 : 2, amp: 0.2 });
  }
}

export interface Brouillon {
  pts: V[];
  /** Le geste deviné : mur, rature, cercle, tour ou rien. */
  geste: string;
}

export function scene(ctx: CanvasRenderingContext2D, j: Jeu, brouillon: Brouillon | null, selection: Tour | null): void {
  // Les taches d'encre laissées par les morts
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = ROUGE;
  for (const e of j.eclats) {
    const pts = pointsCercle(e.x, e.y, e.r, e.graine, 0.35);
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.fill();
  }
  ctx.restore();
  // Les chemins, au crayon (plus appuyés avant la première vague)
  ctx.save();
  ctx.setLineDash([2, 7]);
  ctx.lineCap = "round";
  ctx.strokeStyle = j.phase === "attente" ? "rgba(60,62,75,0.55)" : "rgba(60,62,75,0.22)";
  ctx.lineWidth = j.phase === "attente" ? 1.6 : 1.1;
  for (const t of j.trajets) {
    ctx.beginPath();
    t.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.stroke();
  }
  ctx.restore();
  // Les entrées
  j.carte.entrees.forEach((e, i) => {
    const dx = e.bord.x - e.depart.x;
    const dy = e.bord.y - e.depart.y;
    const n = Math.hypot(dx, dy) || 1;
    const pulse = j.phase === "attente" ? 1 + Math.sin(j.temps * 6) * 0.2 : 1;
    fleche(ctx, { x: e.bord.x - (dx / n) * 4, y: e.bord.y - (dy / n) * 4 }, { x: e.bord.x + (dx / n) * 26, y: e.bord.y + (dy / n) * 26 }, ROUGE, 2.4 * pulse, 60 + i * 3);
  });
  // Le Cœur
  const touche = j.effets.find((f) => f.type === "fuite");
  coeur(ctx, j.carte.coeur.x, j.carte.coeur.y, 15, touche ? 1 - touche.age / touche.vie : Math.sin(j.temps * 2.4) * 0.15);
  // Le sol qui brûle
  for (const z of j.zones) {
    const a = Math.min(1, (z.vie - z.age) * 2);
    hachures(ctx, pointsCercle(z.x, z.y, z.r, Math.round(z.x), 0.2), `rgba(196,48,43,${0.35 * a})`, 4, -0.4);
  }
  // La colle
  for (const c of j.colles) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, c.vie - c.age);
    hachures(ctx, c.poly, "rgba(34,64,143,0.35)", 5, -0.6);
    hachures(ctx, c.poly, "rgba(34,64,143,0.2)", 9, 0.7);
    trait(ctx, c.poly, { ferme: true, epaisseur: 1.6, graine: c.id, alpha: 0.8 });
    ctx.restore();
  }
  // Les murs
  for (const m of j.murs) {
    const seche = Math.min(1, (m.vie - m.age) / 3);
    m.segs.forEach((s, i) => {
      if (s.pv <= 0) return;
      const r = s.pv / s.pvMax;
      trait(ctx, [s.a, s.b], { epaisseur: 2 + 2.4 * r, graine: m.id * 100 + i, alpha: seche * (0.35 + 0.65 * r), amp: 0.5 });
    });
  }
  // La portée de la tour choisie
  if (selection) {
    const s = stats(selection);
    if (s.portee && s.portee < PORTEE_INFINIE) {
      ctx.save();
      ctx.fillStyle = "rgba(34,64,143,0.06)";
      ctx.beginPath();
      ctx.arc(selection.x, selection.y, s.portee, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      cercle(ctx, selection.x, selection.y, s.portee, { epaisseur: 1.2, couleur: "rgba(34,64,143,0.5)", graine: 77 });
    }
    cercle(ctx, selection.x, selection.y, RAYON_TOUR + 6, { couleur: ROUGE, epaisseur: 1.6, graine: 78 });
  }
  // Les auras des spirales
  for (const t of j.tours) {
    const s = stats(t);
    if (s.ralenti) {
      ctx.save();
      ctx.setLineDash([2, 6]);
      ctx.strokeStyle = "rgba(34,64,143,0.25)";
      ctx.beginPath();
      ctx.arc(t.x, t.y, s.portee, j.temps * 0.5, j.temps * 0.5 + Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
  for (const t of j.tours) {
    dessinerTour(ctx, { type: t.type, x: t.x, y: t.y, angle: t.angle, niveau: t.niveau, spec: t.spec, recul: t.recul, temps: j.temps, id: t.id });
    if (t.pv < t.pvMax) {
      const w = 22;
      trait(ctx, [{ x: t.x - w / 2, y: t.y - 19 }, { x: t.x - w / 2 + (w * t.pv) / t.pvMax, y: t.y - 19 }], { couleur: t.pv < t.pvMax * 0.35 ? ROUGE : BLEU, epaisseur: 2, amp: 0.2 });
    }
    const s = stats(t);
    if (s.lames) {
      for (let k = 0; k < s.lames; k++) {
        const p = positionLame(j, t, k, s.lames, s.orbite ?? 36);
        const pts: V[] = [];
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2 + j.temps * 10;
          const r = i % 2 ? 4 : 7;
          pts.push({ x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r });
        }
        trait(ctx, pts, { ferme: true, epaisseur: 1.3, graine: t.id + k, fond: "rgba(34,64,143,0.15)", amp: 0.3 });
      }
    }
  }
  for (const e of j.ennemis) ennemi(ctx, e);
  // Les tirs
  for (const s of j.tirs) {
    const n = Math.hypot(s.vx, s.vy) || 1;
    const l = s.type === "roquette" ? 9 : 7;
    trait(ctx, [{ x: s.x - (s.vx / n) * l, y: s.y - (s.vy / n) * l }, { x: s.x, y: s.y }], { epaisseur: s.type === "roquette" ? 4 : 2, amp: 0.2 });
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
      case "coche":
        trait(ctx, [{ x: f.x - 8, y: f.y - 1 }, { x: f.x - 2, y: f.y + 7 }, { x: f.x + 10, y: f.y - 10 }], { couleur: ROUGE, epaisseur: f.rouge ? 4 : 2.6, alpha: 1 - t, graine: f.graine });
        break;
      case "chiffre":
        ecrire(ctx, f.texte!, f.x, f.y - t * 16, { couleur: f.rouge ? ROUGE : BLEU, taille: f.rouge ? 18 : 13, alpha: 1 - t * t });
        break;
      case "fuite":
        ecrire(ctx, f.texte!, f.x + 18, f.y - 14 - t * 20, { couleur: ROUGE, taille: 22, police: "titre", alpha: 1 - t });
        break;
      case "texte":
        ecrire(ctx, f.texte!, f.x, f.y - t * 10, { couleur: CRAYON, taille: 15, alpha: 1 - t * t, rotation: -0.05 });
        break;
      case "pose":
        cercle(ctx, f.x, f.y, 14 + t * 14, { epaisseur: 1.5, alpha: 1 - t, graine: f.graine });
        break;
      case "detruite":
      case "casse":
        for (let k = 0; k < (f.type === "detruite" ? 10 : 5); k++) {
          const a = hash3(f.graine, k, 0) * Math.PI * 2;
          const d = 4 + t * (f.type === "detruite" ? 26 : 14);
          ctx.fillStyle = BLEU;
          ctx.globalAlpha = 1 - t;
          ctx.fillRect(f.x + Math.cos(a) * d, f.y + Math.sin(a) * d, 2.5, 2.5);
          ctx.globalAlpha = 1;
        }
        break;
      case "soin":
        break;
    }
  }
  // Le trait en cours
  if (brouillon && brouillon.pts.length > 1) {
    const couleur = brouillon.geste === "rien" ? CRAYON : BLEU;
    trait(ctx, brouillon.pts, { couleur, epaisseur: brouillon.geste === "mur" ? 3.5 : 2.4, amp: 0.4, graine: 7 });
  }
}

export { PAPIER };
