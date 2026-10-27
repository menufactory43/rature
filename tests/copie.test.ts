import { describe, expect, it, vi } from "vitest";

// La copie vit côté interface (traductions, réglages) : un localStorage de poche suffit sous Node
vi.hoisted(() => {
  const m = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => m.set(k, v), removeItem: (k: string) => m.delete(k) };
});
import { lancerVague, nouveauJeu, step } from "../src/sim/jeu";
import { PAGES, optionsDePage } from "../src/sim/pages";
import { afficherNote, annoter, lienDefi, lireDefi, noteSur20 } from "../src/ui/copie";

const perdue = () => {
  const j = nouveauJeu(optionsDePage(PAGES[1], { toursDispo: ["plume"], colle: false }));
  lancerVague(j);
  for (let i = 0; i < 60 * 60 * 10 && j.phase !== "perdu"; i++) {
    if (j.phase === "attente") lancerVague(j);
    step(j, 1 / 60);
  }
  return j;
};

describe("la copie corrigée", () => {
  it("note une page perdue sur la part tenue, une page gagnée entre 10 et 20, au demi-point", () => {
    const j = perdue();
    const n = noteSur20(j);
    expect(n).toBeGreaterThanOrEqual(0);
    expect(n).toBeLessThan(10);
    expect((n * 2) % 1).toBe(0);
    j.phase = "gagne";
    j.vies = j.viesMax;
    j.stats.ratures = 4;
    j.stats.ratees = 0;
    expect(noteSur20(j)).toBe(20);
    j.vies = Math.round(j.viesMax / 2);
    expect(noteSur20(j)).toBeGreaterThan(10);
    expect(noteSur20(j)).toBeLessThan(20);
    expect(afficherNote(15.5)).toBe("15,5");
    expect(afficherNote(15.5, true)).toBe("15.5");
  });
  it("montre où les mots sont passés, et le mot de la prof", () => {
    const j = perdue();
    const a = annoter(j, noteSur20(j), "Revois tes murs.");
    expect(a[0].k).toBe("note");
    expect(a.some((n) => n.k === "attention")).toBe(true);
    expect(a[a.length - 1]).toMatchObject({ k: "mot", texte: "Revois tes murs." });
    for (const n of a) if ("x" in n) {
      expect(n.x).toBeGreaterThanOrEqual(0);
      expect(n.x).toBeLessThanOrEqual(400);
    }
  });
  it("le lien « Bats ma copie » se relit tel quel, et un lien abîmé ne lance rien", () => {
    const url = lienDefi({ page: "1-3", note: 15.5, tours: ["plume", "roquette"], pouvoir: "regle" });
    expect(url.startsWith("http")).toBe(true);
    expect(lireDefi(new URL(url).search)).toEqual({ page: "1-3", note: 15.5, tours: ["plume", "roquette"], pouvoir: "regle" });
    expect(lireDefi("?bats=../x&note=3")).toBeNull();
    expect(lireDefi("?bats=1-3&note=abc")).toBeNull();
    expect(lireDefi("?bats=1-3&note=99")?.note).toBe(20);
  });
});
