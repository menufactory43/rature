// Les monstres : des mots qui s'écrivent tout seuls sur la page, au stylo rouge, et marchent vers le Cœur. Chacun a un
// corps de lettre (ou de mot), des yeux griffonnés et de petites pattes ; la silhouette dit déjà ce qu'il fait. Le
// h muet est écrit au crayon (furtif), la majuscule repassée dix fois (blindée), le point d'exclamation fonce sur
// les tours, la faute éclate en lettres quand on la rature.
import type { TypeEnnemi } from "../sim/ennemis";
import { hash3 } from "../sim/rng";
import { CRAYON, ROUGE, hachures, trait } from "./encre";
import { t } from "../i18n";

/** Le clignement : un instant toutes les trois secondes environ, décalé selon le monstre. */
let clin = false;
/** Le tremblé du stylo, huit fois par seconde (comme le reste de la page). */
let tic = 0;
const tremble = (g: number, i: number, amp: number) => (hash3(g, i, tic) - 0.5) * 2 * amp;

const ENCRE_OEIL = "#2a2a35";

/** Une lettre (ou un mot) à l'encre : repassée en plusieurs passages légèrement décalés, comme quand on appuie. */
function lettre(ctx: CanvasRenderingContext2D, txt: string, x: number, y: number, taille: number, couleur: string, g: number, passes = 2, alpha = 1): void {
  ctx.save();
  ctx.font = `700 ${taille}px Caveat, cursive`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = couleur;
  ctx.globalAlpha *= alpha;
  // Centrée sur son vrai contour (une majuscule monte plus haut qu'une minuscule)
  const m = ctx.measureText(txt);
  const by = y + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
  const amp = passes > 2 ? taille * 0.025 : taille * 0.012;
  for (let k = 0; k < passes; k++) ctx.fillText(txt, x + tremble(g, k * 2, amp), by + tremble(g, k * 2 + 1, amp));
  ctx.restore();
}

