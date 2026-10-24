// Le joueur automatique : règle la difficulté des pages sans y jouer à la main.
//   npm run bot                 toutes les pages, 5 parties par niveau
//   npm run bot -- 1-3 10       une page, 10 parties
// « passif » ne fait rien ; « moyen » pose et améliore des tours, à des places correctes ; « fort » choisit mieux,
// rature les volants et les furtifs qui approchent du Cœur, et dépense son encre sans traîner.
// Objectif par page : le passif perd, le moyen gagne souvent sans 3 étoiles, le fort fait 3 étoiles la plupart du temps.
import { ENNEMIS } from "../src/sim/ennemis";
import type { V } from "../src/sim/geom";
import type { Pt } from "../src/sim/gestures";
import {
  ameliorer, appliquerTrace, coutAmelioration, coutPose, coutRature, etoiles, lancerVague, nouveauJeu, poserTour, refusPose, step, type Jeu, type Options,
} from "../src/sim/jeu";
import { PAGES, optionsDePage, optionsPageDuJour, type Page } from "../src/sim/pages";
import { Rng } from "../src/sim/rng";
import { PORTEE_INFINIE, TOURS, TYPES_TOURS, statsTour, type TypeTour } from "../src/sim/tours";

export type Niveau = "passif" | "moyen" | "fort";

function place(j: Jeu, type: TypeTour, rng: Rng, bruit: number): V | null {
  const portee = statsTour(type, 1, 0).portee || 60;
  const pts = j.trajets.flat();
  let best: V | null = null;
  let bs = -1;
  for (let y = 20; y < 710; y += 20) {
    for (let x = 20; x < 390; x += 20) {
      if (refusPose(j, x, y)) continue;
      let s = 0;
      let surChemin = false;
      for (const q of pts) {
        const d = Math.hypot(q.x - x, q.y - y);
        if (d < 18) surChemin = true;
        if (d < portee) s += 1 + (portee >= PORTEE_INFINIE ? 0 : 0.002 * Math.hypot(q.x - j.carte.coeur.x, q.y - j.carte.coeur.y) * 0);
      }
      if (surChemin) continue;
      if (type === "encrier") s = 1000 - Math.hypot(x - j.carte.coeur.x, y - j.carte.coeur.y) * 0 - s;
      if (type === "correction") s = 1000 - Math.hypot(x - j.carte.coeur.x, y - j.carte.coeur.y);
      s *= 1 + (rng.next() - 0.5) * bruit;
      if (s > bs) {
        bs = s;
        best = { x, y };
      }
    }
  }
  return best;
}

function ligne(c: V, angle: number, demi: number, ms: number): Pt[] {
  return Array.from({ length: 11 }, (_, i) => {
    const k = i / 10 - 0.5;
    return { x: c.x + Math.cos(angle) * demi * 2 * k, y: c.y + Math.sin(angle) * demi * 2 * k, t: ms * (i / 10) };
  });
}

