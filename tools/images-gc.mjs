// Les images des succès Game Center (1024 × 1024) : une médaille au stylo sur papier, avec le symbole du succès.
//   node tools/images-gc.mjs      (Playwright et Chrome : PLAYWRIGHT=… pour un autre chemin)
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ICI = new URL(".", import.meta.url).pathname;
const { chromium } = await import(process.env.PLAYWRIGHT ?? "/Users/meff/panache/node_modules/playwright-core/index.mjs");
const gc = JSON.parse(readFileSync(join(ICI, "fiche/gamecenter.json"), "utf8"));
const police = (f) => `data:font/woff2;base64,${readFileSync(join(ICI, "../node_modules/@fontsource", f)).toString("base64")}`;
const html = `<html><head><style>
@font-face { font-family: Caveat; font-weight: 700; src: url(${police("caveat/files/caveat-latin-700-normal.woff2")}); }
body { margin: 0; }
</style></head><body><canvas id="c" width="1024" height="1024"></canvas></body></html>`;
const b = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
const page = await b.newPage({ viewport: { width: 1024, height: 1024 } });
await page.setContent(html);
await page.evaluate(() => document.fonts.load("700 100px Caveat"));
for (const s of gc.succes) {
  const png = await page.evaluate(({ symbole, points, id }) => {
    const c = document.getElementById("c");
    const ctx = c.getContext("2d");
    let g = [...id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
    const alea = () => ((g = (g * 1103515245 + 12345) >>> 0) / 2 ** 32);
    // Le papier Seyès
    ctx.fillStyle = "#f6efdc";
    ctx.fillRect(0, 0, 1024, 1024);
    for (let y = 40; y < 1024; y += 40) {
      ctx.strokeStyle = y % 160 === 0 ? "rgba(80,120,190,0.35)" : "rgba(80,120,190,0.18)";
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1024, y); ctx.stroke();
    }
    ctx.strokeStyle = "rgba(200,60,60,0.5)"; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(130, 0); ctx.lineTo(130, 1024); ctx.stroke();
    // La médaille : plusieurs tours de stylo bille, un peu tremblés
    const or = points >= 50;
    ctx.fillStyle = or ? "rgba(236,190,70,0.6)" : "rgba(255,251,238,0.95)";
    ctx.beginPath(); ctx.arc(512, 512, 360, 0, Math.PI * 2); ctx.fill();
    for (let k = 0; k < 4; k++) {
      ctx.strokeStyle = k < 2 ? "#22408f" : "rgba(34,64,143,0.5)";
      ctx.lineWidth = k < 2 ? 14 : 7;
      ctx.beginPath();
      const r0 = 370 + k * 12;
      for (let i = 0; i <= 80; i++) {
        const a = (i / 80) * Math.PI * 2 + k;
        const r = r0 + (alea() - 0.5) * 10;
        i ? ctx.lineTo(512 + Math.cos(a) * r, 512 + Math.sin(a) * r) : ctx.moveTo(512 + Math.cos(a) * r, 512 + Math.sin(a) * r);
      }
      ctx.stroke();
    }
    // Le symbole, au stylo (le Point Final : un gros point d'encre)
    if (symbole === ".") {
      ctx.fillStyle = "#c4302b";
      ctx.beginPath(); ctx.arc(512, 530, 120, 0, Math.PI * 2); ctx.fill();
      return c.toDataURL("image/png").split(",")[1];
    }
    const taille = symbole.length <= 2 ? 440 : symbole.length <= 3 ? 330 : 230;
    ctx.font = `700 ${taille}px Caveat, "Apple Symbols", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    const m = ctx.measureText(symbole);
    const y = 512 + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
    for (let k = 0; k < 2; k++) {
      ctx.fillStyle = k ? "#c4302b" : "rgba(196,48,43,0.35)";
      ctx.fillText(symbole, 512 + (k ? 0 : 7), y + (k ? 0 : 6));
    }
    return c.toDataURL("image/png").split(",")[1];
  }, s);
  writeFileSync(join(ICI, "fiche/gamecenter", `${s.id}.png`), Buffer.from(png, "base64"));
}
await b.close();
console.log(`${gc.succes.length} images`);
