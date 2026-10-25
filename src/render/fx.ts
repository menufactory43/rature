// Les effets : tout ce qui gicle, tremble et s'écrit en grand. Purement visuel, nourri par les événements de la
// simulation (j.evts) ; le hasard ici n'a pas besoin d'être reproductible.
import { ENNEMIS, type TypeEnnemi } from "../sim/ennemis";
import type { V } from "../sim/geom";
import type { Jeu } from "../sim/jeu";
import { BLEU, CRAYON, ROUGE, ecrire, pointsCercle, trait } from "./encre";
import { vibrer } from "../vibre";
import { reglages } from "../reglages";
import { monstre } from "./monstres";
import { t } from "../i18n";

type Genre = "goutte" | "tache" | "fumee" | "tiret" | "anneau" | "papier" | "etincelle" | "plus" | "encre";

interface Particule {
  genre: Genre;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  vie: number;
  r: number;
  rot: number;
  vr: number;
  couleur: string;
  graine: number;
  /** Pour l'encre qui vole vers le compteur : le point de départ. */
  x0?: number;
  y0?: number;
}

interface Cadavre {
  type: TypeEnnemi;
  x: number;
  y: number;
  r: number;
  id: number;
  angle: number;
  age: number;
  vie: number;
}

interface Banniere {
  texte: string;
  sous?: string;
  rouge: boolean;
  age: number;
  vie: number;
}

interface Trace {
  pts: V[];
  cible: V | null;
  couleur: string;
  age: number;
  vie: number;
}

const fx = {
  traces: [] as Trace[],
  particules: [] as Particule[],
  cadavres: [] as Cadavre[],
  banniere: null as Banniere | null,
  secousse: 0,
  flash: 0,
  flashCouleur: ROUGE,
  naissances: new Map<number, number>(),
  ameliorations: new Map<number, number>(),
  prets: new Map<string, number>(),
  pulseEncre: 0,
  temps: 0,
  dx: 0,
  dy: 0,
};

/** Où se trouve le compteur d'encre, en coordonnées de page (le bandeau du bas commence à la fin de la page). */
let cibleEncre: V = { x: 36, y: 748 };
export const reglerCibleEncre = (p: V) => (cibleEncre = p);

const hasard = (a: number, b: number) => a + Math.random() * (b - a);

function ajouter(genre: Genre, x: number, y: number, o: Partial<Particule> = {}): void {
  // Effets réduits : une particule décorative sur trois seulement (l'encre qui vole au compteur reste)
  if (reglages.effetsReduits && genre !== "encre" && Math.random() < 0.66) return;
  if (fx.particules.length > 700) fx.particules.splice(0, 100);
  fx.particules.push({ genre, x, y, vx: 0, vy: 0, age: 0, vie: 0.5, r: 2, rot: Math.random() * 6.28, vr: 0, couleur: ROUGE, graine: (Math.random() * 1e6) | 0, ...o });
}

function gicler(x: number, y: number, n: number, couleur: string, vitesse: number, taille = 2.2): void {
  for (let k = 0; k < n; k++) {
    const a = Math.random() * Math.PI * 2;
    const v = hasard(0.3, 1) * vitesse;
    ajouter("goutte", x, y, { vx: Math.cos(a) * v, vy: Math.sin(a) * v, vie: hasard(0.25, 0.5), r: hasard(0.6, 1.3) * taille, couleur });
  }
}

function secouer(force: number): void {
  if (reglages.effetsReduits) return;
  fx.secousse = Math.max(fx.secousse, force);
}

export function banniere(texte: string, sous?: string, rouge = false, vie = 1.6): void {
  fx.banniere = { texte, sous, rouge, age: 0, vie };
}

/** Le trait du joueur après qu'il a levé le doigt : il se resserre vers la tour née, ou s'efface s'il n'a rien donné. */
export function ajouterTrace(pts: V[], cible: V | null, couleur: string): void {
  fx.traces.push({ pts: pts.map((p) => ({ x: p.x, y: p.y })), cible, couleur, age: 0, vie: cible ? 0.28 : 0.4 });
}

