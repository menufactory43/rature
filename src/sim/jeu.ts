// La simulation d'une page : pure, sans DOM, reproductible à partir de la graine.
// Le rendu (src/render) et les tests la lisent ; seuls step(), appliquerTrace(), lancer() et choisir() la modifient.
import { AMELIORATIONS, IDS_AMELIORATIONS, type IdAmelioration } from "./ameliorations";
import { ENNEMIS, echellePv, type TypeEnnemi } from "./ennemis";
import { dist, pointInPolygon, pointSegDist, polylineDist, polylineLength, resample, type V } from "./geom";
import { classer, type Geste, type Pt } from "./gestures";
import { hashString, Rng } from "./rng";
import { DERNIERE_VAGUE, planifier, type PlanVague } from "./vagues";

export const LARGEUR = 400;
export const HAUTEUR = 720;
export const TOUR_X = 200;
export const TOUR_Y = 380;
export const PREPARATION = 6;
export const PORTEE = 240;
/** Encre par pixel de mur ou de boucle (une rature coûte bien moins). */
export const ENCRE_PAR_PX = 0.16;

export interface Ennemi {
  id: number;
  type: TypeEnnemi;
  x: number;
  y: number;
  pv: number;
  pvMax: number;
  r: number;
  age: number;
  zig: number;
  /** Arrêté par un mur à cette image. */
  bloque: boolean;
  /** Englué à cette image. */
  englue: boolean;
  mort: boolean;
  ponte: number;
  /** Petit éclat quand il est touché. */
  touche: number;
}

export interface SegMur {
  a: V;
  b: V;
  pv: number;
  pvMax: number;
}

export interface Mur {
  id: number;
  segs: SegMur[];
  age: number;
  vie: number;
}

export interface Colle {
  id: number;
  poly: V[];
  age: number;
  vie: number;
}

export interface Tir {
  x: number;
  y: number;
  vx: number;
  vy: number;
  degats: number;
  roquette: boolean;
  vie: number;
}

export type TypeEffet = "chiffre" | "rate" | "eclair" | "boom" | "impact" | "rature" | "sec" | "casse";

export interface Effet {
  type: TypeEffet;
  x: number;
  y: number;
  age: number;
  vie: number;
  texte?: string;
  pts?: V[];
  r?: number;
  graine: number;
}

/** Les taches d'encre laissées par les monstres morts : du décor. */
export interface Eclat {
  x: number;
  y: number;
  r: number;
  graine: number;
}

export type Phase = "prep" | "vague" | "choix" | "perdu" | "gagne";

export type Son = "pop" | "aie" | "casse" | "tir" | "boom" | "zap" | "rate" | "page" | "mur" | "rature" | "colle" | "sec" | "boss";

export interface Jeu {
  graine: string;
  g: number;
  tirages: Rng;
  phase: Phase;
  vague: number;
  plan: PlanVague;
  tVague: number;
  prep: number;
  file: { type: TypeEnnemi; x: number; y: number; a: number }[];
  tour: { x: number; y: number; r: number; pv: number; pvMax: number; cd: number; angle: number; cdRoquette: number; cdFoudre: number };
  encre: number;
  encreMax: number;
  niv: Record<IdAmelioration, number>;
  ennemis: Ennemi[];
  murs: Mur[];
  colles: Colle[];
  tirs: Tir[];
  effets: Effet[];
  eclats: Eclat[];
  offres: IdAmelioration[];
  temps: number;
  tues: number;
  encreDepensee: number;
  ratures: number;
  ratees: number;
  prochainId: number;
  /** Les sons de l'image, vidés par le jeu (src/audio.ts). */
  sons: Son[];
}

