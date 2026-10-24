// Les sons de Rature, enregistrés une fois par ElevenLabs (effets sonores et musique), puis nettoyés par ffmpeg :
// silence coupé au début et à la fin, volume égalisé, mono pour les effets. Les fichiers finis vont dans public/sons.
//   ELEVENLABS_API_KEY=… node tools/sons.mjs [nom…]   (sans nom : tout ce qui manque)
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from "node:fs";

const CLE = process.env.ELEVENLABS_API_KEY;
if (!CLE) throw new Error("ELEVENLABS_API_KEY manquante");
const BRUT = "/tmp/rature-sons/brut";
const FINI = new URL("../public/sons/", import.meta.url).pathname;
mkdirSync(BRUT, { recursive: true });
mkdirSync(FINI, { recursive: true });

const SEC = "close-up foley, dry, no music, no reverb";
/** Les effets : [nom, description, durée en secondes, variantes]. */
const EFFETS = [
  ["gratte", `continuous ballpoint pen writing on a paper notebook, steady scratching strokes, ${SEC}`, 4, 1, { loop: true }],
  ["pose", `a ballpoint pen draws a tiny symbol on paper then taps the page once, satisfying, ${SEC}`, 0.7, 3],
  ["tir", `a very short soft flick of paper, tiny tick, ${SEC}`, 0.5, 3],
  ["pop", `a small soft cartoon pop, like an ink bubble bursting, ${SEC}`, 0.5, 3],
  ["aie", `a quick short rip of a notebook page tearing, ${SEC}`, 0.7, 2],
  ["casse", `a pencil lead snapping, small dry crack, ${SEC}`, 0.5, 3],
  ["boom", `a muffled thump of a heavy book dropped on a wooden desk, ${SEC}`, 0.9, 2],
  ["zap", `a short crackling electric spark zap, small, ${SEC}`, 0.6, 2],
  ["rate", `a rubber eraser squeaking quickly on paper, short, ${SEC}`, 0.6, 2],
  ["rature", `a fast aggressive ballpoint pen scribble crossing out a word, back and forth, ${SEC}`, 0.7, 3],
  ["mur", `a ballpoint pen pressing hard and drawing one long firm line on paper, ${SEC}`, 0.8, 2],
  ["colle", `a glue stick being rolled and squished onto paper, sticky, ${SEC}`, 0.7, 2],
  ["sec", `a dry empty ballpoint pen scratching paper with no ink, squeaky, ${SEC}`, 0.6, 2],
  ["page", `turning one page of a paper school notebook, crisp paper rustle, ${SEC}`, 1, 3],
  ["refus", `a short soft knock of a pen on a wooden desk, two taps, ${SEC}`, 0.5, 2],
  ["vague", `a small brass school hand bell rung twice, short, ${SEC}`, 1.6, 1],
  ["ding", `a single bright small triangle ding, reward chime`, 1.2, 2],
  ["coche", `a pen quickly ticking a checkbox on paper, one quick tick, ${SEC}`, 0.5, 2],
  ["boss", `an ominous low cello and timpani stinger, dramatic, short`, 2.2, 1],
];

/** La musique : [nom, description, durée en secondes]. Les ambiances d'une partie se fondent l'une dans l'autre. */
const STYLE = "instrumental only, no vocals, hand-made feel, warm and intimate, recorded in a small room";
const MUSIQUES = [
  ["menu", `Gentle whimsical music box melody with soft pizzicato strings and a felt piano, a pencil tapping lightly as percussion, playful schoolroom daydream, 84 bpm, C major, ${STYLE}, seamless loop`, 60],
  ["calme", `Calm playful study music: plucked ukulele, felt piano and glockenspiel, light brushed shaker, curious and focused, 96 bpm, C major, ${STYLE}, seamless loop`, 60],
  ["vague", `Energetic quirky march: pizzicato strings, staccato bassoon, upright bass, snare drum played with brushes, hand claps and pencil taps, tense but fun, 120 bpm, C minor, ${STYLE}, seamless loop`, 60],
  ["boss", `Dramatic mischievous boss theme: low cello ostinato, timpani, tuba, staccato strings and a slightly out of tune upright piano, menacing but cartoonish, 120 bpm, C minor, ${STYLE}, seamless loop`, 50],
  ["gagne", `Short triumphant fanfare jingle on glockenspiel, pizzicato strings and a toy trumpet, joyful ending, ${STYLE}`, 6],
  ["perdu", `Short sad comedic jingle: descending muted trombone and a soft piano, a little deflated ending, ${STYLE}`, 6],
];

