// Les monstres des marges, dessinés au stylo rouge.
import type { TypeEnnemi } from "../sim/ennemis";
import { CRAYON, PAPIER, ROUGE, cercle, ecrire, hachures, pointsCercle, rectangle, trait } from "./encre";

function yeux(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fache: boolean, couleur: string): void {
  ctx.fillStyle = couleur;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(x + s * r * 0.35, y - r * 0.15, Math.max(1.2, r * 0.11), 0, Math.PI * 2);
    ctx.fill();
    if (fache)
      trait(ctx, [{ x: x + s * r * 0.6, y: y - r * 0.5 }, { x: x + s * r * 0.15, y: y - r * 0.3 }], { couleur, epaisseur: 1.4, amp: 0.3 });
  }
}

export function monstre(ctx: CanvasRenderingContext2D, type: TypeEnnemi, x: number, y: number, r: number, graine: number, age: number, couleur = ROUGE, angle = 0): void {
  const o = { couleur, epaisseur: 1.8, graine };
  switch (type) {
    case "gribouille": {
      cercle(ctx, x, y, r, o);
      yeux(ctx, x, y, r, false, couleur);
      trait(ctx, [-0.4, -0.2, 0, 0.2, 0.4].map((k) => ({ x: x + k * r, y: y + r * 0.3 + (0.16 - k * k) * r * 0.7 })), { ...o, epaisseur: 1.4 });
      break;
    }
    case "carre": {
      rectangle(ctx, x - r, y - r * 0.85, r * 2, r * 1.7, o);
      yeux(ctx, x, y, r, true, couleur);
      trait(ctx, [{ x: x - r * 0.4, y: y + r * 0.4 }, { x: x + r * 0.4, y: y + r * 0.4 }], { ...o, epaisseur: 1.4 });
      break;
    }
    case "avion": {
      const c = Math.cos(angle);
      const s = Math.sin(angle);
      const p = (u: number, v: number) => ({ x: x + c * u - s * v, y: y + s * u + c * v });
      trait(ctx, [p(r * 1.3, 0), p(-r, r * 0.9), p(-r * 0.5, 0), p(-r, -r * 0.9)], { ...o, ferme: true, fond: "rgba(196,48,43,0.08)" });
      trait(ctx, [p(r * 1.3, 0), p(-r * 0.5, 0)], { ...o, epaisseur: 1.1 });
      break;
    }
    case "araignee": {
      for (let k = 0; k < 8; k++) {
        const cote = k < 4 ? -1 : 1;
        const i = k % 4;
        const a = (i - 1.5) * 0.45 + Math.sin(age * 14 + k) * 0.18;
        trait(ctx, [
          { x, y },
          { x: x + cote * r * 1.1 * Math.cos(a), y: y + r * 1.1 * Math.sin(a) - r * 0.3 },
          { x: x + cote * r * 1.6 * Math.cos(a), y: y + r * 1.4 * Math.sin(a) + r * 0.2 },
        ], { couleur, epaisseur: 1.2, graine: graine + k, amp: 0.3 });
      }
      cercle(ctx, x, y, r * 0.6, { ...o, fond: couleur });
      break;
    }
    case "tache":
    case "petite":
    case "mere": {
      const pts = pointsCercle(x, y, r, graine, 0.25);
      trait(ctx, pts, { ...o, ferme: true, fond: "rgba(196,48,43,0.22)", epaisseur: type === "mere" ? 2.6 : 1.8 });
      hachures(ctx, pts, "rgba(196,48,43,0.35)", type === "mere" ? 5 : 4);
      if (type !== "petite") {
        yeux(ctx, x, y, r * 0.8, true, couleur);
        if (type === "mere") {
          ecrire(ctx, "♛", x, y - r - 8, { couleur, taille: 20 });
        }
      }
      break;
    }
    case "gomme": {
      const pts = [{ x: x - r * 1.2, y: y - r * 0.6 }, { x: x + r * 1.2, y: y - r * 0.6 }, { x: x + r * 1.2, y: y + r * 0.6 }, { x: x - r * 1.2, y: y + r * 0.6 }];
      trait(ctx, pts, { ...o, ferme: true });
      const moitie = [pts[0], { x: x - r * 0.1, y: y - r * 0.6 }, { x: x - r * 0.1, y: y + r * 0.6 }, pts[3]];
      hachures(ctx, moitie, "rgba(196,48,43,0.5)", 3, 0.8);
      trait(ctx, [moitie[1], moitie[2]], o);
      ecrire(ctx, "GOMME", x + r * 0.55, y, { couleur, taille: 7 });
      break;
    }
    case "compas": {
      // Un compas qui marche sur ses deux pointes
      const ecart = r * (0.7 + Math.sin(age * 6) * 0.25);
      cercle(ctx, x, y - r * 0.9, r * 0.32, { ...o, fond: "rgba(196,48,43,0.2)" });
      trait(ctx, [{ x, y: y - r * 0.6 }, { x: x - ecart, y: y + r }], { ...o, epaisseur: 3 });
      trait(ctx, [{ x, y: y - r * 0.6 }, { x: x + ecart, y: y + r }], { ...o, epaisseur: 3 });
      trait(ctx, [{ x: x - ecart * 0.5, y: y + r * 0.2 }, { x: x + ecart * 0.5, y: y + r * 0.2 }], { ...o, epaisseur: 1.4 });
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + age;
        trait(ctx, [{ x, y: y - r * 0.9 }, { x: x + Math.cos(a) * r * 0.75, y: y - r * 0.9 + Math.sin(a) * r * 0.55 }], { couleur, epaisseur: 1, graine: graine + k, amp: 0.3 });
      }
      yeux(ctx, x, y - r * 0.9, r * 0.32, true, PAPIER);
      break;
    }
    case "postit": {
      trait(ctx, [{ x: x - r, y: y - r }, { x: x + r, y: y - r }, { x: x + r, y: y + r * 0.4 }, { x: x + r * 0.4, y: y + r }, { x: x - r, y: y + r }], { ...o, ferme: true, fond: "rgba(196,48,43,0.07)" });
      trait(ctx, [{ x: x + r, y: y + r * 0.4 }, { x: x + r * 0.4, y: y + r * 0.4 }, { x: x + r * 0.4, y: y + r }], { ...o, epaisseur: 1.2 });
      yeux(ctx, x - r * 0.1, y, r * 0.8, false, couleur);
      break;
    }
    case "fantome": {
      const pts = [];
      for (let i = 0; i <= 12; i++) {
        const a = Math.PI + (i / 12) * Math.PI;
        pts.push({ x: x + Math.cos(a) * r, y: y - r * 0.1 + Math.sin(a) * r });
      }
      for (let i = 0; i <= 6; i++) pts.push({ x: x + r - (i / 6) * 2 * r, y: y + r * 0.9 + (i % 2 ? -r * 0.3 : 0) + Math.sin(age * 6 + i) * 1.2 });
      trait(ctx, pts, { ...o, ferme: true, couleur: couleur === ROUGE ? CRAYON : couleur, epaisseur: 1.4 });
      yeux(ctx, x, y - r * 0.15, r, false, couleur === ROUGE ? CRAYON : couleur);
      break;
    }
    case "tippex": {
      rectangle(ctx, x - r * 0.7, y - r * 0.6, r * 1.4, r * 1.6, { ...o, fond: "rgba(255,255,255,0.9)" });
      rectangle(ctx, x - r * 0.35, y - r * 1.1, r * 0.7, r * 0.5, o);
      trait(ctx, [{ x: x - r * 0.35, y: y + r * 0.2 }, { x: x + r * 0.35, y: y + r * 0.2 }], { ...o, epaisseur: 2.2 });
      trait(ctx, [{ x, y: y - r * 0.15 }, { x, y: y + r * 0.55 }], { ...o, epaisseur: 2.2 });
      break;
    }
    case "punaise": {
      const c = Math.cos(angle);
      const s = Math.sin(angle);
      trait(ctx, [{ x, y }, { x: x + c * r * 1.6, y: y + s * r * 1.6 }], { ...o, epaisseur: 1.4 });
      cercle(ctx, x - c * r * 0.2, y - s * r * 0.2, r * 0.85, { ...o, fond: "rgba(196,48,43,0.35)" });
      cercle(ctx, x - c * r * 0.2, y - s * r * 0.2, r * 0.4, { ...o, epaisseur: 1.2 });
      break;
    }
    case "taille": {
      rectangle(ctx, x - r, y - r * 0.75, r * 2, r * 1.5, { ...o, epaisseur: 2.6, fond: "rgba(196,48,43,0.12)" });
      cercle(ctx, x - r * 0.35, y, r * 0.42, { ...o, epaisseur: 2.2, fond: PAPIER });
      trait(ctx, [{ x: x + r * 0.15, y: y - r * 0.55 }, { x: x + r * 0.85, y: y + r * 0.55 }], { ...o, epaisseur: 3 });
      for (let k = 0; k < 4; k++) {
        const a = age * 8 + (k * Math.PI) / 2;
        trait(ctx, [{ x: x - r * 0.35, y }, { x: x - r * 0.35 + Math.cos(a) * r * 0.36, y: y + Math.sin(a) * r * 0.36 }], { couleur, epaisseur: 1, graine: graine + k });
      }
      yeux(ctx, x + r * 0.45, y - r * 0.05, r * 0.5, true, couleur);
      break;
    }
  }
}

