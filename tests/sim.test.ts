import { describe, expect, it } from "vitest";
import { classer, type Pt } from "../src/sim/gestures";
import { FORMES, type Glyphe } from "../src/sim/glyphes";
import { genererCarte, lireCarte, toutesReliees } from "../src/sim/carte";
import { ajouterEnnemi, ameliorer, blesser, effacerMur, encreDuMur, murSous, choisirFourniture, lancerPouvoir, stats, appliquerTrace, lancerVague, nouveauJeu, poserTour, step, vendre, type Jeu, type Options } from "../src/sim/jeu";
import { ENNEMIS } from "../src/sim/ennemis";
import { planifier, resume } from "../src/sim/vagues";
import { PAGES, optionsDePage, optionsInterro, optionsPageDuJour } from "../src/sim/pages";
import { TYPES_TOURS } from "../src/sim/tours";

/** Un trait droit tracé en `ms` millisecondes. */
function trait(x1: number, y1: number, x2: number, y2: number, ms: number, n = 20): Pt[] {
  return Array.from({ length: n + 1 }, (_, i) => ({ x: x1 + ((x2 - x1) * i) / n, y: y1 + ((y2 - y1) * i) / n, t: (ms * i) / n }));
}
function boucle(cx: number, cy: number, r: number, ms: number): Pt[] {
  return Array.from({ length: 41 }, (_, i) => ({ x: cx + Math.cos((i / 40) * Math.PI * 2) * r, y: cy + Math.sin((i / 40) * Math.PI * 2) * r, t: (ms * i) / 40 }));
}
/** Un symbole dessiné à la main (un peu de tremblé), centré en (cx, cy). */
function symbole(g: Glyphe, cx: number, cy: number, taille = 28): Pt[] {
  const f = FORMES[g][0];
  return f.map((p, i) => ({ x: cx + p.x * taille + Math.sin(i * 1.7) * 1.2, y: cy + p.y * taille + Math.cos(i * 2.3) * 1.2, t: i * 15 }));
}

const VIDE = `
.........EE.........
${"....................\n".repeat(31)}.........CC.........
.........CC.........
....................
....................`;

function jeuVide(): Jeu {
  const carte = lireCarte("vide", VIDE);
  const o: Options = { carte, regles: { graine: 1, total: 5, pool: ["gribouille"], difficulte: 1, entrees: 1 }, encreDepart: 1000, toursDispo: [...TYPES_TOURS] };
  const j = nouveauJeu(o);
  lancerVague(j);
  j.file = [];
  return j;
}
const images = (j: Jeu, s: number) => { for (let i = 0; i < s * 60; i++) step(j, 1 / 60); };

describe("gestes et symboles", () => {
  it("grand trait lent = mur, sec = rature, grande boucle = colle", () => {
    expect(classer(trait(0, 0, 150, 0, 900)).geste).toBe("mur");
    expect(classer(trait(0, 0, 150, 0, 120)).geste).toBe("rature");
    expect(classer(boucle(100, 100, 60, 900)).geste).toBe("cercle");
    expect(classer(trait(0, 0, 5, 0, 300)).geste).toBe("rien");
  });
  it("chaque petit symbole devient sa tour", () => {
    for (const g of Object.keys(FORMES) as Glyphe[]) {
      const c = classer(symbole(g, 200, 300));
      expect(c, g).toEqual({ geste: "tour", glyphe: g });
    }
  });
  it("un petit trait droit n'est pas un symbole", () => {
    expect(classer(trait(0, 0, 60, 10, 400)).geste).not.toBe("tour");
  });
});

describe("cartes", () => {
  it("toutes les pages se lisent et chaque entrée rejoint le Cœur", () => {
    for (const p of PAGES) {
      const o = optionsDePage(p, { toursDispo: ["plume"], colle: true });
      expect(o.carte.entrees.length, p.id).toBeGreaterThan(0);
      expect(toutesReliees(o.carte), p.id).toBe(true);
    }
  });
  it("les cartes générées sont jouables et reproductibles", () => {
    for (let g = 0; g < 200; g++) {
      const c = genererCarte(g);
      expect(toutesReliees(c)).toBe(true);
      expect(c.entrees.length).toBeGreaterThan(0);
    }
    expect(genererCarte(7).blocs).toEqual(genererCarte(7).blocs);
  });
});

