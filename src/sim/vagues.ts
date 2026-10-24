// Les vagues, générées depuis la graine de la page : identiques pour tout le monde, annoncées à l'avance.
import { ENNEMIS, type TypeEnnemi } from "./ennemis";
import { Rng } from "./rng";

export interface ReglesVagues {
  graine: number;
  /** Nombre de vagues (Infinity : sans fin). */
  total: number;
  /** Les monstres de la page, dans leur ordre d'arrivée. */
  pool: TypeEnnemi[];
  difficulte: number;
  /** Le boss de la dernière vague (et, en sans fin, toutes les 10 vagues). */
  boss?: TypeEnnemi;
  entrees: number;
}

export interface Groupe {
  type: TypeEnnemi;
  nombre: number;
  entree: number;
  /** Secondes après le début de la vague. */
  a: number;
}

export interface PlanVague {
  numero: number;
  groupes: Groupe[];
}

export const budget = (n: number) => 8 + 5 * n + 0.3 * n * n;

/** La vague où chaque monstre de la page apparaît pour la première fois. */
export function premiereVague(r: ReglesVagues, i: number): number {
  if (i === 0) return 1;
  const etendue = Number.isFinite(r.total) ? r.total : 12;
  return Math.max(2, Math.round((i * etendue) / (r.pool.length + 0.5)));
}

export const estVagueBoss = (r: ReglesVagues, n: number) => !!r.boss && (Number.isFinite(r.total) ? n === r.total : n % 10 === 0);

export function planifier(r: ReglesVagues, n: number): PlanVague {
  const rng = new Rng(r.graine ^ Math.imul(n, 0x9e3779b1));
  const boss = estVagueBoss(r, n) ? r.boss : undefined;
  let reste = budget(n) * (boss ? 0.5 : 1);
  const dispo = r.pool.filter((t, i) => premiereVague(r, i) <= n && ENNEMIS[t].cout > 0);
  const nouveaux = r.pool.filter((_, i) => premiereVague(r, i) === n);
  const duree = Math.min(28, 10 + n * 0.8);
  const groupes: Groupe[] = [];
  if (boss) groupes.push({ type: boss, nombre: 1, entree: rng.int(0, r.entrees - 1), a: 4 });
  // Un nouveau venu arrive seul en tête de vague, pour qu'on le remarque
  for (const t of nouveaux) {
    const f = ENNEMIS[t];
    if (f.cout > reste) continue;
    const nombre = f.groupe[0];
    reste -= nombre * f.cout;
    groupes.push({ type: t, nombre, entree: rng.int(0, r.entrees - 1), a: 0.5 });
  }
  let garde = 0;
  while (reste >= 1 && garde++ < 300) {
    const poids = dispo.map((t) => (t === "gribouille" ? 1.4 : 1));
    let tirage = rng.next() * poids.reduce((s, p) => s + p, 0);
    let type = dispo[0];
    for (let i = 0; i < dispo.length; i++) {
      tirage -= poids[i];
      if (tirage <= 0) {
        type = dispo[i];
        break;
      }
    }
    if (ENNEMIS[type].cout > reste) type = "gribouille";
    const f = ENNEMIS[type];
    const nombre = Math.max(1, Math.min(rng.int(f.groupe[0], f.groupe[1]), Math.floor(reste / f.cout)));
    reste -= nombre * f.cout;
    groupes.push({ type, nombre, entree: rng.int(0, r.entrees - 1), a: rng.range(0.5, duree) });
  }
  groupes.sort((a, b) => a.a - b.a);
  return { numero: n, groupes };
}

/** Le résumé affiché avant la vague : « 6 gribouilles · 2 avions en papier ». */
export function resume(plan: PlanVague): { type: TypeEnnemi; nombre: number }[] {
  const compte = new Map<TypeEnnemi, number>();
  for (const g of plan.groupes) compte.set(g.type, (compte.get(g.type) ?? 0) + g.nombre);
  return [...compte.entries()]
    .map(([type, nombre]) => ({ type, nombre }))
    .sort((a, b) => (ENNEMIS[b.type].boss ? 1 : 0) - (ENNEMIS[a.type].boss ? 1 : 0) || b.nombre - a.nombre);
}