export function nouveauJeu(graine: string): Jeu {
  const g = hashString(graine);
  const niv = Object.fromEntries(IDS_AMELIORATIONS.map((id) => [id, 0])) as Record<IdAmelioration, number>;
  return {
    graine, g, tirages: new Rng(g ^ 0x51ed270b),
    phase: "prep", vague: 1, plan: planifier(g, 1), tVague: 0, prep: PREPARATION, file: [],
    tour: { x: TOUR_X, y: TOUR_Y, r: 22, pv: 100, pvMax: 100, cd: 0, angle: -Math.PI / 2, cdRoquette: 1, cdFoudre: 1 },
    encre: 100, encreMax: 100, niv,
    ennemis: [], murs: [], colles: [], tirs: [], effets: [], eclats: [], offres: [],
    temps: 0, tues: 0, encreDepensee: 0, ratures: 0, ratees: 0, prochainId: 1, sons: [],
  };
}

// --- Les valeurs qui dépendent des améliorations ---

const multTour = (j: Jeu) => 1 + 0.35 * j.niv.appui;
export const degatsTir = (j: Jeu) => 5 * multTour(j);
export const intervalleTir = (j: Jeu) => 0.7 / (1 + 0.3 * j.niv.cadence);
export const regenEncre = (j: Jeu) => 6 * (1 + 0.35 * j.niv.plume);
export const econome = (j: Jeu) => 1 - 0.15 * j.niv.econome;
export const coutParPx = (j: Jeu) => ENCRE_PAR_PX * econome(j);
export const coutRature = (j: Jeu, longueur: number) => (5 + longueur * 0.05) * econome(j);
export const degatsRature = (j: Jeu) => 26 * (1 + 0.5 * j.niv.affutee) * (1 + 0.08 * (j.vague - 1));
export const pvSegment = (j: Jeu) => 28 * (1 + 0.6 * j.niv.encreEpaisse) * (1 + 0.05 * (j.vague - 1));
export const ralentiColle = (j: Jeu) => Math.min(0.86, 0.5 + 0.12 * j.niv.colle);
export const vieColle = (j: Jeu) => 5 + 2 * j.niv.colle;
export const VIE_MUR = 30;
/** Longueur qu'on peut encore tracer avant que le stylo sèche. */
export const longueurPossible = (j: Jeu) => j.encre / coutParPx(j);

// --- Le déroulé ---

/** Passe la préparation : la vague arrive tout de suite. */
export function lancer(j: Jeu): void {
  if (j.phase === "prep") j.prep = 0;
}

export function choisir(j: Jeu, id: IdAmelioration): void {
  if (j.phase !== "choix" || !j.offres.includes(id)) return;
  j.niv[id]++;
  if (id === "encrier") j.encreMax += 35;
  if (id === "reparation") {
    j.tour.pvMax += 15;
    j.tour.pv = Math.min(j.tour.pvMax, j.tour.pv + 0.35 * j.tour.pvMax);
  }
  j.vague++;
  j.plan = planifier(j.g, j.vague);
  j.phase = "prep";
  j.prep = PREPARATION;
  j.encre = j.encreMax;
  j.offres = [];
  j.sons.push("page");
}

function finVague(j: Jeu): void {
  if (j.vague >= DERNIERE_VAGUE) {
    j.phase = "gagne";
    j.sons.push("page");
    return;
  }
  const dispo = IDS_AMELIORATIONS.filter((id) => j.niv[id] < AMELIORATIONS[id].max);
  j.offres = j.tirages.shuffle(dispo).slice(0, 3);
  if (!j.offres.length) j.offres = ["reparation"];
  j.phase = "choix";
}

/** Le point d'entrée au bord de la page, dans une direction donnée depuis la tour. */
export function bordDePage(angle: number, marge = 18): V {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  let t = Infinity;
  if (dx > 0) t = Math.min(t, (LARGEUR - TOUR_X) / dx);
  if (dx < 0) t = Math.min(t, -TOUR_X / dx);
  if (dy > 0) t = Math.min(t, (HAUTEUR - TOUR_Y) / dy);
  if (dy < 0) t = Math.min(t, -TOUR_Y / dy);
  return { x: TOUR_X + dx * (t + marge), y: TOUR_Y + dy * (t + marge) };
}