/** Secondes depuis qu'un pouvoir est redevenu prêt (pour faire sursauter son bouton). */
export function pretDepuis(p: string): number {
  const t = fx.prets.get(p);
  return t === undefined ? 99 : fx.temps - t;
}

export function remettreAZero(): void {
  fx.prets.clear();
  fx.traces = [];
  fx.particules = [];
  fx.cadavres = [];
  fx.banniere = null;
  fx.secousse = 0;
  fx.flash = 0;
  fx.naissances.clear();
  fx.ameliorations.clear();
}

/** Lit les événements de la simulation et les transforme en effets. */
export function absorber(j: Jeu, dt: number): void {
  fx.temps += dt;
  for (const e of j.evts) {
    switch (e.k) {
      case "mort": {
        const f = ENNEMIS[e.type];
        fx.cadavres.push({ type: e.type, x: e.x, y: e.y, r: e.r, id: e.id, angle: e.angle, age: 0, vie: f.boss ? 1.4 : 0.42 });
        gicler(e.x, e.y, f.boss ? 40 : 5 + Math.round(e.r / 3), ROUGE, f.boss ? 260 : 90 + e.r * 4, f.boss ? 4 : 2);
        for (let k = 0; k < (f.boss ? 8 : 2); k++) ajouter("tache", e.x + hasard(-e.r, e.r), e.y + hasard(-e.r, e.r), { vie: 1.6, r: hasard(2, 4) * (f.boss ? 2 : 1) });
        // L'encre gagnée vole jusqu'au compteur
        const n = Math.min(4, 1 + Math.floor(e.prime / 6));
        for (let k = 0; k < n; k++) ajouter("encre", e.x, e.y, { x0: e.x + hasard(-10, 10), y0: e.y + hasard(-10, 10), vie: hasard(0.55, 0.8), r: 2.6, couleur: BLEU, age: -k * 0.05 });
        if (f.boss) {
          vibrer("fort");
          secouer(12);
          fx.flash = 0.6;
          fx.flashCouleur = BLEU;
          banniere(t(f.nom.startsWith("la ") || f.nom.includes("Esperluette") ? "{nom} raturée !" : "{nom} raturé !", { nom: t(f.nom) }), undefined, false, 2);
          for (let k = 0; k < 18; k++) ajouter("papier", e.x, e.y, { vx: hasard(-200, 200), vy: hasard(-200, 200), vie: hasard(0.8, 1.4), r: hasard(3, 6), vr: hasard(-10, 10), couleur: "#fffaf0" });
        }
        break;
      }
      case "fuite": {
        vibrer("moyen");
        secouer(5 + Math.min(10, e.vies * 1.5));
        fx.flash = Math.min(1, 0.35 + e.vies * 0.08);
        fx.flashCouleur = ROUGE;
        gicler(e.x, e.y, 14, ROUGE, 180, 2.6);
        ajouter("anneau", e.x, e.y, { vie: 0.5, r: 40, couleur: ROUGE });
        break;
      }
      case "tir": {
        const c = Math.cos(e.angle);
        const s = Math.sin(e.angle);
        if (e.tour === "plume") {
          for (const d of [-0.5, 0, 0.5]) ajouter("tiret", e.x, e.y, { vx: Math.cos(e.angle + d) * 90, vy: Math.sin(e.angle + d) * 90, vie: 0.09, r: 4, rot: e.angle + d, couleur: BLEU });
        } else if (e.tour === "roquette") {
          for (let k = 0; k < 4; k++) ajouter("fumee", e.x - c * 6, e.y - s * 6, { vx: -c * hasard(10, 40) + hasard(-15, 15), vy: -s * hasard(10, 40) + hasard(-15, 15), vie: hasard(0.4, 0.7), r: hasard(3, 5), couleur: CRAYON });
          secouer(1.2);
        } else if (e.tour === "correction") {
          ajouter("etincelle", e.x + c * 20, e.y + s * 20, { vie: 0.15, r: 6, rot: e.angle, couleur: ROUGE });
        }
        break;
      }
      case "impact":
        for (let k = 0; k < 3; k++) {
          const a = e.angle + Math.PI + hasard(-0.9, 0.9);
          ajouter("tiret", e.x, e.y, { vx: Math.cos(a) * 70, vy: Math.sin(a) * 70, vie: 0.14, r: 3, rot: a, couleur: ROUGE });
        }
        break;
      case "boom": {
        secouer(Math.min(6, e.r / 10));
        ajouter("anneau", e.x, e.y, { vie: 0.35, r: e.r, couleur: BLEU });
        gicler(e.x, e.y, 10, BLEU, e.r * 5, 2.4);
        for (let k = 0; k < 5; k++) ajouter("fumee", e.x + hasard(-e.r, e.r) * 0.5, e.y + hasard(-e.r, e.r) * 0.5, { vx: hasard(-20, 20), vy: hasard(-30, 5), vie: hasard(0.5, 0.9), r: hasard(5, 9), couleur: CRAYON });
        break;
      }
      case "pose":
        vibrer("leger");
        fx.naissances.set(e.id, fx.temps);
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2;
          ajouter("tiret", e.x + Math.cos(a) * 14, e.y + Math.sin(a) * 14, { vx: Math.cos(a) * 60, vy: Math.sin(a) * 60, vie: 0.25, r: 4, rot: a, couleur: BLEU });
        }
        gicler(e.x, e.y, 6, BLEU, 70, 1.8);
        break;
      case "amelio":
        vibrer("leger");
        fx.ameliorations.set(e.id, fx.temps);
        ajouter("anneau", e.x, e.y, { vie: 0.45, r: e.spec ? 34 : 24, couleur: e.spec ? ROUGE : BLEU });
        for (let k = 0; k < (e.spec ? 8 : 5); k++) ajouter("plus", e.x + hasard(-14, 14), e.y + hasard(-6, 6), { vx: hasard(-10, 10), vy: hasard(-60, -30), vie: hasard(0.6, 0.9), r: hasard(3, 5), couleur: e.spec ? ROUGE : BLEU });
        break;
      case "detruite":
        vibrer("moyen");
        secouer(4);
        for (let k = 0; k < 12; k++) ajouter("papier", e.x, e.y, { vx: hasard(-120, 120), vy: hasard(-120, 120), vie: hasard(0.6, 1), r: hasard(2.5, 4.5), vr: hasard(-12, 12), couleur: "#fffaf0" });
        gicler(e.x, e.y, 10, BLEU, 120, 2.2);
        break;
      case "vague":
        if (e.boss) {
          vibrer("fort");
          banniere(t("BOSS"), t(ENNEMIS[e.boss].nom), true, 2.4);
          secouer(8);
          fx.flash = 0.4;
          fx.flashCouleur = ROUGE;
        } else banniere(t("Vague {n}", { n: e.n }), Number.isFinite(j.regles.total) ? t("sur {n}", { n: j.regles.total }) : undefined);
        break;
      case "eclair":
        for (const q of e.pts.slice(1)) for (let k = 0; k < 3; k++) {
          const a = Math.random() * Math.PI * 2;
          ajouter("etincelle", q.x, q.y, { vx: Math.cos(a) * 80, vy: Math.sin(a) * 80, vie: 0.18, r: 4, rot: a, couleur: BLEU });
        }
        break;
      case "rature":
        if (e.touches) {
          vibrer("leger");
          secouer(2 + Math.min(4, e.touches));
          for (const q of e.pts.filter((_, i) => i % 3 === 0)) gicler(q.x, q.y, 1, BLEU, 80, 1.8);
        }
        break;
      case "mur": {
        const a = e.pts[0];
        const b = e.pts[e.pts.length - 1];
        ajouter("tache", a.x, a.y, { vie: 0.8, r: 3.5, couleur: BLEU });
        ajouter("tache", b.x, b.y, { vie: 0.8, r: 3.5, couleur: BLEU });
        break;
      }
      case "soin":
        break;
      case "repris":
        vibrer("moyen");
        secouer(4);
        ajouter("anneau", e.x, e.y, { vie: 0.5, r: 34, couleur: ROUGE });
        for (let k = 0; k < 6; k++) ajouter("plus", e.x + hasard(-12, 12), e.y + hasard(-8, 8), { vx: hasard(-20, 20), vy: hasard(-70, -40), vie: hasard(0.6, 0.9), r: hasard(3, 5), couleur: ROUGE });
        if (j.vies <= 0) banniere(t("Rattrapé !"), t(e.vies > 1 ? "{n} vies reprises" : "{n} vie reprise", { n: e.vies }), true, 1.6);
        break;
      case "rendu":
        vibrer("leger");
        ajouter("anneau", j.carte.coeur.x, j.carte.coeur.y, { vie: 0.5, r: 30, couleur: ROUGE });
        break;
      case "pouvoir":
        if (e.p === "regle") {
          vibrer("fort");
          secouer(9);
          const [a, b] = e.pts;
          for (let k = 0; k < 14; k++) {
            const u = k / 13;
            ajouter("fumee", a.x + (b.x - a.x) * u + hasard(-6, 6), a.y + (b.y - a.y) * u + hasard(-6, 6), { vx: hasard(-30, 30), vy: hasard(-30, 30), vie: hasard(0.4, 0.8), r: hasard(4, 8), couleur: CRAYON });
          }
        } else if (e.p === "lasso") {
          vibrer("moyen");
          ajouter("anneau", e.x, e.y, { vie: 0.4, r: 30, couleur: ROUGE });
        } else {
          vibrer("moyen");
          secouer(4);
          // Les miettes de gomme
          for (let k = 0; k < 22; k++) ajouter("papier", e.x + hasard(-e.r, e.r) * 0.7, e.y + hasard(-e.r, e.r) * 0.7, { vx: hasard(-90, 90), vy: hasard(-90, 90), vie: hasard(0.6, 1.1), r: hasard(1.5, 3), vr: hasard(-10, 10), couleur: k % 3 ? "#e9a3ad" : "#8fb0dd", age: -hasard(0, 0.5) });
        }
        if (e.touches >= 6) banniere(t("Carton !"), t("{n} touchés", { n: e.touches }), true, 1.2);
        break;
      case "pret":
        vibrer("leger");
        fx.prets.set(e.p, fx.temps);
        break;
      case "evade":
        vibrer("moyen");
        gicler(e.x, e.y, 8, ROUGE, 120, 2);
        break;
    }
  }
  j.evts.length = 0;
  // La fumée des roquettes en vol
  for (const t of j.tirs) if (t.type === "roquette" && Math.random() < dt * 45) ajouter("fumee", t.x - t.vx * 0.03, t.y - t.vy * 0.03, { vx: hasard(-8, 8), vy: hasard(-8, 8), vie: hasard(0.35, 0.6), r: hasard(2, 3.5), couleur: CRAYON });
  // Les soigneurs : des petites croix qui montent
  for (const e of j.ennemis) if (ENNEMIS[e.type].soigne && Math.random() < dt * 4) ajouter("plus", e.x + hasard(-30, 30), e.y + hasard(-20, 20), { vy: -25, vie: 0.8, r: 3, couleur: "rgba(60,140,90,0.9)" });
  avancer(dt);
}

