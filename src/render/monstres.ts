// Les monstres des marges, dessinés au stylo rouge.
import type { TypeEnnemi } from "../sim/ennemis";
import { CRAYON, PAPIER, ROUGE, cercle, ecrire, hachures, rectangle, trait } from "./encre";

/** Le clignement : un instant toutes les trois secondes environ, décalé selon le monstre. */
let clin = false;

function yeux(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fache: boolean, couleur: string): void {
  ctx.fillStyle = couleur;
  for (const s of [-1, 1]) {
    if (clin) {
      trait(ctx, [{ x: x + s * r * 0.35 - r * 0.12, y: y - r * 0.15 }, { x: x + s * r * 0.35 + r * 0.12, y: y - r * 0.15 }], { couleur, epaisseur: 1.2, amp: 0.2 });
    } else {
      ctx.beginPath();
      ctx.arc(x + s * r * 0.35, y - r * 0.15, Math.max(1.2, r * 0.11), 0, Math.PI * 2);
      ctx.fill();
    }
    if (fache)
      trait(ctx, [{ x: x + s * r * 0.6, y: y - r * 0.5 }, { x: x + s * r * 0.15, y: y - r * 0.3 }], { couleur, epaisseur: 1.4, amp: 0.3 });
  }
}

/** Deux petites jambes qui marchent sous le corps. */
function jambes(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, age: number, couleur: string, graine: number): void {
  const pas = Math.sin(age * 12 + graine);
  for (const s of [-1, 1]) {
    const lev = Math.max(0, pas * s) * r * 0.25;
    trait(ctx, [{ x: x + s * r * 0.4, y: y - 1 }, { x: x + s * r * 0.45 + pas * s * r * 0.15, y: y + r * 0.35 - lev }, { x: x + s * r * 0.65 + pas * s * r * 0.15, y: y + r * 0.35 - lev }], { couleur, epaisseur: 1.3, graine: graine + s, amp: 0.2 });
  }
}