function demarrerVague(j: Jeu): void {
  j.phase = "vague";
  j.tVague = 0;
  const rng = new Rng(j.g ^ Math.imul(j.vague, 0x85ebca6b));
  j.file = [];
  for (const gr of j.plan.groupes) {
    const p = bordDePage(gr.angle);
    const tx = -Math.sin(gr.angle);
    const ty = Math.cos(gr.angle);
    for (let k = 0; k < gr.nombre; k++) {
      const d = (k - (gr.nombre - 1) / 2) * 24 + rng.range(-6, 6);
      j.file.push({ type: gr.type, x: p.x + tx * d + rng.range(-8, 8), y: p.y + ty * d + rng.range(-8, 8), a: gr.a + k * 0.28 });
    }
  }
  j.file.sort((a, b) => a.a - b.a);
  if (j.plan.groupes.some((g) => ENNEMIS[g.type].boss)) j.sons.push("boss");
}

export function ajouterEnnemi(j: Jeu, type: TypeEnnemi, x: number, y: number): Ennemi {
  const f = ENNEMIS[type];
  const pv = f.pv * echellePv(j.vague);
  const e: Ennemi = {
    id: j.prochainId++, type, x, y, pv, pvMax: pv, r: f.rayon, age: 0, zig: (j.prochainId * 1.7) % 6.28,
    bloque: false, englue: false, mort: false, ponte: 2, touche: 0,
  };
  j.ennemis.push(e);
  return e;
}

function effet(j: Jeu, type: TypeEffet, x: number, y: number, vie: number, extra: Partial<Effet> = {}): void {
  j.effets.push({ type, x, y, age: 0, vie, graine: (j.prochainId++ * 7919) | 0, ...extra });
}

export function blesser(j: Jeu, e: Ennemi, degats: number, chiffre = false): void {
  if (e.mort) return;
  e.pv -= degats;
  e.touche = 0.12;
  if (chiffre) effet(j, "chiffre", e.x, e.y - e.r - 4, 0.7, { texte: String(Math.round(degats)) });
  if (e.pv <= 0) tuer(j, e);
}

function tuer(j: Jeu, e: Ennemi): void {
  e.mort = true;
  j.tues++;
  j.eclats.push({ x: e.x, y: e.y, r: e.r * 1.4, graine: e.id });
  if (j.eclats.length > 160) j.eclats.shift();
  j.sons.push("pop");
  if (e.type === "tache") for (const s of [-1, 1]) ajouterEnnemi(j, "petite", e.x + s * 9, e.y + s * 4);
  if (e.type === "mere") {
    for (let k = 0; k < 6; k++) ajouterEnnemi(j, "tache", e.x + Math.cos(k) * 30, e.y + Math.sin(k) * 30);
    effet(j, "boom", e.x, e.y, 0.6, { r: 70 });
  }
  if (e.type === "compas") effet(j, "boom", e.x, e.y, 0.6, { r: 80 });
}

// --- Les gestes du joueur ---

export interface Resultat {
  geste: Geste;
  ok: boolean;
  touches: number;
}

