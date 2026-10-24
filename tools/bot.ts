// Le bilan des pages par le joueur automatique.
//   npm run bot                 toutes les pages, 5 parties par niveau
//   npm run bot -- 1-3 10       une page, 10 parties
import { etoiles, type Options } from "../src/sim/jeu";
import { POUVOIRS, TYPES_POUVOIRS } from "../src/sim/pouvoirs";
import { PAGES, optionsDePage, optionsPageDuJour, type Page } from "../src/sim/pages";
import { TYPES_TOURS, type TypeTour } from "../src/sim/tours";
import { partie, type Niveau } from "./joueur";

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
  const avant = PAGES.slice(0, PAGES.indexOf(p)).map((q) => q.id);
  const pouvoirs = TYPES_POUVOIRS.filter((k) => avant.includes(POUVOIRS[k].apres));
  bilan(`${p.id} ${p.nom}`, () => ({ ...optionsDePage(p, { toursDispo: debloqueesAvant(p), colle }), pouvoirs }), n);
}
if (!filtre || filtre === "jour") bilan("page du jour", () => ({ ...optionsPageDuJour("2026-10-24", [...TYPES_TOURS]), pouvoirs: [...TYPES_POUVOIRS] }), n);
