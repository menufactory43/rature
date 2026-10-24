// La page en jeu : obstacles, entrées, Cœur, chemins au crayon, murs, colle, tours, monstres, tirs et effets.
import type { Carte } from "../sim/carte";
import { ENNEMIS } from "../sim/ennemis";
import type { V } from "../sim/geom";
import { positionLame, segmentRegle, stats, zoneGomme, type Ennemi, type Jeu, type Tour } from "../sim/jeu";
import { hash3 } from "../sim/rng";
import { PORTEE_INFINIE, RAYON_TOUR } from "../sim/tours";
import { BLEU, CRAYON, PAPIER, ROUGE, cercle, ecrire, hachures, pointsCercle, rectangle, trait } from "./encre";
import { dessinerSous, dessinerSur, echelleTour } from "./fx";
import { monstre } from "./monstres";
import { frottement, lasso, regle } from "./pouvoirs";
import type { Pouvoir } from "../sim/pouvoirs";
import { dessinerTour } from "./tours";

/** Les obstacles et les gribouillis des marges ne bougent pas : on les dessine une fois par carte (sur le papier). */
export function decor(ctx: CanvasRenderingContext2D, carte: Carte): void {
  griffonnages(ctx, carte);
  for (const c of carte.cadres) cadre(ctx, c);
  const taches = carte.blocs.filter((b) => b.type === "tache");
  const trous = carte.blocs.filter((b) => b.type === "trou");
  const cafes = carte.blocs.filter((b) => b.type === "cafe");
  // Le café : une flaque d'un seul tenant, plus foncée au bord (comme une auréole de tasse)
  if (cafes.length) {
    const flaque = (r: number) => {
      ctx.beginPath();
      for (const b of cafes) {
        const pts = pointsCercle(b.x + 10, b.y + 10, r, b.x * 31 + b.y * 17, 0.15);
        pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
        ctx.closePath();
      }
    };
    ctx.save();
    flaque(16);
    ctx.fillStyle = "rgba(140,85,35,0.26)";
    ctx.fill("nonzero");
    flaque(12.5);
    ctx.fillStyle = "rgba(246,239,220,0.55)";
    ctx.fill("nonzero");
    flaque(12.5);
    ctx.fillStyle = "rgba(150,100,50,0.1)";
    ctx.fill("nonzero");
    ctx.restore();
  }
  // Les taches d'encre : les cases voisines se fondent en une seule grosse tache, avec ses coulures
  if (taches.length) {
    ctx.save();
    ctx.fillStyle = "rgba(28,38,80,0.86)";
    ctx.beginPath();
    for (const b of taches) {
      const pts = pointsCercle(b.x + 10, b.y + 10, 15, b.x * 31 + b.y * 17, 0.18);
      pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.closePath();
    }
    ctx.fill("nonzero");
    for (const b of taches) {
      const g = b.x * 13 + b.y * 7;
      // Des éclaboussures autour, et une coulure sous les bords bas
      if (hash3(g, 1, 0) < 0.35) {
        const a = hash3(g, 2, 0) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(b.x + 10 + Math.cos(a) * 19, b.y + 10 + Math.sin(a) * 19, 1.5 + hash3(g, 3, 0) * 2, 0, Math.PI * 2);
        ctx.fill();
      }
      const dessous = taches.some((o) => o.x === b.x && o.y === b.y + 20);
      if (!dessous && hash3(g, 4, 0) < 0.3) {
        // Une coulure : elle part du bord de la tache et finit en goutte
        const x = b.x + 5 + hash3(g, 5, 0) * 10;
        const l = 5 + hash3(g, 6, 0) * 9;
        ctx.beginPath();
        ctx.moveTo(x - 4, b.y + 20);
        ctx.quadraticCurveTo(x - 1.8, b.y + 22 + l * 0.6, x - 2.6, b.y + 22 + l);
        ctx.arc(x, b.y + 22 + l, 2.6, Math.PI, 0, true);
        ctx.quadraticCurveTo(x + 1.8, b.y + 22 + l * 0.6, x + 4, b.y + 20);
        ctx.fill();
      }
    }
    // Un reflet sur l'encre encore brillante
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 1.4;
    ctx.lineCap = "round";
    for (const b of taches) {
      if (hash3(b.x, b.y, 9) < 0.8 || taches.some((o) => o.x === b.x && o.y === b.y - 20)) continue;
      ctx.beginPath();
      ctx.arc(b.x + 10, b.y + 12, 9, Math.PI * 1.15, Math.PI * 1.55);
      ctx.stroke();
    }
    ctx.restore();
  }
  // Les trous : la feuille déchirée, bord en dents de scie, l'ombre de la page d'en dessous
  for (const b of trous) {
    const cx = b.x + 10;
    const cy = b.y + 10;
    const g = b.x * 31 + b.y * 17;
    const bord: V[] = [];
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2;
      const r = 8.5 + (hash3(g, i, 0) - 0.5) * 2.6;
      bord.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    }
    const chemin = () => {
      ctx.beginPath();
      bord.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.closePath();
    };
    // Le bureau qu'on voit à travers, l'ombre du bord de la feuille, et les fibres blanches du papier arraché
    chemin();
    ctx.fillStyle = "#9c8a68";
    ctx.fill();
    ctx.save();
    chemin();
    ctx.clip();
    ctx.fillStyle = "rgba(40,30,20,0.35)";
    ctx.beginPath();
    ctx.arc(cx + 3, cy + 3, 9, 0, Math.PI * 2);
    ctx.arc(cx - 2, cy - 2, 9, 0, Math.PI * 2, true);
    ctx.fill("evenodd");
    ctx.restore();
    chemin();
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = 1.6;
    ctx.stroke();
    chemin();
    ctx.strokeStyle = "rgba(60,50,40,0.35)";
    ctx.lineWidth = 0.7;
    ctx.stroke();
  }
}