export function appliquerTrace(j: Jeu, trace: Pt[]): Resultat {
  const geste = classer(trace);
  if (geste === "rien" || j.phase === "perdu" || j.phase === "gagne" || j.phase === "choix") return { geste, ok: false, touches: 0 };
  const l = polylineLength(trace);
  const cout = geste === "rature" ? coutRature(j, l) : l * coutParPx(j);
  if (cout > j.encre + 0.5) {
    effet(j, "sec", trace[trace.length - 1].x, trace[trace.length - 1].y, 0.8, { texte: "plus d'encre" });
    j.sons.push("sec");
    return { geste, ok: false, touches: 0 };
  }
  j.encre = Math.max(0, j.encre - cout);
  j.encreDepensee += cout;
  if (geste === "rature") {
    const pts = resample(trace, 6);
    const d = degatsRature(j);
    let touches = 0;
    for (const e of j.ennemis) {
      if (!e.mort && polylineDist(e, pts) <= e.r + 5) {
        blesser(j, e, d, true);
        touches++;
      }
    }
    j.ratures++;
    effet(j, "rature", 0, 0, 0.45, { pts });
    if (!touches) {
      j.ratees++;
      const m = pts[Math.floor(pts.length / 2)];
      effet(j, "rate", m.x, m.y, 0.8, { texte: "raté" });
      j.sons.push("rate");
    } else j.sons.push("rature");
    return { geste, ok: true, touches };
  }
  if (geste === "mur") {
    const pts = resample(trace, 12);
    const pv = pvSegment(j);
    const segs: SegMur[] = [];
    for (let i = 1; i < pts.length; i++) segs.push({ a: pts[i - 1], b: pts[i], pv, pvMax: pv });
    j.murs.push({ id: j.prochainId++, segs, age: 0, vie: VIE_MUR });
    j.sons.push("mur");
    return { geste, ok: true, touches: 0 };
  }
  j.colles.push({ id: j.prochainId++, poly: resample(trace, 10), age: 0, vie: vieColle(j) });
  j.sons.push("colle");
  return { geste, ok: true, touches: 0 };
}

// --- Une image de simulation ---

export function step(j: Jeu, dt: number): void {
  j.temps += dt;
  for (const f of j.effets) f.age += dt;
  j.effets = j.effets.filter((f) => f.age < f.vie);
  if (j.phase === "perdu" || j.phase === "gagne" || j.phase === "choix") return;

  j.encre = Math.min(j.encreMax, j.encre + regenEncre(j) * dt);
  for (const m of j.murs) m.age += dt;
  j.murs = j.murs.filter((m) => m.age < m.vie && m.segs.some((s) => s.pv > 0));
  for (const c of j.colles) c.age += dt;
  j.colles = j.colles.filter((c) => c.age < c.vie);

  if (j.phase === "prep") {
    j.prep -= dt;
    if (j.prep <= 0) demarrerVague(j);
    return;
  }

  j.tVague += dt;
  while (j.file.length && j.file[0].a <= j.tVague) {
    const s = j.file.shift()!;
    ajouterEnnemi(j, s.type, s.x, s.y);
  }

  bougerEnnemis(j, dt);
  armes(j, dt);
  bougerTirs(j, dt);

  j.ennemis = j.ennemis.filter((e) => !e.mort);
  if (j.tour.pv <= 0) {
    j.tour.pv = 0;
    j.phase = "perdu";
    j.sons.push("page");
    return;
  }
  if (!j.file.length && !j.ennemis.length) finVague(j);
}

