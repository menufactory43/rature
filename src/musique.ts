// La musique : des morceaux enregistrés (public/sons, faits avec tools/sons.mjs), un par ambiance. Une boîte à musique
// pour les menus, du ukulélé entre les vagues, une marche quand la horde arrive, le violoncelle pour les boss. Les
// ambiances se fondent l'une dans l'autre ; chaque morceau tourne en boucle en se fondant dans son propre début (la fin
// enregistrée, qui s'éteint, n'est jamais jouée). Un morceau qu'on retrouve reprend où il en serait.
import { contexte, decoder } from "./audio";

export type Ambiance = "silence" | "menu" | "calme" | "vague" | "boss";
type Morceau = Exclude<Ambiance, "silence">;
const MORCEAUX: Morceau[] = ["menu", "calme", "vague", "boss"];

/** Le volume de chaque morceau : la marche et le boss, plus chargés, un peu en retrait. */
const VOLUME: Record<Morceau, number> = { menu: 0.8, calme: 0.75, vague: 0.7, boss: 0.7 };
/** Le fondu d'une ambiance à l'autre, et d'un tour de boucle au suivant (secondes). */
const FONDU = 1.4;
const BOUCLE = 2.5;
/** La fin des fichiers s'éteint : on reboucle avant. */
const QUEUE = 3;

interface Voix {
  src: AudioBufferSourceNode;
  gain: GainNode;
  /** Le volume qui suit le danger (le fondu, lui, est sur `gain`). */
  intensite: GainNode;
  /** Quand cette voix atteindra la fin de sa boucle. */
  fin: number;
}

const tampons: Partial<Record<Morceau | "gagne" | "perdu", AudioBuffer>> = {};
let chargement: Promise<void> | null = null;
/** Le moment où chaque morceau aurait commencé, s'il avait toujours tourné. */
const origine: Partial<Record<Morceau, number>> = {};
let actuel: { m: Morceau; voix: Voix } | null = null;
let voulu: Ambiance = "silence";
let minuterie = 0;
/** Le danger voulu (0 : tout va bien, 1 : le Cœur est en train de tomber), et celui qu'on entend, lissé. */
let dangerVoulu = 0;
let danger = 0;
/** Le jeu ralenti (le dernier mot) : la musique ralentit avec lui. */
let ralentiVoulu = false;

function charger(): void {
  const c = contexte();
  if (!c || chargement) return;
  chargement = Promise.all([...MORCEAUX, "gagne" as const, "perdu" as const].map(async (m) => {
    const b = await decoder(c.ctx, `musique-${m}`);
    if (b) tampons[m] = b;
  })).then(() => {});
}

/** Lance une voix du morceau à partir de `depart` secondes, en fondu sur `fondu`. */
function voix(m: Morceau, depart: number, fondu: number): Voix | null {
  const c = contexte();
  const b = tampons[m];
  if (!c || !b) return null;
  const t = c.ctx.currentTime;
  const src = c.ctx.createBufferSource();
  src.buffer = b;
  const gain = c.ctx.createGain();
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(VOLUME[m], t + fondu);
  const intensite = c.ctx.createGain();
  src.playbackRate.value = vitesseVoulue();
  src.connect(gain).connect(intensite).connect(c.sortie);
  src.start(t, depart);
  return { src, gain, intensite, fin: t + (b.duration - QUEUE - depart) / src.playbackRate.value };
}

function eteindre(v: Voix, fondu: number): void {
  const c = contexte();
  if (!c) return;
  const t = c.ctx.currentTime;
  v.gain.gain.cancelScheduledValues(t);
  v.gain.gain.setValueAtTime(v.gain.gain.value, t);
  v.gain.gain.linearRampToValueAtTime(0, t + fondu);
  v.src.stop(t + fondu + 0.05);
}

/** La musique suit la partie : quand ça va mal, elle presse le pas et monte ; au ralenti, elle traîne. */
function suivre(c: AudioContext): void {
  danger += (dangerVoulu - danger) * 0.12;
  if (!actuel) return;
  const v = actuel.voix;
  const avant = v.src.playbackRate.value;
  const vitesse = vitesseVoulue();
  v.src.playbackRate.setTargetAtTime(vitesse, c.currentTime, ralentiVoulu ? 0.08 : 0.4);
  v.intensite.gain.setTargetAtTime(1 + 0.3 * danger, c.currentTime, 0.4);
  // Plus vite, la fin de la boucle arrive plus tôt (et plus tard au ralenti) : on la recale à chaque tic
  v.fin -= (avant - 1) * 0.1;
}

function vitesseVoulue(): number {
  return ralentiVoulu ? 0.82 : 1 + 0.08 * danger;
}

function tic(): void {
  const c = contexte();
  if (!c) return;
  charger();
  suivre(c.ctx);
  const t = c.ctx.currentTime;
  const m = voulu === "silence" ? null : voulu;
  // Changer d'ambiance : l'ancienne s'éteint, la nouvelle reprend où elle en serait
  if ((actuel?.m ?? null) !== m) {
    if (actuel) eteindre(actuel.voix, voulu === "silence" ? 0.6 : FONDU);
    actuel = null;
    const b = m && tampons[m];
    if (m && b) {
      const boucle = b.duration - QUEUE;
      origine[m] ??= t;
      const v = voix(m, (t - origine[m]!) % boucle, FONDU);
      if (v) actuel = { m, voix: v };
    }
    return;
  }
  // La boucle : un peu avant la fin, le morceau repart du début en se fondant dans lui-même
  if (actuel && t >= actuel.voix.fin - BOUCLE) {
    eteindre(actuel.voix, BOUCLE);
    const v = voix(actuel.m, 0, BOUCLE);
    origine[actuel.m] = t;
    actuel = v ? { m: actuel.m, voix: v } : null;
  }
}

/** À appeler à chaque image : ce qui se passe à l'écran. */
export function ambiance(a: Ambiance, o: { graine: number; cahier: number; danger?: number; ralenti?: boolean }): void {
  voulu = a;
  dangerVoulu = Math.max(0, Math.min(1, o.danger ?? 0));
  ralentiVoulu = !!o.ralenti;
  if (!minuterie) minuterie = window.setInterval(tic, 100);
}

/** Les quelques mesures de fin de page, par-dessus le reste (la musique s'est tue). */
export function jingle(k: "gagne" | "perdu"): void {
  const c = contexte();
  const b = tampons[k];
  if (!c || !b) return;
  const src = c.ctx.createBufferSource();
  src.buffer = b;
  const g = c.ctx.createGain();
  g.gain.value = 0.85;
  src.connect(g).connect(c.sortie);
  src.start();
}