/** Une action par appel ; renvoie vrai si quelque chose a été fait. */
function agir(j: Jeu, niveau: Niveau, rng: Rng): boolean {
  const fort = niveau === "fort";
  // Les menaces qui approchent du Cœur : une rature (fort seulement)
  if (fort && j.phase === "jeu") {
    const c = j.carte.coeur;
    const menace = j.ennemis.find((e) => !e.mort && (ENNEMIS[e.type].vole || ENNEMIS[e.type].furtif || ENNEMIS[e.type].soigne) && Math.hypot(e.x - c.x, e.y - c.y) < 160 && e.x > 0 && e.y > 0);
    if (menace && j.encre > coutRature(80) + 20) {
      appliquerTrace(j, ligne({ x: menace.x + (rng.next() - 0.5) * 6, y: menace.y + (rng.next() - 0.5) * 6 }, rng.next() * Math.PI, 40, 100));
      return true;
    }
  }
  const dispo = j.options.toursDispo;
  const nbTours = j.tours.length;
  // Améliorer quand on a déjà assez de tours
  const cible = 3 + Math.floor(j.vague / (fort ? 2 : 3));
  if (nbTours >= cible || nbTours >= 10) {
    const candidates = j.tours.filter((t) => t.type !== "encrier" || fort).sort((a, b) => a.niveau - b.niveau);
    for (const t of candidates) {
      if (t.niveau < 3) {
        const c = coutAmelioration(j, t)!;
        if (j.encre >= c) return ameliorer(j, t);
        return false;
      }
      if (!t.spec && j.vague >= 4) {
        const spec = fort ? (t.type === "plume" ? 1 : t.type === "spirale" ? 1 : rng.next() < 0.5 ? 1 : 2) : 1 + Math.floor(rng.next() * 2);
        const c = coutAmelioration(j, t, spec)!;
        if (j.encre >= c) return ameliorer(j, t, spec);
        return false;
      }
    }
  }
  // Poser une tour : un ordre de préférence selon ce qui manque
  const compte = (ty: TypeTour) => j.tours.filter((t) => t.type === ty).length;
  const ordre: TypeTour[] = fort
    ? ["plume", "roquette", "plume", "foudre", "correction", "spirale", "roquette", "scie", "foudre", "correction", "encrier"]
    : ["plume", "roquette", "plume", "foudre", "roquette", "correction", "spirale", "scie"];
  const voulu = ordre.find((ty, i) => dispo.includes(ty) && compte(ty) < ordre.slice(0, i + 1).filter((o) => o === ty).length) ?? dispo[Math.floor(rng.next() * dispo.length)];
  if (j.encre < coutPose(j, voulu)) return false;
  const p = place(j, voulu, rng, niveau === "moyen" ? 0.4 : 0.1);
  if (!p) return false;
  return poserTour(j, voulu, p.x, p.y).ok;
}

export function partie(options: Options, niveau: Niveau, graine: number): Jeu {
  const j = nouveauJeu(options);
  const rng = new Rng(graine);
  if (niveau !== "passif") for (let k = 0; k < 8 && agir(j, niveau, rng); k++);
  lancerVague(j);
  const delai = niveau === "fort" ? 0.4 : 0.8;
  let attente = 0;
  for (let i = 0; i < 60 * 60 * 30 && j.phase === "jeu"; i++) {
    step(j, 1 / 60);
    attente -= 1 / 60;
    if (niveau !== "passif" && attente <= 0) {
      agir(j, niveau, rng);
      attente = delai;
    }
  }
  return j;
}

function bilan(nom: string, options: () => Options, n: number): void {
  const lignes: string[] = [];
  for (const niveau of ["passif", "moyen", "fort"] as Niveau[]) {
    let gagnees = 0;
    let vies = 0;
    let etoilesTot = 0;
    const vagues: number[] = [];
    for (let k = 0; k < (niveau === "passif" ? 1 : n); k++) {
      const j = partie(options(), niveau, 1000 + k);
      if (j.phase === "gagne") gagnees++;
      vies += j.vies;
      etoilesTot += etoiles(j);
      vagues.push(j.phase === "gagne" ? j.regles.total : j.vague);
    }
    const m = niveau === "passif" ? 1 : n;
    lignes.push(`${niveau}: ${gagnees}/${m} gagnées, ${(vies / m).toFixed(1)} vies, ${(etoilesTot / m).toFixed(1)} ★, vagues ${Math.min(...vagues)}–${Math.max(...vagues)}`);
  }
  console.log(`${nom.padEnd(18)} ${lignes.join("  |  ")}`);
}

if (import.meta.url.endsWith("bot.ts") && process.argv[1]?.includes("bot")) main();
function main(): void {
const args = process.argv.slice(2);
const n = Number(args.find((a) => /^\d+$/.test(a)) ?? 5);
const filtre = args.find((a) => /^\d-\d$|^jour$/.test(a));
// Le joueur a tout ce qu'il aurait débloqué en arrivant à cette page
const debloqueesAvant = (p: Page): TypeTour[] => {
  const t: TypeTour[] = ["plume"];
  for (const q of PAGES) {
    if (q === p) break;
    if (q.debloque && q.debloque !== "colle") t.push(q.debloque);
  }
  return t;
};
for (const p of PAGES) {
  if (filtre && filtre !== p.id) continue;
  const colle = PAGES.slice(0, PAGES.indexOf(p)).some((q) => q.debloque === "colle");
  bilan(`${p.id} ${p.nom}`, () => optionsDePage(p, { toursDispo: debloqueesAvant(p), colle }), n);
}
if (!filtre || filtre === "jour") bilan("page du jour", () => optionsPageDuJour("2026-10-24", [...TYPES_TOURS]), n);
void TOURS;
}
