// La musique, composée à la volée pour chaque page : une boîte à musique et un crayon qui tapote entre les vagues,
// la basse et la batterie quand la horde arrive, le mode mineur et une nappe sombre pour les boss. Aucun fichier.
import { contexte } from "./audio";
import { Rng } from "./sim/rng";

export type Ambiance = "silence" | "menu" | "calme" | "vague" | "boss";
type Couche = "melodie" | "arpege" | "basse" | "batterie" | "crayon" | "nappe";
const COUCHES: Couche[] = ["melodie", "arpege", "basse", "batterie", "crayon", "nappe"];

const MIX: Record<Ambiance, Record<Couche, number>> = {
  silence: { melodie: 0, arpege: 0, basse: 0, batterie: 0, crayon: 0, nappe: 0 },
  menu: { melodie: 0.9, arpege: 0.6, basse: 0.25, batterie: 0, crayon: 0.5, nappe: 0 },
  calme: { melodie: 0.7, arpege: 0.8, basse: 0.5, batterie: 0, crayon: 0.6, nappe: 0 },
  vague: { melodie: 1, arpege: 0.5, basse: 1, batterie: 1, crayon: 0.3, nappe: 0 },
  boss: { melodie: 1, arpege: 0.35, basse: 1, batterie: 1, crayon: 0.2, nappe: 0.8 },
};

const MODES = {
  majeur: [0, 2, 4, 5, 7, 9, 11],
  dorien: [0, 2, 3, 5, 7, 9, 10],
  mixolydien: [0, 2, 4, 5, 7, 9, 10],
  mineur: [0, 2, 3, 5, 7, 8, 11],
};

interface Style {
  racine: number;
  mode: keyof typeof MODES;
  tempo: number;
  /** Les degrés des accords, une mesure chacun. */
  grille: number[];
  swing: number;
}

// Cahier de brouillon : do majeur, guilleret. Maths : ré dorien, plus carré. Musique : fa mixolydien, swingué.
const STYLES: Record<number, Style> = {
  0: { racine: 60, mode: "majeur", tempo: 84, grille: [0, 3, 5, 4], swing: 0.1 },
  1: { racine: 60, mode: "majeur", tempo: 96, grille: [0, 5, 3, 4], swing: 0 },
  2: { racine: 62, mode: "dorien", tempo: 104, grille: [0, 3, 0, 6], swing: 0 },
  3: { racine: 65, mode: "mixolydien", tempo: 92, grille: [0, 2, 3, 6], swing: 0.18 },
};

interface Note {
  pas: number;
  degre: number;
  duree: number;
}

interface Morceau {
  style: Style;
  echelle: number[];
  /** 8 mesures de mélodie. */
  melodie: Note[][];
  boss: boolean;
}

const RYTHMES = [
  "1000100010001000",
  "1000101010001000",
  "1010100010100000",
  "1000001010000010",
  "1001001010000000",
  "1000100000101000",
  "1000000010101010",
];

function composer(graine: number, cahier: number, boss: boolean): Morceau {
  const base = STYLES[cahier] ?? STYLES[0];
  const style: Style = boss ? { ...base, mode: "mineur", tempo: base.tempo + 10, grille: [0, 5, 3, 4], swing: 0 } : base;
  const echelle = MODES[style.mode];
  const rng = new Rng(graine * 7 + cahier * 131 + (boss ? 999 : 0) + 1);
  const mesure = (accord: number, depart: number, cadence: boolean): Note[] => {
    const r = RYTHMES[rng.int(0, RYTHMES.length - 1)];
    const notes: Note[] = [];
    let d = depart;
    const tons = [accord, accord + 2, accord + 4, accord + 7, accord + 9];
    for (let pas = 0; pas < 16; pas++) {
      if (r[pas] !== "1") continue;
      if (pas % 4 === 0) {
        // Sur le temps : la note de l'accord la plus proche
        d = tons.reduce((m, t) => (Math.abs(t - d) < Math.abs(m - d) ? t : m), tons[0]);
      } else d += rng.pick([-2, -1, -1, 1, 1, 2]);
      d = Math.max(accord - 1, Math.min(accord + 9, d));
      notes.push({ pas, degre: d, duree: 1 });
    }
    if (cadence) {
      notes.length = 0;
      notes.push({ pas: 0, degre: accord + 2, duree: 4 }, { pas: 6, degre: accord + 1, duree: 2 }, { pas: 8, degre: accord, duree: 8 });
    }
    for (let i = 0; i < notes.length; i++) notes[i].duree = Math.max(notes[i].duree, Math.min(6, (notes[i + 1]?.pas ?? 16) - notes[i].pas));
    return notes;
  };
  const g = style.grille;
  const a0 = mesure(g[0], g[0] + 4, false);
  const a1 = mesure(g[1], a0[a0.length - 1]?.degre ?? g[1], false);
  const b0 = mesure(g[2], g[2] + 7, false);
  const b1 = mesure(g[3], g[3] + 4, false);
  // A A' B A'' : la phrase revient, la dernière mesure conclut
  const melodie = [a0, a1, a0, mesure(g[3], g[3] + 4, false), b0, b1, a0, mesure(g[3], g[3] + 4, true)];
  return { style, echelle, melodie, boss };
}

