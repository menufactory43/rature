// Les captures d'écran de la fiche App Store, en français et en anglais, pour l'iPhone 6,7" (1290 × 2796) et
// l'iPad 12,9" (2048 × 2732). Il faut le serveur de développement (npm run dev, port 5191).
//   node tools/captures.mjs          → tools/fiche/captures/<fr|en>/<iphone|ipad>-N.png
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const ICI = new URL(".", import.meta.url).pathname;
const { chromium } = await import(process.env.PLAYWRIGHT ?? "/Users/meff/panache/node_modules/playwright-core/index.mjs");
const URL_JEU = process.env.JEU ?? "http://127.0.0.1:5191/";
const APPAREILS = {
  iphone: { viewport: { width: 430, height: 932 }, dpr: 3, encoches: "59px 0px 34px 0px" },
  ipad: { viewport: { width: 1024, height: 1366 }, dpr: 2, encoches: "24px 0px 20px 0px" },
};
const DITS = ["presentation", "heros-intro", "intro-campagne", "intro-talents", "intro-trousse", "intro-reglages", "intro-aide", "intro-coop"];

const b = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
for (const langue of ["fr", "en"]) {
  for (const [nom, a] of Object.entries(APPAREILS)) {
    const dossier = join(ICI, "fiche/captures", langue);
    mkdirSync(dossier, { recursive: true });
    const page = await b.newPage({ viewport: a.viewport, deviceScaleFactor: a.dpr });
    page.on("pageerror", (e) => console.log("ERR", e.message));
    // Une partie bien avancée : tout débloqué, toutes les pages gagnées (pas de conseils), Bille déjà présentée
    const preparer = async (o = {}) => {
      await page.goto(URL_JEU);
      await page.evaluate(({ langue, DITS, o }) => {
        localStorage.clear();
        if (!o.tutoNonVu) localStorage.setItem("rature.tuto", "vu");
        localStorage.setItem("rature.reglages", JSON.stringify({ langue, musique: 0, effets: 0 }));
        localStorage.setItem("rature.bille", JSON.stringify(DITS));
        const et = {};
        for (const c of [1, 2, 3, 4]) for (let i = 1; i <= 5; i++) et[`${c}-${i}`] = o.vierge ? 0 : c < 4 || i < 3 ? 3 : 2;
        if (o.vierge) return;
        localStorage.setItem("rature.sauvegarde.v2", JSON.stringify({
          etoiles: et, defis: { "1-1": true, "1-2": true }, talents: { encre: 2, vies: 1 },
          appris: ["plume", "roquette", "foudre", "spirale", "correction", "scie", "encrier", "tuto"],
          vus: ["gribouille", "carre", "avion", "araignee", "tache", "petite", "gomme", "postit", "fantome", "tippex", "punaise", "mere", "compas", "taille", "point"],
          jour: {}, sansFin: { "1-3": 34 }, interro: 18, succes: [],
        }));
      }, { langue, DITS, o });
      await page.reload();
      await page.evaluate((p) => { document.querySelector('div[style*="safe-area"]').style.padding = p; }, a.encoches);
      await page.waitForTimeout(900);
    };
    const shot = async (n) => {
      await page.screenshot({ path: join(dossier, `${nom}-${n}.png`) });
      console.log(langue, nom, n);
    };
    const carte = (x, y) => page.evaluate(([x, y]) => { const q = window.rature.vue.carte.transformPoint({ x, y: y + 60 }); return [q.x / window.rature.vue.dpr, q.y / window.rature.vue.dpr]; }, [x, y]);
    const menu = (x, y) => page.evaluate(([x, y]) => { const q = window.rature.vue.menu.transformPoint({ x, y }); return [q.x / window.rature.vue.dpr, q.y / window.rature.vue.dpr]; }, [x, y]);

    /** Une page en pleine bataille : des tours le long du chemin, une vague lancée, Bille au contact. */
    const bataille = async (id, tours, attente, o = {}) => {
      await page.evaluate((id) => window.rature.jouerPage(window.rature.pages.find((p) => p.id === id), "campagne"), id);
      await page.waitForTimeout(600);
      await page.evaluate(({ tours, o }) => {
        const r = window.rature;
        const p = r.partie;
        const j = p.jeu;
        p.fiches = [];
        j.encre = 5000;
        const chemin = j.trajets[0];
        // Les tours de part et d'autre du chemin, en avançant vers le Cœur
        tours.forEach((type, i) => {
          const q = chemin[Math.floor(((i + 1) / (tours.length + 1)) * chemin.length)];
          for (const d of [34, -34, 44, -44, 56, -56]) {
            const res = r.sim.poserTour(j, type, Math.max(20, Math.min(380, q.x + d)), Math.max(20, Math.min(700, q.y + (i % 2 ? d / 3 : -d / 3))));
            if (res.ok) {
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
      await page.waitForTimeout(attente);
      await page.evaluate(() => { window.rature.partie.vitesse = 1; });
    };

    // 1. Le titre
    await preparer();
    await page.waitForTimeout(2200);
    await shot(1);
    // 2. Une bataille dans le cahier de brouillon
    await preparer();
    await bataille("1-3", ["plume", "roquette", "foudre", "plume", "spirale"], 5200);
    await shot(2);
    // 3. Un boss dans le cahier de musique
    await preparer();
    await bataille("3-5", ["correction", "roquette", "foudre", "scie", "encrier", "roquette"], 7000, { vague: 25, encre: 488 });
    await shot(3);
    // 4. Les cahiers
    await preparer();
    await page.evaluate(() => window.rature.aller("campagne"));
    await page.waitForTimeout(600);
    await page.mouse.click(...(await menu(10 + 3 * 96 + 45, 108)));
    await page.waitForTimeout(500);
    await page.mouse.click(...(await menu(200, 186 + 92 + 40)));
    await page.waitForTimeout(700);
    await shot(4);
    // 5. Le tutoriel avec Bille
    await preparer({ tutoNonVu: true, vierge: true });
    await page.waitForTimeout(1600);
    await page.mouse.click(...(await menu(44, 210)));
    await page.waitForTimeout(800);
    for (let k = 0; k < 4; k++) {
      await page.mouse.click(...(await carte(200, 360)));
      await page.waitForTimeout(800);
    }
    await page.waitForTimeout(1400);
    await shot(5);
    await page.close();
  }
}
await b.close();
