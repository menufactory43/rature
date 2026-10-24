// Les papiers des cahiers : Seyès (brouillon), petits carreaux (maths), portées (musique). Dessinés une fois.
import type { Papier } from "../sim/carte";
import { hash3 } from "../sim/rng";
import { PAPIER } from "./encre";

export function papier(largeur: number, hauteur: number, echelle: number, type: Papier = "seyes", haut = 0): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.ceil(largeur * echelle);
  c.height = Math.ceil(hauteur * echelle);
  const ctx = c.getContext("2d")!;
  ctx.scale(echelle, echelle);
  ctx.fillStyle = type === "portee" ? "#f8f3e6" : PAPIER;
  ctx.fillRect(0, 0, largeur, hauteur);
  // La teinte n'est jamais tout à fait égale : de grandes nuées un peu plus chaudes
  for (let i = 0; i < 9; i++) {
    const x = hash3(i, 11, 0) * largeur;
    const y = hash3(i, 12, 0) * hauteur;
    const r = 80 + hash3(i, 13, 0) * 160;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(190,160,100,${0.025 + hash3(i, 14, 0) * 0.03})`);
    g.addColorStop(1, "rgba(190,160,100,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // Le grain, et quelques fibres
  for (let i = 0; i < (largeur * hauteur) / 60; i++) {
    ctx.fillStyle = `rgba(120,100,60,${hash3(i, 3, 0) * 0.06})`;
    ctx.fillRect(hash3(i, 1, 0) * largeur, hash3(i, 2, 0) * hauteur, 1, 1);
  }
  ctx.lineWidth = 0.5;
  for (let i = 0; i < (largeur * hauteur) / 2500; i++) {
    const x = hash3(i, 21, 0) * largeur;
    const y = hash3(i, 22, 0) * hauteur;
    const a = hash3(i, 23, 0) * Math.PI;
    const l = 3 + hash3(i, 24, 0) * 7;
    ctx.strokeStyle = `rgba(130,110,70,${0.05 + hash3(i, 25, 0) * 0.07})`;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + 1.5, y + Math.sin(a) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l);
    ctx.stroke();
  }
  // Les bords jaunissent un peu, comme une feuille qui a vécu dans le cartable
  const bord = ctx.createRadialGradient(largeur / 2, hauteur / 2, Math.min(largeur, hauteur) * 0.45, largeur / 2, hauteur / 2, Math.max(largeur, hauteur) * 0.75);
  bord.addColorStop(0, "rgba(170,130,70,0)");
  bord.addColorStop(1, "rgba(170,130,70,0.12)");
  ctx.fillStyle = bord;
  ctx.fillRect(0, 0, largeur, hauteur);
  const ligne = (x1: number, y1: number, x2: number, y2: number, style: string, w: number) => {
    ctx.strokeStyle = style;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  };
  if (type === "seyes") {
    for (let y = haut + 8; y < hauteur; y += 8) ligne(0, y, largeur, y, (y - haut) % 32 === 0 ? "rgba(80,120,190,0.3)" : "rgba(80,120,190,0.16)", 0.6);
    for (let x = 8; x < largeur; x += 32) ligne(x, 0, x, hauteur, "rgba(80,120,190,0.16)", 0.6);
    ligne(34, 0, 34, hauteur, "rgba(200,60,60,0.45)", 1.2);
  } else if (type === "carreaux") {
    for (let y = haut; y < hauteur; y += 10) ligne(0, y, largeur, y, "rgba(80,120,190,0.2)", 0.5);
    for (let x = 0; x < largeur; x += 10) ligne(x, 0, x, hauteur, "rgba(80,120,190,0.2)", 0.5);
  } else {
    // Des portées : cinq lignes, puis un blanc
    for (let y0 = haut + 30; y0 < hauteur; y0 += 64) for (let k = 0; k < 5; k++) ligne(18, y0 + k * 6, largeur - 18, y0 + k * 6, "rgba(60,60,70,0.22)", 0.7);
    ligne(18, 0, 18, hauteur, "rgba(60,60,70,0.12)", 0.7);
  }
  // Une auréole de café
  ctx.strokeStyle = "rgba(150,105,55,0.12)";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(largeur * 0.82, hauteur * 0.14, 40, 0.3, Math.PI * 2 - 0.2);
  ctx.stroke();
  return c;
}
