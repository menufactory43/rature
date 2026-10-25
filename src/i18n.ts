// Les langues : le jeu est écrit en français, et chaque texte affiché passe par t(). En anglais, t() cherche la
// traduction dans src/i18n/en.ts (la clé est la phrase française) ; sinon, il garde le français.
//   t("Plus que {n} vies !", { n: 3 })
import { EN } from "./i18n/en";
import { reglages } from "./reglages";

export type Langue = "fr" | "en";

export const anglais = () => reglages.langue === "en";

/** Les phrases rencontrées en anglais sans traduction (pour les contrôles à l'œil et les tests). */
export const manques = new Set<string>();

/** Le texte dans la langue du joueur ; les {noms} sont remplacés par les valeurs données. */
export function t(fr: string, vars?: Record<string, string | number>): string {
  let s = fr;
  if (reglages.langue === "en") {
    const en = EN[fr];
    if (en === undefined) {
      if (/[a-zà-ÿ]{3}/i.test(fr)) manques.add(fr);
    } else s = en;
  }
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
  return s;
}