/** Deux yeux ronds griffonnés, qui regardent où le monstre va (ou fâchés). */
function yeux(ctx: CanvasRenderingContext2D, x: number, y: number, ecart: number, r: number, regard: number, g: number, fache = false, alpha = 1): void {
  ctx.save();
  ctx.globalAlpha *= alpha;
  for (const s of [-1, 1]) {
    const ex = x + s * ecart + tremble(g, s + 5, r * 0.08);
    const ey = y + tremble(g, s + 7, r * 0.08);
    ctx.lineWidth = Math.max(0.8, r * 0.3);
    ctx.strokeStyle = ENCRE_OEIL;
    if (clin) {
      ctx.beginPath();
      ctx.moveTo(ex - r, ey);
      ctx.lineTo(ex + r, ey);
      ctx.stroke();
    } else {
      ctx.fillStyle = "#fffaf0";
      ctx.beginPath();
      ctx.arc(ex, ey, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = ENCRE_OEIL;
      ctx.beginPath();
      ctx.arc(ex + regard * r * 0.42, ey + r * 0.15, r * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    if (fache) {
      ctx.lineWidth = Math.max(1, r * 0.4);
      ctx.beginPath();
      ctx.moveTo(ex + s * r * 1.3, ey - r * 1.7);
      ctx.lineTo(ex - s * r * 0.3, ey - r * 1.05);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** De petites pattes qui trottinent sous le corps. */
function pattes(ctx: CanvasRenderingContext2D, x: number, y: number, n: number, ecart: number, l: number, age: number, couleur: string, g: number, alpha = 1): void {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = couleur;
  ctx.lineWidth = Math.max(1, l * 0.22);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (let i = 0; i < n; i++) {
    const px = x + (n === 1 ? 0 : (i / (n - 1) - 0.5) * 2 * ecart);
    const pas = Math.sin(age * 14 + i * Math.PI + g) * l * 0.45;
    ctx.beginPath();
    ctx.moveTo(px, y);
    ctx.lineTo(px + pas + tremble(g, i, l * 0.06), y + l);
    ctx.lineTo(px + pas + (i % 2 ? 1 : -1) * l * 0.4, y + l);
    ctx.stroke();
  }
  ctx.restore();
}

const MINUSCULES = "aeosucmnrv";
const MAJUSCULES = "BMRDP";
/** Les fautes qui marchent. */
const FAUTES = ["fote", "sa va", "éléfan", "bocou", "kom", "aprè", "pluzieur", "ortograf"];
const SERPENT = "anticonstitutionnellement";

/** Le chemin parcouru par chaque mot-serpent, pour que sa queue suive les virages. */
const traces = new Map<number, { x: number; y: number }[]>();

/** La position à la distance d derrière la tête, le long du chemin parcouru (puis tout droit derrière, au-delà). */
function sillage(g: number, x: number, y: number, angle: number, age: number) {
  let t = traces.get(g);
  if (!t || age <= 0) {
    if (traces.size > 12) traces.clear();
    t = [];
    if (age > 0) traces.set(g, t);
  }
  const der = t[t.length - 1];
  if (!der || Math.hypot(der.x - x, der.y - y) > 2) {
    t.push({ x, y });
    if (t.length > 160) t.shift();
  }
  const c0 = Math.cos(angle);
  const s0 = Math.sin(angle);
  return (d: number) => {
    let reste = d;
    let a = { x, y };
    for (let i = t!.length - 1; i >= 0; i--) {
      const b = t![i];
      const l = Math.hypot(b.x - a.x, b.y - a.y);
      if (l >= reste && l > 0) {
        const u = reste / l;
        return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, c: (a.x - b.x) / l, s: (a.y - b.y) / l };
      }
      reste -= l;
      a = b;
    }
    return { x: a.x - c0 * reste, y: a.y - s0 * reste, c: c0, s: s0 };
  };
}

/** La faute que porte un monstre (et dont les lettres repartent seules quand on la rature). */
export const fauteDe = (graine: number) => t(FAUTES[Math.abs(Math.round(graine)) % FAUTES.length]);

export function monstre(ctx: CanvasRenderingContext2D, type: TypeEnnemi, x: number, y: number, r: number, graine: number, age: number, couleur = ROUGE, angle = 0): void {
  clin = age > 0 && (age + graine * 0.37) % 3.1 < 0.13;
  tic = Math.floor(age * 8);
  const g = Math.abs(Math.round(graine));
  const regard = Math.cos(angle) * 0.9;
  switch (type) {
    case "gribouille": {
      pattes(ctx, x, y + r * 0.75, 2, r * 0.38, r * 0.6, age, couleur, g);
      lettre(ctx, MINUSCULES[g % MINUSCULES.length], x, y, r * 3.6, couleur, g);
      yeux(ctx, x, y - r * 0.3, r * 0.38, r * 0.3, regard, g);
      break;
    }
    case "carre": {
      // Une majuscule repassée dix fois : on voit qu'elle est blindée
      pattes(ctx, x, y + r * 0.95, 2, r * 0.45, r * 0.5, age * 0.7, couleur, g);
      lettre(ctx, MAJUSCULES[g % MAJUSCULES.length], x, y, r * 3.1, couleur, g, 4);
      yeux(ctx, x - r * 0.05, y - r * 0.5, r * 0.34, r * 0.24, regard, g, true);
      break;
    }
    case "avion": {
      // Un avion plié dans une page de dictée, couvert de lignes d'écriture
      const c = Math.cos(angle);
      const s = Math.sin(angle);
      const k = r * 1.25;
      const p = (u: number, v: number) => ({ x: x + c * u - s * v, y: y + s * u + c * v });
      const aile = 0.75 + Math.sin(age * 9 + g) * 0.25;
      ctx.fillStyle = "rgba(60,50,40,0.12)";
      ctx.beginPath();
      ctx.ellipse(x + 4, y + k * 1.4, k * 0.9, k * 0.25, 0, 0, Math.PI * 2);
      ctx.fill();
      const coque = [p(k * 1.3, 0), p(-k, k * 0.9 * aile), p(-k * 0.5, 0), p(-k, -k * 0.9 * aile)];
      trait(ctx, coque, { couleur, epaisseur: 1.8, graine: g, ferme: true, fond: "rgba(252,248,236,0.95)", pate: false });
      for (const v of [-0.55, -0.3, 0.3, 0.55]) trait(ctx, [p(-k * 0.75, v * k * aile), p(k * (0.65 - Math.abs(v)), v * k * aile * 0.45)], { couleur, epaisseur: 0.7, graine: g + 9 + v * 10, alpha: 0.55, amp: 0.25, pate: false });
      for (const w of [-0.5, 0.5]) trait(ctx, [p(-k * 1.4, w * k), p(-k * 2.2 - Math.sin(age * 20 + w) * 2, w * k)], { couleur: CRAYON, epaisseur: 0.9, graine: g + 7, amp: 0.2, pate: false });
      trait(ctx, [p(k * 1.3, 0), p(-k * 0.5, 0)], { couleur, epaisseur: 1.1, graine: g + 1, pate: false });
      const o = p(k * 0.35, 0);
      yeux(ctx, o.x, o.y - k * 0.15, k * 0.22, k * 0.17, regard, g);
      break;
    }
    case "araignee": {
      pattes(ctx, x, y + r * 0.35, 6, r * 0.9, r * 0.55, age * 1.6, couleur, g);
      lettre(ctx, "z", x, y, r * 3.3, couleur, g);
      yeux(ctx, x, y - r * 0.45, r * 0.34, r * 0.26, regard, g, true);
      break;
    }
    case "tache": {
      // Une faute d'orthographe qui marche, contente d'elle
      const mot = fauteDe(g);
      const taille = r * 2.4;
      ctx.font = `700 ${taille}px Caveat, cursive`;
      const l = ctx.measureText(mot).width;
      pattes(ctx, x, y + r * 0.6, Math.min(5, Math.max(3, mot.length - 1)), l * 0.38, r * 0.5, age, couleur, g);
      lettre(ctx, mot, x, y, taille, couleur, g);
      yeux(ctx, x - l * 0.32, y - r * 0.5, r * 0.26, r * 0.22, regard, g);
      break;
    }
    case "petite": {
      // Une lettre échappée d'une faute raturée
      pattes(ctx, x, y + r * 0.7, 2, r * 0.35, r * 0.6, age * 1.3, couleur, g);
      lettre(ctx, "fotesavlnk"[g % 10], x, y, r * 3.4, couleur, g);
      yeux(ctx, x, y - r * 0.35, r * 0.4, r * 0.32, regard, g);
      break;
    }
    case "mere": {
      // Le mot-serpent : un mot à rallonge qui suit le chemin parcouru derrière sa tête couronnée
      const queue = sillage(g, x, y, angle, age);
      const mot = t(SERPENT);
      const n = 11;
      for (let i = n; i >= 1; i--) {
        const q = queue(i * r * 0.5);
        const ond = Math.sin(age * 5 - i * 0.8) * r * 0.12;
        lettre(ctx, mot[i], q.x - q.s * ond, q.y + q.c * ond, r * (1.25 - i * 0.045), couleur, g + i);
      }
      lettre(ctx, "A", x, y, r * 2.3, couleur, g, 4);
      yeux(ctx, x, y - r * 0.25, r * 0.28, r * 0.2, regard, g, true);
      const cy = y - r * 0.72;
      trait(ctx, [{ x: x - 12, y: cy }, { x: x - 13, y: cy - 12 }, { x: x - 6, y: cy - 5 }, { x, y: cy - 15 }, { x: x + 6, y: cy - 5 }, { x: x + 13, y: cy - 12 }, { x: x + 12, y: cy }], { couleur, epaisseur: 2, graine: g, ferme: true, fond: "rgba(230,180,60,0.6)" });
      break;
    }
    case "point": {
      // Le Point Final : un gros point d'encre, plein et luisant, qui écrase tout ; trois petits points le suivent
      const c = Math.cos(angle);
      const s = Math.sin(angle);
      for (let k = 1; k <= 3; k++) {
        ctx.fillStyle = couleur;
        ctx.beginPath();
        ctx.arc(x - c * r * (1.1 + k * 0.55), y - s * r * (1.1 + k * 0.55) + Math.sin(age * 6 + k) * 2, r * 0.16, 0, Math.PI * 2);
        ctx.fill();
      }
      const p = 1 + Math.sin(age * 3) * 0.04;
      ctx.fillStyle = couleur;
      ctx.beginPath();
      for (let k = 0; k <= 24; k++) {
        const a = (k / 24) * Math.PI * 2;
        const rr = r * 0.95 * p * (1 + (hash3(g, k % 24, 9) - 0.5) * 0.08);
        if (k) ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
        else ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      }
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.beginPath();
      ctx.ellipse(x - r * 0.35, y - r * 0.4, r * 0.22, r * 0.12, -0.6, 0, Math.PI * 2);
      ctx.fill();
      yeux(ctx, x, y - r * 0.1, r * 0.3, r * 0.24, regard, g, true);
      const cy = y - r * 0.92;
      trait(ctx, [{ x: x - 12, y: cy }, { x: x - 13, y: cy - 12 }, { x: x - 6, y: cy - 5 }, { x, y: cy - 15 }, { x: x + 6, y: cy - 5 }, { x: x + 13, y: cy - 12 }, { x: x + 12, y: cy }], { couleur, epaisseur: 2, graine: g, ferme: true, fond: "rgba(230,180,60,0.6)" });
      break;
    }
    case "gomme": {
      // Une lettre à moitié gommée, qui laisse une traînée effacée derrière elle
      const c = Math.cos(angle);
      const s = Math.sin(angle);
      ctx.save();
      ctx.globalAlpha *= 0.5;
      for (let k = 1; k <= 3; k++) {
        ctx.fillStyle = `rgba(250,246,232,${0.9 - k * 0.2})`;
        ctx.beginPath();
        ctx.ellipse(x - c * r * (0.7 + k * 0.7), y - s * r * (0.7 + k * 0.7), r * (0.9 - k * 0.15), r * 0.55, angle, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      for (let k = 0; k < 5; k++) {
        const u = hash3(g, k, 3);
        ctx.fillStyle = "rgba(196,48,43,0.35)";
        ctx.fillRect(x - c * r * (1 + u * 1.6) + (hash3(g, k, 4) - 0.5) * r, y - s * r * (1 + u * 1.6) + (hash3(g, k, 5) - 0.5) * r, 1.4, 1);
      }
      pattes(ctx, x, y + r * 0.85, 2, r * 0.45, r * 0.5, age * 0.8, couleur, g);
      lettre(ctx, "E", x, y, r * 3, couleur, g, 3);
      // La moitié gommée : du papier par-dessus, puis le grain de la gomme
      const cote = c >= 0 ? -1 : 1;
      const zone = [{ x, y: y - r * 1.2 }, { x: x + cote * r * 1.3, y: y - r * 1.2 }, { x: x + cote * r * 1.3, y: y + r * 0.9 }, { x, y: y + r * 0.9 }];
      ctx.fillStyle = "rgba(246,239,220,0.82)";
      ctx.beginPath();
      zone.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
      ctx.fill();
      hachures(ctx, zone, "rgba(196,48,43,0.25)", 3, 0.6, 0.8);
      yeux(ctx, x, y - r * 0.35, r * 0.36, r * 0.26, regard, g);
      break;
    }
    case "compas": {
      // L'esperluette géante, sur huit pattes
      pattes(ctx, x, y + r * 0.6, 8, r * 0.95, r * 0.45, age * 1.4, couleur, g);
      lettre(ctx, "&", x, y, r * 2.6, couleur, g, 4);
      yeux(ctx, x + r * 0.05, y - r * 0.45, r * 0.2, r * 0.15, regard, g, true);
      break;
    }
    case "postit": {
      // Un mot qui avance derrière une grosse parenthèse tenue comme un bouclier
      const c = Math.cos(angle);
      const s = Math.sin(angle);
      pattes(ctx, x, y + r * 0.7, 2, r * 0.35, r * 0.5, age, couleur, g);
      lettre(ctx, t("mot"), x - c * r * 0.2, y - s * r * 0.2, r * 2.2, couleur, g);
      yeux(ctx, x - c * r * 0.2, y - s * r * 0.2 - r * 0.55, r * 0.3, r * 0.22, regard, g);
      // La parenthèse, toujours devant lui, tournée vers où il va
      ctx.save();
      ctx.translate(x + c * r * 1.05, y + s * r * 1.05);
      ctx.rotate(angle);
      lettre(ctx, ")", 0, 0, r * 3.4, couleur, g + 3, 3);
      ctx.restore();
      break;
    }
    case "fantome": {
      // Le h muet, écrit au crayon : à peine visible
      const gris = couleur === ROUGE ? "#55576a" : couleur;
      const a = couleur === ROUGE ? 0.55 : 0.9;
      pattes(ctx, x, y + r * 0.85, 2, r * 0.38, r * 0.5, age, gris, g, a * 0.7);
      lettre(ctx, "h", x, y, r * 3.6, gris, g, 1, a);
      yeux(ctx, x + r * 0.1, y - r * 0.45, r * 0.34, r * 0.26, regard, g, false, a);
      break;
    }
    case "tippex": {
      // Le plus qui soigne
      pattes(ctx, x, y + r * 0.6, 2, r * 0.4, r * 0.5, age, couleur, g);
      lettre(ctx, "+", x, y, r * 3.6, couleur, g, 4);
      yeux(ctx, x, y - r * 0.1, r * 0.34, r * 0.24, regard, g);
      break;
    }
    case "punaise": {
      // Le point d'exclamation, penché vers la tour qu'il charge
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.cos(angle) * 0.25);
      pattes(ctx, 0, r * 1.15, 2, r * 0.35, r * 0.55, age * 1.4, couleur, g);
      lettre(ctx, "!", 0, 0, r * 3.8, couleur, g, 4);
      yeux(ctx, 0, -r * 0.75, r * 0.36, r * 0.27, regard, g, true);
      ctx.restore();
      break;
    }
    case "taille": {
      // L'Œ blindé : hachuré comme une armure, sur quatre pattes lourdes
      pattes(ctx, x, y + r * 0.75, 4, r * 0.6, r * 0.4, age * 0.7, couleur, g);
      lettre(ctx, "Œ", x, y, r * 2.4, couleur, g, 4);
      const armure = [{ x: x - r * 0.95, y: y - r * 0.75 }, { x: x + r * 0.95, y: y - r * 0.75 }, { x: x + r * 0.95, y: y + r * 0.6 }, { x: x - r * 0.95, y: y + r * 0.6 }];
      hachures(ctx, armure, "rgba(60,62,75,0.35)", 5, 1.2, 1);
      yeux(ctx, x - r * 0.3, y - r * 0.2, r * 0.2, r * 0.15, regard, g, true);
      break;
    }
  }
}

