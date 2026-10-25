// Ce que la coop joue sur la partie : les actions des deux joueurs, appliquées pareil des deux côtés, et l'empreinte
// qui vérifie que les deux parties sont toujours la même. Sans DOM : les tests le font tourner sous Node.
import type { Pt } from "../sim/gestures";
import { PAS_SIM, ameliorer, appliquerTrace, changerCible, choisirFourniture, lancerPouvoir, lancerVague, ordonnerHeros, step, vendre, type Jeu, type Resultat } from "../sim/jeu";
import type { Pouvoir } from "../sim/pouvoirs";
import { DUREE_TOUR, type Action } from "./lockstep";

/** Ce que les deux joueurs partagent en plus de la partie : la vitesse et la pause. */
export interface Commun {
  vitesse: number;
  pause: boolean;
}

/** Un trait voyage à plat : x, y, t, x, y, t… (le JSON garde les nombres exacts). */
export const aplatir = (pts: Pt[]): number[] => pts.flatMap((p) => [p.x, p.y, p.t]);
export function deplier(a: number[]): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i + 2 < a.length; i += 3) pts.push({ x: a[i], y: a[i + 1], t: a[i + 2] });
  return pts;
}

export interface Fait {
  a: Action;
  /** Le trait joué, et ce qu'il a donné (pour l'encre qui reste ou s'efface à l'écran). */
  trace?: Pt[];
  resultat?: Resultat;
}

/** Joue une action. Tout ce qui vient du réseau est vérifié : un message bizarre ne fait rien. */
export function executer(j: Jeu, c: Commun, a: Action): Fait {
  const tour = (id: unknown) => j.tours.find((t) => t.id === id);
  switch (a.k) {
    case "trace": {
      if (!Array.isArray(a.p) || a.p.length < 6 || a.p.length > 6000 || !a.p.every((n) => typeof n === "number" && Number.isFinite(n))) return { a };
      const trace = deplier(a.p as number[]);
      const arme = typeof a.arme === "string" && a.arme in j.recharges ? (a.arme as Pouvoir) : null;
      if (arme && !j.options.pouvoirs?.includes(arme)) return { a };
      return { a, trace, resultat: arme ? lancerPouvoir(j, arme, trace) : appliquerTrace(j, trace) };
    }
    case "ameliorer": {
      const t = tour(a.id);
      if (t) ameliorer(j, t, typeof a.spec === "number" ? a.spec : undefined);
      return { a };
    }
    case "vendre": {
      const t = tour(a.id);
      if (t) vendre(j, t);
      return { a };
    }
    case "cible": {
      const t = tour(a.id);
      if (t) changerCible(t);
      return { a };
    }
    case "vague":
      lancerVague(j);
      return { a };
    case "heros":
      if (typeof a.x === "number" && typeof a.y === "number" && Number.isFinite(a.x) && Number.isFinite(a.y)) ordonnerHeros(j, a.x, a.y);
      return { a };
    case "fourniture":
      if (typeof a.i === "number") choisirFourniture(j, a.i);
      return { a };
    case "vitesse":
      if (a.v === 1 || a.v === 2 || a.v === 3) c.vitesse = a.v;
      return { a };
    case "pause":
      c.pause = a.on === true;
      return { a };
  }
  return { a };
}

/** Le temps de jeu d'un tour : rien en pause, plus vite en accéléré (seulement pendant les vagues, comme en solo). */
export function pasDuTour(j: Jeu, c: Commun): number {
  if (c.pause || j.phase === "gagne" || j.phase === "perdu") return 0;
  return Math.round((DUREE_TOUR / PAS_SIM) * (j.phase === "jeu" ? c.vitesse : 1));
}

/** Joue un tour entier : les actions, puis le temps. Renvoie ce qui a été fait. */
export function jouerTour(j: Jeu, c: Commun, actions: Action[]): Fait[] {
  const faits = actions.map((a) => executer(j, c, a));
  const n = pasDuTour(j, c);
  for (let i = 0; i < n; i++) step(j, PAS_SIM);
  return faits;
}

/** Une empreinte de l'état : l'encre, les vies, la vague, chaque monstre et chaque tour (FNV-1a sur des entiers). */
export function empreinte(j: Jeu): number {
  let h = 0x811c9dc5;
  const mel = (x: number) => {
    h ^= Math.round(x * 64) | 0;
    h = Math.imul(h, 0x01000193) >>> 0;
  };
  mel(j.encre);
  mel(j.vies);
  mel(j.vague);
  mel(j.temps);
  mel(j.ennemis.length);
  for (const e of j.ennemis) {
    mel(e.x);
    mel(e.y);
    mel(e.pv);
  }
  mel(j.tours.length);
  for (const t of j.tours) {
    mel(t.id);
    mel(t.niveau);
    mel(t.cd);
  }
  mel(j.murs.length);
  if (j.heros) {
    mel(j.heros.x);
    mel(j.heros.y);
    mel(j.heros.pv);
  }
  return h;
}
