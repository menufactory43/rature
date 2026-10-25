// La traduction : chaque phrase passée à t() a son entrée anglaise, les {noms} y sont conservés, et l'anglais ne garde
// pas d'entrée orpheline.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EN } from "../src/i18n/en";
import { t } from "../src/i18n";
import { changer, reglages } from "../src/reglages";
import { ENNEMIS } from "../src/sim/ennemis";
import { TOURS } from "../src/sim/tours";
import { AMELIORATIONS } from "../src/sim/ameliorations";
import { POUVOIRS } from "../src/sim/pouvoirs";
import { PAGES, TEXTE_DEFI } from "../src/sim/pages";
import { TALENTS } from "../src/progression";
import { SUCCES } from "../src/succes";

const RACINE = join(__dirname, "..", "src");

function fichiers(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return fichiers(p);
    return p.endsWith(".ts") && !p.endsWith(join("i18n", "en.ts")) ? [p] : [];
  });
}

/** Les littéraux d'un fichier source, et les premiers arguments littéraux de ses appels t(...). */
function lire(src: string): { litteraux: string[]; appels: string[] } {
  const litteraux: string[] = [];
  const appels: string[] = [];
  const appelsDe: number[] = [];
  const n = src.length;
  /** Une chaîne entre guillemets ; renvoie l'indice qui suit. */
  const chaine = (i: number, sortie: string[] | null): number => {
    const q = src[i];
    let j = i + 1;
    let v = "";
    while (j < n && src[j] !== q) {
      if (src[j] === "\\") {
        v += src[j + 1];
        j += 2;
      } else v += src[j++];
    }
    if (sortie && q === '"') sortie.push(v);
    return j + 1;
  };
  /** Un modèle `...` : seuls ceux sans ${} sont des littéraux ; le code des ${} est parcouru à part. */
  const modele = (i: number, sortie: string[] | null): number => {
    let j = i + 1;
    let v = "";
    let dyn = false;
    while (j < n && src[j] !== "`") {
      if (src[j] === "\\") {
        v += src[j + 1];
        j += 2;
      } else if (src[j] === "$" && src[j + 1] === "{") {
        dyn = true;
        j = code(j + 2, true, sortie !== null);
      } else v += src[j++];
    }
    if (sortie && !dyn) sortie.push(v);
    return j + 1;
  };
  /** Le code : saute les commentaires, relève les littéraux et les appels t( ; s'arrête à l'accolade fermante d'un ${}. */
  const code = (i: number, dansModele: boolean, relever: boolean): number => {
    let prof = 0;
    while (i < n) {
      const c = src[i];
      if (c === "/" && src[i + 1] === "/") {
        while (i < n && src[i] !== "\n") i++;
      } else if (c === "/" && src[i + 1] === "*") {
        i = src.indexOf("*/", i + 2) + 2;
      } else if (c === '"' || c === "'") i = chaine(i, relever ? litteraux : null);
      else if (c === "`") i = modele(i, relever ? litteraux : null);
      else if (dansModele && c === "{") {
        prof++;
        i++;
      } else if (dansModele && c === "}") {
        if (prof === 0) return i + 1;
        prof--;
        i++;
      } else {
        if (c === "t" && src[i + 1] === "(" && !/[\w$.]/.test(src[i - 1] ?? " ")) appelsDe.push(i + 2);
        i++;
      }
    }
    return i;
  };
  code(0, false, true);
  // Le premier argument de chaque t( : toutes les chaînes jusqu'à la virgule ou la parenthèse fermante du même niveau
  for (const debut of appelsDe) {
    let prof = 0;
    let j = debut;
    while (j < n) {
      const c = src[j];
      if (c === '"' || c === "'") {
        // Les comparaisons (=== "cercle", startsWith("la ")) ne sont pas des phrases à traduire
        const compare = /(===|!==|startsWith\(|includes\()\s*$/.test(src.slice(Math.max(0, j - 16), j));
        j = chaine(j, compare ? null : appels);
        continue;
      }
      if (c === "`") {
        j = modele(j, appels);
        continue;
      }
      if (c === "(" || c === "[" || c === "{") prof++;
      else if (c === ")" || c === "]" || c === "}") {
        if (prof === 0) break;
        prof--;
      } else if (c === "," && prof === 0) break;
      j++;
    }
  }
  return { litteraux, appels };
}

const sources = fichiers(RACINE).map((f) => ({ f, ...lire(readFileSync(f, "utf8")) }));
/** Les textes des tables de données, affichés par t(f.nom), t(f.conseil)… */
const donnees = new Set<string>();
for (const f of Object.values(ENNEMIS)) [f.nom, f.pluriel, f.conseil].forEach((s) => donnees.add(s));
for (const f of Object.values(TOURS)) {
  [f.nom, f.role].forEach((s) => donnees.add(s));
  for (const sp of f.specs) [sp.nom, sp.texte].forEach((s) => donnees.add(s));
}
for (const f of Object.values(AMELIORATIONS)) {
  donnees.add(f.nom);
  for (let n = 1; n <= f.max; n++) donnees.add(f.texte(n));
}
for (const f of Object.values(POUVOIRS)) [f.nom, f.consigne, f.conseil].forEach((s) => donnees.add(s));
for (const f of Object.values(TALENTS)) [f.nom, f.texte].forEach((s) => donnees.add(s));
for (const f of SUCCES) [f.nom, f.texte].forEach((s) => donnees.add(s));
for (const p of PAGES) donnees.add(p.nom);
for (const s of Object.values(TEXTE_DEFI)) donnees.add(s);

/** Les listes de phrases tirées au hasard ou jouées dans l'ordre, et les textes des étapes du tutoriel. */
const listes = [
  { f: "ui/compagnon.ts", re: /const (?:ASTUCES|INTROS)[^=]*= (\[|\{)([\s\S]*?)\n(?:\]|\});/g },
  { f: "ui/tuto.ts", re: /texte:\s*("(?:[^"\\]|\\.)*")/g },
  { f: "ui/partie.ts", re: /tire\((\[[^\]]*\])\)/g },
  { f: "ui/compagnon.ts", re: /tirer\((\[[^\]]*\])\)/g },
];
const aTraduire = new Set<string>();
for (const l of listes) {
  const src = readFileSync(join(RACINE, l.f), "utf8");
  for (const m of src.matchAll(l.re)) for (const c of (m[2] ?? m[1]).matchAll(/"((?:[^"\\]|\\.)*)"/g)) if (/[ éèàç]/.test(c[1])) aTraduire.add(c[1].replace(/\\(.)/g, "$1"));
}

