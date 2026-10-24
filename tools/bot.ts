// Le joueur automatique : règle la difficulté sans jouer à la main.
//   npm run bot               (40 pages par niveau de joueur)
//   npm run bot -- 200
// « passif » ne dessine jamais ; « moyen » joue comme un humain correct (un geste toutes les 0,6 s, réflexes simples) ;
// « fort » réagit plus vite et vise mieux. Objectif : le passif perd vers la vague 5, le moyen tient la moitié de la page,
// le fort gagne parfois.
import { ENNEMIS } from "../src/sim/ennemis";
import type { IdAmelioration } from "../src/sim/ameliorations";
import type { Pt } from "../src/sim/gestures";
import { appliquerTrace, choisir, coutParPx, coutRature, lancer, nouveauJeu, step, vaguesTenues, type Ennemi, type Jeu } from "../src/sim/jeu";

type Niveau = "passif" | "moyen" | "fort";
const PREFERENCES: IdAmelioration[] = ["appui", "foudre", "roquette", "cadence", "scie", "plume", "reparation", "affutee", "encrier", "encreEpaisse", "colle", "econome"];

function ligne(x1: number, y1: number, x2: number, y2: number, ms: number): Pt[] {
  return Array.from({ length: 13 }, (_, i) => ({ x: x1 + ((x2 - x1) * i) / 12, y: y1 + ((y2 - y1) * i) / 12, t: (ms * i) / 12 }));
}
function boucle(cx: number, cy: number, r: number): Pt[] {
  return Array.from({ length: 33 }, (_, i) => ({ x: cx + Math.cos((i / 32) * 6.283) * r, y: cy + Math.sin((i / 32) * 6.283) * r, t: i * 25 }));
}
const d = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

function jouerGeste(j: Jeu, niveau: Niveau, rng: () => number): boolean {
  const t = j.tour;
  const vivants = j.ennemis.filter((e) => !e.mort);
  if (!vivants.length) return false;
  const vise = niveau === "fort" ? 4 : 12; // imprécision du doigt
  const bruit = () => (rng() - 0.5) * vise;
  // 1. Les volants et les gommes proches : rature
  const menaces = vivants.filter((e) => (ENNEMIS[e.type].vole || e.type === "gomme") && d(e, t) < 180).sort((a, b) => d(a, t) - d(b, t));
  if (menaces.length && j.encre >= coutRature(j, 90)) {
    const e = menaces[0];
    const a = Math.atan2(e.y - t.y, e.x - t.x) + Math.PI / 2;
    const cx = e.x + bruit();
    const cy = e.y + bruit();
    appliquerTrace(j, ligne(cx - Math.cos(a) * 45, cy - Math.sin(a) * 45, cx + Math.cos(a) * 45, cy + Math.sin(a) * 45, 100));
    return true;
  }
  const sol = vivants.filter((e) => !ENNEMIS[e.type].vole);
  // 2. Un paquet au sol : colle
  let paquet: Ennemi | null = null;
  let taille = 0;
  for (const e of sol) {
    if (d(e, t) > 200 || d(e, t) < 60) continue;
    const n = sol.filter((o) => d(o, e) < 45).length;
    if (n > taille) {
      taille = n;
      paquet = e;
    }
  }
  if (paquet && taille >= 4 && j.encre >= 2 * Math.PI * 45 * coutParPx(j) + 10) {
    appliquerTrace(j, boucle(paquet.x + bruit(), paquet.y + bruit(), 45));
    return true;
  }
  // 3. Le plus proche au sol, pas encore bloqué : un mur devant lui
  const libres = sol.filter((e) => !e.bloque && d(e, t) < 170 && d(e, t) > 70).sort((a, b) => d(a, t) - d(b, t));
  if (libres.length && j.encre >= 110 * coutParPx(j) + 5) {
    const e = libres[0];
    const a = Math.atan2(e.y - t.y, e.x - t.x);
    const r = d(e, t) - 30;
    const cx = t.x + Math.cos(a) * r + bruit();
    const cy = t.y + Math.sin(a) * r + bruit();
    const p = a + Math.PI / 2;
    appliquerTrace(j, ligne(cx - Math.cos(p) * 55, cy - Math.sin(p) * 55, cx + Math.cos(p) * 55, cy + Math.sin(p) * 55, 1100));
    return true;
  }
  // 4. Les gros près de la tour : rature
  const gros = vivants.filter((e) => d(e, t) < 120).sort((a, b) => b.pv - a.pv)[0];
  if (gros && j.encre >= 60) {
    const cx = gros.x + bruit();
    const cy = gros.y + bruit();
    appliquerTrace(j, ligne(cx - 40, cy - 10, cx + 40, cy + 10, 100));
    return true;
  }
  return false;
}

export function partie(graine: string, niveau: Niveau): Jeu {
  const j = nouveauJeu(graine);
  let s = (graine.length * 2654435761) >>> 0;
  const rng = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const delai = niveau === "fort" ? 0.4 : 0.6;
  let attente = 0;
  for (let i = 0; i < 60 * 60 * 40; i++) {
    if (j.phase === "perdu" || j.phase === "gagne") break;
    if (j.phase === "choix") {
      choisir(j, [...j.offres].sort((a, b) => PREFERENCES.indexOf(a) - PREFERENCES.indexOf(b))[0]);
      continue;
    }
    if (j.phase === "prep") lancer(j);
    step(j, 1 / 60);
    attente -= 1 / 60;
    if (niveau !== "passif" && attente <= 0 && j.phase === "vague" && jouerGeste(j, niveau, rng)) attente = delai;
  }
  return j;
}

const n = Number(process.argv[2] ?? 40);
for (const niveau of ["passif", "moyen", "fort"] as Niveau[]) {
  const tenues: number[] = [];
  let gagnees = 0;
  for (let i = 0; i < n; i++) {
    const j = partie("bot-" + i, niveau);
    tenues.push(vaguesTenues(j));
    if (j.phase === "gagne") gagnees++;
  }
  tenues.sort((a, b) => a - b);
  const moy = tenues.reduce((a, b) => a + b, 0) / n;
  console.log(`${niveau.padEnd(7)} vagues tenues : médiane ${tenues[Math.floor(n / 2)]}, moyenne ${moy.toFixed(1)}, min ${tenues[0]}, max ${tenues[n - 1]} · gagnées ${gagnees}/${n}`);
}
