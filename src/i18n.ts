// Les langues : le jeu est écrit en français, et chaque texte affiché passe par t(). En anglais, t() cherche la
// traduction dans src/i18n/en.ts (la clé est la phrase française) ; sinon, il garde le français.
//   t("Plus que {n} vies !", { n: 3 })
import { EN } from "./i18n/en";
import { reglages } from "./reglages";

export type Langue = "fr" | "en";

export const anglais = () => reglages.langue === "en";

/** Le texte dans la langue du joueur ; les {noms} sont remplacés par les valeurs données. */
export function t(fr: string, vars?: Record<string, string | number>): string {
  let s = reglages.langue === "en" ? (EN[fr] ?? fr) : fr;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
  return s;
}