const marques = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("traduction anglaise", () => {
  it("chaque phrase passée à t() est traduite", () => {
    const manquantes = new Set<string>();
    for (const s of sources) for (const k of s.appels) if (!(k in EN)) manquantes.add(`${s.f.replace(RACINE, "src")} : ${k}`);
    expect([...manquantes]).toEqual([]);
  });

  it("chaque texte des tables de données est traduit", () => {
    expect([...donnees].filter((k) => !(k in EN))).toEqual([]);
  });

  it("chaque phrase des listes (astuces, étapes du tutoriel…) est traduite", () => {
    expect(aTraduire.size).toBeGreaterThan(40);
    expect([...aTraduire].filter((k) => !(k in EN))).toEqual([]);
  });

  it("les {noms} de la phrase française sont ceux de l'anglais", () => {
    const faux = Object.entries(EN).filter(([k, v]) => marques(k).join() !== marques(v).join()).map(([k]) => k);
    expect(faux).toEqual([]);
  });

  it("l'anglais n'a pas d'entrée qui ne sert nulle part", () => {
    const utilises = new Set<string>(donnees);
    for (const s of sources) for (const l of s.litteraux) utilises.add(l);
    expect(Object.keys(EN).filter((k) => !utilises.has(k))).toEqual([]);
  });

  it("t() traduit et remplace les {noms}, en français comme en anglais", () => {
    const avant = reglages.langue;
    changer("langue", "fr");
    expect(t("Retour")).toBe("Retour");
    expect(t("Jouer {id}", { id: "1-1" })).toBe("Jouer 1-1");
    changer("langue", "en");
    expect(t("Retour")).toBe("Back");
    expect(t("Jouer {id}", { id: "1-1" })).toBe("Play 1-1");
    expect(t("phrase pas encore traduite")).toBe("phrase pas encore traduite");
    changer("langue", avant);
  });
});
