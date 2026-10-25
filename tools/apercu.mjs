// La vidéo d'aperçu de la fiche App Store (iPhone 6,9" : 886 × 1920, 30 i/s, 15 à 30 s), en français et en anglais.
// Il faut le serveur de développement (npm run dev, port 5191).
//   node tools/apercu.mjs          → tools/fiche/apercu/<fr|en>/iphone.mp4
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const ICI = new URL(".", import.meta.url).pathname;
const { chromium } = await import(process.env.PLAYWRIGHT ?? "/Users/meff/panache/node_modules/playwright-core/index.mjs");
const URL_JEU = process.env.JEU ?? "http://127.0.0.1:5191/";
const DITS = ["presentation", "heros-intro", "intro-campagne", "intro-talents", "intro-trousse", "intro-reglages", "intro-aide", "intro-coop"];
const TAILLE = { width: 443, height: 960 };

const b = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
for (const langue of ["fr", "en"]) {
  const dossier = join(ICI, "fiche/apercu", langue);
  const brut = join("/tmp/rature-apercu", langue);
  rmSync(brut, { recursive: true, force: true });
  mkdirSync(dossier, { recursive: true });
  // On prépare la sauvegarde hors caméra, puis une seconde page filme
  const prep = await b.newContext({ viewport: TAILLE, deviceScaleFactor: 2 });
  const p0 = await prep.newPage();
  await p0.goto(URL_JEU);
  const etat = await p0.evaluate(({ langue, DITS }) => {
    const et = {};
    for (const c of [1, 2, 3, 4]) for (let i = 1; i <= 5; i++) et[`${c}-${i}`] = c < 4 || i < 3 ? 3 : 2;
    return {
      "rature.tuto": "vu",
      "rature.reglages": JSON.stringify({ langue, musique: 0, effets: 0, bille: true }),
      "rature.bille": JSON.stringify(DITS),
      "rature.sauvegarde.v2": JSON.stringify({
        etoiles: et, defis: { "1-1": true }, talents: { encre: 2, vies: 1 },
        appris: ["plume", "roquette", "foudre", "spirale", "correction", "scie", "encrier", "tuto"],
        vus: ["gribouille", "carre", "avion", "araignee", "tache", "petite", "gomme", "postit", "fantome", "tippex", "punaise", "mere", "compas", "taille", "point", "oe"],
        jour: {}, sansFin: {}, interro: 0, succes: [],
      }),
    };
  }, { langue, DITS });
  await prep.close();

  // L'horloge de la page est figée : on la fait avancer d'une image à la fois et on photographie chaque image
  const ctx = await b.newContext({ viewport: TAILLE, deviceScaleFactor: 2 });
  await ctx.addInitScript((etat) => { if (!sessionStorage.getItem("fait")) { localStorage.clear(); for (const [k, v] of Object.entries(etat)) localStorage.setItem(k, v); sessionStorage.setItem("fait", "1"); } }, etat);
  const page = await ctx.newPage();
  await page.clock.install();
  await page.goto(URL_JEU);
  await page.evaluate(() => { document.querySelector('div[style*="safe-area"]').style.padding = "0px"; });
  await page.clock.runFor(1500);
  const sortie = join(dossier, "iphone.mp4");
  const images = join(brut, "images");
  mkdirSync(images, { recursive: true });
  let n = 0;
  /** Filme `ms` millisecondes ; `geste` reçoit le numéro d'image et peut bouger la souris. */
  const filmer = async (ms, geste) => {
    const fin = n + Math.round((ms / 1000) * 30);
    for (let k = 0; n < fin; k++, n++) {
      if (geste) await geste(k);
      await page.clock.runFor(1000 / 30);
      await page.screenshot({ path: join(images, `${String(n).padStart(4, "0")}.jpg`), type: "jpeg", quality: 92 });
    }
  };
  const avancer = (ms) => page.clock.runFor(ms);

  const ecran = (x, y, m = "carte") => page.evaluate(([x, y, m]) => { const v = window.rature.vue; const q = v[m].transformPoint({ x, y }); return [q.x / v.dpr, q.y / v.dpr]; }, [x, y, m]);
  /** Des ratures à la main à travers les monstres les plus avancés, une toutes les `periode` images. */
  const raturer = (periode) => {
    let pts = [];
    return async (k) => {
      const i = k % periode;
      if (i === 0) {
        const c = await page.evaluate(() => window.rature.partie.jeu.ennemis.filter((e) => !e.mort && e.y > 120).map((e) => [e.x, e.y])[0]);
        if (!c) return;
        const [x, y] = c;
        const coins = [[x - 30, y - 24], [x + 30, y + 24], [x - 26, y + 10], [x + 28, y - 14]];
        pts = [];
        for (let s = 0; s < coins.length - 1; s++) for (let u = 0; u < 4; u++) {
          const [a, b2] = coins[s], [c2, d] = coins[s + 1];
          pts.push(await ecran(a + ((c2 - a) * u) / 4, b2 + ((d - b2) * u) / 4));
        }
        pts.push(await ecran(...coins[coins.length - 1]));
        await page.mouse.move(...pts[0]);
        await page.mouse.down();
      } else if (i < pts.length) await page.mouse.move(...pts[i]);
      else if (i === pts.length) await page.mouse.up();
    };
  };
  const bataille = async (id, tours, o = {}) => {
    await page.evaluate((id) => window.rature.jouerPage(window.rature.pages.find((p) => p.id === id), "campagne"), id);
    await avancer(300);
    await page.evaluate(({ tours, o }) => {
      const r = window.rature;
      const p = r.partie;
      const j = p.jeu;
      p.fiches = [];
      j.encre = 5000;
      const chemin = j.trajets[0];
      tours.forEach((type, i) => {
        const q = chemin[Math.floor(((i + 1) / (tours.length + 1)) * chemin.length)];
        for (const d of [34, -34, 44, -44, 56, -56]) {
          if (r.sim.poserTour(j, type, Math.max(20, Math.min(380, q.x + d)), Math.max(20, Math.min(700, q.y + (i % 2 ? d / 3 : -d / 3)))).ok) {
            const t = j.tours[j.tours.length - 1];
            for (let k = 0; k < (i % 3) + 1; k++) r.sim.ameliorer(j, t);
            break;
          }
        }
      });
      if (j.heros) {
        const q = chemin[Math.floor(chemin.length * 0.45)];
        j.heros.x = q.x + 6;
        j.heros.y = q.y;
        j.heros.niveau = 3;
      }
      if (o.vague) j.vague = o.vague - 1;
      j.encre = o.encre ?? 312;
      r.sim.lancerVague(j);
      p.vitesse = 2;
    }, { tours, o });
  };

  // 1. Le titre, Bille qui salue
  await filmer(2600);
  // 2. Une bataille : les tours tirent, on rature à la main
  await bataille("1-3", ["plume", "roquette", "foudre", "plume", "spirale"]);
  await filmer(1500);
  await filmer(6500, raturer(40));
  // 3. Le boss du cahier de musique (Bille se tait : sa bulle cacherait le boss)
  await bataille("3-5", ["correction", "roquette", "foudre", "scie", "encrier", "roquette"], { vague: 25, encre: 488 });
  await avancer(2500);
  const muette = raturer(42);
  await filmer(7500, async (k) => { await page.evaluate(() => { const j = window.rature.partie.jeu; j.vies = Math.max(j.vies, 18); window.rature.taire(); }); await muette(k); });
  // 4. Les cahiers
  await page.evaluate(() => { window.rature.partie = null; window.rature.aller("campagne"); });
  await avancer(300);
  await page.mouse.click(...(await ecran(10 + 3 * 96 + 45, 108, "menu")));
  await filmer(3000);
  await ctx.close();

  const duree = n / 30;
  console.log(langue, `${n} images → ${duree.toFixed(1)} s`);
  execFileSync("ffmpeg", [
    "-loglevel", "error", "-y", "-framerate", "30", "-i", join(images, "%04d.jpg"), "-i", join(ICI, "../public/sons/musique-vague.mp3"),
    "-filter_complex", `[0:v]scale=886:1920:flags=lanczos,setsar=1,format=yuv420p[v];[1:a]atrim=0:${duree.toFixed(2)},afade=t=out:st=${(duree - 1.2).toFixed(2)}:d=1.2,aresample=44100[a]`,
    "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-profile:v", "high", "-level", "4.0", "-r", "30", "-b:v", "10M",
    "-c:a", "aac", "-b:a", "256k", "-ac", "2", "-shortest", sortie,
  ]);
}
await b.close();