// --- Les instruments ---

const freq = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
const noteDe = (m: Morceau, degre: number, octave: number) => {
  const e = m.echelle;
  const o = Math.floor(degre / 7);
  return m.style.racine + octave * 12 + o * 12 + e[((degre % 7) + 7) % 7];
};

let couches: Record<Couche, GainNode> | null = null;

function enveloppe(ctx: AudioContext, t: number, vol: number, attaque: number, chute: number, vers: AudioNode): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attaque);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attaque + chute);
  g.connect(vers);
  return g;
}

function osc(ctx: AudioContext, type: OscillatorType, f: number, t: number, duree: number, vers: AudioNode, desaccord = 0): void {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = f;
  o.detune.value = desaccord;
  o.connect(vers);
  o.start(t);
  o.stop(t + duree + 0.05);
}

/** La boîte à musique : une fondamentale ronde et un partiel aigu un peu faux, qui s'éteignent vite. */
function boite(ctx: AudioContext, f: number, t: number, duree: number, vol: number, vers: AudioNode): void {
  const chute = Math.max(0.5, duree * 1.4);
  osc(ctx, "sine", f, t, chute, enveloppe(ctx, t, vol, 0.004, chute, vers));
  osc(ctx, "sine", f * 4.02, t, 0.25, enveloppe(ctx, t, vol * 0.18, 0.002, 0.25, vers));
}

function pizz(ctx: AudioContext, f: number, t: number, vol: number, vers: AudioNode): void {
  const filtre = ctx.createBiquadFilter();
  filtre.type = "lowpass";
  filtre.frequency.value = 2400;
  filtre.connect(vers);
  osc(ctx, "triangle", f, t, 0.3, enveloppe(ctx, t, vol, 0.004, 0.28, filtre));
}

function basse(ctx: AudioContext, f: number, t: number, duree: number, vol: number, vers: AudioNode): void {
  const filtre = ctx.createBiquadFilter();
  filtre.type = "lowpass";
  filtre.frequency.value = 420;
  filtre.connect(vers);
  osc(ctx, "triangle", f, t, duree, enveloppe(ctx, t, vol, 0.01, duree, filtre));
  osc(ctx, "sine", f / 2, t, duree, enveloppe(ctx, t, vol * 0.6, 0.01, duree, vers));
}

function bruitFiltre(ctx: AudioContext, bruit: AudioBuffer, t: number, type: BiquadFilterType, f: number, q: number, vol: number, duree: number, vers: AudioNode): void {
  const s = ctx.createBufferSource();
  s.buffer = bruit;
  const filtre = ctx.createBiquadFilter();
  filtre.type = type;
  filtre.frequency.value = f;
  filtre.Q.value = q;
  s.connect(filtre).connect(enveloppe(ctx, t, vol, 0.002, duree, vers));
  s.start(t, Math.random() * 0.8);
  s.stop(t + duree + 0.05);
}

function grosseCaisse(ctx: AudioContext, t: number, vers: AudioNode): void {
  const o = ctx.createOscillator();
  o.type = "sine";
  o.frequency.setValueAtTime(150, t);
  o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
  o.connect(enveloppe(ctx, t, 0.9, 0.003, 0.22, vers));
  o.start(t);
  o.stop(t + 0.3);
}

/** La nappe des boss : l'accord tenu par des scies désaccordées, étouffées. */
function nappe(ctx: AudioContext, fs: number[], t: number, duree: number, vers: AudioNode): void {
  const filtre = ctx.createBiquadFilter();
  filtre.type = "lowpass";
  filtre.frequency.value = 650;
  filtre.Q.value = 2;
  filtre.connect(vers);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.12, t + 0.6);
  g.gain.setValueAtTime(0.12, t + duree - 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duree + 0.5);
  g.connect(filtre);
  for (const f of fs) for (const d of [-8, 8]) osc(ctx, "sawtooth", f, t, duree + 0.5, g, d);
}

// --- Le chef d'orchestre ---

let actuel: Morceau | null = null;
let voulu: { graine: number; cahier: number; boss: boolean } = { graine: 0, cahier: 0, boss: false };
let cle = "";
let ambianceActuelle: Ambiance = "silence";
let danger = 0;
let pas = 0;
let prochain = 0;
let minuterie: ReturnType<typeof setInterval> | null = null;

function preparer(): { ctx: AudioContext; bruit: AudioBuffer; sortie: GainNode } | null {
  const c = contexte();
  if (!c) return null;
  if (!couches) {
    couches = {} as Record<Couche, GainNode>;
    for (const k of COUCHES) {
      const g = c.ctx.createGain();
      g.gain.value = 0;
      g.connect(c.sortie);
      couches[k] = g;
    }
    prochain = c.ctx.currentTime + 0.1;
  }
  return c;
}