function bougerEnnemis(j: Jeu, dt: number): void {
  const t = j.tour;
  const vivants = j.ennemis;
  // Ils se poussent un peu entre eux, pour ne pas s'empiler
  for (let a = 0; a < vivants.length; a++) {
    const e = vivants[a];
    if (ENNEMIS[e.type].vole) continue;
    for (let b = a + 1; b < vivants.length; b++) {
      const o = vivants[b];
      if (ENNEMIS[o.type].vole) continue;
      const dx = o.x - e.x;
      const dy = o.y - e.y;
      const min = e.r + o.r;
      const d2 = dx * dx + dy * dy;
      if (d2 >= min * min || d2 === 0) continue;
      const d = Math.sqrt(d2);
      const p = ((min - d) / d) * 0.25;
      e.x -= dx * p;
      e.y -= dy * p;
      o.x += dx * p;
      o.y += dy * p;
    }
  }
  const ralenti = ralentiColle(j);
  const rongeColle = 3 * j.niv.colle * (1 + 0.1 * (j.vague - 1));
  for (const e of vivants) {
    if (e.mort) continue;
    const f = ENNEMIS[e.type];
    e.age += dt;
    e.touche = Math.max(0, e.touche - dt);
    e.bloque = false;
    e.englue = false;
    if (f.boss) {
      e.ponte -= dt;
      if (e.ponte <= 0) {
        e.ponte = e.type === "mere" ? 2.6 : 3.2;
        ajouterEnnemi(j, e.type === "mere" ? "petite" : "araignee", e.x + Math.cos(e.age) * e.r, e.y + Math.sin(e.age) * e.r);
      }
    }
    let vitesse = f.vitesse;
    if (!f.vole) {
      for (const c of j.colles) {
        if (!pointInPolygon(e, c.poly)) continue;
        if (e.type === "gomme") {
          c.vie = 0;
          continue;
        }
        e.englue = true;
        vitesse = f.vitesse * (1 - ralenti);
        if (rongeColle) blesser(j, e, rongeColle * dt);
      }
    }
    if (e.mort) continue;
    let dx = t.x - e.x;
    let dy = t.y - e.y;
    let n = Math.hypot(dx, dy) || 1;
    dx /= n;
    dy /= n;
    if (e.type === "araignee" || e.type === "compas") {
      const w = Math.sin(e.age * 3.2 + e.zig) * 0.9;
      const px = -dy;
      dy += dx * w;
      dx += px * w;
      n = Math.hypot(dx, dy) || 1;
      dx /= n;
      dy /= n;
    }
    const nx = e.x + dx * vitesse * dt;
    const ny = e.y + dy * vitesse * dt;
    if (!f.vole) {
      const seg = murBloquant(j, e, nx, ny);
      if (seg) {
        e.bloque = true;
        const avant = seg.pv;
        seg.pv -= f.ronge * dt;
        if (avant > 0 && seg.pv <= 0) {
          j.sons.push("casse");
          effet(j, "casse", (seg.a.x + seg.b.x) / 2, (seg.a.y + seg.b.y) / 2, 0.4);
        }
        continue;
      }
    }
    e.x = nx;
    e.y = ny;
    if (dist(e, t) < t.r + e.r) {
      t.pv -= f.degats;
      e.mort = true;
      effet(j, "impact", e.x, e.y, 0.5, { texte: "-" + f.degats });
      j.sons.push("aie");
    }
  }
}

/** Le segment de mur qui arrête ce monstre s'il avance jusqu'en (nx, ny). */
function murBloquant(j: Jeu, e: Ennemi, nx: number, ny: number): SegMur | null {
  const p = { x: nx, y: ny };
  for (const m of j.murs) {
    for (const s of m.segs) {
      if (s.pv <= 0) continue;
      const apres = pointSegDist(p, s.a, s.b);
      if (apres < e.r + 1.5 && apres < pointSegDist(e, s.a, s.b)) return s;
    }
  }
  return null;
}

function plusProche(j: Jeu, x: number, y: number, portee: number, exclus?: Set<number>): Ennemi | null {
  let best: Ennemi | null = null;
  let bd = portee;
  for (const e of j.ennemis) {
    if (e.mort || exclus?.has(e.id)) continue;
    const d = Math.hypot(e.x - x, e.y - y);
    if (d < bd) {
      bd = d;
      best = e;
    }
  }
  return best;
}

