// Une carte : une page de cahier, avec ses entrées, son Cœur et ses obstacles.
// Les cartes faites à la main s'écrivent en texte, 20 colonnes × 36 lignes, une case = 20 px :
//   .  libre        #  tache d'encre séchée (infranchissable)     o  trou dans la feuille (infranchissable)
//   E  entrée (au bord de la page)   C  le Cœur (2×2)   ~  café renversé (ralentit)
import type { V } from "./geom";
import { Rng } from "./rng";
import { hypot } from "./maths";

export const LARGEUR = 400;
export const HAUTEUR = 720;
/** Le chemin se calcule sur une grille fine de 10 px. */
export const CASE = 10;
export const COLS = LARGEUR / CASE;
export const LIGNES = HAUTEUR / CASE;
/** Une case du texte de carte vaut 2 × 2 cases fines. */
const GROS = 20;

export type Papier = "seyes" | "carreaux" | "portee" | "dictee";

/** Les objets posés sur la page, qui bloquent comme une tache : G gomme, T trombone, R règle, K capuchon, B bonbon, S taille-crayon. */
export type TypeObjet = "gomme" | "trombone" | "regle" | "capuchon" | "bonbon" | "taille";
const LETTRES_OBJETS: Record<string, TypeObjet> = { G: "gomme", T: "trombone", R: "regle", K: "capuchon", B: "bonbon", S: "taille" };

