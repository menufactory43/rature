import { describe, expect, it } from "vitest";
import { fusionner, type Sauvegarde } from "../src/progression";

const vide = (): Sauvegarde => ({ etoiles: {}, defis: {}, sansFin: {}, talents: {}, apparences: {}, jour: {}, appris: [], vus: [], interro: 0, succes: [], cartables: {}, couverture: {} });

describe("la fusion des sauvegardes (iPhone, app, iCloud)", () => {
  it("garde le meilleur de chacune", () => {
    const a = { ...vide(), etoiles: { "1-1": 3, "1-2": 1 }, interro: 4, vus: ["carre"], jour: { "2026-10-25": { vagues: 8, vies: 3 } } };
    const b = { ...vide(), etoiles: { "1-2": 2, "1-3": 1 }, interro: 9, vus: ["avion"], defis: { "1-1": true }, jour: { "2026-10-25": { vagues: 8, vies: 7 } }, succes: ["rature.page1"] };
    const f = fusionner(a, b);
    expect(f.etoiles).toEqual({ "1-1": 3, "1-2": 2, "1-3": 1 });
    expect(f.interro).toBe(9);
    expect(f.vus.sort()).toEqual(["avion", "carre"]);
    expect(f.defis["1-1"]).toBe(true);
    expect(f.jour["2026-10-25"].vies).toBe(7);
    expect(f.succes).toEqual(["rature.page1"]);
  });
  it("prend les talents de celle qui en a placé le plus", () => {
    const a = { ...vide(), talents: { encre: 1 } };
    const b = { ...vide(), talents: { encre: 2, vies: 1 } };
    expect(fusionner(a, b).talents).toEqual({ encre: 2, vies: 1 });
    expect(fusionner(b, a).talents).toEqual({ encre: 2, vies: 1 });
  });
  it("supporte une vieille sauvegarde incomplète", () => {
    const f = fusionner(vide(), { etoiles: { "1-1": 1 } } as Partial<Sauvegarde>);
    expect(f.etoiles["1-1"]).toBe(1);
    expect(f.succes).toEqual([]);
  });
});