async function demander(url, corps) {
  for (let essai = 0; essai < 3; essai++) {
    const r = await fetch(url, { method: "POST", headers: { "xi-api-key": CLE, "Content-Type": "application/json" }, body: JSON.stringify(corps) });
    if (r.ok) return { audio: Buffer.from(await r.arrayBuffer()), cout: r.headers.get("character-cost") };
    const t = await r.text();
    if (r.status < 500 && r.status !== 429) throw new Error(`${r.status} ${t.slice(0, 200)}`);
    await new Promise((ok) => setTimeout(ok, 3000 * (essai + 1)));
  }
  throw new Error("trop d'échecs");
}

const ff = (...args) => execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args]);

/** Mono, crête ramenée à −1 dB, puis le silence coupé aux deux bouts (sauf une boucle) et une fin adoucie. */
function traiter(brut, fini, boucle) {
  const sortie = spawnSync("ffmpeg", ["-hide_banner", "-i", brut, "-af", "volumedetect", "-f", "null", "-"]).stderr.toString();
  const crete = Number(/max_volume: (-?[\d.]+) dB/.exec(sortie)?.[1] ?? 0);
  const gain = `volume=${(-1 - crete).toFixed(1)}dB`;
  const coupe = "silenceremove=start_periods=1:start_threshold=-36dB:start_silence=0.004,areverse,silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.03,afade=t=in:d=0.02,areverse";
  const tmp = `${fini}.tmp.wav`;
  ff("-i", brut, "-ac", "1", "-af", boucle ? gain : `${gain},${coupe}`, "-ar", "44100", tmp);
  // Puis le niveau moyen ramené vers −20 dB, un limiteur gardant la crête sous −1 dB
  const m = spawnSync("ffmpeg", ["-hide_banner", "-i", tmp, "-af", "volumedetect", "-f", "null", "-"]).stderr.toString();
  const moyen = Number(/mean_volume: (-?[\d.]+) dB/.exec(m)?.[1] ?? -20);
  ff("-i", tmp, "-af", `volume=${Math.min(10, -20 - moyen).toFixed(1)}dB,alimiter=limit=0.89:attack=1:release=30:level=false`, "-b:a", "96k", fini);
  unlinkSync(tmp);
}

/** Les variantes reçues qui ne sont qu'un clic. */
const REJETS = ["mur0", "pose2", "refus0"];

const refaire = process.argv[2] === "--refaire";
if (refaire) {
  // Retraite les fichiers bruts déjà reçus, sans rien redemander
  // Les variantes ratées (un simple clic) sont écartées, les autres renumérotées
  for (const [nom, , , n, extra = {}] of EFFETS) {
    const gardees = Array.from({ length: n }, (_, i) => i).filter((i) => !REJETS.includes(`${nom}${i}`));
    for (let i = 0; i < n; i++) if (existsSync(`${FINI}${nom}${i}.mp3`)) unlinkSync(`${FINI}${nom}${i}.mp3`);
    gardees.forEach((i, k) => traiter(`${BRUT}/${nom}${i}.mp3`, `${FINI}${nom}${gardees.length > 1 ? k : ""}.mp3`, !!extra.loop));
  }
  process.exit(0);
}

const voulus = process.argv.slice(2);
const garde = (nom) => !voulus.length || voulus.includes(nom);

for (const [nom, texte, duree, n, extra = {}] of EFFETS) {
  if (!garde(nom)) continue;
  for (let i = 0; i < n; i++) {
    const fini = `${FINI}${nom}${n > 1 ? i : ""}.mp3`;
    if (existsSync(fini) && !voulus.length) continue;
    const { audio, cout } = await demander("https://api.elevenlabs.io/v1/sound-generation", { text: texte, duration_seconds: duree, prompt_influence: 0.55, model_id: "eleven_text_to_sound_v2", ...extra });
    const brut = `${BRUT}/${nom}${i}.mp3`;
    writeFileSync(brut, audio);
    traiter(brut, fini, !!extra.loop);
    console.log(nom, i, `coût ${cout}`);
  }
}

for (const [nom, texte, duree] of MUSIQUES) {
  if (!garde(nom)) continue;
  const fini = `${FINI}musique-${nom}.mp3`;
  if (existsSync(fini) && !voulus.length) continue;
  const { audio, cout } = await demander("https://api.elevenlabs.io/v1/music", { prompt: texte, music_length_ms: duree * 1000 });
  const brut = `${BRUT}/musique-${nom}.mp3`;
  writeFileSync(brut, audio);
  ff("-i", brut, "-af", "loudnorm=I=-20:TP=-2:LRA=11", "-ar", "44100", "-b:a", "128k", fini);
  console.log("musique", nom, `coût ${cout}`);
}