function armes(j: Jeu, dt: number): void {
  const t = j.tour;
  const m = multTour(j);
  // Le tir de base
  t.cd -= dt;
  const cible = plusProche(j, t.x, t.y, PORTEE);
  if (cible) {
    t.angle = Math.atan2(cible.y - t.y, cible.x - t.x);
    if (t.cd <= 0) {
      t.cd = intervalleTir(j);
      tirer(j, t.angle, degatsTir(j), false);
    }
  }
  // Roquettes : vers le plus gros paquet
  const nr = j.niv.roquette;
  if (nr) {
    t.cdRoquette -= dt;
    if (t.cdRoquette <= 0) {
      const rayon = 40 + 8 * nr;
      let best: Ennemi | null = null;
      let bn = 0;
      for (const e of j.ennemis) {
        if (e.mort || dist(e, t) > PORTEE) continue;
        let c = 0;
        for (const o of j.ennemis) if (!o.mort && dist(e, o) < rayon) c++;
        if (c > bn) {
          bn = c;
          best = e;
        }
      }
      if (best) {
        t.cdRoquette = 3.2 / (1 + 0.25 * (nr - 1));
        tirer(j, Math.atan2(best.y - t.y, best.x - t.x), 30 * nr * m, true);
      }
    }
  }
  // Foudre en chaîne
  const nf = j.niv.foudre;
  if (nf) {
    t.cdFoudre -= dt;
    if (t.cdFoudre <= 0) {
      let e = plusProche(j, t.x, t.y, PORTEE);
      if (e) {
        t.cdFoudre = 2.6;
        const vus = new Set<number>();
        const pts: V[] = [{ x: t.x, y: t.y }];
        for (let k = 0; k < 3 + nf && e; k++) {
          vus.add(e.id);
          pts.push({ x: e.x, y: e.y });
          blesser(j, e, (14 + 8 * nf) * m, true);
          e = plusProche(j, e.x, e.y, 95, vus);
        }
        effet(j, "eclair", 0, 0, 0.25, { pts });
        j.sons.push("zap");
      }
    }
  }
  // Lames de scie
  const ns = j.niv.scie;
  for (let k = 0; k < ns; k++) {
    const p = positionScie(j, k);
    for (const e of j.ennemis) if (!e.mort && dist(e, p) < e.r + 9) blesser(j, e, (30 + 15 * ns) * m * dt);
  }
}

export function positionScie(j: Jeu, k: number): V {
  const a = j.temps * 2.6 + (k * Math.PI * 2) / Math.max(1, j.niv.scie);
  return { x: j.tour.x + Math.cos(a) * 64, y: j.tour.y + Math.sin(a) * 64 };
}

function tirer(j: Jeu, angle: number, degats: number, roquette: boolean): void {
  const v = roquette ? 300 : 460;
  j.tirs.push({
    x: j.tour.x + Math.cos(angle) * 20, y: j.tour.y + Math.sin(angle) * 20,
    vx: Math.cos(angle) * v, vy: Math.sin(angle) * v, degats, roquette, vie: 1.2,
  });
  if (!roquette) j.sons.push("tir");
}

function bougerTirs(j: Jeu, dt: number): void {
  for (const s of j.tirs) {
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.vie -= dt;
    for (const e of j.ennemis) {
      if (e.mort || Math.hypot(e.x - s.x, e.y - s.y) > e.r + 3) continue;
      if (s.roquette) {
        const rayon = 40 + 8 * j.niv.roquette;
        for (const o of j.ennemis) if (!o.mort && Math.hypot(o.x - s.x, o.y - s.y) < rayon + o.r) blesser(j, o, s.degats, true);
        effet(j, "boom", s.x, s.y, 0.45, { r: rayon });
        j.sons.push("boom");
      } else blesser(j, e, s.degats);
      s.vie = 0;
      break;
    }
  }
  j.tirs = j.tirs.filter((s) => s.vie > 0);
}

// --- Le bulletin ---

/** Les vagues tenues jusqu'au bout. */
export const vaguesTenues = (j: Jeu) => (j.phase === "gagne" ? DERNIERE_VAGUE : j.vague - 1);

/** La note de la prof, sur 20. */
export function note(j: Jeu): number {
  if (j.phase === "gagne") return Math.min(20, 12 + Math.round((8 * j.tour.pv) / j.tour.pvMax));
  return Math.round((vaguesTenues(j) / DERNIERE_VAGUE) * 11);
}
