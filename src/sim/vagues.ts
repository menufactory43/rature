// Les vagues, générées depuis la graine. Annoncées à l'avance : composition et directions.
import { ENNEMIS, type TypeEnnemi } from "./ennemis";
import { Rng } from "./rng";

export const DERNIERE_VAGUE = 20;
export const VAGUES_BOSS: Partial<Record<number, TypeEnnemi>> = { 10: "mere", 20: "compas" };

export interface Groupe {
  type: TypeEnnemi;
  nombre: number;
  /** Direction d'arrivée, en radians depuis la tour. */
  angle: number;
  /** Secondes après le début de la vague. */
  a: number;
}

export interface PlanVague {
  numero: number;
  groupes: Groupe[];
  /** Les directions d'arrivée (pour les flèches dans la marge). */
  fronts: number[];
}

const TYPES_COURANTS: TypeEnnemi[] = ["gribouille", "carre", "avion", "araignee", "tache", "gomme"];

export function budget(n: number): number {
  return 6 + 4.5 * n + 0.34 * n * n;
}

export function planifier(graine: number, n: number): PlanVague {
  const rng = new Rng(graine ^ Math.imul(n, 0x9e3779b1));
  const boss = VAGUES_BOSS[n];
  let reste = budget(n) * (boss ? 0.6 : 1);
  const dispo = TYPES_COURANTS.filter((t) => ENNEMIS[t].vague <= n);
  const nbFronts = Math.min(4, 1 + Math.floor(n / 4));
  const base = rng.range(0, Math.PI * 2);
  const fronts: number[] = [];
  for (let i = 0; i < nbFronts; i++) fronts.push(base + (i * Math.PI * 2) / nbFronts + rng.range(-0.35, 0.35));
  const duree = Math.min(30, 12 + n * 0.9);
  const groupes: Groupe[] = [];
  if (boss) groupes.push({ type: boss, nombre: 1, angle: rng.pick(fronts), a: 3 });
  let garde = 0;
  while (reste >= 1 && garde++ < 200) {
    // Les nouveaux venus sont un peu plus fréquents : on les voit vite
    const poids = dispo.map((t) => (ENNEMIS[t].vague >= n - 2 ? 1.6 : 1) * (t === "gribouille" ? 1.4 : 1));
    let tirage = rng.next() * poids.reduce((s, p) => s + p, 0);
    let type = dispo[0];
    for (let i = 0; i < dispo.length; i++) {
      tirage -= poids[i];
      if (tirage <= 0) {
        type = dispo[i];
        break;
      }
    }
    const f = ENNEMIS[type];
    if (f.cout > reste) {
      if (reste < 1) break;
      type = "gribouille";
    }
    const g = ENNEMIS[type];
    const nombre = Math.max(1, Math.min(rng.int(g.groupe[0], g.groupe[1]), Math.floor(reste / g.cout)));
    reste -= nombre * g.cout;
    groupes.push({ type, nombre, angle: rng.pick(fronts) + rng.range(-0.15, 0.15), a: rng.range(0, duree) });
  }
  // La toute première vague démarre doucement, par un seul côté
  groupes.sort((a, b) => a.a - b.a);
  if (groupes.length && !boss) groupes[0].a = Math.min(groupes[0].a, 1);
  return { numero: n, groupes, fronts };
}

/** Le résumé affiché avant la vague : « 6 gribouilles · 2 avions en papier ». */
export function resume(plan: PlanVague): { type: TypeEnnemi; nombre: number }[] {
  const compte = new Map<TypeEnnemi, number>();
  for (const g of plan.groupes) compte.set(g.type, (compte.get(g.type) ?? 0) + g.nombre);
  return [...compte.entries()].map(([type, nombre]) => ({ type, nombre })).sort((a, b) => (ENNEMIS[b.type].boss ? 1 : 0) - (ENNEMIS[a.type].boss ? 1 : 0) || b.nombre - a.nombre);
}
