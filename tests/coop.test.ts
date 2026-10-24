import { describe, expect, it } from "vitest";
import { Lockstep, type Action, type MessageTour } from "../src/coop/lockstep";
import { aplatir, empreinte, jouerTour, type Commun } from "../src/coop/partage";
import { FORMES, type Glyphe } from "../src/sim/glyphes";
import { nouveauJeu, type Jeu } from "../src/sim/jeu";
import { PAGES, optionsDePage } from "../src/sim/pages";
import { TYPES_TOURS } from "../src/sim/tours";
import { Rng } from "../src/sim/rng";

function symbole(g: Glyphe, cx: number, cy: number, taille = 28) {
  const f = FORMES[g][0];
  return f.map((p, i) => ({ x: cx + p.x * taille + Math.sin(i * 1.7) * 1.2, y: cy + p.y * taille + Math.cos(i * 2.3) * 1.2, t: i * 15 }));
}

/** Deux joueurs, un réseau qui traîne au hasard, et chacun qui agit de son côté. */
function partieADeux(graine: number, tricher = false) {
  const rng = new Rng(graine);
  const page = PAGES[3];
  const nouveau = () => nouveauJeu({ ...optionsDePage(page, { toursDispo: [...TYPES_TOURS], colle: true }), coop: true, pouvoirs: ["regle"] });
  let maintenant = 0;
  const vol: { quand: number; vers: number; m: MessageTour }[] = [];
  const joueurs = [0, 1].map((k) => {
    const jeu: Jeu = nouveau();
    jeu.encre = 5000;
    const commun: Commun = { vitesse: 1, pause: false };
    const ls = new Lockstep((m) => vol.push({ quand: maintenant + 0.02 + rng.next() * 0.3, vers: 1 - k, m: JSON.parse(JSON.stringify(m)) }), k === 0);
    return { jeu, commun, ls, empreintes: new Map<number, number>() };
  });
  const places = joueurs[0].jeu.trajets[0].filter((_, i) => i % 9 === 4);
  const glyphes: Glyphe[] = ["cercle", "triangle", "eclair", "spirale"];
  for (let image = 0; image < 60 * 150; image++) {
    maintenant += 1 / 60;
    for (const v of vol.filter((v) => v.quand <= maintenant)) joueurs[v.vers].ls.recevoir(v.m);
    vol.splice(0, vol.length, ...vol.filter((v) => v.quand > maintenant));
    joueurs.forEach((jr, k) => {
      // Le second arrive un peu après, comme dans la vraie vie
      if (k === 1 && maintenant < 0.4) return;
      if (rng.next() < 0.01) {
        const q = places[rng.int(0, places.length - 1)];
        const g = glyphes[rng.int(0, glyphes.length - 1)];
        jr.ls.agir({ k: "trace", p: aplatir(symbole(g, q.x + (k ? -30 : 30), q.y, 20)) });
      }
      if (rng.next() < 0.004) jr.ls.agir({ k: "vague" });
      if (rng.next() < 0.003 && jr.jeu.tours.length) jr.ls.agir({ k: "ameliorer", id: jr.jeu.tours[rng.int(0, jr.jeu.tours.length - 1)].id });
      if (rng.next() < 0.002) jr.ls.agir({ k: "vitesse", v: rng.int(1, 3) });
      jr.ls.avancer(1 / 60, (actions, n) => {
        if (tricher && k === 1 && n === 55) jr.jeu.encre += 1;
        jouerTour(jr.jeu, jr.commun, actions.map((x) => x.a as Action));
        const h = empreinte(jr.jeu);
        jr.empreintes.set(n, h);
        return h;
      });
    });
  }
  return joueurs;
}

describe("coop en lockstep", () => {
  it("les deux parties restent identiques malgré le réseau", () => {
    for (const graine of [1, 2, 3]) {
      const [a, b] = partieADeux(graine);
      expect(a.ls.tour).toBeGreaterThan(1000);
      expect(Math.abs(a.ls.tour - b.ls.tour)).toBeLessThanOrEqual(3);
      for (const [n, h] of a.empreintes) if (b.empreintes.has(n)) expect(b.empreintes.get(n), `tour ${n}`).toBe(h);
      expect(a.jeu.tours.length).toBeGreaterThan(2);
      expect(a.ls.divergence).toBeNull();
      expect(b.ls.divergence).toBeNull();
    }
  }, 60_000);

  it("voit quand les deux parties divergent", () => {
    const [a, b] = partieADeux(4, true);
    expect(a.ls.divergence).toBe(60);
    expect(b.ls.divergence).toBe(60);
  }, 30_000);
});
