// Les papiers des cahiers : Seyès (brouillon), petits carreaux (maths), portées (musique). Dessinés une fois.
import type { Papier } from "../sim/carte";
import { hash3 } from "../sim/rng";
import { PAPIER } from "./encre";

/** Un rectangle, dans les unités de la page. */
export interface Zone {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function papier(largeur: number, hauteur: number, echelle: number, type: Papier = "seyes", haut = 0, zone?: Zone): HTMLCanvasElement {
  // La zone peinte peut déborder de la page (la feuille qui va jusqu'aux bords de l'écran) : les lignes continuent
  const z = zone ?? { x: 0, y: 0, w: largeur, h: hauteur };
  const c = document.createElement("canvas");
  c.width = Math.ceil(z.w * echelle);
  c.height = Math.ceil(z.h * echelle);
  const ctx = c.getContext("2d")!;
  ctx.scale(echelle, echelle);
  ctx.translate(-z.x, -z.y);
  ctx.fillStyle = type === "portee" ? "#f8f3e6" : PAPIER;
  ctx.fillRect(z.x, z.y, z.w, z.h);
  // La teinte n'est jamais tout à fait égale : de grandes nuées un peu plus chaudes
  for (let i = 0; i < 9; i++) {
    const x = z.x + hash3(i, 11, 0) * z.w;
    const y = z.y + hash3(i, 12, 0) * z.h;
    const r = 80 + hash3(i, 13, 0) * 160;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(190,160,100,${0.025 + hash3(i, 14, 0) * 0.03})`);
    g.addColorStop(1, "rgba(190,160,100,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // Le grain, et quelques fibres
  for (let i = 0; i < (z.w * z.h) / 60; i++) {
    ctx.fillStyle = `rgba(120,100,60,${hash3(i, 3, 0) * 0.06})`;
    ctx.fillRect(z.x + hash3(i, 1, 0) * z.w, z.y + hash3(i, 2, 0) * z.h, 1, 1);
  }
  ctx.lineWidth = 0.5;
  for (let i = 0; i < (z.w * z.h) / 2500; i++) {
    const x = z.x + hash3(i, 21, 0) * z.w;
    const y = z.y + hash3(i, 22, 0) * z.h;
    const a = hash3(i, 23, 0) * Math.PI;
    const l = 3 + hash3(i, 24, 0) * 7;
    ctx.strokeStyle = `rgba(130,110,70,${0.05 + hash3(i, 25, 0) * 0.07})`;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + 1.5, y + Math.sin(a) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l);
    ctx.stroke();
  }
  // Les bords jaunissent un peu, comme une feuille qui a vécu dans le cartable
  const cx = z.x + z.w / 2;
  const cy = z.y + z.h / 2;
  const bord = ctx.createRadialGradient(cx, cy, Math.min(z.w, z.h) * 0.45, cx, cy, Math.max(z.w, z.h) * 0.75);
  bord.addColorStop(0, "rgba(170,130,70,0)");
  bord.addColorStop(1, "rgba(170,130,70,0.12)");
  ctx.fillStyle = bord;
  ctx.fillRect(z.x, z.y, z.w, z.h);
  const x0 = z.x;
  const x1 = z.x + z.w;
  const y0 = z.y;
  const y1 = z.y + z.h;
  /** Le premier multiple de pas (décalé de o) à partir de a. */
  const depuis = (a: number, o: number, pas: number) => o + Math.ceil((a - o) / pas) * pas;
  const ligne = (x1: number, y1: number, x2: number, y2: number, style: string, w: number) => {
    ctx.strokeStyle = style;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  };
  if (type === "seyes") {
    for (let y = depuis(y0, haut + 8, 8); y < y1; y += 8) ligne(x0, y, x1, y, (((y - haut) % 32) + 32) % 32 === 0 ? "rgba(80,120,190,0.3)" : "rgba(80,120,190,0.16)", 0.6);
    for (let x = depuis(x0, 8, 32); x < x1; x += 32) ligne(x, y0, x, y1, "rgba(80,120,190,0.16)", 0.6);
    ligne(34, y0, 34, y1, "rgba(200,60,60,0.45)", 1.2);
  } else if (type === "carreaux") {
    for (let y = depuis(y0, haut, 10); y < y1; y += 10) ligne(x0, y, x1, y, "rgba(80,120,190,0.2)", 0.5);
    for (let x = depuis(x0, 0, 10); x < x1; x += 10) ligne(x, y0, x, y1, "rgba(80,120,190,0.2)", 0.5);
  } else {
    // Des portées : cinq lignes, puis un blanc
    for (let yp = depuis(y0 - 30, haut + 30, 64); yp < y1; yp += 64) for (let k = 0; k < 5; k++) ligne(Math.min(18, x0 + 18), yp + k * 6, Math.max(largeur - 18, x1 - 18), yp + k * 6, "rgba(60,60,70,0.22)", 0.7);
    ligne(18, y0, 18, y1, "rgba(60,60,70,0.12)", 0.7);
  }
  // Une auréole de café
  ctx.strokeStyle = "rgba(150,105,55,0.12)";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(largeur * 0.82, hauteur * 0.14, 40, 0.3, Math.PI * 2 - 0.2);
  ctx.stroke();
  return c;
}
