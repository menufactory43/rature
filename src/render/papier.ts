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
  for (let i = 0; i < (largeur * hauteur) / 90; i++) {
    ctx.fillStyle = `rgba(120,100,60,${hash3(i, 3, 0) * 0.05})`;
    ctx.fillRect(hash3(i, 1, 0) * largeur, hash3(i, 2, 0) * hauteur, 1, 1);
  }
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