describe("vagues", () => {
  it("même graine, même vague ; le boss à la fin", () => {
    const r = { graine: 42, total: 10, pool: ["gribouille", "carre", "avion"] as const, difficulte: 1, entrees: 2, boss: "mere" as const };
    const regles = { ...r, pool: [...r.pool] };
    expect(planifier(regles, 4)).toEqual(planifier(regles, 4));
    expect(resume(planifier(regles, 10)).some((x) => x.type === "mere")).toBe(true);
    expect(resume(planifier(regles, 9)).some((x) => x.type === "mere")).toBe(false);
    expect(resume(planifier(regles, 1)).every((x) => x.type === "gribouille")).toBe(true);
  });
});

describe("tours", () => {
  it("dessiner un triangle pose des roquettes ; on améliore, on vend", () => {
    const j = jeuVide();
    const r = appliquerTrace(j, symbole("triangle", 120, 300));
    expect(r.ok).toBe(true);
    expect(j.tours[0].type).toBe("roquette");
    const t = j.tours[0];
    expect(ameliorer(j, t)).toBe(true);
    expect(ameliorer(j, t)).toBe(true);
    expect(t.niveau).toBe(3);
    expect(ameliorer(j, t)).toBe(false);
    expect(ameliorer(j, t, 2)).toBe(true);
    expect(t.spec).toBe(2);
    const encre = j.encre;
    vendre(j, t);
    expect(j.tours.length).toBe(0);
    expect(j.encre).toBeGreaterThan(encre);
  });
  it("on ne pose pas sur un obstacle, ni collé à une autre tour, ni sans encre", () => {
    const j = jeuVide();
    expect(poserTour(j, "plume", 200, 200).ok).toBe(true);
    expect(poserTour(j, "plume", 210, 205).ok).toBe(false);
    j.encre = 10;
    expect(poserTour(j, "plume", 100, 400).ok).toBe(false);
  });
  it("une plume tue un gribouille qui passe", () => {
    const j = jeuVide();
    poserTour(j, "plume", 230, 300);
    const e = ajouterEnnemi(j, "gribouille", 200, 150);
    images(j, 8);
    expect(e.mort).toBe(true);
    expect(j.vies).toBe(j.viesMax);
  });
  it("l'armure du carré ronge les petits coups, pas la Correction", () => {
    const j = jeuVide();
    const a = ajouterEnnemi(j, "carre", 100, 100);
    a.pv = a.pvMax = 1000;
    poserTour(j, "plume", 100, 160);
    images(j, 0.6);
    const parPlume = 1000 - a.pv;
    expect(parPlume).toBeLessThan(6);
  });
  it("le fantôme est invisible pour une plume lointaine, pas pour la Correction", () => {
    const j = jeuVide();
    const e = ajouterEnnemi(j, "fantome", 100, 300);
    e.pv = e.pvMax = 1e6;
    poserTour(j, "plume", 180, 300);
    images(j, 0.5);
    expect(e.pv).toBe(1e6);
    poserTour(j, "correction", 300, 600);
    images(j, 0.5);
    expect(e.pv).toBeLessThan(1e6);
  });
});

