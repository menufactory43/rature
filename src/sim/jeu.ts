// La simulation d'une page : pure, sans DOM, reproductible.
// Le rendu et les tests la lisent ; seuls step(), appliquerTrace(), lancerVague(), ameliorer(), vendre() et
// changerCible() la modifient.
import { CASE, COLS, HAUTEUR, LARGEUR, LIGNES, caseDe, indice, type Carte } from "./carte";
import { Champ, COUT_TOUR } from "./chemin";
import { ENNEMIS, echellePv, type TypeEnnemi } from "./ennemis";
import { dist, pointInPolygon, pointSegDist, polylineDist, polylineLength, resample, type V } from "./geom";
import type { Glyphe } from "./glyphes";
import { classer, type Geste, type Pt } from "./gestures";
import { LARGEUR_REGLE, LONGUEUR_REGLE, POUVOIRS, type Pouvoir } from "./pouvoirs";
import { VAGUES_ENTRE_CHOIX, appliquer, boostNeutre, tirer, type Boost, type Fourniture } from "./interro";
import { Rng } from "./rng";
import { PORTEE_INFINIE, RAYON_TOUR, TOURS, TYPES_TOURS as TYPES_TOURS_LISTE, prochainCout, pvTour, statsTour, tourDuGlyphe, type Stats, type TypeTour } from "./tours";
import { estVagueBoss, planifier, type PlanVague, type ReglesVagues } from "./vagues";

export { LARGEUR, HAUTEUR };

export const ENCRE_PAR_PX_MUR = 0.14;
export const ENCRE_PAR_PX_COLLE = 0.12;
export const VIE_MUR = 30;
export const VIE_COLLE = 6;
export const REGEN = 1.5;
export const DELAI_VAGUE = 14;

// --- Ce qui vient de dehors : talents et défis ---

export interface Talents {
  encreDepart: number;
  regen: number;
  murPv: number;
  ratureDegats: number;
  colleDuree: number;
  coutTours: number;
  vies: number;
  primes: number;
}

export const TALENTS_NEUTRES: Talents = { encreDepart: 0, regen: 1, murPv: 1, ratureDegats: 1, colleDuree: 1, coutTours: 1, vies: 0, primes: 1 };

export type Defi = "sansMur" | "quatreTours" | "encreMoitie" | "sansRature";

export interface Options {
  carte: Carte;
  regles: ReglesVagues;
  encreDepart: number;
  vies?: number;
  toursDispo: TypeTour[];
  gestes?: { mur: boolean; rature: boolean; colle: boolean };
  talents?: Talents;
  defi?: Defi;
  /** Les pouvoirs que le joueur a gagnés. */
  pouvoirs?: Pouvoir[];
  /** L'interro surprise : une fourniture à choisir toutes les deux vagues. */
  interro?: boolean;
}

// --- L'état ---

export type Priorite = "premier" | "dernier" | "fort" | "proche";
export const PRIORITES: Priorite[] = ["premier", "dernier", "fort", "proche"];

export interface Tour {
  id: number;
  type: TypeTour;
  x: number;
  y: number;
  niveau: number;
  spec: number;
  pv: number;
  pvMax: number;
  cd: number;
  angle: number;
  cible: Priorite;
  investi: number;
  /** Les fournitures de l'interro (partagé par toutes les tours du type). */
  boost?: Boost;
  cache?: { cle: string; s: Stats };
  /** Petit recul visuel au tir. */
  recul: number;
}

export interface Ennemi {
  id: number;
  type: TypeEnnemi;
  x: number;
  y: number;
  vx: number;
  vy: number;
  pv: number;
  pvMax: number;
  bouclier: number;
  r: number;
  age: number;
  zig: number;
  bloque: boolean;
  englue: number;
  etourdi: number;
  marque: number;
  revele: number;
  acide: number;
  ralenti: number;
  mort: boolean;
  ponte: number;
  touche: number;
  /** L'entrée par où il est arrivé (pour repartir avec son butin). */
  entree: number;
  /** Les vies qu'il emporte : s'il meurt en route, elles retournent au Cœur. */
  vol: number;
  /** Le chemin du retour vers sa sortie, quand il a volé des vies. */
  retour: V[] | null;
  ri: number;
}

