// Cherche, page par page, le multiplicateur de difficulté où le bot « moyen » gagne sans 3 étoiles et où « fort » gagne.
//   npx vite-node tools/regler.ts [id] [parties]
import { etoiles } from "../src/sim/jeu";
import { PAGES, optionsDePage, type Page } from "../src/sim/pages";
import type { TypeTour } from "../src/sim/tours";
import { partie, type Niveau } from "./joueur";

const args = process.argv.slice(2);
const filtre = args.find((a) => /^\d-\d$/.test(a));
const n = Number(args.find((a) => /^\d+$/.test(a)) ?? 4);
const avant = (p: Page) => {
  const t: TypeTour[] = ["plume"];
  for (const q of PAGES) { if (q === p) break; if (q.debloque && q.debloque !== "colle") t.push(q.debloque); }
  return { toursDispo: t, colle: PAGES.slice(0, PAGES.indexOf(p)).some((q) => q.debloque === "colle") };
};
function mesure(p: Page, f: number, niveau: Niveau) {
  let g = 0, e = 0;
  for (let k = 0; k < n; k++) {
    const j = partie(optionsDePage({ ...p, difficulte: p.difficulte * f }, avant(p)), niveau, 500 + k);
    if (j.phase === "gagne") g++;
    e += etoiles(j);
  }
  return { g: g / n, e: e / n };
}
for (const p of PAGES) {
  if (filtre && p.id !== filtre) continue;
  const ligne: string[] = [];
  for (const f of (process.env.FACTEURS ?? "1,1.25,1.5,1.75,2,2.4").split(",").map(Number)) {
    const m = mesure(p, f, "moyen");
    const fo = mesure(p, f, "fort");
    ligne.push(`×${f}: m ${m.g * 100}% ${m.e.toFixed(1)}★ f ${fo.g * 100}% ${fo.e.toFixed(1)}★`);
    if (m.g === 0 && fo.g === 0) break;
  }
  console.log(p.id.padEnd(4), ligne.join("  "));
}
