// Les sons, synthétisés (aucun fichier) : le grattement du stylo, les pops d'encre, la page qui tourne.
import type { Son } from "./sim/jeu";
import { reglages, surChangement } from "./reglages";

let ctx: AudioContext | null = null;
let bruit: AudioBuffer | null = null;
let grattement: { gain: GainNode; filtre: BiquadFilterNode } | null = null;
/** Tout passe par là : coupé, plus rien ne sort. */
let maitre: GainNode | null = null;
let busEffets: GainNode | null = null;
let busMusique: GainNode | null = null;
export let actif = localStorage.getItem("rature.son") !== "non";

function volumes(): void {
  if (!ctx || !maitre || !busEffets || !busMusique) return;
  const t = ctx.currentTime;
  maitre.gain.setTargetAtTime(actif ? 1 : 0, t, 0.05);
  busEffets.gain.setTargetAtTime(reglages.effets, t, 0.05);
  busMusique.gain.setTargetAtTime(reglages.musique * 0.5, t, 0.05);
}
surChangement(volumes);

export function basculer(): boolean {
  actif = !actif;
  localStorage.setItem("rature.son", actif ? "oui" : "non");
  if (!actif) gratter(0);
  volumes();
  return actif;
}

/** Pour la musique : le contexte, son bus et le bruit blanc partagé (null tant que le son n'est pas déverrouillé). */
export function contexte(): { ctx: AudioContext; sortie: GainNode; bruit: AudioBuffer } | null {
  return ctx && busMusique && bruit ? { ctx, sortie: busMusique, bruit } : null;
}

/** À appeler sur le premier geste (iOS n'ouvre le son qu'au toucher). */
export function deverrouiller(): void {
  if (ctx) {
    if (ctx.state === "suspended") void ctx.resume();
    return;
  }
  ctx = new AudioContext();
  maitre = ctx.createGain();
  maitre.connect(ctx.destination);
  busEffets = ctx.createGain();
  busEffets.connect(maitre);
  busMusique = ctx.createGain();
  busMusique.connect(maitre);
  volumes();
  bruit = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = bruit.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = bruit;
  src.loop = true;
  const filtre = ctx.createBiquadFilter();
  filtre.type = "bandpass";
  filtre.frequency.value = 2400;
  filtre.Q.value = 0.8;
  const gain = ctx.createGain();
  gain.gain.value = 0;
  src.connect(filtre).connect(gain).connect(busEffets!);
  src.start();
  grattement = { gain, filtre };
}

/** Le stylo qui gratte le papier, selon la vitesse du doigt (0 = silence). */
export function gratter(vitesse: number): void {
  if (!ctx || !grattement) return;
  const v = actif ? Math.min(1, vitesse / 1.5) : 0;
  grattement.gain.gain.setTargetAtTime(v * 0.09, ctx.currentTime, 0.03);
  grattement.filtre.frequency.setTargetAtTime(1800 + v * 2200, ctx.currentTime, 0.05);
}

function bip(freq: number, duree: number, type: OscillatorType, volume: number, glisse = 0): void {
  if (!ctx) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (glisse) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * glisse), t + duree);
  g.gain.setValueAtTime(volume, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duree);
  o.connect(g).connect(busEffets!);
  o.start(t);
  o.stop(t + duree);
}

function souffle(duree: number, freq: number, volume: number, q = 1): void {
  if (!ctx || !bruit) return;
  const t = ctx.currentTime;
  const s = ctx.createBufferSource();
  s.buffer = bruit;
  const f = ctx.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(volume, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duree);
  s.connect(f).connect(g).connect(busEffets!);
  s.start(t, Math.random() * 0.5);
  s.stop(t + duree);
}

const dernier: Partial<Record<Son, number>> = {};

export function jouer(sons: Son[]): void {
  if (!ctx || !actif || reglages.effets <= 0) return;
  const maintenant = ctx.currentTime;
  for (const s of new Set(sons)) {
    // Pas plus d'un même son toutes les 50 ms (une rafale de pops reste lisible)
    if ((dernier[s] ?? -1) > maintenant - 0.05) continue;
    dernier[s] = maintenant;
    switch (s) {
      case "pop": bip(500 + Math.random() * 300, 0.08, "sine", 0.12, 0.4); break;
      case "tir": souffle(0.04, 3500, 0.04, 2); break;
      case "aie": bip(140, 0.25, "triangle", 0.25, 0.5); souffle(0.2, 400, 0.2); break;
      case "casse": souffle(0.12, 1200, 0.12, 3); break;
      case "boom": souffle(0.35, 300, 0.3); bip(90, 0.3, "sine", 0.25, 0.5); break;
      case "zap": bip(1400, 0.12, "sawtooth", 0.05, 0.3); break;
      case "rate": bip(220, 0.15, "square", 0.04, 0.8); break;
      case "rature": souffle(0.1, 2800, 0.15, 1.5); break;
      case "mur": souffle(0.08, 1600, 0.08); break;
      case "colle": bip(300, 0.2, "sine", 0.08, 0.6); break;
      case "sec": bip(180, 0.1, "square", 0.05); break;
      case "page": souffle(0.4, 900, 0.14, 0.5); break;
      case "pose": souffle(0.06, 2200, 0.1); bip(660, 0.1, "triangle", 0.08, 1.5); break;
      case "refus": bip(160, 0.12, "square", 0.05, 0.9); break;
      case "vague": bip(330, 0.3, "triangle", 0.1, 1.3); bip(440, 0.3, "triangle", 0.06, 1.3); break;
      case "ding": bip(1320, 0.4, "sine", 0.08, 0.98); break;
      case "coche": bip(880, 0.08, "sine", 0.08, 1.4); break;
      case "boss": bip(110, 0.8, "sawtooth", 0.08, 0.7); bip(116, 0.8, "sawtooth", 0.06, 0.7); break;
    }
  }
}
