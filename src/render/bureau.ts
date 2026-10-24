// Le bureau d'écolier autour du cahier : le bois, la lumière de la lampe, et ce qui traîne à côté (crayon, gomme,
// taille-crayon, trousse) quand l'écran laisse de la place. Dessiné une fois par taille d'écran.
import { hash3 } from "../sim/rng";

export interface Cadre {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** La couverture du cahier, selon le cahier (brouillon rouge, maths bleu, musique vert). */
export const COUVERTURES: Record<number, string> = { 0: "#b8433a", 1: "#b8433a", 2: "#2f5f9e", 3: "#3d7a4a" };

function bois(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const fond = ctx.createLinearGradient(0, 0, w, h);
  fond.addColorStop(0, "#b98450");
  fond.addColorStop(1, "#8f5c31");
  ctx.fillStyle = fond;
  ctx.fillRect(0, 0, w, h);
  // Des lattes verticales, chacune avec son ton et son veinage
  const latte = Math.max(90, w / 6);
  for (let k = 0; k * latte < w; k++) {
    const x0 = k * latte;
    ctx.fillStyle = `rgba(${hash3(k, 1, 7) < 0.5 ? "255,220,170" : "60,30,10"},${0.04 + hash3(k, 2, 7) * 0.06})`;
    ctx.fillRect(x0, 0, latte, h);
    ctx.lineWidth = 1;
    for (let i = 0; i < latte / 5; i++) {
      const xi = x0 + hash3(k, i, 3) * latte;
      const amp = 2 + hash3(k, i, 4) * 6;
      const freq = 0.004 + hash3(k, i, 5) * 0.01;
      ctx.strokeStyle = `rgba(70,35,12,${0.05 + hash3(k, i, 6) * 0.12})`;
      ctx.beginPath();
      for (let y = 0; y <= h; y += 12) {
        const x = xi + Math.sin(y * freq + k * 3 + i) * amp + Math.sin(y * freq * 3.1 + i) * amp * 0.25;
        if (y === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // Un nœud de temps en temps
    if (hash3(k, 9, 9) < 0.6) {
      const nx = x0 + latte * (0.3 + hash3(k, 10, 9) * 0.4);
      const ny = hash3(k, 11, 9) * h;
      for (let r = 3; r < 22; r += 3.5) {
        ctx.strokeStyle = `rgba(60,28,8,${0.18 - r * 0.006})`;
        ctx.beginPath();
        ctx.ellipse(nx, ny, r * 0.6, r * 1.6, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    // La rainure entre deux lattes
    ctx.fillStyle = "rgba(40,20,5,0.35)";
    ctx.fillRect(x0, 0, 1.5, h);
    ctx.fillStyle = "rgba(255,230,190,0.12)";
    ctx.fillRect(x0 + 1.5, 0, 1, h);
  }
}

/** Un crayon à papier jaune, taillé, posé de biais. */
function crayon(ctx: CanvasRenderingContext2D, x: number, y: number, l: number, angle: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const e = l * 0.075;
  ctx.fillStyle = "rgba(30,15,5,0.3)";
  ctx.fillRect(-l / 2 + 5, -e / 2 + 6, l, e);
  // Le corps à pans, la ferrule et la gomme, la pointe taillée
  ctx.fillStyle = "#e9b82c";
  ctx.fillRect(-l / 2 + e * 1.6, -e / 2, l - e * 3.6, e);
  ctx.fillStyle = "#f6d35c";
  ctx.fillRect(-l / 2 + e * 1.6, -e / 2, l - e * 3.6, e * 0.3);
  ctx.fillStyle = "#c99a1c";
  ctx.fillRect(-l / 2 + e * 1.6, e * 0.2, l - e * 3.6, e * 0.3);
  ctx.fillStyle = "#b8b8b8";
  ctx.fillRect(-l / 2 + e * 0.8, -e / 2, e * 0.8, e);
  ctx.fillStyle = "#e58b93";
  ctx.fillRect(-l / 2, -e / 2, e * 0.8, e);
  ctx.fillStyle = "#e8cfa3";
  ctx.beginPath();
  ctx.moveTo(l / 2 - e * 2, -e / 2);
  ctx.lineTo(l / 2, 0);
  ctx.lineTo(l / 2 - e * 2, e / 2);
  ctx.fill();
  ctx.fillStyle = "#3a3a3a";
  ctx.beginPath();
  ctx.moveTo(l / 2 - e * 0.7, -e * 0.18);
  ctx.lineTo(l / 2, 0);
  ctx.lineTo(l / 2 - e * 0.7, e * 0.18);
  ctx.fill();
  ctx.restore();
}

/** Une gomme blanche, avec son étui en carton. */
function gommeBlanche(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, angle: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = "rgba(30,15,5,0.3)";
  ctx.fillRect(-s + 4, -s * 0.45 + 5, s * 2, s * 0.9);
  ctx.fillStyle = "#f4f1ea";
  ctx.fillRect(-s, -s * 0.45, s * 2, s * 0.9);
  ctx.fillStyle = "#2c5aa0";
  ctx.fillRect(-s * 0.35, -s * 0.47, s * 1.35, s * 0.94);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = `700 ${s * 0.32}px "Patrick Hand", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("GOMME", s * 0.32, 1);
  ctx.restore();
}

/** Le taille-crayon en métal. */
function tailleCrayon(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, angle: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = "rgba(30,15,5,0.3)";
  ctx.fillRect(-s / 2 + 3, -s * 0.35 + 4, s, s * 0.7);
  const g = ctx.createLinearGradient(0, -s * 0.35, 0, s * 0.35);
  g.addColorStop(0, "#d9dde2");
  g.addColorStop(0.5, "#9aa1aa");
  g.addColorStop(1, "#c7ccd2");
  ctx.fillStyle = g;
  ctx.fillRect(-s / 2, -s * 0.35, s, s * 0.7);
  ctx.fillStyle = "#555b63";
  ctx.beginPath();
  ctx.arc(-s * 0.15, 0, s * 0.16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#c0c4ca";
  ctx.fillRect(s * 0.08, -s * 0.3, s * 0.32, s * 0.12);
  ctx.restore();
}

/** Le coin d'une trousse en tissu, avec sa fermeture éclair. */
function trousse(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, angle: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = "rgba(30,15,5,0.35)";
  ctx.beginPath();
  ctx.roundRect(-w / 2 + 6, -h / 2 + 8, w, h, h * 0.35);
  ctx.fill();
  const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
  g.addColorStop(0, "#4b6fa8");
  g.addColorStop(1, "#2f4f82");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, h * 0.35);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.roundRect(-w / 2 + 5, -h / 2 + 5, w - 10, h - 10, h * 0.3);
  ctx.stroke();
  ctx.setLineDash([]);
  // La fermeture éclair et sa tirette
  ctx.fillStyle = "#c9c9c9";
  ctx.fillStyle = "rgba(30,40,60,0.5)";
  ctx.fillRect(-w / 2 + 12, -1.5, w - 24, 3);
  ctx.fillStyle = "#b9bcc2";
  for (let xx = -w / 2 + 12; xx < w / 2 - 12; xx += 7) ctx.fillRect(xx, (xx / 7) % 2 ? -4 : 0.5, 3.5, 3.5);
  ctx.fillStyle = "#e0e0e0";
  ctx.fillRect(w * 0.18, -h * 0.12, 10, h * 0.24);
  ctx.fillRect(w * 0.18 + 3, h * 0.1, 4, h * 0.22);
  ctx.restore();
}

/** Le bureau, à la taille de l'écran (en pixels réels), le cahier posé en `page`. */
export function bureau(w: number, h: number, page: Cadre): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  bois(ctx, w, h);
  // Ce qui traîne : seulement là où il y a de la place, à gauche et à droite du cahier
  const gauche = page.x;
  const droite = w - page.x - page.w;
  const u = page.w / 400;
  if (gauche > 70 * u) {
    crayon(ctx, gauche * 0.5, page.y + page.h * 0.3, Math.min(gauche * 0.9, 260 * u), 1.35);
    gommeBlanche(ctx, gauche * 0.45, page.y + page.h * 0.62, Math.min(gauche * 0.25, 40 * u), -0.3);
  }
  if (droite > 70 * u) {
    const x = page.x + page.w + droite * 0.5;
    if (droite > 160 * u) trousse(ctx, x + droite * 0.15, page.y + page.h * 0.18, Math.min(droite * 1.2, 360 * u), Math.min(droite * 0.5, 120 * u), 0.12);
    tailleCrayon(ctx, x, page.y + page.h * 0.55, Math.min(droite * 0.3, 44 * u), 0.4);
    crayon(ctx, x - droite * 0.05, page.y + page.h * 0.8, Math.min(droite * 0.85, 230 * u), -1.7);
  }
  // La lampe en haut à gauche, et les coins dans l'ombre
  const lampe = ctx.createRadialGradient(w * 0.15, -h * 0.1, 0, w * 0.15, -h * 0.1, Math.max(w, h) * 1.1);
  lampe.addColorStop(0, "rgba(255,236,190,0.28)");
  lampe.addColorStop(0.5, "rgba(255,236,190,0.06)");
  lampe.addColorStop(1, "rgba(20,8,0,0.35)");
  ctx.fillStyle = lampe;
  ctx.fillRect(0, 0, w, h);
  return c;
}

/** Le cahier lui-même, sous la page : sa couverture qui dépasse, l'épaisseur des pages, et son ombre. Coordonnées de page. */
export function dessous(ctx: CanvasRenderingContext2D, w: number, h: number, cahier: number): void {
  ctx.save();
  ctx.shadowColor = "rgba(20,8,0,0.45)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetX = 5;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = COUVERTURES[cahier] ?? COUVERTURES[1];
  ctx.beginPath();
  ctx.roundRect(-3, -3, w + 9, h + 9, 5);
  ctx.fill();
  ctx.restore();
  // Le grain de la couverture
  ctx.fillStyle = "rgba(255,255,255,0.07)";
  ctx.fillRect(-3, -3, w + 9, 3);
  // Les tranches des pages en dessous
  for (let k = 3; k >= 1; k--) {
    ctx.fillStyle = k % 2 ? "#e9dfc6" : "#f1e8d2";
    ctx.fillRect(k * 1.3, k * 1.3, w, h);
  }
}

/** Le coin de la page qui rebique, en bas à droite. Coordonnées de page. */
export function coinCorne(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const s = 14;
  ctx.save();
  // Sous le coin replié, on voit la page d'en dessous
  ctx.fillStyle = "#e6dbc0";
  ctx.beginPath();
  ctx.moveTo(w - s, h);
  ctx.lineTo(w, h - s);
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
  const g = ctx.createLinearGradient(w - s, h - s, w - s / 2, h - s / 2);
  g.addColorStop(0, "#fffaf0");
  g.addColorStop(1, "#ddd2b8");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(w - s, h);
  ctx.lineTo(w, h - s);
  ctx.lineTo(w - s - 1, h - s - 1);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Le cahier ouvert : les deux bandes de papier de part et d'autre du pli, où l'on ne pose rien. Coordonnées de page. */
export function reliure(ctx: CanvasRenderingContext2D, pli: number, h: number, r: number): void {
  ctx.fillStyle = "#f6efdc";
  ctx.fillRect(pli - r, 0, r * 2, h);
}

/** Le creux du pli par-dessus les deux pages : l'ombre qui se fond dans le papier, et la couture. */
export function ombrePli(ctx: CanvasRenderingContext2D, pli: number, h: number, r: number): void {
  ctx.save();
  const l = r * 2.6;
  const g = ctx.createLinearGradient(pli - l, 0, pli + l, 0);
  g.addColorStop(0, "rgba(90,60,20,0)");
  g.addColorStop(0.36, "rgba(90,60,20,0.06)");
  g.addColorStop(0.48, "rgba(70,45,15,0.2)");
  g.addColorStop(0.5, "rgba(50,30,10,0.32)");
  g.addColorStop(0.52, "rgba(70,45,15,0.18)");
  g.addColorStop(0.66, "rgba(90,60,20,0.05)");
  g.addColorStop(1, "rgba(90,60,20,0)");
  ctx.fillStyle = g;
  ctx.fillRect(pli - l, 0, l * 2, h);
  // Les points de couture du cahier
  ctx.strokeStyle = "rgba(60,40,20,0.35)";
  ctx.lineWidth = 0.8;
  for (const y of [h * 0.18, h * 0.5, h * 0.82]) {
    ctx.beginPath();
    ctx.moveTo(pli, y - 9);
    ctx.lineTo(pli, y + 9);
    ctx.stroke();
  }
  ctx.restore();
}
