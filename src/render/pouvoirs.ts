// Les pouvoirs dessinés : la règle en bois, le lasso au stylo rouge, la gomme rose et bleue, et leurs icônes.
import type { V } from "../sim/geom";
import { LARGEUR_REGLE, type Pouvoir } from "../sim/pouvoirs";
import { hash3 } from "../sim/rng";
import { t } from "../i18n";
import { CRAYON, ROUGE, ecrire, trait } from "./encre";

const BOIS = "rgba(231,196,128,0.96)";
const BOIS_FONCE = "#9a6b2f";

/** Une règle d'écolier posée de a à b. `levee` la soulève (0 posée, 1 haut) ; `fantome` la dessine en pointillé. */
export function regle(ctx: CanvasRenderingContext2D, a: V, b: V, o: { levee?: number; alpha?: number; fantome?: boolean; graine?: number } = {}): void {
  const l = Math.hypot(b.x - a.x, b.y - a.y);
  if (l < 4) return;
  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  const w = LARGEUR_REGLE * 2;
  const levee = o.levee ?? 0;
  const g = o.graine ?? 3;
  ctx.save();
  ctx.globalAlpha *= o.alpha ?? 1;
  ctx.translate((a.x + b.x) / 2, (a.y + b.y) / 2);
  ctx.rotate(ang);
  if (o.fantome) {
    ctx.setLineDash([6, 5]);
    ctx.strokeStyle = BOIS_FONCE;
    ctx.lineWidth = 1.4;
    ctx.fillStyle = "rgba(231,196,128,0.18)";
    ctx.beginPath();
    ctx.rect(-l / 2, -w / 2, l, w);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    return;
  }
  // L'ombre portée s'écarte quand la règle se soulève
  ctx.fillStyle = `rgba(40,30,20,${0.22 - levee * 0.12})`;
  ctx.fillRect(-l / 2 + 4 + levee * 10, -w / 2 + 5 + levee * 18, l, w);
  ctx.translate(0, -levee * 26);
  ctx.scale(1 + levee * 0.08, 1 + levee * 0.08);
  ctx.fillStyle = BOIS;
  ctx.fillRect(-l / 2, -w / 2, l, w);
  // Le fil du bois
  ctx.strokeStyle = "rgba(154,107,47,0.25)";
  ctx.lineWidth = 0.8;
  for (let k = 0; k < 4; k++) {
    const y = -w / 2 + 5 + k * 7 + hash3(g, k, 1) * 2;
    ctx.beginPath();
    ctx.moveTo(-l / 2, y);
    for (let x = -l / 2; x <= l / 2; x += 20) ctx.lineTo(x, y + Math.sin(x * 0.05 + k * 2 + g) * 1.4);
    ctx.stroke();
  }
  trait(ctx, [{ x: -l / 2, y: -w / 2 }, { x: l / 2, y: -w / 2 }, { x: l / 2, y: w / 2 }, { x: -l / 2, y: w / 2 }], { ferme: true, couleur: BOIS_FONCE, epaisseur: 1.6, amp: 0.25, graine: g });
  // Les graduations et les centimètres
  const pas = 8;
  for (let i = 0, x = -l / 2 + 6; x < l / 2 - 3; i++, x += pas) {
    const h = i % 5 === 0 ? 9 : 5;
    trait(ctx, [{ x, y: -w / 2 }, { x, y: -w / 2 + h }], { couleur: "#4a3418", epaisseur: i % 5 === 0 ? 1.2 : 0.8, amp: 0.1, graine: g + i });
    if (i % 5 === 0) ecrire(ctx, String(i / 5), x, -w / 2 + 16, { taille: 8, couleur: "#4a3418" });
  }
  ctx.restore();
}

/** Le lasso : une boucle au stylo rouge, son nœud et le bout de corde qui pend. */
export function lasso(ctx: CanvasRenderingContext2D, poly: V[], t: number, temps: number, graine: number): void {
  if (poly.length < 3) return;
  const alpha = t > 0.85 ? (1 - t) / 0.15 : 1;
  const serre = Math.min(1, t * 8);
  const cx = poly.reduce((s, p) => s + p.x, 0) / poly.length;
  const cy = poly.reduce((s, p) => s + p.y, 0) / poly.length;
  // La boucle se resserre un peu au début, puis tremble
  const k = 1 - serre * 0.06;
  const pts = poly.map((p, i) => ({ x: cx + (p.x - cx) * k + Math.sin(temps * 9 + i) * 0.6, y: cy + (p.y - cy) * k + Math.cos(temps * 8 + i) * 0.6 }));
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = "rgba(196,48,43,0.07)";
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  trait(ctx, pts, { ferme: true, couleur: ROUGE, epaisseur: 2.6, amp: 0.5, graine, alpha });
  trait(ctx, pts, { ferme: true, couleur: ROUGE, epaisseur: 1, amp: 1.2, graine: graine + 1, alpha: alpha * 0.6 });
  // Le nœud, au point le plus haut, et la corde qui pend
  const haut = pts.reduce((m, p) => (p.y < m.y ? p : m), pts[0]);
  trait(ctx, [haut, { x: haut.x + 6, y: haut.y - 6 }, { x: haut.x + 2, y: haut.y - 10 }, { x: haut.x - 3, y: haut.y - 4 }, haut], { couleur: ROUGE, epaisseur: 2, amp: 0.3, graine: graine + 2, alpha });
  const corde: V[] = [];
  for (let i = 0; i <= 8; i++) corde.push({ x: haut.x + 4 + i * 4, y: haut.y - 8 - i * 3 + Math.sin(temps * 3 + i * 0.8) * 2 });
  trait(ctx, corde, { couleur: ROUGE, epaisseur: 1.8, amp: 0.3, graine: graine + 3, alpha });
  // Le compte à rebours, en petits traits qui s'effacent
  const restants = Math.ceil((1 - t) * 5);
  for (let i = 0; i < restants; i++) trait(ctx, [{ x: haut.x - 18 - i * 5, y: haut.y - 14 }, { x: haut.x - 16 - i * 5, y: haut.y - 6 }], { couleur: ROUGE, epaisseur: 1.4, amp: 0.2, graine: graine + 10 + i, alpha });
}