function avancer(dt: number): void {
  for (const p of fx.particules) {
    p.age += dt;
    if (p.age < 0) continue;
    const frein = p.genre === "fumee" ? 2 : p.genre === "papier" ? 3 : p.genre === "goutte" ? 5 : 1;
    p.vx *= Math.exp(-frein * dt);
    p.vy *= Math.exp(-frein * dt);
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rot += p.vr * dt;
    // Une goutte qui retombe laisse une petite tache
    if (p.genre === "goutte" && p.age >= p.vie && Math.random() < 0.4) ajouter("tache", p.x, p.y, { vie: hasard(0.8, 1.4), r: p.r * 1.1, couleur: p.couleur });
    if (p.genre === "encre" && p.age >= p.vie) fx.pulseEncre = 1;
  }
  fx.particules = fx.particules.filter((p) => p.age < p.vie);
  for (const t of fx.traces) t.age += dt;
  fx.traces = fx.traces.filter((t) => t.age < t.vie);
  for (const c of fx.cadavres) c.age += dt;
  fx.cadavres = fx.cadavres.filter((c) => c.age < c.vie);
  if (fx.banniere) {
    fx.banniere.age += dt;
    if (fx.banniere.age > fx.banniere.vie) fx.banniere = null;
  }
  fx.secousse *= Math.exp(-dt * 9);
  if (fx.secousse < 0.2) fx.secousse = 0;
  fx.flash = Math.max(0, fx.flash - dt * 1.6);
  fx.pulseEncre = Math.max(0, fx.pulseEncre - dt * 4);
  fx.dx = (Math.random() - 0.5) * 2 * fx.secousse;
  fx.dy = (Math.random() - 0.5) * 2 * fx.secousse;
}