/** Des vies reprises à un voleur, qui flottent jusqu'au Cœur. */
export interface Rendu {
  x: number;
  y: number;
  vies: number;
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

export interface Zone {
  x: number;
  y: number;
  r: number;
  dps: number;
  age: number;
  vie: number;
}

export interface Tir {
  x: number;
  y: number;
  vx: number;
  vy: number;
  degats: number;
  type: "plume" | "roquette";
  cible: V;
  perce: number;
  touches: number[];
  vie: number;
  tour: number;
}

export type TypeEffet = "chiffre" | "texte" | "eclair" | "boom" | "fuite" | "rature" | "casse" | "coche" | "pose" | "detruite" | "soin" | "regle" | "lasso" | "gomme";

export interface Effet {
  type: TypeEffet;
  x: number;
  y: number;
  age: number;
  vie: number;
  texte?: string;
  pts?: V[];
  r?: number;
  rouge?: boolean;
  graine: number;
}

export interface Eclat {
  x: number;
  y: number;
  r: number;
  graine: number;
}

export type Phase = "attente" | "jeu" | "perdu" | "gagne";

export type Son = "pop" | "aie" | "casse" | "tir" | "boom" | "zap" | "rate" | "page" | "mur" | "rature" | "colle" | "sec" | "boss" | "pose" | "refus" | "vague" | "ding" | "coche";

/** Ce qui vient d'arriver, pour les animations (vidé par l'affichage, jamais lu par la simulation). */
export type Evt =
  | { k: "mort"; type: TypeEnnemi; x: number; y: number; r: number; id: number; angle: number; prime: number }
  | { k: "fuite"; x: number; y: number; vies: number; type: TypeEnnemi }
  | { k: "tir"; tour: TypeTour; id: number; x: number; y: number; angle: number }
  | { k: "impact"; x: number; y: number; angle: number }
  | { k: "boom"; x: number; y: number; r: number }
  | { k: "pose"; id: number; x: number; y: number }
  | { k: "amelio"; id: number; x: number; y: number; spec: boolean }
  | { k: "detruite"; x: number; y: number }
  | { k: "vague"; n: number; boss: TypeEnnemi | null }
  | { k: "eclair"; pts: V[] }
  | { k: "rature"; pts: V[]; touches: number }
  | { k: "mur"; pts: V[] }
  | { k: "soin"; x: number; y: number }
  | { k: "repris"; x: number; y: number; vies: number }
  | { k: "rendu"; vies: number }
  | { k: "evade"; x: number; y: number; vies: number }
  | { k: "pouvoir"; p: Pouvoir; x: number; y: number; r: number; pts: V[]; touches: number }
  | { k: "pret"; p: Pouvoir };

export interface Jeu {
  options: Options;
  carte: Carte;
  champ: Champ;
  regles: ReglesVagues;
  talents: Talents;
  phase: Phase;
  vague: number;
  plan: PlanVague | null;
  /** Secondes avant la vague suivante (null : la vague en cours n'a pas fini d'arriver). */
  prochaine: number | null;
  file: { type: TypeEnnemi; x: number; y: number; t: number; vague: number }[];
  encre: number;
  vies: number;
  viesMax: number;
  tours: Tour[];
  ennemis: Ennemi[];
  murs: Mur[];
  colles: Colle[];
  zones: Zone[];
  tirs: Tir[];
  effets: Effet[];
  eclats: Eclat[];
  temps: number;
  champSale: boolean;
  dernierCalcul: number;
  /** Les trajets de chaque entrée au Cœur, recalculés avec le champ (pour les tracer au crayon). */
  trajets: V[][];
  rng: Rng;
  stats: { tues: number; fuites: number; encreDepensee: number; ratures: number; ratees: number; toursPosees: number };
  prochainId: number;
  sons: Son[];
  evts: Evt[];
  rendus: Rendu[];
  /** Secondes avant que chaque pouvoir soit de nouveau prêt. */
  recharges: Record<Pouvoir, number>;
  /** L'interro : les fournitures par type de tour, les modificateurs, le choix en attente, ce qui a été pris. */
  boosts: Record<TypeTour, Boost>;
  mods: { recharge: number; pvMonstres: number };
  choix: Fourniture[] | null;
  choixFait: number;
  prises: string[];
}

export function nouveauJeu(options: Options): Jeu {
  const talents = options.talents ?? TALENTS_NEUTRES;
  const vies = (options.vies ?? 20) + talents.vies;
  const encre = (options.encreDepart + talents.encreDepart) * (options.defi === "encreMoitie" ? 0.5 : 1);
  const j: Jeu = {
    options, carte: options.carte, champ: new Champ(options.carte), regles: options.regles, talents: { ...talents },
    phase: "attente", vague: 0, plan: planifier(options.regles, 1), prochaine: null, file: [],
    encre, vies, viesMax: vies,
    tours: [], ennemis: [], murs: [], colles: [], zones: [], tirs: [], effets: [], eclats: [],
    temps: 0, champSale: true, dernierCalcul: -1, trajets: [], rng: new Rng(options.regles.graine ^ 0x7f4a7c15),
    stats: { tues: 0, fuites: 0, encreDepensee: 0, ratures: 0, ratees: 0, toursPosees: 0 },
    prochainId: 1, sons: [], evts: [], rendus: [], recharges: { regle: 0, lasso: 0, gomme: 0 },
    boosts: Object.fromEntries(TYPES_TOURS_LISTE.map((t) => [t, boostNeutre()])) as Record<TypeTour, Boost>,
    mods: { recharge: 1, pvMonstres: 1 }, choix: null, choixFait: 0, prises: [],
  };
  recalculer(j);
  return j;
}

const gestes = (j: Jeu) => ({
  mur: (j.options.gestes?.mur ?? true) && j.options.defi !== "sansMur",
  rature: (j.options.gestes?.rature ?? true) && j.options.defi !== "sansRature",
  colle: j.options.gestes?.colle ?? true,
});
export const gestesPermis = gestes;

export const regen = (j: Jeu) => REGEN * j.talents.regen * (j.options.defi === "encreMoitie" ? 0.5 : 1);
export const coutPose = (j: Jeu, type: TypeTour) => Math.round(TOURS[type].couts[0] * j.talents.coutTours);
export const coutAmelioration = (j: Jeu, t: Tour, spec?: number): number | null => {
  if (spec && t.niveau === 3 && !t.spec) return Math.round(TOURS[t.type].specs[spec - 1].cout * j.talents.coutTours);
  const c = prochainCout(t.type, t.niveau, t.spec);
  return c === null ? null : Math.round(c * j.talents.coutTours);
};
export const degatsRature = (j: Jeu) => 30 * j.talents.ratureDegats * (1 + 0.06 * Math.max(0, j.vague - 1));
export const coutRature = (longueur: number) => 5 + longueur * 0.05;
export const pvSegment = (j: Jeu) => 30 * j.talents.murPv * (1 + 0.04 * Math.max(0, j.vague - 1));
export const valeurRevente = (t: Tour) => Math.floor(t.investi * 0.6);
/** Longueur qu'on peut encore tracer avant que le stylo sèche (au tarif d'un mur). */
export const longueurPossible = (j: Jeu) => j.encre / ENCRE_PAR_PX_MUR;
export function stats(t: Tour): Stats {
  const base = statsTour(t.type, t.niveau, t.spec);
  const b = t.boost;
  if (!b || (b.degats === 1 && b.cadence === 1 && b.portee === 1)) return base;
  const cle = `${t.niveau}/${t.spec}/${b.version}`;
  if (t.cache?.cle !== cle) {
    const portee = base.portee >= PORTEE_INFINIE ? base.portee : base.portee * b.portee;
    t.cache = { cle, s: { ...base, degats: base.degats * b.degats, dps: base.dps && base.dps * b.degats, intervalle: base.intervalle / b.cadence, portee } };
  }
  return t.cache.s;
}

/** Choisir une des fournitures proposées (l'interro). */
export function choisirFourniture(j: Jeu, i: number): boolean {
  const f = j.choix?.[i];
  if (!f) return false;
  appliquer(j, f);
  j.choix = null;
  j.choixFait = j.vague;
  j.sons.push("coche");
  return true;
}

// --- Le déroulé des vagues ---

/** Lance la première vague, ou appelle la suivante en avance (bonus d'encre). */
/** L'interro : une fourniture est due toutes les deux vagues ; on ne peut pas appeler la suite avant de l'avoir choisie. */
export const fournitureDue = (j: Jeu) => !!j.options.interro && j.vague - j.choixFait >= VAGUES_ENTRE_CHOIX && j.vague < j.regles.total;

export function lancerVague(j: Jeu): void {
  if (j.choix || (j.phase === "jeu" && fournitureDue(j))) return;
  if (j.phase === "attente") {
    j.phase = "jeu";
    demarrerVague(j);
    return;
  }
  if (j.phase !== "jeu" || j.prochaine === null) return;
  const bonus = Math.round(j.prochaine * 2);
  if (bonus > 0) {
    j.encre += bonus;
    effet(j, "texte", LARGEUR / 2, 40, 1.2, { texte: `+${bonus} d'encre (en avance)` });
  }
  demarrerVague(j);
}

function demarrerVague(j: Jeu): void {
  j.vague++;
  const plan = planifier(j.regles, j.vague);
  for (const g of plan.groupes) {
    const e = j.carte.entrees[g.entree % j.carte.entrees.length];
    const horizontal = e.depart.x < 0 || e.depart.x > LARGEUR;
    for (let k = 0; k < g.nombre; k++) {
      const ecart = (j.rng.next() - 0.5) * 22;
      j.file.push({ type: g.type, x: e.depart.x + (horizontal ? 0 : ecart), y: e.depart.y + (horizontal ? ecart : 0), t: j.temps + g.a + k * 0.32, vague: j.vague });
    }
  }
  j.file.sort((a, b) => a.t - b.t);
  j.prochaine = null;
  j.plan = Number.isFinite(j.regles.total) && j.vague >= j.regles.total ? null : planifier(j.regles, j.vague + 1);
  // Les intérêts de la banque
  for (const t of j.tours) {
    const s = stats(t);
    if (s.interets) {
      const gain = Math.min(60, Math.floor(j.encre * s.interets));
      j.encre += gain;
      if (gain) effet(j, "texte", t.x, t.y - 22, 1, { texte: `+${gain}` });
    }
  }
  j.sons.push(estVagueBoss(j.regles, j.vague) ? "boss" : "vague");
  j.evts.push({ k: "vague", n: j.vague, boss: estVagueBoss(j.regles, j.vague) ? j.regles.boss ?? null : null });
}

// --- Les tours ---

export interface Resultat {
  geste: Geste;
  ok: boolean;
  glyphe?: Glyphe;
  raison?: string;
  touches?: number;
}

/** Où une tour peut-elle se poser ? Renvoie la raison du refus, ou null. */
export function refusPose(j: Jeu, x: number, y: number): string | null {
  if (x < 14 || y < 14 || x > LARGEUR - 14 || y > HAUTEUR - 14) return "trop près du bord";
  if (dist({ x, y }, j.carte.coeur) < 30) return "trop près du Cœur";
  if (j.carte.entrees.some((e) => dist({ x, y }, e.bord) < 26)) return "sur une entrée";
  for (let dy = -8; dy <= 8; dy += 8) for (let dx = -8; dx <= 8; dx += 8) if (j.carte.bloque[caseDe(x + dx, y + dy)]) return "sur un obstacle";
  if (j.carte.interdit[caseDe(x, y)]) return "on n'écrit pas dans ce cadre";
  if (j.tours.some((t) => Math.hypot(t.x - x, t.y - y) < RAYON_TOUR * 2 + 4)) return "trop près d'une autre tour";
  if (j.options.defi === "quatreTours" && j.tours.length >= 4) return "4 tours maximum (défi)";
  return null;
}

export function poserTour(j: Jeu, type: TypeTour, x: number, y: number): Resultat {
  const res = { geste: "tour" as Geste, glyphe: TOURS[type].glyphe };
  if (!j.options.toursDispo.includes(type)) return refuser(j, x, y, { ...res, ok: false, raison: `${TOURS[type].nom} : pas encore débloquée` });
  const refus = refusPose(j, x, y);
  if (refus) return refuser(j, x, y, { ...res, ok: false, raison: refus });
  const cout = coutPose(j, type);
  if (j.encre < cout) return refuser(j, x, y, { ...res, ok: false, raison: `il faut ${cout} d'encre` });
  j.encre -= cout;
  j.stats.encreDepensee += cout;
  const pv = pvTour(1, 0);
  j.tours.push({ id: j.prochainId++, type, x, y, niveau: 1, spec: 0, pv, pvMax: pv, cd: 0.3, angle: -Math.PI / 2, cible: "premier", investi: cout, recul: 0, boost: j.options.interro ? j.boosts[type] : undefined });
  j.stats.toursPosees++;
  j.champSale = true;
  effet(j, "pose", x, y, 0.5);
  j.sons.push("pose");
  j.evts.push({ k: "pose", id: j.tours[j.tours.length - 1].id, x, y });
  return { ...res, ok: true };
}

function refuser(j: Jeu, x: number, y: number, r: Resultat): Resultat {
  effet(j, "texte", x, y - 20, 1.2, { texte: r.raison });
  j.sons.push("refus");
  return r;
}

export function ameliorer(j: Jeu, t: Tour, spec?: number): boolean {
  const cout = coutAmelioration(j, t, spec);
  if (cout === null || j.encre < cout) return false;
  if (t.niveau === 3 && !spec) return false;
  j.encre -= cout;
  j.stats.encreDepensee += cout;
  t.investi += cout;
  if (t.niveau < 3) t.niveau++;
  else t.spec = spec!;
  const ratio = t.pv / t.pvMax;
  t.pvMax = pvTour(t.niveau, t.spec);
  t.pv = t.pvMax * ratio;
  effet(j, "pose", t.x, t.y, 0.5);
  j.sons.push("ding");
  j.evts.push({ k: "amelio", id: t.id, x: t.x, y: t.y, spec: !!spec });
  return true;
}

export function vendre(j: Jeu, t: Tour): void {
  const gain = valeurRevente(t);
  j.encre += gain;
  j.tours = j.tours.filter((o) => o !== t);
  j.champSale = true;
  effet(j, "texte", t.x, t.y - 20, 1, { texte: `+${gain}` });
  j.sons.push("casse");
}

export function changerCible(t: Tour): void {
  t.cible = PRIORITES[(PRIORITES.indexOf(t.cible) + 1) % PRIORITES.length];
}

// --- Les gestes ---

export function appliquerTrace(j: Jeu, trace: Pt[]): Resultat {
  const c = classer(trace);
  if (c.geste === "rien" || j.phase === "perdu" || j.phase === "gagne") return { geste: c.geste, ok: false };
  const g = gestes(j);
  if (c.geste === "tour") {
    const cx = trace.reduce((s, p) => s + p.x, 0) / trace.length;
    const cy = trace.reduce((s, p) => s + p.y, 0) / trace.length;
    return poserTour(j, tourDuGlyphe(c.glyphe!), cx, cy);
  }
  const fin = trace[trace.length - 1];
  const l = polylineLength(trace);
  if ((c.geste === "mur" && !g.mur) || (c.geste === "rature" && !g.rature) || (c.geste === "cercle" && !g.colle)) {
    const nom = c.geste === "cercle" ? "la colle" : c.geste === "mur" ? "le mur" : "la rature";
    return refuser(j, fin.x, fin.y, { geste: c.geste, ok: false, raison: `${nom} n'est pas permis ici` });
  }
  const cout = c.geste === "rature" ? coutRature(l) : l * (c.geste === "mur" ? ENCRE_PAR_PX_MUR : ENCRE_PAR_PX_COLLE);
  if (cout > j.encre + 0.5) return refuser(j, fin.x, fin.y, { geste: c.geste, ok: false, raison: "plus d'encre" });
  j.encre = Math.max(0, j.encre - cout);
  j.stats.encreDepensee += cout;
  if (c.geste === "rature") {
    const pts = resample(trace, 6);
    const d = degatsRature(j);
    let touches = 0;
    for (const e of j.ennemis) {
      if (!e.mort && polylineDist(e, pts) <= e.r + 5) {
        e.revele = Math.max(e.revele, 3);
        blesser(j, e, d, { chiffre: true });
        touches++;
      }
    }
    j.stats.ratures++;
    effet(j, "rature", 0, 0, 0.45, { pts });
    j.evts.push({ k: "rature", pts, touches });
    if (!touches) {
      j.stats.ratees++;
      const m = pts[Math.floor(pts.length / 2)];
      effet(j, "texte", m.x, m.y - 14, 0.8, { texte: "raté" });
      j.sons.push("rate");
    } else j.sons.push("rature");
    return { geste: "rature", ok: true, touches };
  }
  if (c.geste === "mur") {
    const pts = resample(trace, 12);
    const pv = pvSegment(j);
    const segs: SegMur[] = [];
    for (let i = 1; i < pts.length; i++) segs.push({ a: pts[i - 1], b: pts[i], pv, pvMax: pv });
    j.murs.push({ id: j.prochainId++, segs, age: 0, vie: VIE_MUR });
    j.champSale = true;
    j.sons.push("mur");
    j.evts.push({ k: "mur", pts });
    return { geste: "mur", ok: true };
  }
  j.colles.push({ id: j.prochainId++, poly: resample(trace, 10), age: 0, vie: VIE_COLLE * j.talents.colleDuree });
  j.sons.push("colle");
  return { geste: "cercle", ok: true };
}

// --- Les pouvoirs ---

/** La force d'un pouvoir suit celle des monstres de la vague en cours. */
const forcePouvoir = (j: Jeu, base: number) => base * j.regles.difficulte * echellePv(Math.max(1, j.vague));

/** La règle va du premier au dernier point du trait, bornée à LONGUEUR_REGLE autour de son milieu. */
export function segmentRegle(trace: V[]): [V, V] {
  const a = trace[0];
  const b = trace[trace.length - 1];
  const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const demi = Math.min(l, LONGUEUR_REGLE) / 2;
  return [{ x: m.x - ((b.x - a.x) / l) * demi, y: m.y - ((b.y - a.y) / l) * demi }, { x: m.x + ((b.x - a.x) / l) * demi, y: m.y + ((b.y - a.y) / l) * demi }];
}

/** La zone frottée par la gomme : le centre du griffonnage et son étendue. */
export function zoneGomme(trace: V[]): { x: number; y: number; r: number } {
  const x = trace.reduce((s, p) => s + p.x, 0) / trace.length;
  const y = trace.reduce((s, p) => s + p.y, 0) / trace.length;
  const moy = trace.reduce((s, p) => s + Math.hypot(p.x - x, p.y - y), 0) / trace.length;
  return { x, y, r: Math.max(36, Math.min(70, moy * 1.5 + 12)) };
}

export function lancerPouvoir(j: Jeu, p: Pouvoir, trace: Pt[]): Resultat {
  const fin = trace[trace.length - 1];
  const res = (ok: boolean, raison?: string, touches?: number): Resultat => ({ geste: "rien", ok, raison, touches });
  if (j.phase !== "jeu" && j.phase !== "attente") return res(false);
  if (!j.options.pouvoirs?.includes(p)) return refuser(j, fin.x, fin.y, res(false, "pas encore gagné"));
  if (j.recharges[p] > 0) return refuser(j, fin.x, fin.y, res(false, `prêt dans ${Math.ceil(j.recharges[p])} s`));
  const l = polylineLength(trace);
  let touches = 0;
  if (p === "regle") {
    const [a, b] = segmentRegle(trace);
    if (Math.hypot(b.x - a.x, b.y - a.y) < 50) return refuser(j, fin.x, fin.y, res(false, "trop court"));
    const d = forcePouvoir(j, 45);
    for (const e of j.ennemis) {
      if (e.mort || pointSegDist(e, a, b) > LARGEUR_REGLE + e.r) continue;
      blesser(j, e, d, { chiffre: true, ignoreArmure: true });
      e.etourdi = Math.max(e.etourdi, ENNEMIS[e.type].boss ? 0.8 : 2);
      touches++;
    }
    effet(j, "regle", (a.x + b.x) / 2, (a.y + b.y) / 2, 1.1, { pts: [a, b] });
    j.evts.push({ k: "pouvoir", p, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, r: 0, pts: [a, b], touches });
    j.sons.push("boom");
  } else if (p === "lasso") {
    const a = trace[0];
    if (l < 80 || Math.hypot(fin.x - a.x, fin.y - a.y) > Math.max(40, l * 0.3)) return refuser(j, fin.x, fin.y, res(false, "ferme la boucle"));
    const poly = resample(trace, 8);
    const duree = 4.5;
    for (const e of j.ennemis) {
      if (e.mort || !pointInPolygon(e, poly)) continue;
      e.etourdi = Math.max(e.etourdi, ENNEMIS[e.type].boss ? 1.5 : duree);
      e.marque = Math.max(e.marque, duree + 1);
      touches++;
    }
    const cx = poly.reduce((s, q) => s + q.x, 0) / poly.length;
    const cy = poly.reduce((s, q) => s + q.y, 0) / poly.length;
    effet(j, "lasso", cx, cy, duree, { pts: poly });
    j.evts.push({ k: "pouvoir", p, x: cx, y: cy, r: 0, pts: poly, touches });
    j.sons.push("colle");
  } else {
    if (l < 60) return refuser(j, fin.x, fin.y, res(false, "frotte plus"));
    const z = zoneGomme(trace);
    const d = forcePouvoir(j, 110);
    for (const e of j.ennemis) {
      if (e.mort || Math.hypot(e.x - z.x, e.y - z.y) > z.r + e.r * 0.5) continue;
      e.bouclier = 0;
      blesser(j, e, d, { chiffre: true, ignoreArmure: true });
      touches++;
    }
    effet(j, "gomme", z.x, z.y, 0.9, { r: z.r });
    j.evts.push({ k: "pouvoir", p, x: z.x, y: z.y, r: z.r, pts: [], touches });
    j.sons.push("rature");
  }
  j.recharges[p] = POUVOIRS[p].recharge * j.mods.recharge;
  return res(true, undefined, touches);
}

// --- Le champ de flux ---

function remplirSurcout(s: Float32Array, murs: { segs: SegMur[] }[], tours: V[]): void {
  s.fill(0);
  for (const m of murs) {
    for (const seg of m.segs) {
      if (seg.pv <= 0) continue;
      const c0 = Math.floor((Math.min(seg.a.x, seg.b.x) - 10) / CASE);
      const c1 = Math.floor((Math.max(seg.a.x, seg.b.x) + 10) / CASE);
      const l0 = Math.floor((Math.min(seg.a.y, seg.b.y) - 10) / CASE);
      const l1 = Math.floor((Math.max(seg.a.y, seg.b.y) + 10) / CASE);
      for (let l = Math.max(0, l0); l <= Math.min(LIGNES - 1, l1); l++)
        for (let c = Math.max(0, c0); c <= Math.min(COLS - 1, c1); c++)
          if (pointSegDist({ x: (c + 0.5) * CASE, y: (l + 0.5) * CASE }, seg.a, seg.b) < 8) s[indice(c, l)] = Math.max(s[indice(c, l)], seg.pv * 0.3);
    }
  }
  for (const t of tours) {
    const r = RAYON_TOUR + 4;
    for (let l = Math.floor((t.y - r) / CASE); l <= Math.floor((t.y + r) / CASE); l++)
      for (let c = Math.floor((t.x - r) / CASE); c <= Math.floor((t.x + r) / CASE); c++)
        if (c >= 0 && l >= 0 && c < COLS && l < LIGNES && Math.hypot((c + 0.5) * CASE - t.x, (l + 0.5) * CASE - t.y) < r) s[indice(c, l)] = COUT_TOUR;
  }
}

function recalculer(j: Jeu): void {
  remplirSurcout(j.champ.surcout, j.murs, j.tours);
  j.champ.calculer();
  j.trajets = j.carte.entrees.map((e) => j.champ.trajet(e.bord));
  j.champSale = false;
  j.dernierCalcul = j.temps;
}

/** Les trajets qu'auraient les monstres si l'on posait ce mur ou cette tour (aperçu pendant qu'on dessine). */
export function apercuTrajets(j: Jeu, ajout: { mur?: V[]; tour?: V }): V[][] {
  const champ = new Champ(j.carte);
  const murs: { segs: SegMur[] }[] = [...j.murs];
  if (ajout.mur && ajout.mur.length > 1) {
    const pts = resample(ajout.mur, 12);
    const pv = pvSegment(j);
    const segs: SegMur[] = [];
    for (let i = 1; i < pts.length; i++) segs.push({ a: pts[i - 1], b: pts[i], pv, pvMax: pv });
    murs.push({ segs });
  }
  remplirSurcout(champ.surcout, murs, ajout.tour ? [...j.tours, ajout.tour] : j.tours);
  champ.calculer();
  return j.carte.entrees.map((e) => champ.trajet(e.bord));
}

// --- Les dégâts ---

export function ajouterEnnemi(j: Jeu, type: TypeEnnemi, x: number, y: number, vague = j.vague): Ennemi {
  const f = ENNEMIS[type];
  const pv = f.pv * j.mods.pvMonstres * j.regles.difficulte * echellePv(Math.max(1, vague)) * (Number.isFinite(j.regles.total) ? 1 : 1 + Math.max(0, vague - 20) * 0.04);
  const e: Ennemi = {
    id: j.prochainId++, type, x, y, vx: 0, vy: 0, pv, pvMax: pv, bouclier: (f.bouclier ?? 0) * j.regles.difficulte * echellePv(Math.max(1, vague)), r: f.rayon,
    age: 0, zig: (j.prochainId * 1.7) % 6.28, bloque: false, englue: 0, etourdi: 0, marque: 0, revele: 0, acide: 0, ralenti: 0,
    mort: false, ponte: 2, touche: 0, vol: 0, retour: null, ri: 0,
    entree: j.carte.entrees.reduce((b, en, i) => (Math.hypot(en.depart.x - x, en.depart.y - y) < Math.hypot(j.carte.entrees[b].depart.x - x, j.carte.entrees[b].depart.y - y) ? i : b), 0),
  };
  j.ennemis.push(e);
  return e;
}

function effet(j: Jeu, type: TypeEffet, x: number, y: number, vie: number, extra: Partial<Effet> = {}): void {
  j.effets.push({ type, x, y, age: 0, vie, graine: (j.prochainId++ * 7919) | 0, ...extra });
}

interface Coup {
  ignoreArmure?: boolean;
  /** Dégâts continus (par image) : l'armure les réduit en proportion, pas d'un coup. */
  continu?: boolean;
  chiffre?: boolean;
  rouge?: boolean;
}

export function blesser(j: Jeu, e: Ennemi, degats: number, coup: Coup = {}): void {
  if (e.mort || degats <= 0) return;
  let d = degats * (e.marque > 0 ? 1.3 : 1);
  const armure = (ENNEMIS[e.type].armure ?? 0) * (e.acide > 0 ? 0.5 : 1);
  if (armure && !coup.ignoreArmure) d = coup.continu ? d / (1 + armure * 0.12) : Math.max(d * 0.25, d - armure);
  if (e.bouclier > 0) {
    const absorbe = Math.min(e.bouclier, d);
    e.bouclier -= absorbe;
    d -= absorbe;
  }
  e.pv -= d;
  if (!coup.continu) e.touche = 0.12;
  if (coup.chiffre) effet(j, "chiffre", e.x, e.y - e.r - 4, 0.7, { texte: String(Math.round(degats)), rouge: coup.rouge });
  if (e.pv <= 0) tuer(j, e);
}

function tuer(j: Jeu, e: Ennemi): void {
  e.mort = true;
  const f = ENNEMIS[e.type];
  j.stats.tues++;
  let prime = f.prime * j.talents.primes;
  for (const t of j.tours) {
    const s = stats(t);
    if (s.primeBonus && Math.hypot(t.x - e.x, t.y - e.y) < s.portee) {
      prime *= 1 + s.primeBonus;
      break;
    }
  }
  j.encre += prime;
  if (e.vol > 0) {
    j.rendus.push({ x: e.x, y: e.y, vies: e.vol });
    effet(j, "texte", e.x, e.y - 20, 1.2, { texte: `${e.vol} ${e.vol > 1 ? "vies reprises" : "vie reprise"} !` });
    j.evts.push({ k: "repris", x: e.x, y: e.y, vies: e.vol });
    j.sons.push("ding");
    e.vol = 0;
  }
  j.evts.push({ k: "mort", type: e.type, x: e.x, y: e.y, r: e.r, id: e.id, angle: Math.atan2(e.vy, e.vx), prime });
  j.eclats.push({ x: e.x, y: e.y, r: e.r * 1.4, graine: e.id });
  if (j.eclats.length > 160) j.eclats.shift();
  j.sons.push("pop");
  if (e.type === "tache") for (const s of [-1, 1]) ajouterEnnemi(j, "petite", e.x + s * 9, e.y + s * 4);
  if (e.type === "mere") for (let k = 0; k < 6; k++) ajouterEnnemi(j, "tache", e.x + Math.cos(k) * 30, e.y + Math.sin(k) * 30);
  if (f.boss) effet(j, "boom", e.x, e.y, 0.7, { r: 80 });
}

const visible = (e: Ennemi, t: Tour) => !ENNEMIS[e.type].furtif || e.revele > 0 || TOURS[t.type].voitFurtifs || Math.hypot(e.x - t.x, e.y - t.y) < 50;

/** Distance restante jusqu'au Cœur (en cases), pour « premier » et « dernier ». */
export function progression(j: Jeu, e: Ennemi): number {
  if (ENNEMIS[e.type].vole) return Math.hypot(e.x - j.carte.coeur.x, e.y - j.carte.coeur.y) / CASE;
  if (e.x < 0 || e.y < 0 || e.x > LARGEUR || e.y > HAUTEUR) return 1e5;
  return j.champ.distance(e);
}

function choisirCible(j: Jeu, t: Tour, portee: number, exclus?: Set<number>): Ennemi | null {
  let best: Ennemi | null = null;
  let score = Infinity;
  for (const e of j.ennemis) {
    if (e.mort || exclus?.has(e.id)) continue;
    if (e.x < -4 || e.y < -4 || e.x > LARGEUR + 4 || e.y > HAUTEUR + 4) continue;
    const d = Math.hypot(e.x - t.x, e.y - t.y);
    if (d > portee + e.r || !visible(e, t)) continue;
    const s = t.cible === "premier" ? progression(j, e) : t.cible === "dernier" ? -progression(j, e) : t.cible === "fort" ? -e.pv : d;
    if (s < score) {
      score = s;
      best = e;
    }
  }
  return best;
}

// --- Une image de simulation ---

export function step(j: Jeu, dt: number): void {
  j.temps += dt;
  // Personne ne vide les événements (bot, tests) : on n'en garde qu'un paquet
  if (j.evts.length > 600) j.evts.splice(0, j.evts.length - 300);
  for (const f of j.effets) f.age += dt;
  j.effets = j.effets.filter((f) => f.age < f.vie);
  if (j.phase !== "jeu") return;

  j.encre += regen(j) * dt;
  for (const t of j.tours) {
    const s = stats(t);
    if (s.encre) j.encre += s.encre * dt;
  }
  for (const m of j.murs) m.age += dt;
  const avant = j.murs.length;
  j.murs = j.murs.filter((m) => m.age < m.vie && m.segs.some((s) => s.pv > 0));
  if (j.murs.length !== avant) j.champSale = true;
  for (const c of j.colles) c.age += dt;
  j.colles = j.colles.filter((c) => c.age < c.vie);
  for (const z of j.zones) z.age += dt;
  j.zones = j.zones.filter((z) => z.age < z.vie);
  if (j.champSale && j.temps - j.dernierCalcul > 0.2) recalculer(j);

  while (j.file.length && j.file[0].t <= j.temps) {
    const s = j.file.shift()!;
    ajouterEnnemi(j, s.type, s.x, s.y, s.vague);
  }

  bougerEnnemis(j, dt);
  tours(j, dt);
  bougerTirs(j, dt);

  j.ennemis = j.ennemis.filter((e) => !e.mort);
  const detruites = j.tours.filter((t) => t.pv <= 0);
  if (detruites.length) {
    for (const t of detruites) {
      effet(j, "detruite", t.x, t.y, 0.8, { r: 24 });
      j.evts.push({ k: "detruite", x: t.x, y: t.y });
      j.sons.push("casse");
    }
    j.tours = j.tours.filter((t) => t.pv > 0);
    j.champSale = true;
  }
  // Les vies reprises flottent jusqu'au Cœur
  for (const r of j.rendus) {
    const dx = j.carte.coeur.x - r.x;
    const dy = j.carte.coeur.y - r.y;
    const d = Math.hypot(dx, dy);
    const pas = Math.min(d, 110 * dt);
    if (d > 0) {
      r.x += (dx / d) * pas;
      r.y += (dy / d) * pas;
    }
    if (d < 8) {
      j.vies = Math.min(j.viesMax, j.vies + r.vies);
      j.stats.fuites = Math.max(0, j.stats.fuites - r.vies);
      effet(j, "fuite", j.carte.coeur.x, j.carte.coeur.y, 0.8, { texte: "+" + r.vies });
      j.evts.push({ k: "rendu", vies: r.vies });
      j.sons.push("ding");
      r.vies = 0;
    }
  }
  j.rendus = j.rendus.filter((r) => r.vies > 0);
  // Le Cœur vide n'est perdu que lorsque plus personne n'emporte ni ne rapporte de vies : on peut encore rattraper le dernier voleur
  if (j.vies <= 0 && !j.rendus.length && !j.ennemis.some((e) => e.vol > 0)) {
    j.vies = 0;
    j.phase = "perdu";
    j.sons.push("page");
    return;
  }
  for (const k of Object.keys(j.recharges) as Pouvoir[]) {
    if (j.recharges[k] <= 0) continue;
    j.recharges[k] -= dt;
    if (j.recharges[k] <= 0) {
      j.recharges[k] = 0;
      if (j.options.pouvoirs?.includes(k)) j.evts.push({ k: "pret", p: k });
    }
  }
  // La suite des vagues
  const derniere = Number.isFinite(j.regles.total) && j.vague >= j.regles.total;
  if (!j.file.length) {
    if (derniere) {
      if (!j.ennemis.length) {
        // Ce qui flottait encore vers le Cœur arrive
        for (const r of j.rendus) j.vies = Math.min(j.viesMax, j.vies + r.vies);
        j.rendus = [];
        j.phase = "gagne";
        j.sons.push("page");
      }
    } else if (fournitureDue(j)) {
      // L'interro : dès que la page est vide, on choisit sa fourniture avant la suite
      if (!j.choix && !j.ennemis.length) j.choix = tirer(j);
    } else {
      if (j.prochaine === null) j.prochaine = DELAI_VAGUE;
      // Page vide : on n'attend pas pour rien
      if (!j.ennemis.length) j.prochaine = Math.min(j.prochaine, 5);
      j.prochaine -= dt;
      if (j.prochaine <= 0) demarrerVague(j);
    }
  }
}

function bougerEnnemis(j: Jeu, dt: number): void {
  const vivants = j.ennemis;
  // Ils se poussent un peu, pour ne pas s'empiler ; les voleurs qui repartent remontent le flot sans bousculade
  for (let a = 0; a < vivants.length; a++) {
    const e = vivants[a];
    if (ENNEMIS[e.type].vole) continue;
    for (let b = a + 1; b < vivants.length; b++) {
      const o = vivants[b];
      if (ENNEMIS[o.type].vole || !o.retour !== !e.retour) continue;
      const dx = o.x - e.x;
      const dy = o.y - e.y;
      const min = e.r + o.r;
      const d2 = dx * dx + dy * dy;
      if (d2 >= min * min || d2 === 0) continue;
      const d = Math.sqrt(d2);
      const p = ((min - d) / d) * 0.2;
      e.x -= dx * p;
      e.y -= dy * p;
      o.x += dx * p;
      o.y += dy * p;
    }
  }
  const coeur = j.carte.coeur;
  for (const e of vivants) {
    if (e.mort) continue;
    const f = ENNEMIS[e.type];
    e.age += dt;
    e.touche = Math.max(0, e.touche - dt);
    e.etourdi = Math.max(0, e.etourdi - dt);
    e.englue = Math.max(0, e.englue - dt);
    e.marque = Math.max(0, e.marque - dt);
    e.revele = Math.max(0, e.revele - dt);
    e.acide = Math.max(0, e.acide - dt);
    e.bloque = false;
    if (f.boss && (e.type === "mere" || e.type === "compas")) {
      e.ponte -= dt;
      if (e.ponte <= 0) {
        e.ponte = e.type === "mere" ? 2.6 : 3.2;
        ajouterEnnemi(j, e.type === "mere" ? "petite" : "araignee", e.x + Math.cos(e.age) * e.r, e.y + Math.sin(e.age) * e.r);
      }
    }
    if (f.soigne) {
      for (const o of vivants) {
        if (o === e || o.mort || ENNEMIS[o.type].boss) continue;
        if (Math.hypot(o.x - e.x, o.y - e.y) < 60 && o.pv < o.pvMax) o.pv = Math.min(o.pvMax, o.pv + o.pvMax * f.soigne * dt);
      }
    }
    if (f.devore) {
      for (const t of j.tours) if (Math.hypot(t.x - e.x, t.y - e.y) < e.r + RAYON_TOUR + 8) t.pv -= f.devore * dt;
    }
    // Le ralentissement : colle, spirales, café
    let lent = 0;
    if (!f.vole) {
      for (const c of j.colles) {
        if (!pointInPolygon(e, c.poly)) continue;
        if (f.efface) {
          c.vie = 0;
          continue;
        }
        lent = Math.max(lent, 0.5);
      }
      if (j.carte.cafe[caseDe(e.x, e.y)]) lent = Math.max(lent, 0.35);
    }
    for (const t of j.tours) {
      const s = stats(t);
      if (s.ralenti && Math.hypot(t.x - e.x, t.y - e.y) < s.portee + e.r) {
        lent = Math.max(lent, f.boss ? s.ralenti * 0.5 : s.ralenti);
        if (s.dps) blesser(j, e, s.dps * dt, { continu: true, ignoreArmure: true });
        if (s.rongeArmure) e.acide = 0.3;
      }
    }
    for (const z of j.zones) if (Math.hypot(z.x - e.x, z.y - e.y) < z.r + e.r) blesser(j, e, z.dps * dt, { continu: true });
    if (e.mort) continue;
    e.ralenti = lent;
    if (e.etourdi > 0 || e.englue > 0) continue;
    const vitesse = f.vitesse * (1 - lent);
    if (e.retour) {
      // Le voleur rentre chez lui par où il est venu, sans plus se soucier des murs
      const cible = e.ri < e.retour.length ? e.retour[e.ri] : j.carte.entrees[e.entree].depart;
      const dx = cible.x - e.x;
      const dy = cible.y - e.y;
      const d = Math.hypot(dx, dy);
      if (d < 6 && e.ri < e.retour.length) e.ri++;
      const pas = Math.min(d, vitesse * 1.1 * dt);
      if (d > 0) {
        e.vx = dx / d;
        e.vy = dy / d;
        e.x += e.vx * pas;
        e.y += e.vy * pas;
      }
      if (e.ri >= e.retour.length && d < 4) {
        e.mort = true;
        effet(j, "texte", Math.max(30, Math.min(370, e.x)), Math.max(20, Math.min(700, e.y)), 1.4, { texte: `${e.vol} ${e.vol > 1 ? "vies perdues" : "vie perdue"}` });
        j.evts.push({ k: "evade", x: e.x, y: e.y, vies: e.vol });
        e.vol = 0;
      }
      continue;
    }

    // La direction : le champ de flux, tout droit pour les volants, la tour la plus proche pour les chasseurs
    let dir: V;
    let proie: Tour | null = null;
    if (f.vole) {
      const n = Math.hypot(coeur.x - e.x, coeur.y - e.y) || 1;
      dir = { x: (coeur.x - e.x) / n, y: (coeur.y - e.y) / n };
    } else if (f.chasseur && j.tours.length) {
      let bd = Infinity;
      for (const t of j.tours) {
        const d = Math.hypot(t.x - e.x, t.y - e.y);
        if (d < bd) {
          bd = d;
          proie = t;
        }
      }
      const n = bd || 1;
      dir = { x: (proie!.x - e.x) / n, y: (proie!.y - e.y) / n };
    } else dir = j.champ.direction(e);
    if (e.type === "araignee" || e.type === "compas") {
      const w = Math.sin(e.age * 3.2 + e.zig) * 0.8;
      const px = -dir.y;
      const py = dir.x;
      const n = Math.hypot(dir.x + px * w, dir.y + py * w) || 1;
      dir = { x: (dir.x + px * w) / n, y: (dir.y + py * w) / n };
    }
    // Un virage en douceur
    const lissage = Math.min(1, dt * 10);
    e.vx += (dir.x - e.vx) * lissage;
    e.vy += (dir.y - e.vy) * lissage;
    const n = Math.hypot(e.vx, e.vy) || 1;
    const nx = e.x + (e.vx / n) * vitesse * dt;
    const ny = e.y + (e.vy / n) * vitesse * dt;
    if (!f.vole) {
      const seg = murBloquant(j, e, nx, ny);
      if (seg) {
        e.bloque = true;
        const avant = seg.pv;
        seg.pv -= f.ronge * dt;
        if (avant > 0 && seg.pv <= 0) {
          j.sons.push("casse");
          j.champSale = true;
          effet(j, "casse", (seg.a.x + seg.b.x) / 2, (seg.a.y + seg.b.y) / 2, 0.4);
        }
        continue;
      }
      const t = tourBloquante(j, e, nx, ny);
      if (t) {
        e.bloque = true;
        t.pv -= f.ronge * dt;
        continue;
      }
    }
    e.x = nx;
    e.y = ny;
    if (Math.hypot(e.x - coeur.x, e.y - coeur.y) < 14 + e.r) {
      // Il arrache des vies au Cœur et repart avec : on peut encore les reprendre en le raturant sur le chemin du retour
      const vol = Math.min(f.vies, j.vies);
      j.vies -= vol;
      j.stats.fuites += vol;
      effet(j, "fuite", coeur.x, coeur.y, 0.8, { texte: "-" + vol });
      j.evts.push({ k: "fuite", x: e.x, y: e.y, vies: vol, type: e.type });
      j.sons.push("aie");
      if (vol > 0 && !f.vole) {
        e.vol = vol;
        // Il remonte à côté du chemin, pour ne pas se perdre dans la horde qui descend
        const t = [...(j.trajets[e.entree] ?? [])].reverse();
        e.retour = t.map((p, i) => {
          const a = t[Math.max(0, i - 1)];
          const b = t[Math.min(t.length - 1, i + 1)];
          const n = Math.hypot(b.x - a.x, b.y - a.y) || 1;
          return { x: p.x - ((b.y - a.y) / n) * 16, y: p.y + ((b.x - a.x) / n) * 16 };
        });
        e.ri = 0;
      } else if (vol > 0) {
        e.vol = vol;
        e.retour = [j.carte.entrees[e.entree].depart];
        e.ri = 0;
      } else e.mort = true;
    }
  }
}

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

function tourBloquante(j: Jeu, e: Ennemi, nx: number, ny: number): Tour | null {
  for (const t of j.tours) {
    const apres = Math.hypot(nx - t.x, ny - t.y);
    if (apres < RAYON_TOUR + e.r && apres < Math.hypot(e.x - t.x, e.y - t.y)) return t;
  }
  return null;
}

function tours(j: Jeu, dt: number): void {
  for (const t of j.tours) {
    const s = stats(t);
    t.cd -= dt;
    t.recul = Math.max(0, t.recul - dt * 4);
    switch (t.type) {
      case "plume":
      case "roquette": {
        const c = choisirCible(j, t, s.portee);
        if (!c) break;
        t.angle = Math.atan2(c.y - t.y, c.x - t.x);
        if (t.cd > 0) break;
        t.cd = s.intervalle;
        t.recul = 1;
        const v = t.type === "plume" ? 520 : 300;
        j.tirs.push({
          x: t.x + Math.cos(t.angle) * 14, y: t.y + Math.sin(t.angle) * 14, vx: Math.cos(t.angle) * v, vy: Math.sin(t.angle) * v,
          degats: s.degats, type: t.type, cible: { x: c.x, y: c.y }, perce: s.perce ?? 1, touches: [], vie: (s.portee + 40) / v, tour: t.id,
        });
        j.sons.push(t.type === "plume" ? "tir" : "boom");
        j.evts.push({ k: "tir", tour: t.type, id: t.id, x: t.x + Math.cos(t.angle) * 16, y: t.y + Math.sin(t.angle) * 16, angle: t.angle });
        break;
      }
      case "foudre": {
        if (t.cd > 0) break;
        let e = choisirCible(j, t, s.portee);
        if (!e) break;
        t.cd = s.intervalle;
        t.angle = Math.atan2(e.y - t.y, e.x - t.x);
        const vus = new Set<number>();
        const pts: V[] = [{ x: t.x, y: t.y }];
        for (let k = 0; k < (s.rebonds ?? 3) && e; k++) {
          vus.add(e.id);
          pts.push({ x: e.x, y: e.y });
          if (s.etourdit && !ENNEMIS[e.type].boss) e.etourdi = Math.max(e.etourdi, s.etourdit);
          blesser(j, e, s.degats, { chiffre: true });
          let suivant: Ennemi | null = null;
          let bd = 90;
          for (const o of j.ennemis) {
            if (o.mort || vus.has(o.id)) continue;
            const d = Math.hypot(o.x - e.x, o.y - e.y);
            if (d < bd) {
              bd = d;
              suivant = o;
            }
          }
          e = suivant;
        }
        effet(j, "eclair", 0, 0, 0.25, { pts });
        j.evts.push({ k: "eclair", pts });
        j.sons.push("zap");
        break;
      }
      case "correction": {
        if (t.cd > 0) break;
        const e = choisirCible(j, t, PORTEE_INFINIE);
        if (!e) break;
        t.cd = s.intervalle;
        t.angle = Math.atan2(e.y - t.y, e.x - t.x);
        t.recul = 1;
        let d = s.degats;
        const crit = !!s.critique && j.rng.next() < s.critique;
        if (crit) d *= 4;
        if (s.marque) e.marque = 4;
        if (s.etourdit && !ENNEMIS[e.type].boss) e.etourdi = Math.max(e.etourdi, s.etourdit);
        e.revele = Math.max(e.revele, 1);
        const pos = { x: e.x, y: e.y };
        if (s.execute && !ENNEMIS[e.type].boss && e.pv - d < e.pvMax * s.execute) d = e.pv + e.bouclier + 1e6;
        blesser(j, e, d, { chiffre: true, rouge: crit });
        effet(j, "coche", pos.x, pos.y, 0.5, { rouge: crit });
        j.evts.push({ k: "tir", tour: t.type, id: t.id, x: t.x, y: t.y, angle: t.angle });
        j.sons.push("coche");
        break;
      }
      case "spirale": {
        // L'aura est appliquée dans bougerEnnemis ; la glu englue tout le monde toutes les 3 s
        if (s.englue && t.cd <= 0) {
          let n = 0;
          for (const e of j.ennemis) {
            if (e.mort || ENNEMIS[e.type].vole || ENNEMIS[e.type].boss) continue;
            if (Math.hypot(e.x - t.x, e.y - t.y) < s.portee + e.r) {
              e.englue = s.englue;
              n++;
            }
          }
          if (n) {
            t.cd = 3;
            effet(j, "boom", t.x, t.y, 0.4, { r: s.portee });
          }
        }
        break;
      }
      case "scie": {
        const n = s.lames ?? 2;
        for (let k = 0; k < n; k++) {
          const p = positionLame(j, t, k, n, s.orbite ?? 36);
          for (const e of j.ennemis) if (!e.mort && Math.hypot(e.x - p.x, e.y - p.y) < e.r + 8) blesser(j, e, (s.dps ?? 0) * dt, { continu: true, ignoreArmure: s.ignoreArmure });
        }
        break;
      }
      case "encrier":
        break;
    }
  }
}

export function positionLame(j: Jeu, t: Tour, k: number, n: number, orbite: number): V {
  const a = j.temps * 3 + (k * Math.PI * 2) / n + t.id;
  return { x: t.x + Math.cos(a) * orbite, y: t.y + Math.sin(a) * orbite };
}

function bougerTirs(j: Jeu, dt: number): void {
  for (const s of j.tirs) {
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.vie -= dt;
    const t = j.tours.find((o) => o.id === s.tour);
    const st = t ? stats(t) : null;
    if (s.type === "roquette") {
      // La roquette explose au point visé, ou sur le premier monstre qu'elle percute
      let explose = Math.hypot(s.x - s.cible.x, s.y - s.cible.y) < 8 || s.vie <= 0;
      for (const e of j.ennemis) if (!e.mort && !ENNEMIS[e.type].vole && Math.hypot(e.x - s.x, e.y - s.y) < e.r + 3) explose = true;
      if (explose) {
        const zone = st?.zone ?? 30;
        for (const e of j.ennemis) if (!e.mort && Math.hypot(e.x - s.x, e.y - s.y) < zone + e.r) blesser(j, e, s.degats, { chiffre: true });
        if (st?.dps) j.zones.push({ x: s.x, y: s.y, r: zone * 0.8, dps: st.dps, age: 0, vie: 2.5 });
        effet(j, "boom", s.x, s.y, 0.45, { r: zone });
        j.evts.push({ k: "boom", x: s.x, y: s.y, r: zone });
        s.vie = 0;
      }
      continue;
    }
    for (const e of j.ennemis) {
      if (e.mort || s.touches.includes(e.id) || Math.hypot(e.x - s.x, e.y - s.y) > e.r + 3) continue;
      blesser(j, e, s.degats, { chiffre: s.degats >= 20 });
      j.evts.push({ k: "impact", x: s.x, y: s.y, angle: Math.atan2(s.vy, s.vx) });
      s.touches.push(e.id);
      if (s.touches.length >= s.perce) {
        s.vie = 0;
        break;
      }
    }
  }
  j.tirs = j.tirs.filter((s) => s.vie > 0 && s.x > -30 && s.y > -30 && s.x < LARGEUR + 30 && s.y < HAUTEUR + 30);
}

// --- Le bulletin ---

export function etoiles(j: Jeu): number {
  if (j.phase !== "gagne") return 0;
  return j.vies >= j.viesMax - 2 ? 3 : j.vies >= j.viesMax / 2 ? 2 : 1;
}
