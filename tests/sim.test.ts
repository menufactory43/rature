import { describe, expect, it } from "vitest";
import { classer, type Pt } from "../src/sim/gestures";
import { appliquerTrace, ajouterEnnemi, choisir, lancer, nouveauJeu, step, TOUR_X, TOUR_Y, type Jeu } from "../src/sim/jeu";
import { planifier, resume, DERNIERE_VAGUE } from "../src/sim/vagues";
import { ENNEMIS } from "../src/sim/ennemis";
import { resample, polylineLength } from "../src/sim/geom";

/** Un trait droit de (x1, y1) à (x2, y2) tracé en `ms` millisecondes. */
function trait(x1: number, y1: number, x2: number, y2: number, ms: number, n = 20): Pt[] {
  return Array.from({ length: n + 1 }, (_, i) => ({ x: x1 + ((x2 - x1) * i) / n, y: y1 + ((y2 - y1) * i) / n, t: (ms * i) / n }));
}
function boucle(cx: number, cy: number, r: number, ms: number): Pt[] {
  return Array.from({ length: 41 }, (_, i) => ({ x: cx + Math.cos((i / 40) * Math.PI * 2) * r, y: cy + Math.sin((i / 40) * Math.PI * 2) * r, t: (ms * i) / 40 }));
}
function enVague(j: Jeu) {
  lancer(j);
  step(j, 1 / 60);
  j.file = [];
  j.ennemis = [];
}
const images = (j: Jeu, s: number) => { for (let i = 0; i < s * 60; i++) step(j, 1 / 60); };

describe("gestes", () => {
  it("lent = mur, sec = rature, boucle = colle, tapotis = rien", () => {
    expect(classer(trait(0, 0, 150, 0, 900))).toBe("mur");
    expect(classer(trait(0, 0, 150, 0, 120))).toBe("rature");
    expect(classer(boucle(100, 100, 50, 900))).toBe("cercle");
    expect(classer(boucle(100, 100, 50, 150))).toBe("cercle");
    expect(classer(trait(0, 0, 5, 0, 300))).toBe("rien");
  });
  it("le rééchantillonnage garde la longueur", () => {
    const pts = trait(0, 0, 100, 0, 100, 3);
    const r = resample(pts, 12);
    expect(polylineLength(r)).toBeCloseTo(100, 0);
  });
});

describe("vagues", () => {
  it("même graine, même page", () => {
    expect(planifier(42, 7)).toEqual(planifier(42, 7));
    expect(planifier(42, 7)).not.toEqual(planifier(43, 7));
  });
  it("chaque monstre attend sa vague, les boss ont la leur", () => {
    for (let n = 1; n <= DERNIERE_VAGUE; n++) {
      const p = planifier(1234, n);
      for (const g of p.groupes) if (!ENNEMIS[g.type].boss) expect(ENNEMIS[g.type].vague).toBeLessThanOrEqual(n);
      expect(resume(p).some((r) => r.type === "mere")).toBe(n === 10);
      expect(resume(p).some((r) => r.type === "compas")).toBe(n === 20);
    }
  });
});

describe("la page", () => {
  it("un mur arrête un gribouille, qui le ronge", () => {
    const j = nouveauJeu("t");
    enVague(j);
    appliquerTrace(j, trait(TOUR_X - 60, TOUR_Y - 80, TOUR_X + 60, TOUR_Y - 80, 1200));
    expect(j.murs.length).toBe(1);
    const e = ajouterEnnemi(j, "gribouille", TOUR_X, TOUR_Y - 140);
    e.pv = 1e9;
    j.tour.cd = 1e9;
    images(j, 3);
    expect(e.bloque).toBe(true);
    expect(e.y).toBeLessThan(TOUR_Y - 80);
    expect(Math.min(...j.murs[0].segs.map((s) => s.pv))).toBeLessThan(j.murs[0].segs[0].pvMax);
  });
  it("un avion passe par-dessus le mur", () => {
    const j = nouveauJeu("t");
    enVague(j);
    appliquerTrace(j, trait(TOUR_X - 60, TOUR_Y - 80, TOUR_X + 60, TOUR_Y - 80, 1200));
    const e = ajouterEnnemi(j, "avion", TOUR_X, TOUR_Y - 140);
    e.pv = 1e9;
    images(j, 1.5);
    expect(e.y).toBeGreaterThan(TOUR_Y - 80);
  });
  it("une rature frappe tous ceux qu'elle touche, et seulement eux", () => {
    const j = nouveauJeu("t");
    enVague(j);
    const a = ajouterEnnemi(j, "carre", 100, 150);
    const b = ajouterEnnemi(j, "carre", 160, 150);
    const c = ajouterEnnemi(j, "carre", 300, 150);
    const r = appliquerTrace(j, trait(80, 150, 200, 150, 100));
    expect(r.geste).toBe("rature");
    expect(r.touches).toBe(2);
    expect(a.pv).toBeLessThan(a.pvMax);
    expect(b.pv).toBeLessThan(b.pvMax);
    expect(c.pv).toBe(c.pvMax);
  });
  it("une rature dans le vide coûte quand même", () => {
    const j = nouveauJeu("t");
    enVague(j);
    const avant = j.encre;
    const r = appliquerTrace(j, trait(50, 50, 150, 50, 100));
    expect(r.touches).toBe(0);
    expect(j.encre).toBeLessThan(avant);
    expect(j.ratees).toBe(1);
  });
  it("la colle ralentit, la gomme l'efface", () => {
    const j = nouveauJeu("t");
    enVague(j);
    j.tour.cd = 1e9;
    appliquerTrace(j, boucle(TOUR_X, 150, 50, 800));
    const e = ajouterEnnemi(j, "gribouille", TOUR_X, 150);
    e.pv = 1e9;
    step(j, 1 / 60);
    expect(e.englue).toBe(true);
    ajouterEnnemi(j, "gomme", TOUR_X, 140).pv = 1e9;
    step(j, 1 / 60);
    step(j, 1 / 60);
    expect(j.colles.length).toBe(0);
  });
  it("le stylo sèche : plus d'encre, pas de mur", () => {
    const j = nouveauJeu("t");
    enVague(j);
    j.encre = 3;
    const r = appliquerTrace(j, trait(50, 50, 350, 50, 2000));
    expect(r.ok).toBe(false);
    expect(j.murs.length).toBe(0);
  });
  it("sans rien faire, la page est perdue tôt ; la graine rejoue pareil", () => {
    const jouer = () => {
      const j = nouveauJeu("passif");
      for (let i = 0; i < 60 * 60 * 20 && j.phase !== "perdu"; i++) {
        step(j, 1 / 60);
        if (j.phase === "choix") choisir(j, j.offres[0]);
      }
      return j;
    };
    const a = jouer();
    expect(a.phase).toBe("perdu");
    expect(a.vague).toBeLessThan(10);
    expect(jouer().tues).toBe(a.tues);
  });
});
