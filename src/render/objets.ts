// Les objets posés sur la page : ils bloquent la horde comme les taches, et ont du volume (ombre, reflets).
import type { Objet } from "../sim/carte";
import { hash3 } from "../sim/rng";

function ombre(ctx: CanvasRenderingContext2D): void {
  ctx.shadowColor = "rgba(40,25,10,0.35)";
  ctx.shadowBlur = 6;
  ctx.shadowOffsetX = 3;
  ctx.shadowOffsetY = 5;
}

/** Une règle en plastique transparent, un peu bleutée, avec ses graduations. Dessinée à l'horizontale, longueur l. */
function regle(ctx: CanvasRenderingContext2D, l: number, e: number): void {
  ctx.save();
  ombre(ctx);
  ctx.fillStyle = "rgba(170,205,230,0.55)";
  ctx.beginPath();
  ctx.roundRect(-l / 2, -e / 2, l, e, 2);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = "rgba(60,100,140,0.7)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(-l / 2, -e / 2, l, e, 2);
  ctx.stroke();
  // Le reflet le long du bord
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.fillRect(-l / 2 + 2, -e / 2 + 1.5, l - 4, e * 0.18);
  ctx.strokeStyle = "rgba(20,30,50,0.75)";
  for (let i = 0, x = -l / 2 + 5; x < l / 2 - 3; i++, x += 4) {
    ctx.lineWidth = i % 5 === 0 ? 0.9 : 0.6;
    ctx.beginPath();
    ctx.moveTo(x, e / 2);
    ctx.lineTo(x, e / 2 - (i % 10 === 0 ? e * 0.5 : i % 5 === 0 ? e * 0.35 : e * 0.22));
    ctx.stroke();
    if (i % 10 === 0) {
      ctx.fillStyle = "rgba(20,30,50,0.75)";
      ctx.font = `${Math.max(6, e * 0.32)}px "Patrick Hand", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(i / 10), x, -e * 0.08);
    }
  }
}

/** Un trombone en métal : trois boucles emboîtées, reflet clair sur le fil. */
function trombone(ctx: CanvasRenderingContext2D, l: number, e: number): void {
  const h = Math.min(e * 0.8, 14);
  const fil = (decal: number, couleur: string, largeur: number) => {
    ctx.strokeStyle = couleur;
    ctx.lineWidth = largeur;
    ctx.lineCap = "round";
    ctx.beginPath();
    // Boucle extérieure, boucle intérieure, et la tige du milieu
    const x0 = -l / 2 + 2;
    const x1 = l / 2 - 2;
    const r = h / 2;
    ctx.moveTo(x0 + l * 0.3, r + decal);
    ctx.lineTo(x1 - r, r + decal);
    ctx.arc(x1 - r, decal, r, Math.PI / 2, -Math.PI / 2, true);
    ctx.lineTo(x0 + r, -r + decal);
    ctx.arc(x0 + r, decal, r, -Math.PI / 2, Math.PI / 2, true);
    ctx.lineTo(x1 - r * 1.8, r + decal - h * 0.001);
    ctx.moveTo(x1 - r * 1.8, r * 0.45 + decal);
    ctx.arc(x1 - r * 1.8, decal, r * 0.45, Math.PI / 2, -Math.PI / 2, true);
    ctx.lineTo(x0 + l * 0.22, -r * 0.45 + decal);
    ctx.stroke();
  };
  ctx.save();
  ombre(ctx);
  fil(0, "#8b9099", 2.4);
  ctx.restore();
  fil(0, "#b7bcc4", 2);
  fil(-0.6, "rgba(255,255,255,0.8)", 0.7);
}

/** Le capuchon d'un stylo bille bleu, avec son agrafe. */
function capuchon(ctx: CanvasRenderingContext2D, l: number, e: number): void {
  const h = Math.min(e * 0.7, 13);
  ctx.save();
  ombre(ctx);
  const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
  g.addColorStop(0, "#5b7fd0");
  g.addColorStop(0.4, "#2848a8");
  g.addColorStop(1, "#1a2f74");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-l / 2 + 2, -h / 2);
  ctx.lineTo(l / 2 - h * 0.6, -h / 2);
  ctx.quadraticCurveTo(l / 2, -h / 2, l / 2, 0);
  ctx.quadraticCurveTo(l / 2, h / 2, l / 2 - h * 0.6, h / 2);
  ctx.lineTo(-l / 2 + 2, h / 2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // L'agrafe, et le reflet
  ctx.fillStyle = "#1a2f74";
  ctx.fillRect(-l / 2 + 4, -h / 2 - 2.5, l * 0.6, 3);
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.fillRect(-l / 2 + 4, -h / 2 + 2, l - h, h * 0.15);
}

/** Un bonbon emballé, papillote rayée aux deux bouts. */
function bonbon(ctx: CanvasRenderingContext2D, l: number, e: number, graine: number): void {
  const r = Math.min(e * 0.42, l * 0.28);
  const couleur = ["#d6383b", "#e98a1f", "#3b9a5a", "#8a4cc2"][Math.floor(hash3(graine, 1, 1) * 4)];
  ctx.save();
  ombre(ctx);
  ctx.fillStyle = couleur;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * r * 0.8, 0);
    ctx.lineTo(s * (l / 2 - 1), -r * 0.95);
    ctx.lineTo(s * (l / 2 - 1), r * 0.95);
    ctx.closePath();
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // Les rayures et le brillant de l'emballage
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = r * 0.25;
  for (let k = -3; k <= 3; k++) {
    ctx.beginPath();
    ctx.moveTo(k * r * 0.6 - r, -r);
    ctx.lineTo(k * r * 0.6 + r, r);
    ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.beginPath();
  ctx.ellipse(-r * 0.35, -r * 0.4, r * 0.3, r * 0.16, -0.5, 0, Math.PI * 2);
  ctx.fill();
}

/** Un pavé vu d'un peu au-dessus : la face du dessus et la face avant, plus sombre. Remplit l × e. */
function pave(ctx: CanvasRenderingContext2D, l: number, e: number, dessus: (w: number, h: number) => void, avant: string): void {
  const hAvant = e * 0.3;
  const hDessus = e - hAvant;
  ctx.save();
  ombre(ctx);
  ctx.fillStyle = avant;
  ctx.beginPath();
  ctx.roundRect(-l / 2, -e / 2, l, e, 3);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.translate(-l / 2, -e / 2);
  ctx.beginPath();
  ctx.roundRect(0, 0, l, hDessus, 3);
  ctx.clip();
  dessus(l, hDessus);
  ctx.restore();
  // L'arête entre les deux faces
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fillRect(-l / 2 + 2, -e / 2 + hDessus - 1, l - 4, 1);
}

function gomme3d(ctx: CanvasRenderingContext2D, l: number, e: number, bicolore: boolean): void {
  if (bicolore) {
    pave(ctx, l, e, (w, h) => {
      ctx.fillStyle = "#f2a7b0";
      ctx.fillRect(0, 0, w * 0.58, h);
      ctx.fillStyle = "#7fa6d9";
      ctx.fillRect(w * 0.58, 0, w * 0.42, h);
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.fillRect(0, 0, w, h * 0.25);
      ctx.fillStyle = "rgba(90,59,63,0.6)";
      ctx.font = `700 ${Math.max(7, h * 0.32)}px "Patrick Hand", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("GOMME", w * 0.29, h * 0.55);
    }, "#c9727e");
  } else {
    pave(ctx, l, e, (w, h) => {
      ctx.fillStyle = "#f6f3ec";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#2c5aa0";
      ctx.fillRect(w * 0.32, 0, w * 0.68, h);
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.font = `700 ${Math.max(7, h * 0.34)}px "Patrick Hand", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("GOMME", w * 0.66, h * 0.55);
    }, "#c9c3b5");
  }
}

function taille3d(ctx: CanvasRenderingContext2D, l: number, e: number): void {
  pave(ctx, l, e, (w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, "#e2e6ea");
    g.addColorStop(1, "#a7aeb6");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // La lame, vissée
    ctx.fillStyle = "#c3c8ce";
    ctx.fillRect(w * 0.15, h * 0.2, w * 0.7, h * 0.22);
    ctx.fillStyle = "#6d737a";
    ctx.beginPath();
    ctx.arc(w * 0.5, h * 0.31, Math.min(w, h) * 0.06, 0, Math.PI * 2);
    ctx.fill();
  }, "#7d848c");
  // Le trou où l'on met le crayon, sur la face avant
  ctx.fillStyle = "#2f3338";
  ctx.beginPath();
  ctx.ellipse(0, e / 2 - e * 0.15, Math.min(l, e) * 0.16, e * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
}

export function objet(ctx: CanvasRenderingContext2D, o: Objet): void {
  const g = o.x * 7 + o.y * 13;
  const horizontal = o.w >= o.h;
  const l = (horizontal ? o.w : o.h) - 2;
  const e = (horizontal ? o.h : o.w) - 2;
  ctx.save();
  ctx.translate(o.x + o.w / 2, o.y + o.h / 2);
  ctx.rotate((horizontal ? 0 : Math.PI / 2) + (hash3(g, 3, 3) - 0.5) * 0.08);
  switch (o.type) {
    case "regle": regle(ctx, l, e); break;
    case "trombone": trombone(ctx, l, e); break;
    case "capuchon": capuchon(ctx, l, e); break;
    case "bonbon": bonbon(ctx, l, e, g); break;
    case "gomme": gomme3d(ctx, l, e, hash3(g, 5, 5) < 0.5); break;
    case "taille": taille3d(ctx, l, e); break;
  }
  ctx.restore();
}