export function monstre(ctx: CanvasRenderingContext2D, type: TypeEnnemi, x: number, y: number, r: number, graine: number, age: number, couleur = ROUGE, angle = 0): void {
  const o = { couleur, epaisseur: 1.8, graine };
  clin = age > 0 && (age + graine * 0.37) % 3.1 < 0.13;
  switch (type) {
    case "gribouille": {
      jambes(ctx, x, y + r * 0.8, r, age, couleur, graine);
      cercle(ctx, x, y, r, { ...o, fond: "rgba(246,239,220,0.9)" });
      // Les boucles du gribouillis, à l'intérieur
      const boucles: { x: number; y: number }[] = [];
      for (let i = 0; i <= 16; i++) {
        const a = i * 1.9 + graine;
        boucles.push({ x: x + Math.cos(a) * r * 0.55 + Math.cos(i * 0.6) * r * 0.2, y: y + Math.sin(a) * r * 0.35 - r * 0.45 });
      }
      trait(ctx, boucles, { couleur, epaisseur: 0.8, graine: graine + 3, alpha: 0.45, amp: 0.4 });
      yeux(ctx, x, y, r, false, couleur);
      trait(ctx, [-0.4, -0.2, 0, 0.2, 0.4].map((k) => ({ x: x + k * r, y: y + r * 0.3 + (0.16 - k * k) * r * 0.7 })), { ...o, epaisseur: 1.4 });
      break;
    }
    case "carre": {
      jambes(ctx, x, y + r * 0.85, r * 1.1, age * 0.7, couleur, graine);
      rectangle(ctx, x - r, y - r * 0.85, r * 2, r * 1.7, { ...o, fond: "rgba(246,239,220,0.9)" });
      // Le blindage : des rivets dans les coins
      for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        ctx.fillStyle = couleur;
        ctx.beginPath();
        ctx.arc(x + a * r * 0.72, y + b * r * 0.6, 1.1, 0, Math.PI * 2);
        ctx.fill();
      }
      yeux(ctx, x, y, r, true, couleur);
      trait(ctx, [{ x: x - r * 0.4, y: y + r * 0.4 }, { x: x + r * 0.4, y: y + r * 0.4 }], { ...o, epaisseur: 1.4 });
      break;
    }
    case "avion": {
      const c = Math.cos(angle);
      const s = Math.sin(angle);
      const p = (u: number, v: number) => ({ x: x + c * u - s * v, y: y + s * u + c * v });
      const aile = 0.75 + Math.sin(age * 9 + graine) * 0.25;
      trait(ctx, [p(r * 1.3, 0), p(-r, r * 0.9 * aile), p(-r * 0.5, 0), p(-r, -r * 0.9 * aile)], { ...o, ferme: true, fond: "rgba(196,48,43,0.08)" });
      for (const w of [-0.5, 0.5]) trait(ctx, [p(-r * 1.4, w * r), p(-r * 2.2 - Math.sin(age * 20 + w) * 2, w * r)], { couleur, epaisseur: 0.9, graine: graine + 7, alpha: 0.5, amp: 0.2 });
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
      // Le corps : une goutte lisse qui ondule comme de l'encre liquide
      const n = 28;
      const pts = Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2;
        const k = 1 + 0.12 * Math.sin(3 * a + graine) + 0.07 * Math.sin(5 * a + graine * 2.3) + 0.05 * Math.sin(age * 5 + a * 3);
        return { x: x + Math.cos(a) * r * k, y: y + Math.sin(a) * r * k * 0.92 };
      });
      trait(ctx, pts, { ...o, ferme: true, fond: "rgba(196,48,43,0.22)", epaisseur: type === "mere" ? 2.6 : 1.8, amp: 0.4 });
      // Une goutte qui pend et retombe
      const u = (age * 0.8 + graine * 0.1) % 1;
      if (type !== "petite") cercle(ctx, x + r * 0.3, y + r + u * r * 0.8, r * 0.12 * (1 - u * 0.5), { ...o, epaisseur: 1, fond: couleur, alpha: 1 - u });
      hachures(ctx, pts, "rgba(196,48,43,0.35)", type === "mere" ? 5 : 4);
      if (type !== "petite") {
        yeux(ctx, x, y, r * 0.8, true, couleur);
        if (type === "mere") {
          // Une couronne de travers, dessinée à la main
          const cy = y - r * 0.95;
          trait(ctx, [{ x: x - 12, y: cy }, { x: x - 13, y: cy - 12 }, { x: x - 6, y: cy - 5 }, { x: x, y: cy - 15 }, { x: x + 6, y: cy - 5 }, { x: x + 13, y: cy - 12 }, { x: x + 12, y: cy }], { ...o, ferme: true, fond: "rgba(230,180,60,0.6)", epaisseur: 2 });
          trait(ctx, [{ x: x - 12, y: cy - 2 }, { x: x + 12, y: cy - 2 }], { ...o, epaisseur: 1 });
          trait(ctx, [{ x: x - 7, y: y + r * 0.3 }, { x: x - 2, y: y + r * 0.42 }, { x: x + 3, y: y + r * 0.3 }, { x: x + 8, y: y + r * 0.42 }], { ...o, epaisseur: 1.8 });
        }
      }
      break;
    }
    case "gomme": {
      jambes(ctx, x, y + r * 0.6, r * 1.2, age * 0.8, couleur, graine);
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
      jambes(ctx, x, y + r, r, age, couleur, graine);
      trait(ctx, [{ x: x - r, y: y - r }, { x: x + r, y: y - r }, { x: x + r, y: y + r * 0.4 }, { x: x + r * 0.4, y: y + r }, { x: x - r, y: y + r }], { ...o, ferme: true, fond: "rgba(196,48,43,0.07)" });
      const coin = 0.4 + Math.sin(age * 4 + graine) * 0.12;
      trait(ctx, [{ x: x + r, y: y + r * 0.4 }, { x: x + r * coin, y: y + r * coin }, { x: x + r * 0.4, y: y + r }], { ...o, epaisseur: 1.2, fond: "rgba(196,48,43,0.15)" });
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
      jambes(ctx, x, y + r, r * 0.9, age, couleur, graine);
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

