// La page en jeu : obstacles, entrées, Cœur, chemins au crayon, murs, colle, tours, monstres, tirs et effets.
import type { Carte } from "../sim/carte";
import { ENNEMIS } from "../sim/ennemis";
import type { V } from "../sim/geom";
import { positionLame, stats, type Ennemi, type Jeu, type Tour } from "../sim/jeu";
import { hash3 } from "../sim/rng";
import { PORTEE_INFINIE, RAYON_TOUR } from "../sim/tours";
import { BLEU, CRAYON, PAPIER, ROUGE, cercle, ecrire, hachures, pointsCercle, rectangle, trait } from "./encre";
import { dessinerSous, dessinerSur, echelleTour } from "./fx";
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

export function coeur(ctx: CanvasRenderingContext2D, x: number, y: number, taille: number, battement: number, graine = 5, fele = 0): void {
  const pts: V[] = [];
  const s = taille * (1 + battement * 0.15);
  for (let i = 0; i <= 40; i++) {
    const t = (i / 40) * Math.PI * 2;
    pts.push({ x: x + (s * 16 * Math.sin(t) ** 3) / 17, y: y - (s * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))) / 17 });
  }
  trait(ctx, pts, { couleur: ROUGE, epaisseur: 2.4, graine, fond: "rgba(196,48,43,0.25)" });
  hachures(ctx, pts, "rgba(196,48,43,0.4)", 4, -0.8);
  // Les fêlures, à mesure que les vies s'en vont
  const k = s / 17;
  if (fele > 0) trait(ctx, [{ x: x - 2 * k, y: y - 9 * k }, { x: x + 3 * k, y: y - 4 * k }, { x: x - 3 * k, y: y + 1 * k }, { x: x + 2 * k, y: y + 6 * k }], { couleur: "#5a1512", epaisseur: 1.6, graine: graine + 3, amp: 0.2 });
  if (fele > 1) trait(ctx, [{ x: x + 3 * k, y: y - 4 * k }, { x: x + 9 * k, y: y - 6 * k }, { x: x + 11 * k, y: y - 2 * k }], { couleur: "#5a1512", epaisseur: 1.3, graine: graine + 4, amp: 0.2 });
  if (fele > 2) trait(ctx, [{ x: x - 3 * k, y: y + 1 * k }, { x: x - 9 * k, y: y - 1 * k }, { x: x - 12 * k, y: y - 6 * k }], { couleur: "#5a1512", epaisseur: 1.3, graine: graine + 5, amp: 0.2 });
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
  const vole = !!f.vole;
  const lent = e.englue > 0 || e.etourdi > 0;
  // La démarche : on sautille (les volants planent), on penche d'un pied sur l'autre
  const pas = e.age * (6 + f.vitesse * 0.12) + e.id;
  const saut = vole ? Math.sin(e.age * 3 + e.id) * 2.5 : lent ? 0 : -Math.abs(Math.sin(pas)) * Math.min(3, e.r * 0.2);
  const penche = vole || f.boss ? 0 : lent ? 0 : Math.sin(pas) * 0.12;
  // Touché : il s'écrase un instant
  const ecrase = e.touche > 0 ? e.touche / 0.12 : 0;
  ctx.save();
  ctx.fillStyle = "rgba(60,50,40,0.13)";
  ctx.beginPath();
  if (vole) ctx.ellipse(e.x + 9, e.y + e.r + 12, e.r * 0.7, e.r * 0.25, 0, 0, Math.PI * 2);
  else ctx.ellipse(e.x + 1.5, e.y + e.r * 0.85, e.r * (0.9 + saut * -0.03), e.r * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  if (cache) ctx.globalAlpha = 0.3;
  ctx.translate(e.x + tremble, e.y + saut + e.r * 0.8);
  ctx.rotate(penche);
  ctx.scale(1 + ecrase * 0.3, 1 - ecrase * 0.25);
  ctx.translate(-(e.x + tremble), -(e.y + e.r * 0.8));
  monstre(ctx, e.type, e.x + tremble, e.y, e.r, e.id, e.age, cache ? CRAYON : couleur, Math.atan2(e.vy, e.vx));
  ctx.restore();
  if (f.soigne) {
    const pulse = (e.age * 0.8) % 1;
    cercle(ctx, e.x, e.y, 20 + pulse * 40, { couleur: "rgba(60,140,90,0.9)", epaisseur: 1, alpha: 0.4 * (1 - pulse), graine: e.id + 5 });
  }
  if (e.bouclier > 0) cercle(ctx, e.x, e.y, e.r + 4, { couleur: ROUGE, epaisseur: 1, alpha: 0.6, graine: e.id + 1 });
  if (e.englue > 0 || e.ralenti >= 0.5) hachures(ctx, pointsCercle(e.x, e.y, e.r + 3, e.id), "rgba(34,64,143,0.35)", 4, 0.5);
  if (e.etourdi > 0) for (let k = 0; k < 3; k++) {
    const a = e.age * 6 + (k * Math.PI * 2) / 3;
    ecrire(ctx, "*", e.x + Math.cos(a) * (e.r + 4), e.y - e.r - 2 + Math.sin(a) * 3, { taille: 11, couleur: BLEU });
  }
  if (e.marque > 0) ecrire(ctx, "✗", e.x + e.r, e.y - e.r, { taille: 12, couleur: ROUGE });
  if (f.boss) {
    // La jauge du boss, avec son nom, bien lisible
    const w = 90;
    const y = Math.max(16, e.y - e.r - 30);
    const x = Math.max(w / 2 + 4, Math.min(400 - w / 2 - 4, e.x));
    ecrire(ctx, f.nom, x, y - 10, { taille: 13, couleur: ROUGE });
    rectangle(ctx, x - w / 2, y - 3, w, 6, { couleur: ROUGE, epaisseur: 1.2, amp: 0.2, graine: e.id });
    ctx.fillStyle = "rgba(196,48,43,0.75)";
    ctx.fillRect(x - w / 2 + 1, y - 2, (w - 2) * Math.max(0, e.pv / e.pvMax), 4);
  } else if (e.pv < e.pvMax) {
    const w = Math.max(16, e.r * 2);
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
  const ratio = j.vies / j.viesMax;
  const fele = ratio < 0.25 ? 3 : ratio < 0.5 ? 2 : ratio < 0.85 ? 1 : 0;
  // Le Cœur bat plus vite quand il va mal
  const rythme = 2.4 + (1 - ratio) * 5;
  coeur(ctx, j.carte.coeur.x, j.carte.coeur.y, 15, touche ? 1 - touche.age / touche.vie : Math.max(0, Math.sin(j.temps * rythme)) ** 4 * 0.35, 5, fele);
  dessinerSous(ctx);
  // Le sol qui brûle
  for (const z of j.zones) {
    const a = Math.min(1, (z.vie - z.age) * 2);
    hachures(ctx, pointsCercle(z.x, z.y, z.r, Math.round(z.x), 0.2), `rgba(196,48,43,${0.25 * a})`, 4, -0.4);
    // Des flammèches qui dansent
    for (let k = 0; k < 7; k++) {
      const ang = hash3(Math.round(z.x), k, 1) * Math.PI * 2;
      const d = Math.sqrt(hash3(Math.round(z.y), k, 2)) * z.r * 0.8;
      const fx0 = z.x + Math.cos(ang) * d;
      const fy0 = z.y + Math.sin(ang) * d;
      const h = (5 + Math.sin(j.temps * 14 + k * 2.1) * 2.5) * a;
      trait(ctx, [{ x: fx0 - 3, y: fy0 }, { x: fx0 + Math.sin(j.temps * 9 + k) * 1.5, y: fy0 - h }, { x: fx0 + 3, y: fy0 }], { couleur: ROUGE, epaisseur: 1.2, fond: `rgba(230,120,40,${0.35 * a})`, graine: k, amp: 0.3 });
    }
  }
  // La colle
  for (const c of j.colles) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, c.vie - c.age);
    hachures(ctx, c.poly, "rgba(34,64,143,0.35)", 5, -0.6 + Math.sin(j.temps * 1.3 + c.id) * 0.06);
    hachures(ctx, c.poly, "rgba(34,64,143,0.2)", 9, 0.7 + Math.sin(j.temps * 1.1 + c.id) * 0.06);
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
    // L'encre fraîche brille, puis sèche
    if (m.age < 1.5) {
      const vivants = m.segs.filter((s) => s.pv > 0);
      for (const [i, s] of vivants.entries()) trait(ctx, [{ x: s.a.x - 0.8, y: s.a.y - 0.8 }, { x: s.b.x - 0.8, y: s.b.y - 0.8 }], { couleur: "#ffffff", epaisseur: 1, alpha: 0.6 * (1 - m.age / 1.5), amp: 0.3, graine: m.id * 100 + i + 50 });
    }
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
    const echelle = echelleTour(t.id);
    ctx.save();
    // L'ombre au crayon, puis la tour (qui rebondit quand on la pose ou l'améliore)
    ctx.fillStyle = "rgba(60,50,40,0.12)";
    ctx.beginPath();
    ctx.ellipse(t.x + 2, t.y + 11, 12 * echelle, 4 * echelle, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.translate(t.x, t.y);
    ctx.scale(echelle, echelle);
    ctx.translate(-t.x, -t.y);
    dessinerTour(ctx, { type: t.type, x: t.x, y: t.y, angle: t.angle, niveau: t.niveau, spec: t.spec, recul: t.recul, temps: j.temps, id: t.id });
    ctx.restore();
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
    const ux = s.vx / n;
    const uy = s.vy / n;
    if (s.type === "roquette") {
      // Une petite fusée au stylo, avec sa flamme qui crépite
      const a = Math.atan2(uy, ux);
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(a);
      const flamme = 5 + Math.sin(j.temps * 60 + s.tour) * 2.5;
      trait(ctx, [{ x: -6, y: -2.5 }, { x: -6 - flamme, y: 0 }, { x: -6, y: 2.5 }], { couleur: ROUGE, epaisseur: 1.4, fond: "rgba(196,48,43,0.4)", amp: 0.5, graine: s.tour });
      trait(ctx, [{ x: -6, y: -3 }, { x: 4, y: -3 }, { x: 8, y: 0 }, { x: 4, y: 3 }, { x: -6, y: 3 }], { ferme: true, epaisseur: 1.6, fond: "rgba(246,239,220,0.95)", amp: 0.2, graine: s.tour + 1 });
      trait(ctx, [{ x: -6, y: -3 }, { x: -9, y: -6 }], { epaisseur: 1.3, amp: 0.2 });
      trait(ctx, [{ x: -6, y: 3 }, { x: -9, y: 6 }], { epaisseur: 1.3, amp: 0.2 });
      ctx.restore();
    } else {
      // Une goutte d'encre lancée, et sa traînée
      for (let k = 3; k >= 1; k--) {
        trait(ctx, [{ x: s.x - ux * (k * 7 + 4), y: s.y - uy * (k * 7 + 4) }, { x: s.x - ux * ((k - 1) * 7 + 4), y: s.y - uy * ((k - 1) * 7 + 4) }], { epaisseur: 2.2 - k * 0.5, alpha: 0.9 - k * 0.25, amp: 0.3, graine: s.tour + k });
      }
      ctx.save();
      ctx.fillStyle = BLEU;
      ctx.translate(s.x, s.y);
      ctx.rotate(Math.atan2(uy, ux));
      ctx.beginPath();
      ctx.moveTo(4, 0);
      ctx.quadraticCurveTo(0, -3, -4, 0);
      ctx.quadraticCurveTo(0, 3, 4, 0);
      ctx.fill();
      ctx.restore();
    }
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
          for (let k = 0; k < 5; k++) pts.push({ x: a.x + ((b.x - a.x) * k) / 5 + (hash3(f.graine, i * 5 + k, 0) - 0.5) * 14, y: a.y + ((b.y - a.y) * k) / 5 + (hash3(f.graine, i * 5 + k, 1) - 0.5) * 14 });
        }
        pts.push(f.pts![f.pts!.length - 1]);
        const vif = 1 - t;
        // Le halo, le cœur de l'éclair, et quelques branches
        trait(ctx, pts, { couleur: "rgba(90,130,230,0.35)", epaisseur: 8 * vif, alpha: vif, graine: f.graine, amp: 2 });
        trait(ctx, pts, { epaisseur: 2.4, alpha: vif, graine: f.graine, amp: 2 });
        trait(ctx, pts, { couleur: "#ffffff", epaisseur: 0.8, alpha: vif, graine: f.graine, amp: 2 });
        for (let b = 2; b < pts.length - 1; b += 4) {
          const o = pts[b];
          const ang = hash3(f.graine, b, 7) * Math.PI * 2;
          trait(ctx, [o, { x: o.x + Math.cos(ang) * 9, y: o.y + Math.sin(ang) * 9 }, { x: o.x + Math.cos(ang + 0.6) * 15, y: o.y + Math.sin(ang + 0.6) * 15 }], { epaisseur: 1.2, alpha: vif * 0.8, graine: f.graine + b });
        }
        break;
      }
      case "boom": {
        const r = (f.r ?? 40) * (0.5 + Math.sqrt(t) * 0.6);
        // Une giclée d'encre qui s'étale, et ses éclaboussures
        ctx.save();
        ctx.globalAlpha = 0.5 * (1 - t);
        ctx.fillStyle = BLEU;
        const tache = pointsCercle(f.x, f.y, r * 0.55, f.graine, 0.45);
        ctx.beginPath();
        tache.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
        ctx.fill();
        ctx.restore();
        for (let k = 0; k < 12; k++) {
          const a = (k / 12) * Math.PI * 2 + hash3(f.graine, k, 0);
          const l = 0.6 + hash3(f.graine, k, 1) * 0.4;
          trait(ctx, [{ x: f.x + Math.cos(a) * r * 0.5, y: f.y + Math.sin(a) * r * 0.5 }, { x: f.x + Math.cos(a) * r * l * 1.1, y: f.y + Math.sin(a) * r * l * 1.1 }], { epaisseur: 2.4 * (1 - t), alpha: 1 - t, graine: f.graine + k });
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
  dessinerSur(ctx);
  // Le trait en cours
  if (brouillon && brouillon.pts.length > 1) {
    const couleur = brouillon.geste === "rien" ? CRAYON : BLEU;
    trait(ctx, brouillon.pts, { couleur, epaisseur: brouillon.geste === "mur" ? 3.5 : 2.4, amp: 0.4, graine: 7 });
  }
}

export { PAPIER };