export interface Objet {
  type: TypeObjet;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Bloc {
  x: number;
  y: number;
  type: "tache" | "trou" | "cafe";
}

export interface Entree {
  /** Où les monstres apparaissent (juste hors de la page). */
  depart: V;
  /** Le premier point sur la page. */
  bord: V;
}

export interface Carte {
  nom: string;
  papier: Papier;
  entrees: Entree[];
  coeur: V;
  /** 1 = infranchissable (grille fine). */
  bloque: Uint8Array;
  /** 1 = café (grille fine). */
  cafe: Uint8Array;
  /** 1 = cadre « ne rien écrire » : la horde y passe, aucune tour ne s'y pose (grille fine). */
  interdit: Uint8Array;
  /** Les cadres, en pixels, pour les dessiner. */
  cadres: { x: number; y: number; w: number; h: number }[];
  objets: Objet[];
  blocs: Bloc[];
}

export const indice = (c: number, l: number) => l * COLS + c;
export const caseDe = (x: number, y: number) => indice(Math.max(0, Math.min(COLS - 1, Math.floor(x / CASE))), Math.max(0, Math.min(LIGNES - 1, Math.floor(y / CASE))));

export function lireCarte(nom: string, texte: string, papier: Papier = "seyes"): Carte {
  const lignes = texte.trim().split("\n").map((l) => l.trim());
  if (lignes.length !== HAUTEUR / GROS) throw new Error(`${nom} : ${lignes.length} lignes au lieu de ${HAUTEUR / GROS}`);
  const bloque = new Uint8Array(COLS * LIGNES);
  const cafe = new Uint8Array(COLS * LIGNES);
  const interdit = new Uint8Array(COLS * LIGNES);
  const casesCadre = new Set<number>();
  const casesObjets: Record<string, Set<number>> = {};
  const blocs: Bloc[] = [];
  const entreesCases: { c: number; l: number }[] = [];
  const coeurs: V[] = [];
  lignes.forEach((ligne, l) => {
    if (ligne.length !== LARGEUR / GROS) throw new Error(`${nom} : ligne ${l + 1} de ${ligne.length} cases au lieu de ${LARGEUR / GROS}`);
    [...ligne].forEach((ch, c) => {
      const marquer = (grille: Uint8Array) => {
        for (const [dc, dl] of [[0, 0], [1, 0], [0, 1], [1, 1]]) grille[indice(c * 2 + dc, l * 2 + dl)] = 1;
      };
      if (ch === "#") { marquer(bloque); blocs.push({ x: c * GROS, y: l * GROS, type: "tache" }); }
      else if (ch === "o") { marquer(bloque); blocs.push({ x: c * GROS, y: l * GROS, type: "trou" }); }
      else if (ch === "~") { marquer(cafe); blocs.push({ x: c * GROS, y: l * GROS, type: "cafe" }); }
      else if (ch === "x") { marquer(interdit); casesCadre.add(l * 100 + c); }
      else if (LETTRES_OBJETS[ch]) { marquer(bloque); (casesObjets[ch] ??= new Set()).add(l * 100 + c); }
      else if (ch === "E") entreesCases.push({ c, l });
      else if (ch === "C") coeurs.push({ x: c * GROS + GROS / 2, y: l * GROS + GROS / 2 });
    });
  });
  if (!coeurs.length) throw new Error(`${nom} : pas de Cœur`);
  const coeur = { x: coeurs.reduce((s, p) => s + p.x, 0) / coeurs.length, y: coeurs.reduce((s, p) => s + p.y, 0) / coeurs.length };
  return { nom, papier, entrees: grouperEntrees(entreesCases), coeur, bloque, cafe, interdit, cadres: cadres(casesCadre), blocs,
    objets: Object.entries(casesObjets).flatMap(([ch, cases]) => cadres(cases).map((r) => ({ type: LETTRES_OBJETS[ch], ...r }))) };
}

/** Les cases « x » voisines forment un cadre ; on garde son rectangle englobant. */
function cadres(cases: Set<number>): { x: number; y: number; w: number; h: number }[] {
  const vues = new Set<number>();
  const res: { x: number; y: number; w: number; h: number }[] = [];
  for (const k of cases) {
    if (vues.has(k)) continue;
    let c0 = 99, c1 = -1, l0 = 99, l1 = -1;
    const pile = [k];
    vues.add(k);
    while (pile.length) {
      const q = pile.pop()!;
      const c = q % 100;
      const l = Math.floor(q / 100);
      c0 = Math.min(c0, c); c1 = Math.max(c1, c); l0 = Math.min(l0, l); l1 = Math.max(l1, l);
      for (const v of [q + 1, q - 1, q + 100, q - 100]) if (cases.has(v) && !vues.has(v)) { vues.add(v); pile.push(v); }
    }
    res.push({ x: c0 * GROS, y: l0 * GROS, w: (c1 - c0 + 1) * GROS, h: (l1 - l0 + 1) * GROS });
  }
  return res;
}

/** Les cases « E » voisines forment une seule entrée ; les monstres apparaissent juste derrière le bord le plus proche. */
function grouperEntrees(cases: { c: number; l: number }[]): Entree[] {
  const vues = new Set<number>();
  const entrees: Entree[] = [];
  const cle = (c: number, l: number) => l * 100 + c;
  const ensemble = new Set(cases.map((p) => cle(p.c, p.l)));
  for (const p of cases) {
    if (vues.has(cle(p.c, p.l))) continue;
    const groupe: { c: number; l: number }[] = [];
    const pile = [p];
    vues.add(cle(p.c, p.l));
    while (pile.length) {
      const q = pile.pop()!;
      groupe.push(q);
      for (const [dc, dl] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const k = cle(q.c + dc, q.l + dl);
        if (ensemble.has(k) && !vues.has(k)) {
          vues.add(k);
          pile.push({ c: q.c + dc, l: q.l + dl });
        }
      }
    }
    const x = groupe.reduce((s, q) => s + q.c * GROS + GROS / 2, 0) / groupe.length;
    const y = groupe.reduce((s, q) => s + q.l * GROS + GROS / 2, 0) / groupe.length;
    // Le bord le plus proche
    const d = [x, LARGEUR - x, y, HAUTEUR - y];
    const m = d.indexOf(Math.min(...d));
    const depart = m === 0 ? { x: -16, y } : m === 1 ? { x: LARGEUR + 16, y } : m === 2 ? { x, y: -16 } : { x, y: HAUTEUR + 16 };
    entrees.push({ depart, bord: { x: Math.max(5, Math.min(LARGEUR - 5, x)), y: Math.max(5, Math.min(HAUTEUR - 5, y)) } });
  }
  return entrees;
}

/** Une carte générée (page du jour) : 1 à 3 entrées, un Cœur, des taches et des trous, toujours franchissable. */
export function genererCarte(graine: number, nom = "Page du jour"): Carte {
  const rng = new Rng(graine ^ 0x2545f491);
  for (let essai = 0; essai < 50; essai++) {
    const g: string[][] = Array.from({ length: 36 }, () => Array(20).fill("."));
    // Le Cœur, dans le tiers du bas ou du haut, loin des bords latéraux
    const enBas = rng.next() < 0.5;
    const cc = rng.int(5, 13);
    const cl = enBas ? rng.int(26, 31) : rng.int(3, 8);
    for (const [dc, dl] of [[0, 0], [1, 0], [0, 1], [1, 1]]) g[cl + dl][cc + dc] = "C";
    // Les entrées, sur les bords opposés au Cœur
    const nb = rng.int(1, 3);
    const bords = rng.shuffle(enBas ? ["haut", "gauche", "droite"] : ["bas", "gauche", "droite"]).slice(0, nb);
    for (const b of bords) {
      if (b === "haut") { const c = rng.int(4, 15); g[0][c] = g[0][c + 1] = "E"; }
      if (b === "bas") { const c = rng.int(4, 15); g[35][c] = g[35][c + 1] = "E"; }
      const l = enBas ? rng.int(2, 10) : rng.int(24, 33);
      if (b === "gauche") g[l][0] = g[l + 1][0] = "E";
      if (b === "droite") g[l][19] = g[l + 1][19] = "E";
    }
    // Des taches et des trous, en grappes
    for (let k = rng.int(5, 9); k > 0; k--) {
      const type = rng.next() < 0.8 ? "#" : rng.next() < 0.5 ? "o" : "~";
      let c = rng.int(2, 17);
      let l = rng.int(3, 32);
      for (let n = rng.int(2, 6); n > 0; n--) {
        if (g[l]?.[c] === ".") g[l][c] = type;
        c += rng.int(-1, 1);
        l += rng.int(-1, 1);
      }
    }
    const texte = g.map((l) => l.join("")).join("\n");
    const carte = lireCarte(nom, texte, rng.pick(["seyes", "carreaux", "portee"] as const));
    if (carte.entrees.length && toutesReliees(carte) && carte.entrees.every((e) => hypot(e.depart.x - carte.coeur.x, e.depart.y - carte.coeur.y) > 380)) return carte;
  }
  throw new Error("carte impossible à générer");
}

/** Chaque entrée rejoint-elle le Cœur sans traverser d'obstacle ? */
export function toutesReliees(carte: Carte): boolean {
  const vu = new Uint8Array(COLS * LIGNES);
  const pile = [caseDe(carte.coeur.x, carte.coeur.y)];
  vu[pile[0]] = 1;
  while (pile.length) {
    const i = pile.pop()!;
    const c = i % COLS;
    const l = (i - c) / COLS;
    for (const [dc, dl] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc;
      const nl = l + dl;
      if (nc < 0 || nl < 0 || nc >= COLS || nl >= LIGNES) continue;
      const j = indice(nc, nl);
      if (vu[j] || carte.bloque[j]) continue;
      vu[j] = 1;
      pile.push(j);
    }
  }
  return carte.entrees.every((e) => vu[caseDe(e.bord.x, e.bord.y)]);
}