describe("le chemin", () => {
  it("un mur sur le chemin le fait contourner ou ronger, une rature frappe, la colle ralentit", () => {
    const j = jeuVide();
    const entree = j.carte.entrees[0].bord;
    const avant = j.champ.distance(entree);
    appliquerTrace(j, trait(60, 300, 340, 300, 1500));
    images(j, 0.3);
    expect(j.champ.distance(entree)).toBeGreaterThan(avant);
    // Une rangée de tours presque d'un bord à l'autre : ils passent par le trou
    for (let x = 16; x <= 320; x += 30) poserTour(j, "spirale", x, 450);
    images(j, 0.3);
    expect(j.trajets[0].some((p) => p.y > 440 && p.y < 460 && p.x > 330)).toBe(true);
    const e = ajouterEnnemi(j, "carre", 200, 200);
    const r = appliquerTrace(j, trait(160, 200, 240, 200, 100));
    expect(r.touches).toBe(1);
    expect(e.pv).toBeLessThan(e.pvMax);
    appliquerTrace(j, boucle(100, 500, 60, 900));
    const g = ajouterEnnemi(j, "gribouille", 100, 500);
    step(j, 1 / 60);
    expect(g.ralenti).toBeGreaterThan(0);
  });
  it("effacer un mur rend l'encre qui lui reste", () => {
    const j = jeuVide();
    const avant = j.encre;
    appliquerTrace(j, trait(60, 300, 340, 300, 1500));
    const m = j.murs[0];
    const prix = avant - j.encre;
    expect(murSous(j, { x: 200, y: 306 })).toBe(m);
    expect(murSous(j, { x: 200, y: 340 })).toBeNull();
    // Tout neuf : tout revient (à l'arrondi près)
    expect(encreDuMur(m)).toBeGreaterThanOrEqual(Math.floor(prix) - 1);
    // À moitié sec et à moitié rongé : un quart
    m.age = m.vie / 2;
    for (const s of m.segs) s.pv = s.pvMax / 2;
    expect(encreDuMur(m)).toBe(Math.floor(m.cout / 4));
    const e0 = j.encre;
    effacerMur(j, m);
    expect(j.encre).toBe(e0 + Math.floor(m.cout / 4));
    expect(j.murs.length).toBe(0);
  });
  it("enfermés, ils rongent les tours", () => {
    const j = jeuVide();
    // Une ligne de tours en travers de la page
    for (let x = 16; x <= 384; x += 30) poserTour(j, "spirale", x, 300);
    images(j, 0.3);
    const e = ajouterEnnemi(j, "gribouille", 200, 200);
    e.pv = e.pvMax = 1e6;
    images(j, 15);
    expect(j.tours.some((t) => t.pv < t.pvMax)).toBe(true);
  });
});

describe("la seconde chance", () => {
  it("le voleur emporte des vies ; raturé sur le retour, il les rend", () => {
    const j = jeuVide();
    const { x, y } = j.carte.coeur;
    const e = ajouterEnnemi(j, "gribouille", x, y - 30);
    const avant = j.vies;
    for (let i = 0; i < 600 && !e.vol; i++) step(j, 1 / 60);
    expect(e.vol).toBeGreaterThan(0);
    expect(j.vies).toBe(avant - e.vol);
    images(j, 0.5);
    blesser(j, e, 1e6);
    images(j, 10);
    expect(j.vies).toBe(avant);
  });
  it("s'il ressort de la page, les vies sont perdues", () => {
    const j = jeuVide();
    const { x, y } = j.carte.coeur;
    const e = ajouterEnnemi(j, "gribouille", x, y - 30);
    const avant = j.vies;
    images(j, 60);
    expect(e.mort).toBe(true);
    expect(j.vies).toBeLessThan(avant);
  });
});

describe("les pouvoirs", () => {
  const avec = () => {
    const j = jeuVide();
    j.options.pouvoirs = ["regle", "lasso", "gomme"];
    return j;
  };
  it("la règle frappe et assomme ce qui est dessous, puis recharge", () => {
    const j = avec();
    const e = ajouterEnnemi(j, "gribouille", 200, 300);
    const loin = ajouterEnnemi(j, "gribouille", 200, 500);
    const r = lancerPouvoir(j, "regle", trait(100, 300, 300, 300, 200));
    expect(r.ok).toBe(true);
    expect(e.mort || e.pv < e.pvMax).toBe(true);
    expect(loin.pv).toBe(loin.pvMax);
    expect(lancerPouvoir(j, "regle", trait(100, 300, 300, 300, 200)).ok).toBe(false);
    images(j, 36);
    expect(j.recharges.regle).toBe(0);
  });
  it("le lasso immobilise ceux qu'il entoure", () => {
    const j = avec();
    const e = ajouterEnnemi(j, "carre", 200, 300);
    expect(lancerPouvoir(j, "lasso", boucle(200, 300, 50, 400)).ok).toBe(true);
    const y = e.y;
    images(j, 2);
    expect(e.y).toBeCloseTo(y, 0);
    // Une boucle ouverte ne prend personne
    const k = avec();
    expect(lancerPouvoir(k, "lasso", trait(100, 300, 300, 300, 400)).ok).toBe(false);
  });
  it("la gomme efface ce qu'on frotte, bouclier compris", () => {
    const j = avec();
    const e = ajouterEnnemi(j, "gribouille", 200, 300);
    const frotte = [...trait(170, 300, 230, 300, 100), ...trait(230, 305, 170, 305, 100).map((q) => ({ ...q, t: q.t + 100 }))];
    expect(lancerPouvoir(j, "gomme", frotte).ok).toBe(true);
    expect(e.mort).toBe(true);
  });
  it("sans l'avoir gagné, rien", () => {
    const j = jeuVide();
    expect(lancerPouvoir(j, "regle", trait(100, 300, 300, 300, 200)).ok).toBe(false);
  });
});