/** Le décalage de la secousse, pour toute la page. */
export const secousse = () => ({ x: fx.dx, y: fx.dy });
export const pulseEncre = () => fx.pulseEncre;

/** L'échelle d'une tour qui vient d'être posée ou améliorée (un petit rebond élastique). */
export function echelleTour(id: number): number {
  let s = 1;
  const n = fx.naissances.get(id);
  if (n !== undefined) {
    const t = fx.temps - n;
    if (t < 0.45) s *= 1 - Math.exp(-t * 9) * Math.cos(t * 22) * 0.9;
    else fx.naissances.delete(id);
  }
  const a = fx.ameliorations.get(id);
  if (a !== undefined) {
    const t = fx.temps - a;
    if (t < 0.4) s *= 1 + Math.sin(t * 24) * Math.exp(-t * 8) * 0.35;
    else fx.ameliorations.delete(id);
  }
  return Math.max(0.05, s);
}

/** Sous les monstres : les taches fraîches et la fumée. */
export function dessinerSous(ctx: CanvasRenderingContext2D): void {
  for (const p of fx.particules) {
    if (p.age < 0) continue;
    const t = p.age / p.vie;
    if (p.genre === "tache") {
      ctx.save();
      ctx.globalAlpha = 0.55 * (1 - t * t);
      ctx.fillStyle = p.couleur;
      const pts = pointsCercle(p.x, p.y, p.r * (0.7 + Math.min(1, t * 6) * 0.3), p.graine, 0.35);
      ctx.beginPath();
      pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
      ctx.fill();
      ctx.restore();
    } else if (p.genre === "fumee") {
      ctx.save();
      ctx.globalAlpha = 0.5 * (1 - t);
      ctx.strokeStyle = p.couleur;
      ctx.lineWidth = 1.1;
      const r = p.r * (1 + t * 1.6);
      // Une boucle au crayon plutôt qu'un rond parfait
      ctx.beginPath();
      for (let i = 0; i <= 14; i++) {
        const a = (i / 14) * Math.PI * 2.3 + p.rot;
        const rr = r * (0.8 + 0.2 * Math.sin(i * 1.7 + p.graine));
        const x = p.x + Math.cos(a) * rr;
        const y = p.y + Math.sin(a) * rr;
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
    }
  }
}

/** Les morts : le monstre se fait raturer à grands traits, puis s'efface. */
function dessinerCadavre(ctx: CanvasRenderingContext2D, c: Cadavre): void {
  const boss = !!ENNEMIS[c.type].boss;
  const ecrit = boss ? 0.8 : 0.16;
  const p = Math.min(1, c.age / ecrit);
  const fin = Math.max(0, (c.age - ecrit) / (c.vie - ecrit));
  ctx.save();
  ctx.globalAlpha = 1 - fin;
  const s = 1 + fin * 0.25 - (c.age < 0.06 ? 0 : 0);
  ctx.translate(c.x, c.y);
  ctx.scale(s * (1 + (1 - p) * 0.15), s * (1 - (1 - p) * 0.1));
  ctx.translate(-c.x, -c.y);
  monstre(ctx, c.type, c.x, c.y, c.r, c.id, 0, ROUGE, c.angle);
  // La rature : un zigzag serré qui traverse le monstre
  const n = boss ? 14 : 7;
  const pts: V[] = [];
  const r = c.r * 1.15;
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    pts.push({ x: c.x - r + u * 2 * r, y: c.y + (i % 2 ? -r : r) * 0.8 + (u - 0.5) * r * 0.4 });
  }
  const k = Math.max(2, Math.ceil(pts.length * p));
  trait(ctx, pts.slice(0, k), { couleur: BLEU, epaisseur: boss ? 4 : 2.4, graine: c.id, amp: 0.8 });
  if (p >= 1) trait(ctx, [{ x: c.x - r, y: c.y + r * 0.2 }, { x: c.x + r, y: c.y - r * 0.3 }], { couleur: BLEU, epaisseur: boss ? 5 : 3, graine: c.id + 1 });
  ctx.restore();
}

