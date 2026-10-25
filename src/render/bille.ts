// Bille, la mascotte : le stylo bille du joueur, debout sur sa pointe. Un corps transparent où l'on voit le tube
// d'encre, le capuchon bleu en guise de chapeau, deux yeux ronds, et des bras de trait qui montrent ce dont elle parle.
import { hash3 } from "../sim/rng";
import { BLEU, trait } from "./encre";

const CONTOUR = "#1e2a5a";

export interface PoseBille {
  /** Où elle regarde (−1 à gauche, 1 à droite). */
  regard?: number;
  /** Le point que son bras montre, s'il y en a un. */
  montre?: { x: number; y: number };
  /** Contente : grand sourire et petit saut. */
  joie?: boolean;
  /** Elle parle : la bouche bouge. */
  parle?: boolean;
}

/** Bille, la pointe posée en (x, y), haute de h. */
export function bille(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, t: number, o: PoseBille = {}): void {
  const saut = o.joie ? Math.abs(Math.sin(t * 7)) * h * 0.08 : Math.sin(t * 2.2) * h * 0.012;
  const pied = y - saut;
  const l = h * 0.27;
  const bas = pied - h * 0.17;
  const haut = pied - h * 0.82;
  const g = 900;
  const tic = Math.floor(t * 8);
  const tr = (i: number, a: number) => (hash3(g, i, tic) - 0.5) * 2 * a;
  ctx.save();
  // L'ombre sous la pointe
  ctx.fillStyle = "rgba(40,40,60,0.15)";
  ctx.beginPath();
  ctx.ellipse(x, y + 1, h * 0.14 * (1 - saut / h), h * 0.03, 0, 0, Math.PI * 2);
  ctx.fill();
  // Les bras, derrière le corps
  const epaule = { y: pied - h * 0.5 };
  const bras = (cote: number) => {
    const ex = x + cote * l * 0.5;
    let mx: number, my: number, fx: number, fy: number;
    if (o.montre && (o.montre.x - x) * cote > 0) {
      const a = Math.atan2(o.montre.y - epaule.y, o.montre.x - ex);
      mx = ex + Math.cos(a) * h * 0.2;
      my = epaule.y + Math.sin(a) * h * 0.2;
      fx = ex + Math.cos(a) * h * 0.36;
      fy = epaule.y + Math.sin(a) * h * 0.36;
    } else if (o.joie) {
      const a = -Math.PI / 2 - cote * (0.5 + Math.sin(t * 9) * 0.25);
      mx = ex + Math.cos(a) * h * 0.18;
      my = epaule.y + Math.sin(a) * h * 0.18;
      fx = ex + Math.cos(a) * h * 0.34;
      fy = epaule.y + Math.sin(a) * h * 0.34;
    } else {
      // Le poing sur la hanche
      mx = ex + cote * h * 0.12;
      my = epaule.y + h * 0.08;
      fx = ex + cote * h * 0.02;
      fy = epaule.y + h * 0.17;
    }
    trait(ctx, [{ x: ex, y: epaule.y }, { x: mx, y: my }, { x: fx, y: fy }], { couleur: CONTOUR, epaisseur: Math.max(1.4, h * 0.028), graine: g + cote, amp: 0.3, pate: false });
    ctx.fillStyle = CONTOUR;
    ctx.beginPath();
    ctx.arc(fx, fy, Math.max(1.4, h * 0.025), 0, Math.PI * 2);
    ctx.fill();
  };
  bras(-1);
  bras(1);
  // La pointe : un cône de métal, la bille au bout et une goutte d'encre
  trait(ctx, [{ x: x - l * 0.42, y: bas }, { x: x + l * 0.42, y: bas }, { x: x + l * 0.08, y: pied - h * 0.02 }, { x: x - l * 0.08, y: pied - h * 0.02 }], { couleur: CONTOUR, epaisseur: Math.max(1.2, h * 0.022), graine: g + 3, ferme: true, fond: "#c9ccd6", amp: 0.25, pate: false });
  ctx.fillStyle = BLEU;
  ctx.beginPath();
  ctx.arc(x, pied - h * 0.01, Math.max(1.4, h * 0.025), 0, Math.PI * 2);
  ctx.fill();
  // Le corps transparent, le tube d'encre dedans
  const corps = [{ x: x - l / 2, y: bas }, { x: x - l / 2, y: haut }, { x: x + l / 2, y: haut }, { x: x + l / 2, y: bas }];
  trait(ctx, corps, { couleur: CONTOUR, epaisseur: Math.max(1.4, h * 0.03), graine: g + 4, ferme: true, fond: "rgba(236,242,252,0.95)", amp: 0.3, pate: false });
  ctx.fillStyle = "rgba(34,64,143,0.18)";
  ctx.fillRect(x - l * 0.1, haut + h * 0.05, l * 0.2, bas - haut - h * 0.05);
  ctx.fillStyle = "rgba(34,64,143,0.55)";
  ctx.fillRect(x - l * 0.1, haut + h * 0.33, l * 0.2, bas - haut - h * 0.33);
  // Un reflet sur le plastique
  ctx.strokeStyle = "rgba(255,255,255,0.8)";
  ctx.lineWidth = Math.max(1, h * 0.02);
  ctx.beginPath();
  ctx.moveTo(x - l * 0.32, haut + h * 0.06);
  ctx.lineTo(x - l * 0.32, bas - h * 0.06);
  ctx.stroke();
  // Le capuchon, en chapeau un peu de travers, avec son agrafe
  ctx.save();
  ctx.translate(x, haut);
  ctx.rotate(-0.12 + Math.sin(t * 1.3) * 0.03);
  const cl = l * 1.12;
  trait(ctx, [{ x: -cl / 2, y: h * 0.02 }, { x: -cl / 2, y: -h * 0.2 }, { x: -cl * 0.3, y: -h * 0.25 }, { x: cl * 0.3, y: -h * 0.25 }, { x: cl / 2, y: -h * 0.2 }, { x: cl / 2, y: h * 0.02 }], { couleur: CONTOUR, epaisseur: Math.max(1.4, h * 0.03), graine: g + 5, ferme: true, fond: BLEU, amp: 0.3, pate: false });
  trait(ctx, [{ x: cl / 2, y: -h * 0.18 }, { x: cl / 2 + h * 0.05, y: -h * 0.15 }, { x: cl / 2 + h * 0.05, y: h * 0.12 }], { couleur: CONTOUR, epaisseur: Math.max(1.2, h * 0.022), graine: g + 6, amp: 0.2, pate: false });
  ctx.restore();
  // Les yeux
  const clin = (t + 0.7) % 3.4 < 0.12;
  const ry = Math.max(2.2, h * 0.07);
  const yo = haut + h * 0.17;
  const regard = o.montre ? Math.sign(o.montre.x - x) * 0.8 : o.regard ?? 0.3;
  for (const s of [-1, 1]) {
    const ex = x + s * l * 0.24 + tr(s, h * 0.004);
    ctx.lineWidth = Math.max(1, h * 0.022);
    ctx.strokeStyle = CONTOUR;
    if (clin) {
      ctx.beginPath();
      ctx.moveTo(ex - ry, yo);
      ctx.lineTo(ex + ry, yo);
      ctx.stroke();
      continue;
    }
    ctx.fillStyle = "#fffdf6";
    ctx.beginPath();
    ctx.arc(ex, yo, ry, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = CONTOUR;
    ctx.beginPath();
    ctx.arc(ex + regard * ry * 0.45, yo + ry * 0.12, ry * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(ex + regard * ry * 0.45 - ry * 0.15, yo - ry * 0.1, ry * 0.15, 0, Math.PI * 2);
    ctx.fill();
  }
  // Les joues et la bouche
  ctx.fillStyle = "rgba(230,110,110,0.35)";
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(x + s * l * 0.32, yo + ry * 1.5, ry * 0.5, ry * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const ouvre = o.parle ? Math.abs(Math.sin(t * 13)) : 0;
  ctx.strokeStyle = CONTOUR;
  ctx.lineWidth = Math.max(1, h * 0.022);
  ctx.beginPath();
  const by = yo + ry * 1.75;
  if (o.joie || ouvre > 0.3) {
    ctx.fillStyle = "#7a2630";
    ctx.ellipse(x, by, l * 0.14, ry * (o.joie ? 0.75 : 0.25 + ouvre * 0.45), 0, 0, Math.PI);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.arc(x, by - ry * 0.4, l * 0.15, 0.35, Math.PI - 0.35);
    ctx.stroke();
  }
  ctx.restore();
}