describe("l'interro surprise", () => {
  it("propose trois fournitures toutes les deux vagues, toujours les mêmes pour la même graine", () => {
    const jouer = () => {
      const j = nouveauJeu(optionsInterro(42));
      j.encre = 1e5;
      for (const q of j.trajets[0].filter((_, i) => i % 5 === 2)) poserTour(j, "plume", q.x + 26, q.y);
      lancerVague(j);
      for (let i = 0; i < 60 * 60 * 5 && !j.choix && j.phase === "jeu"; i++) step(j, 1 / 60);
      return j;
    };
    const j = jouer();
    expect(j.vague).toBe(2);
    expect(j.choix).toHaveLength(3);
    expect(jouer().choix!.map((f) => f.id)).toEqual(j.choix!.map((f) => f.id));
    // Tant qu'on n'a pas choisi, pas de vague suivante
    lancerVague(j);
    expect(j.vague).toBe(2);
    const f = j.choix![0];
    expect(choisirFourniture(j, 0)).toBe(true);
    expect(j.prises).toContain(f.id);
    expect(j.choix).toBeNull();
  });
  it("une tour affûtée frappe plus fort", () => {
    const j = nouveauJeu(optionsInterro(1));
    j.encre = 1000;
    const q = j.trajets[0][8];
    expect(poserTour(j, "plume", q.x + 26, q.y).ok).toBe(true);
    const t = j.tours[0];
    const avant = stats(t).degats;
    j.boosts.plume.degats *= 1.3;
    j.boosts.plume.version++;
    expect(stats(t).degats).toBeCloseTo(avant * 1.3);
  });
});

describe("une page entière", () => {
  it("sans rien faire, la page 1-1 est perdue ; la même graine rejoue pareil", () => {
    const jouer = () => {
      const j = nouveauJeu(optionsDePage(PAGES[0], { toursDispo: ["plume"], colle: false }));
      lancerVague(j);
      for (let i = 0; i < 60 * 60 * 10 && j.phase === "jeu"; i++) step(j, 1 / 60);
      return j;
    };
    const a = jouer();
    expect(a.phase).toBe("perdu");
    expect(jouer().stats.fuites).toBe(a.stats.fuites);
  });
  it("le Cœur vide, chaque page finit perdue : les voleurs qui se suivent ressortent tous", () => {
    for (const p of PAGES) {
      const j = nouveauJeu(optionsDePage(p, { toursDispo: ["plume"], colle: false }));
      lancerVague(j);
      let apres = 0;
      for (let i = 0; i < 60 * 60 * 10 && j.phase !== "perdu"; i++) {
        if (j.phase === "attente") lancerVague(j);
        step(j, 1 / 60);
        if (j.vies <= 0) apres++;
      }
      expect(j.phase, p.id).toBe("perdu");
      expect(apres / 60, p.id).toBeLessThan(60);
    }
  });
  it("la page du jour se génère et se lance", () => {
    const j = nouveauJeu(optionsPageDuJour("2026-10-24", [...TYPES_TOURS]));
    lancerVague(j);
    images(j, 20);
    expect(j.ennemis.length + j.stats.tues + j.stats.fuites).toBeGreaterThan(0);
    for (const e of j.ennemis) expect(ENNEMIS[e.type]).toBeDefined();
  });
});
