import { describe, expect, it } from "vitest";
import { lireCarte } from "../src/sim/carte";
import { ajouterEnnemi, lancerVague, nouveauJeu, ordonnerHeros, step, XP_NIVEAUX, type Jeu } from "../src/sim/jeu";
import { TYPES_TOURS } from "../src/sim/tours";

const VIDE = `
.........EE.........
${"....................\n".repeat(31)}.........CC.........
.........CC.........
....................
....................`;

function jeu(): Jeu {
  const j = nouveauJeu({ carte: lireCarte("vide", VIDE), regles: { graine: 1, total: 5, pool: ["gribouille"], difficulte: 1, entrees: 1 }, encreDepart: 0, toursDispo: [...TYPES_TOURS], heros: true });
  lancerVague(j);
  j.file = [];
  j.prochaine = 1e9;
  return j;
}
const images = (j: Jeu, s: number) => { for (let i = 0; i < s * 60; i++) step(j, 1 / 60); };

describe("Bille sur la page", () => {
  it("part près du Cœur et marche où on l'envoie", () => {
    const j = jeu();
    const h = j.heros!;
    expect(Math.abs(h.x - j.carte.coeur.x)).toBeLessThan(1);
    ordonnerHeros(j, 100, 300);
    images(j, 8);
    expect(Math.hypot(h.x - 100, h.y - 300)).toBeLessThan(2);
  });
  it("arrête les monstres, les tape, et prend un niveau", () => {
    const j = jeu();
    const h = j.heros!;
    ordonnerHeros(j, 200, 200);
    images(j, 8);
    const e = ajouterEnnemi(j, "gribouille", 200, 150);
    images(j, 1.5);
    expect(e.bloque || e.mort).toBe(true);
    images(j, 4);
    expect(e.mort).toBe(true);
    h.xp = XP_NIVEAUX[1] - 1;
    ajouterEnnemi(j, "gribouille", 200, 180);
    images(j, 4);
    expect(h.niveau).toBe(2);
  });
  it("tombe sous les coups, puis revient au Cœur", () => {
    const j = jeu();
    const h = j.heros!;
    h.pv = 0;
    images(j, 0.1);
    expect(h.mort).toBeGreaterThan(0);
    ordonnerHeros(j, 50, 50);
    expect(h.cible).toBe(null);
    images(j, 11);
    expect(h.mort).toBe(0);
    expect(h.pv).toBe(h.pvMax);
  });
});