/** Les gribouillis d'élève dans les coins libres de la page, au crayon, selon le cahier. */
function griffonnages(ctx: CanvasRenderingContext2D, carte: Carte): void {
  const libre = (x: number, y: number, r: number) =>
    carte.blocs.every((b) => Math.hypot(b.x + 10 - x, b.y + 10 - y) > r + 14) &&
    Math.hypot(carte.coeur.x - x, carte.coeur.y - y) > r + 40 &&
    carte.entrees.every((e) => Math.hypot(e.bord.x - x, e.bord.y - y) > r + 40);
  const g0 = carte.nom.length * 97 + Math.round(carte.coeur.x + carte.coeur.y * 3);
  const crayon = { couleur: "rgba(60,62,75,0.22)", epaisseur: 1.1, amp: 0.4 };
  let poses = 0;
  for (let essai = 0; essai < 40 && poses < 5; essai++) {
    const x = 30 + hash3(g0, essai, 1) * 340;
    const y = 40 + hash3(g0, essai, 2) * 640;
    if (!libre(x, y, 22)) continue;
    poses++;
    const g = g0 + essai;
    const genre = Math.floor(hash3(g, 3, 3) * 4);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((hash3(g, 4, 4) - 0.5) * 0.6);
    if (carte.papier === "carreaux") {
      if (genre === 0) ecrire(ctx, ["x² + y² = r²", "a + b = c", "π ≈ 3,14", "2x − 3 = 7"][Math.floor(hash3(g, 5, 5) * 4)], 0, 0, { taille: 14, couleur: "rgba(60,62,75,0.28)" });
      else if (genre === 1) trait(ctx, [{ x: -14, y: 10 }, { x: 14, y: 10 }, { x: -14, y: -14 }], { ...crayon, ferme: true, graine: g });
      else if (genre === 2) {
        ctx.strokeStyle = "rgba(60,62,75,0.2)";
        ctx.beginPath();
        ctx.arc(0, 0, 16, 0.3, 4.2);
        ctx.stroke();
        trait(ctx, [{ x: 0, y: 0 }, { x: 16, y: 0 }], { ...crayon, graine: g });
      } else trait(ctx, [{ x: -16, y: 8 }, { x: -6, y: -4 }, { x: 2, y: 2 }, { x: 16, y: -12 }], { ...crayon, graine: g });
    } else if (carte.papier === "portee") {
      if (genre <= 1) {
        // Une croche, ou deux doubles croches
        for (const dx of genre ? [-6, 6] : [0]) {
          ctx.fillStyle = "rgba(60,62,75,0.25)";
          ctx.beginPath();
          ctx.ellipse(dx - 4, 6, 4.5, 3.2, -0.4, 0, Math.PI * 2);
          ctx.fill();
          trait(ctx, [{ x: dx, y: 5 }, { x: dx, y: -14 }], { ...crayon, graine: g + dx });
        }
        trait(ctx, genre ? [{ x: -6, y: -14 }, { x: 6, y: -14 }] : [{ x: 0, y: -14 }, { x: 7, y: -8 }], { ...crayon, epaisseur: 2, graine: g + 9 });
      } else if (genre === 2) ecrire(ctx, "𝄞", 0, 0, { taille: 34, couleur: "rgba(60,62,75,0.25)" });
      else ecrire(ctx, ["ff", "p", "cresc.", "♯"][Math.floor(hash3(g, 5, 5) * 4)], 0, 0, { taille: 16, couleur: "rgba(60,62,75,0.28)" });
    } else {
      if (genre === 0) {
        // Un soleil
        cercle(ctx, 0, 0, 7, { ...crayon, graine: g });
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2;
          trait(ctx, [{ x: Math.cos(a) * 10, y: Math.sin(a) * 10 }, { x: Math.cos(a) * 15, y: Math.sin(a) * 15 }], { ...crayon, graine: g + k });
        }
      } else if (genre === 1) {
        const pts: V[] = [];
        for (let i = 0; i <= 30; i++) {
          const a = (i / 30) * Math.PI * 6;
          pts.push({ x: Math.cos(a) * i * 0.5, y: Math.sin(a) * i * 0.5 });
        }
        trait(ctx, pts, { ...crayon, graine: g });
      } else if (genre === 2) {
        const e: V[] = [];
        for (let i = 0; i < 10; i++) {
          const a = -Math.PI / 2 + (i * Math.PI) / 5;
          const r = i % 2 ? 5 : 12;
          e.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
        }
        trait(ctx, e, { ...crayon, ferme: true, graine: g });
      } else ecrire(ctx, ["bof", "ennui…", "J + L", "à rendre lundi"][Math.floor(hash3(g, 5, 5) * 4)], 0, 0, { taille: 14, couleur: "rgba(60,62,75,0.28)" });
    }
    ctx.restore();
  }
}

