// Les sons : des bruitages enregistrés (public/sons, faits avec tools/sons.mjs), plusieurs prises par son et une
// hauteur qui varie un peu pour qu'une rafale ne sonne pas mécanique. Tant qu'ils chargent (ou s'ils manquent), des
// sons synthétisés les remplacent. Le stylo qui gratte suit la vitesse du doigt.
import type { Son } from "./sim/jeu";
import { reglages, surChangement } from "./reglages";

let ctx: AudioContext | null = null;
let bruit: AudioBuffer | null = null;
let grattement: { gain: GainNode; filtre: BiquadFilterNode; source: AudioBufferSourceNode } | null = null;
/** Les prises chargées, par son. */
const prises: Partial<Record<Son | "gratte", AudioBuffer[]>> = {};
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
  grattement = { gain, filtre, source: src };
  void charger(ctx);
}

/** Combien de prises pour chaque son (0 : un seul fichier, sans numéro). */
const PRISES: Record<Son | "gratte", number> = {
  gratte: 0, pose: 2, tir: 3, pop: 3, aie: 2, casse: 3, boom: 2, zap: 2, rate: 2, rature: 3, mur: 0, colle: 2, sec: 2,
  page: 3, refus: 0, vague: 0, ding: 2, coche: 2, boss: 0,
};

/** Le volume de chaque son dans le mélange : les tirs, très fréquents, restent discrets. */
const VOLUME: Record<Son, number> = {
  pose: 0.8, tir: 0.16, pop: 0.42, aie: 0.9, casse: 0.5, boom: 0.6, zap: 0.32, rate: 0.6, rature: 0.75, mur: 0.7,
  colle: 0.7, sec: 0.7, page: 0.8, refus: 0.6, vague: 0.7, ding: 0.55, coche: 0.6, boss: 0.9,
};

/** Un fichier de public/sons, décodé (null s'il manque). */
export async function decoder(c: AudioContext, nom: string): Promise<AudioBuffer | null> {
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}sons/${nom}.mp3`);
    if (!r.ok) return null;
    return await c.decodeAudioData(await r.arrayBuffer());
  } catch {
    return null;
  }
}

async function charger(c: AudioContext): Promise<void> {
  await Promise.all((Object.keys(PRISES) as (Son | "gratte")[]).map(async (s) => {
    const n = PRISES[s];
    const noms = n ? Array.from({ length: n }, (_, i) => `${s}${i}`) : [s];
    const b = (await Promise.all(noms.map((x) => decoder(c, x)))).filter((x): x is AudioBuffer => !!x);
    if (b.length) prises[s] = b;
  }));
  // Le grattement enregistré prend la place du bruit filtré : une boucle, les bords du fichier évités
  const g = prises.gratte?.[0];
  if (g && grattement) {
    const src = c.createBufferSource();
    src.buffer = g;
    src.loop = true;
    src.loopStart = 0.06;
    src.loopEnd = g.duration - 0.06;
    grattement.filtre.type = "lowpass";
    grattement.filtre.frequency.value = 9000;
    grattement.filtre.Q.value = 0.5;
    grattement.source.stop();
    src.connect(grattement.filtre);
    src.start(0, 0.06 + Math.random() * (g.duration - 0.2));
    grattement.source = src;
  }
}

/** Une prise au hasard, un peu plus haute ou plus basse. */
function prise(s: Son): boolean {
  const b = prises[s];
  if (!ctx || !b?.length || !busEffets) return false;
  const src = ctx.createBufferSource();
  src.buffer = b[Math.floor(Math.random() * b.length)];
  src.playbackRate.value = 0.93 + Math.random() * 0.14;
  const g = ctx.createGain();
  g.gain.value = VOLUME[s];
  src.connect(g).connect(busEffets);
  src.start();
  return true;
}

/** Le stylo qui gratte le papier, selon la vitesse du doigt (0 = silence). */
export function gratter(vitesse: number): void {
  if (!ctx || !grattement) return;
  const v = actif ? Math.min(1, vitesse / 1.5) : 0;
  if (prises.gratte) {
    // L'enregistrement : plus fort et un peu plus aigu quand le doigt file
    grattement.gain.gain.setTargetAtTime(v * 0.55, ctx.currentTime, 0.03);
    grattement.source.playbackRate.setTargetAtTime(0.8 + v * 0.45, ctx.currentTime, 0.05);
    return;
  }
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
    if (prise(s)) continue;
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