/** Par-dessus la scène : les morts, les éclats, les anneaux. */
export function dessinerSur(ctx: CanvasRenderingContext2D): void {
  for (const tr of fx.traces) {
    const t = tr.age / tr.vie;
    const c = tr.cible;
    const e = t * t;
    const pts = c ? tr.pts.map((p, i) => {
      // Il s'enroule en se resserrant
      const a = e * 2.5;
      const dx = (p.x - c.x) * (1 - e);
      const dy = (p.y - c.y) * (1 - e);
      return { x: c.x + dx * Math.cos(a) - dy * Math.sin(a) + Math.sin(i) * 0.3, y: c.y + dx * Math.sin(a) + dy * Math.cos(a) };
    }) : tr.pts.map((p, i) => ({ x: p.x, y: p.y + e * 6 + Math.sin(i * 0.7) * e * 2 }));
    trait(ctx, pts, { couleur: tr.couleur, epaisseur: 2.4 * (1 - t * 0.5), alpha: 1 - t, amp: 0.4, graine: 7 });
  }
  for (const c of fx.cadavres) dessinerCadavre(ctx, c);
  for (const p of fx.particules) {
    if (p.age < 0) continue;
    const t = p.age / p.vie;
    switch (p.genre) {
      case "goutte": {
        ctx.save();
        ctx.fillStyle = p.couleur;
        ctx.globalAlpha = 0.9;
        // Étirée dans le sens de la course
        const v = Math.hypot(p.vx, p.vy);
        const a = Math.atan2(p.vy, p.vx);
        ctx.translate(p.x, p.y);
        ctx.rotate(a);
        ctx.beginPath();
        ctx.ellipse(0, 0, p.r * (1 + Math.min(2, v / 120)), p.r * (1 - t * 0.3), 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        break;
      }
      case "tiret": {
        const l = p.r * (1 - t * 0.5);
        trait(ctx, [{ x: p.x, y: p.y }, { x: p.x + Math.cos(p.rot) * l, y: p.y + Math.sin(p.rot) * l }], { couleur: p.couleur, epaisseur: 1.6, alpha: 1 - t, amp: 0.2, graine: p.graine });
        break;
      }
      case "etincelle": {
        const l = p.r;
        const pts: V[] = [{ x: p.x, y: p.y }, { x: p.x + Math.cos(p.rot + 0.5) * l * 0.5, y: p.y + Math.sin(p.rot + 0.5) * l * 0.5 }, { x: p.x + Math.cos(p.rot) * l, y: p.y + Math.sin(p.rot) * l }];
        trait(ctx, pts, { couleur: p.couleur, epaisseur: 1.4, alpha: 1 - t, amp: 0.6, graine: p.graine });
        break;
      }
      case "anneau": {
        const r = p.r * (0.4 + 0.8 * Math.sqrt(t));
        ctx.save();
        ctx.globalAlpha = 1 - t;
        ctx.strokeStyle = p.couleur;
        ctx.lineWidth = 2.5 * (1 - t) + 0.5;
        ctx.setLineDash([5, 4]);
        ctx.lineDashOffset = -t * 30;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        break;
      }
      case "papier": {
        ctx.save();
        ctx.globalAlpha = 1 - t * t;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.scale(1, Math.cos(p.rot * 1.7));
        ctx.fillStyle = p.couleur;
        ctx.strokeStyle = "rgba(60,62,75,0.6)";
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(-p.r, -p.r * 0.7);
        ctx.lineTo(p.r, -p.r);
        ctx.lineTo(p.r * 0.8, p.r * 0.8);
        ctx.lineTo(-p.r * 0.9, p.r * 0.6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        break;
      }
      case "plus": {
        const r = p.r;
        ctx.save();
        ctx.globalAlpha = 1 - t;
        ctx.strokeStyle = p.couleur;
        ctx.lineWidth = 1.6;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(p.x - r, p.y);
        ctx.lineTo(p.x + r, p.y);
        ctx.moveTo(p.x, p.y - r);
        ctx.lineTo(p.x, p.y + r);
        ctx.stroke();
        ctx.restore();
        break;
      }
      default:
        break;
    }
  }
}

/** Ce qui sort de la page : l'encre qui vole vers le compteur, la bannière, le flash. Coordonnées d'écran ; « haut » est
 *  le décalage de la page dans l'écran. */
export function dessinerEcran(ctx: CanvasRenderingContext2D, haut: number, largeur: number, hauteur: number): void {
  for (const p of fx.particules) {
    if (p.genre !== "encre" || p.age < 0) continue;
    const t = Math.min(1, p.age / p.vie);
    const e = t * t * (3 - 2 * t);
    // Une courbe qui monte d'abord un peu, puis plonge vers le compteur
    const x0 = p.x0!;
    const y0 = p.y0! + haut;
    const x1 = cibleEncre.x;
    const y1 = cibleEncre.y + haut;
    const cx = (x0 + x1) / 2 + 40;
    const cy = Math.min(y0, y1) - 60;
    const x = (1 - e) * (1 - e) * x0 + 2 * (1 - e) * e * cx + e * e * x1;
    const y = (1 - e) * (1 - e) * y0 + 2 * (1 - e) * e * cy + e * e * y1;
    ctx.save();
    ctx.fillStyle = BLEU;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(x, y, p.r * (1 - t * 0.4), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  if (fx.flash > 0) {
    ctx.save();
    const g = ctx.createRadialGradient(largeur / 2, hauteur / 2, hauteur * 0.25, largeur / 2, hauteur / 2, hauteur * 0.7);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, fx.flashCouleur);
    ctx.globalAlpha = fx.flash * (reglages.effetsReduits ? 0.12 : 0.45);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, largeur, hauteur);
    ctx.restore();
  }
  const b = fx.banniere;
  if (b) {
    const entree = Math.min(1, b.age / 0.35);
    const sortie = Math.max(0, (b.age - (b.vie - 0.35)) / 0.35);
    const y = haut + 250;
    ctx.save();
    ctx.globalAlpha = 1 - sortie;
    // L'écriture se dévoile de gauche à droite, comme si on l'écrivait
    ctx.beginPath();
    ctx.rect(0, y - 70, largeur * entree, 140);
    ctx.clip();
    const couleur = b.rouge ? ROUGE : BLEU;
    const taille = b.rouge ? 76 : 46;
    const w = ecrire(ctx, b.texte, largeur / 2, y, { police: "titre", taille, couleur, rotation: -0.04, alpha: 0.95 });
    trait(ctx, [{ x: largeur / 2 - w / 2, y: y + taille * 0.42 }, { x: largeur / 2 + w / 2 + 6, y: y + taille * 0.36 }], { couleur: ROUGE, epaisseur: 3, graine: 991, amp: 0.6 });
    if (b.sous) ecrire(ctx, b.sous, largeur / 2, y + taille * 0.42 + 26, { taille: 20, couleur: b.rouge ? ROUGE : CRAYON });
    ctx.restore();
  }
}