/** Le cadre « ne rien écrire », comme sur une copie d'examen : double trait, hachures légères au crayon, et la consigne. */
function cadre(ctx: CanvasRenderingContext2D, c: { x: number; y: number; w: number; h: number }): void {
  const g = c.x * 13 + c.y * 7;
  const m = 3;
  ctx.save();
  ctx.beginPath();
  ctx.rect(c.x + m, c.y + m, c.w - m * 2, c.h - m * 2);
  ctx.clip();
  ctx.fillStyle = "rgba(120,122,135,0.06)";
  ctx.fillRect(c.x, c.y, c.w, c.h);
  ctx.strokeStyle = "rgba(90,92,105,0.2)";
  ctx.lineWidth = 0.9;
  for (let d = -c.h; d < c.w; d += 9) {
    ctx.beginPath();
    ctx.moveTo(c.x + d + hash3(g, d, 1) * 2, c.y + c.h);
    ctx.lineTo(c.x + d + c.h + hash3(g, d, 2) * 2, c.y);
    ctx.stroke();
  }
  ctx.restore();
  rectangle(ctx, c.x + m, c.y + m, c.w - m * 2, c.h - m * 2, { couleur: "rgba(60,62,75,0.7)", epaisseur: 1.4, amp: 0.2, graine: g });
  rectangle(ctx, c.x + m + 3, c.y + m + 3, c.w - m * 2 - 6, c.h - m * 2 - 6, { couleur: "rgba(60,62,75,0.45)", epaisseur: 0.8, amp: 0.2, graine: g + 1 });
  // La consigne, à l'horizontale si la place le permet, sinon le long du cadre
  const texte = c.w >= 150 ? "NE RIEN ÉCRIRE DANS CE CADRE" : c.w >= 80 ? "NE RIEN ÉCRIRE" : "INTERDIT";
  ctx.save();
  if (c.w >= 80 || c.w >= c.h) {
    ecrire(ctx, texte, c.x + c.w / 2, c.y + c.h / 2 + 1, { taille: 10, couleur: "rgba(60,62,75,0.55)" });
  } else {
    ctx.translate(c.x + c.w / 2, c.y + c.h / 2);
    ctx.rotate(-Math.PI / 2);
    ecrire(ctx, c.h >= 150 ? "NE RIEN ÉCRIRE DANS CE CADRE" : "NE RIEN ÉCRIRE", 0, 1, { taille: 10, couleur: "rgba(60,62,75,0.55)" });
  }
  ctx.restore();
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
  /** Le pouvoir armé : le trait le dessine au lieu d'un geste. */
  pouvoir?: Pouvoir | null;
  /** La couleur du stylo de la tour reconnue, en direct. */
  couleur?: string;
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
  // Les voleurs : le cœur arraché se balance au-dessus d'eux, une flèche montre où ils filent
  for (const e of j.ennemis) {
    if (e.mort || e.vol <= 0) continue;
    const b = Math.sin(j.temps * 7 + e.id) * 2;
    const hx = e.x;
    const hy = e.y - e.r - 14 + b;
    trait(ctx, [{ x: e.x, y: e.y - e.r + 2 }, { x: hx, y: hy + 6 }], { couleur: CRAYON, epaisseur: 1, amp: 0.3, graine: e.id });
    coeur(ctx, hx, hy, 9, Math.max(0, Math.sin(j.temps * 9)), e.id);
    if (e.vol > 1) ecrire(ctx, "×" + e.vol, hx + 13, hy - 1, { couleur: ROUGE, taille: 15, police: "titre" });
    // Un petit anneau rouge pour qu'on le repère dans la foule
    cercle(ctx, e.x, e.y, e.r + 6 + Math.sin(j.temps * 6) * 1.5, { couleur: ROUGE, epaisseur: 1.3, alpha: 0.7, graine: e.id + 9 });
  }
  // Les vies reprises qui reviennent en flottant vers le Cœur
  for (const r of j.rendus) {
    const dx = j.carte.coeur.x - r.x;
    const dy = j.carte.coeur.y - r.y;
    const d = Math.hypot(dx, dy) || 1;
    for (let k = 1; k <= 4; k++) {
      ctx.save();
      ctx.globalAlpha = 0.5 - k * 0.1;
      ctx.fillStyle = ROUGE;
      ctx.beginPath();
      ctx.arc(r.x - (dx / d) * k * 9, r.y - (dy / d) * k * 9 + Math.sin(j.temps * 8 + k) * 1.5, 3.2 - k * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    coeur(ctx, r.x, r.y + Math.sin(j.temps * 6) * 2, 11, Math.max(0, Math.sin(j.temps * 10)), 31);
    if (r.vies > 1) ecrire(ctx, "+" + r.vies, r.x + 15, r.y - 2, { couleur: ROUGE, taille: 15, police: "titre" });
  }
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
      case "regle": {
        // Elle tombe d'un coup, reste un instant, puis se relève et disparaît
        const levee = t < 0.12 ? 1 - t / 0.12 : t > 0.75 ? (t - 0.75) / 0.25 : 0;
        regle(ctx, f.pts![0], f.pts![1], { levee, alpha: t > 0.75 ? 1 - (t - 0.75) / 0.25 : 1, graine: f.graine });
        break;
      }
      case "lasso":
        lasso(ctx, f.pts!, t, j.temps, f.graine);
        break;
      case "gomme":
        frottement(ctx, f.x, f.y, f.r ?? 50, t, f.graine);
        break;
    }
  }
  dessinerSur(ctx);
  // Le trait en cours
  if (brouillon && brouillon.pouvoir && brouillon.pts.length > 1) {
    const pts = brouillon.pts;
    if (brouillon.pouvoir === "regle") {
      const [a, b] = segmentRegle(pts);
      regle(ctx, a, b, { fantome: true });
      trait(ctx, pts, { couleur: CRAYON, epaisseur: 1.6, amp: 0.4, graine: 7, alpha: 0.6 });
    } else if (brouillon.pouvoir === "lasso") {
      const a = pts[0];
      const z = pts[pts.length - 1];
      const ferme = Math.hypot(z.x - a.x, z.y - a.y) < 40;
      trait(ctx, pts, { couleur: ROUGE, epaisseur: 2.4, amp: 0.4, graine: 7, fond: ferme ? "rgba(196,48,43,0.1)" : undefined });
      cercle(ctx, a.x, a.y, 7, { couleur: ROUGE, epaisseur: 1.2, alpha: 0.7, graine: 8 });
    } else {
      const z = zoneGomme(pts);
      cercle(ctx, z.x, z.y, z.r, { couleur: "#c97a86", epaisseur: 1.4, alpha: 0.7, graine: 9 });
      trait(ctx, pts, { couleur: "#c97a86", epaisseur: 2, amp: 0.4, graine: 7, alpha: 0.6 });
    }
  } else if (brouillon && brouillon.pts.length > 1) {
    const couleur = brouillon.geste === "rien" ? CRAYON : brouillon.couleur ?? BLEU;
    trait(ctx, brouillon.pts, { couleur, epaisseur: brouillon.geste === "mur" ? 3.5 : 2.4, amp: 0.4, graine: 7 });
  }
}

export { PAPIER };