/** Une gomme bicolore vue de dessus, penchée. */
export function gomme(ctx: CanvasRenderingContext2D, x: number, y: number, taille: number, angle: number, alpha = 1): void {
  const w = taille * 2.2;
  const h = taille;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = "rgba(40,30,20,0.18)";
  ctx.fillRect(-w / 2 + 4, -h / 2 + 6, w, h);
  // Le côté rose (encre) et le côté bleu (stylo), avec l'arête en relief
  ctx.fillStyle = "#f2a7b0";
  ctx.fillRect(-w / 2, -h / 2, w * 0.55, h);
  ctx.fillStyle = "#7fa6d9";
  ctx.fillRect(-w / 2 + w * 0.55, -h / 2, w * 0.45, h);
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fillRect(-w / 2, -h / 2, w, h * 0.22);
  trait(ctx, [{ x: -w / 2, y: -h / 2 }, { x: w / 2, y: -h / 2 }, { x: w / 2, y: h / 2 }, { x: -w / 2, y: h / 2 }], { ferme: true, couleur: "#5a3b3f", epaisseur: 1.5, amp: 0.25, graine: 4 });
  trait(ctx, [{ x: -w / 2 + w * 0.55, y: -h / 2 }, { x: -w / 2 + w * 0.55, y: h / 2 }], { couleur: "#5a3b3f", epaisseur: 1, amp: 0.2, graine: 5 });
  ecrire(ctx, t("GOMME"), -w / 2 + w * 0.27, 1, { taille: Math.max(6, taille * 0.32), couleur: "rgba(90,59,63,0.7)", police: "titre" });
  ctx.restore();
}

/** Le passage de la gomme : elle frotte, et la page blanchit sous elle. */
export function frottement(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, t: number, graine: number): void {
  // Le papier frotté, plus clair, qui se fond ensuite
  ctx.save();
  ctx.globalAlpha = 0.55 * (t < 0.6 ? Math.min(1, t * 4) : 1 - (t - 0.6) / 0.4);
  const grad = ctx.createRadialGradient(x, y, r * 0.2, x, y, r);
  grad.addColorStop(0, "rgba(255,253,245,1)");
  grad.addColorStop(1, "rgba(255,253,245,0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (t < 0.7) {
    const va = Math.sin(t * 40) * r * 0.55;
    const vb = Math.cos(t * 23 + graine) * r * 0.25;
    gomme(ctx, x + va, y + vb, Math.max(14, r * 0.42), -0.35 + Math.sin(t * 40) * 0.12, t > 0.55 ? (0.7 - t) / 0.15 : 1);
  }
}

/** L'icône d'un pouvoir, pour son bouton. */
export function icone(ctx: CanvasRenderingContext2D, p: Pouvoir, x: number, y: number, taille: number, actif: boolean): void {
  const s = taille;
  if (p === "regle") {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.6);
    ctx.fillStyle = actif ? BOIS : "rgba(200,190,170,0.6)";
    ctx.fillRect(-s, -s * 0.28, s * 2, s * 0.56);
    trait(ctx, [{ x: -s, y: -s * 0.28 }, { x: s, y: -s * 0.28 }, { x: s, y: s * 0.28 }, { x: -s, y: s * 0.28 }], { ferme: true, couleur: actif ? BOIS_FONCE : CRAYON, epaisseur: 1.3, amp: 0.2, graine: 21 });
    for (let i = 0; i < 7; i++) {
      const xx = -s + 3 + i * ((s * 2 - 6) / 6);
      trait(ctx, [{ x: xx, y: -s * 0.28 }, { x: xx, y: -s * 0.28 + (i % 3 === 0 ? 5 : 3) }], { couleur: actif ? "#4a3418" : CRAYON, epaisseur: 0.8, amp: 0.1, graine: 22 + i });
    }
    ctx.restore();
  } else if (p === "lasso") {
    const pts: V[] = [];
    for (let i = 0; i <= 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      pts.push({ x: x + Math.cos(a) * s * 0.8, y: y + 2 + Math.sin(a) * s * 0.55 });
    }
    const c = actif ? ROUGE : CRAYON;
    trait(ctx, pts, { couleur: c, epaisseur: 2, amp: 0.3, graine: 31 });
    trait(ctx, [{ x: x + s * 0.2, y: y - s * 0.5 }, { x: x + s * 0.6, y: y - s * 0.85 }, { x: x + s, y: y - s * 0.75 }], { couleur: c, epaisseur: 1.6, amp: 0.3, graine: 32 });
  } else {
    if (actif) gomme(ctx, x, y, s * 0.75, -0.35);
    else {
      ctx.save();
      ctx.globalAlpha = 0.45;
      gomme(ctx, x, y, s * 0.75, -0.35);
      ctx.restore();
    }
  }
}