function jouerPas(ctx: AudioContext, bruit: AudioBuffer, t: number): void {
  if (!actuel || !couches) return;
  const m = actuel;
  const p = pas % 16;
  const mesure = Math.floor(pas / 16) % 8;
  const accord = m.style.grille[mesure % 4];
  const duPas = 60 / m.style.tempo / 4;
  const amb = ambianceActuelle;
  const pousse = amb === "vague" || amb === "boss";
  // Une couche muette ne joue pas : autant d'oscillateurs en moins sur le téléphone
  const on = (k: Couche) => MIX[amb][k] > 0;
  // La mélodie
  if (on("melodie")) for (const n of m.melodie[mesure]) if (n.pas === p) boite(ctx, freq(noteDe(m, n.degre, 1)), t, n.duree * duPas, 0.16, couches.melodie);
  // L'arpège, en croches
  if (on("arpege") && p % 2 === 0) {
    const motif = [0, 2, 4, 2, 7, 4, 2, 4];
    pizz(ctx, freq(noteDe(m, accord + motif[(p / 2) % 8], 0)), t, 0.07, couches.arpege);
  }
  // La basse : des blanches au calme, des croches qui poussent pendant la vague
  if (on("basse") && (pousse ? p % 2 === 0 : p % 8 === 0)) {
    const quinte = pousse && p % 8 === 6;
    basse(ctx, freq(noteDe(m, accord + (quinte ? 4 : 0), -2)), t, pousse ? duPas * 1.8 : duPas * 7, 0.3, couches.basse);
  }
  // La batterie
  if (on("batterie")) {
    if (p === 0 || p === 8 || (mesure % 2 === 1 && p === 10)) grosseCaisse(ctx, t, couches.batterie);
    if (p === 4 || p === 12) {
      bruitFiltre(ctx, bruit, t, "bandpass", 1900, 0.8, 0.35, 0.13, couches.batterie);
      osc(ctx, "triangle", 190, t, 0.06, enveloppe(ctx, t, 0.15, 0.002, 0.06, couches.batterie));
    }
    if (p % 2 === 0 || danger > 0.5) bruitFiltre(ctx, bruit, t, "highpass", 7500, 0.7, p % 4 === 2 ? 0.12 : 0.07, 0.035, couches.batterie);
  }
  // Le crayon qui tapote sur la table
  if (on("crayon") && (p % 4 === 2 || (p === 15 && mesure % 2 === 0))) bruitFiltre(ctx, bruit, t, "bandpass", 3300, 5, 0.25, 0.02, couches.crayon);
  // La nappe des boss, une par mesure
  if (on("nappe") && p === 0 && m.boss) nappe(ctx, [0, 2, 4].map((k) => freq(noteDe(m, accord + k, -1))), t, duPas * 16, couches.nappe);
}

function tic(): void {
  const c = preparer();
  if (!c) return;
  const { ctx, bruit } = c;
  // Si l'onglet dormait, on ne rattrape pas : on repart d'ici
  if (prochain < ctx.currentTime - 0.2) prochain = ctx.currentTime + 0.05;
  while (prochain < ctx.currentTime + 0.15) {
    // On change de morceau en début de mesure seulement
    const k = `${voulu.graine}/${voulu.cahier}/${voulu.boss}`;
    if (k !== cle && pas % 16 === 0) {
      actuel = composer(voulu.graine, voulu.cahier, voulu.boss);
      cle = k;
      pas = 0;
    }
    if (ambianceActuelle !== "silence") jouerPas(ctx, bruit, prochain);
    const m = actuel;
    const duPas = 60 / (m?.style.tempo ?? 90) / 4;
    const swing = m && pas % 2 === 0 ? m.style.swing : m ? -m.style.swing : 0;
    prochain += duPas * (1 + swing);
    pas++;
  }
}

/** À appeler à chaque image : ce qui se passe à l'écran. Les couches se fondent, le morceau change à la mesure. */
export function ambiance(a: Ambiance, o: { graine: number; cahier: number; danger?: number }): void {
  voulu = { graine: o.graine, cahier: o.cahier, boss: a === "boss" };
  danger = o.danger ?? 0;
  if (!minuterie) minuterie = setInterval(tic, 25);
  const c = preparer();
  if (!c || !couches) return;
  if (a === ambianceActuelle) return;
  ambianceActuelle = a;
  const t = c.ctx.currentTime;
  for (const k of COUCHES) couches[k].gain.setTargetAtTime(MIX[a][k], t, a === "silence" ? 0.3 : 0.9);
}

/** Les quelques notes de fin de page. */
export function jingle(k: "gagne" | "perdu"): void {
  const c = preparer();
  if (!c || !couches) return;
  const t = c.ctx.currentTime + 0.05;
  const notes = k === "gagne" ? [60, 64, 67, 72, 76, 79, 84] : [67, 63, 60, 55, 51];
  // Hors des couches : la fin se fait entendre même quand la musique se tait
  notes.forEach((n, i) => boite(c.ctx, freq(n), t + i * (k === "gagne" ? 0.09 : 0.2), k === "gagne" ? 0.5 : 0.8, 0.2, c.sortie));
}
