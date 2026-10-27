// La couverture du cahier : chaque succès donne un autocollant, et les étoiles dorées en donnent d'autres (une toutes
// les dix). On les prend dans la pochette en bas et on les colle où on veut sur la couverture, un peu de travers ; un
// autocollant collé se décolle pour le déplacer, ou se range en le reposant dans la pochette. Ceux qu'on n'a pas encore
// sont en pointillés : un toucher dit comment les gagner.
import { BLEU, CRAYON, ROUGE, boite, cercle, ecrire, paragraphe, trait } from "../render/encre";
import { monstre } from "../render/monstres";
import { coeur } from "../render/scene";
import { symbole } from "../render/tours";
import type { TypeEnnemi } from "../sim/ennemis";
import { SUCCES } from "../succes";
import { enregistrer, sauvegarde, totalEtoiles } from "../progression";
import { t } from "../i18n";
import { H, W, bouton, ui } from "./base";
import { nav } from "./nav";
import { etoile } from "./partie";

type Dessin = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number) => void;

interface Autocollant {
  id: string;
  nom: () => string;
  /** Comment l'obtenir. */
  texte: () => string;
  gagne: () => boolean;
  dessin: Dessin;
}

const bete = (type: TypeEnnemi, k = 0.62): Dessin => (ctx, x, y, r) => monstre(ctx, type, x, y, r * k, 3, ui.temps, ROUGE, 0);
const doree: Dessin = (_ctx, x, y, r) => etoile(x, y, r * 0.7, true, 41);

/** Ce que montre l'autocollant de chaque succès. */
const DESSINS: Record<string, Dessin> = {
  "rature.tuto": (ctx, x, y, r) => symbole(ctx, "cercle", x, y, r * 0.5, BLEU, 2.4),
  "rature.page1": doree,
  "rature.cahier1": bete("gribouille"),
  "rature.cahier2": bete("araignee"),
  "rature.cahier3": bete("carre"),
  "rature.cahier4": bete("avion"),
  "rature.etoiles": (ctx, x, y, r) => {
    etoile(x, y - r * 0.08, r * 0.72, true, 42);
    ecrire(ctx, "1er", x, y + r * 0.02, { police: "titre", taille: r * 0.42, couleur: "#7a4a00" });
  },
  "rature.sansfaute": (ctx, x, y, r) => coeur(ctx, x, y, r * 0.42, 0),
  "rature.combo5": (ctx, x, y, r) => {
    ecrire(ctx, "abcde", x, y, { police: "titre", taille: r * 0.55, couleur: ROUGE });
    trait(ctx, [{ x: x - r * 0.7, y: y + r * 0.12 }, { x: x + r * 0.7, y: y - r * 0.12 }], { couleur: BLEU, epaisseur: 2.6, graine: 44 });
  },
  "rature.serpent": bete("mere", 0.42),
  "rature.esperluette": bete("compas", 0.42),
  "rature.oe": bete("taille", 0.42),
  "rature.dictateur": bete("point", 0.42),
  "rature.interro": (ctx, x, y, r) => {
    ecrire(ctx, "20/20", x, y, { police: "titre", taille: r * 0.5, couleur: ROUGE, rotation: -0.1 });
    cercle(ctx, x, y, r * 0.62, { couleur: ROUGE, epaisseur: 1.8, graine: 45 });
  },
  "rature.defi": (ctx, x, y, r) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.2);
    boite(ctx, -r * 0.62, -r * 0.3, r * 1.24, r * 0.6, { couleur: ROUGE, epaisseur: 2.2, graine: 46 });
    ecrire(ctx, t("DÉFI"), 0, 1, { police: "titre", taille: r * 0.45, couleur: ROUGE });
    ctx.restore();
  },
  "rature.coop": (ctx, x, y, r) => {
    symbole(ctx, "cercle", x - r * 0.25, y, r * 0.3, BLEU, 2.2);
    symbole(ctx, "cercle", x + r * 0.25, y, r * 0.3, ROUGE, 2.2);
  },
  "rature.trousse": (ctx, x, y, r) => symbole(ctx, "etoile", x, y, r * 0.5, BLEU, 2.2),
  "rature.jour7": (ctx, x, y, r) => {
    boite(ctx, x - r * 0.5, y - r * 0.5, r, r, { couleur: BLEU, epaisseur: 1.8, graine: 47 });
    trait(ctx, [{ x: x - r * 0.5, y: y - r * 0.22 }, { x: x + r * 0.5, y: y - r * 0.22 }], { couleur: ROUGE, epaisseur: 1.6, graine: 48 });
    ecrire(ctx, "7", x, y + r * 0.12, { police: "titre", taille: r * 0.6 });
  },
};

/** Tous les autocollants : un par succès, puis une étoile dorée toutes les dix étoiles de la campagne. */
function tous(): Autocollant[] {
  const l: Autocollant[] = SUCCES.map((s) => ({
    id: s.id, nom: () => t(s.nom), texte: () => t(s.texte), gagne: () => sauvegarde.succes.includes(s.id), dessin: DESSINS[s.id] ?? doree,
  }));
  for (let k = 1; k <= 6; k++) {
    l.push({ id: `etoiles.${k * 10}`, nom: () => t("Étoile dorée"), texte: () => t("Gagner {n} étoiles dans la campagne.", { n: k * 10 }), gagne: () => totalEtoiles() >= k * 10, dessin: doree });
  }
  return l;
}

// La couverture et la pochette, dans le cadre du menu (400 × 870)
const COUV = { x: 26, y: 92, w: W - 52, h: 520 };
const POCHETTE = { x: 14, y: 640, w: W - 28, h: 150 };
const R = 26;

let pris: { id: string; x: number; y: number; dx: number; dy: number } | null = null;
let info: { a: Autocollant; depuis: number } | null = null;
let deplace = false;

const dansCouverture = (x: number, y: number) => x > COUV.x + R * 0.6 && x < COUV.x + COUV.w - R * 0.6 && y > COUV.y + R * 0.6 && y < COUV.y + COUV.h - R * 0.6;

/** Les places de la pochette : ceux qu'on a et qu'on n'a pas collés, puis ceux qui restent à gagner. */
function pochette(): { a: Autocollant; x: number; y: number }[] {
  const libres = tous().filter((a) => !sauvegarde.couverture[a.id]).sort((a, b) => Number(b.gagne()) - Number(a.gagne()));
  const parLigne = 7;
  const pas = (POCHETTE.w - 20) / parLigne;
  return libres.slice(0, parLigne * 2).map((a, i) => ({ a, x: POCHETTE.x + 10 + pas / 2 + (i % parLigne) * pas, y: POCHETTE.y + 44 + Math.floor(i / parLigne) * 56 }));
}

function autocollant(ctx: CanvasRenderingContext2D, a: Autocollant, x: number, y: number, r: number, rot: number, leve = 0): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  if (!a.gagne()) {
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = CRAYON;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ecrire(ctx, "?", 0, 1, { police: "titre", taille: r, couleur: CRAYON });
    ctx.restore();
    return;
  }
  // Le papier blanc découpé autour du dessin, avec son ombre (plus grande quand on le tient)
  ctx.shadowColor = "rgba(40,30,10,0.35)";
  ctx.shadowBlur = 3 + leve * 8;
  ctx.shadowOffsetY = 1.5 + leve * 6;
  ctx.fillStyle = "#fffdf6";
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.strokeStyle = "rgba(60,62,75,0.25)";
  ctx.lineWidth = 0.8;
  ctx.stroke();
  // Le dessin ne déborde pas du papier découpé
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, r - 2, 0, Math.PI * 2);
  ctx.clip();
  a.dessin(ctx, 0, 0, r);
  ctx.restore();
  // Un petit reflet de vernis
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.beginPath();
  ctx.ellipse(-r * 0.35, -r * 0.45, r * 0.32, r * 0.1, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function dessinerCouverture(): void {
  const ctx = ui.ctx;
  const liste = tous();
  const gagnes = liste.filter((a) => a.gagne()).length;
  ecrire(ctx, t("Mon cahier"), W / 2, 44, { police: "titre", taille: 44 });
  ecrire(ctx, t("{n} autocollants sur {m}", { n: gagnes, m: liste.length }), W / 2, 76, { taille: 15, couleur: CRAYON });
  // La couverture en carton, avec son étiquette
  ctx.save();
  ctx.shadowColor = "rgba(40,30,10,0.3)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 4;
  const g = ctx.createLinearGradient(COUV.x, COUV.y, COUV.x + COUV.w, COUV.y + COUV.h);
  g.addColorStop(0, "#3d5fb0");
  g.addColorStop(1, "#2a4690");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(COUV.x, COUV.y, COUV.w, COUV.h, 6);
  ctx.fill();
  ctx.restore();
  // Le grain du carton
  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = "#ffffff";
  for (let k = 0; k < 260; k++) ctx.fillRect(COUV.x + ((k * 97) % COUV.w), COUV.y + ((k * 211) % COUV.h), 1.2, 1.2);
  ctx.restore();
  const ex = W / 2 - 110;
  const ey = COUV.y + 40;
  ctx.fillStyle = "#fffdf6";
  ctx.fillRect(ex, ey, 220, 74);
  boite(ctx, ex + 6, ey + 6, 208, 62, { couleur: BLEU, epaisseur: 1.2, graine: 400 });
  ecrire(ctx, t("Cahier de"), ex + 16, ey + 22, { align: "left", taille: 14, couleur: CRAYON });
  ecrire(ctx, "Rature", W / 2, ey + 46, { police: "titre", taille: 32 });
  // Les autocollants collés
  for (const a of liste) {
    const c = sauvegarde.couverture[a.id];
    if (!c || pris?.id === a.id || !a.gagne()) continue;
    autocollant(ctx, a, c.x, c.y, R, c.r);
  }
  // La pochette
  boite(ctx, POCHETTE.x, POCHETTE.y, POCHETTE.w, POCHETTE.h, { couleur: CRAYON, epaisseur: 1.4, graine: 401, fond: "rgba(255,252,240,0.85)" });
  ecrire(ctx, t("La pochette : prends un autocollant et colle-le sur la couverture"), W / 2, POCHETTE.y + 14, { taille: 13, couleur: CRAYON });
  for (const s of pochette()) if (pris?.id !== s.a.id) autocollant(ctx, s.a, s.x, s.y, R * 0.8, 0);
  if (pris) {
    const a = liste.find((x) => x.id === pris!.id);
    if (a) autocollant(ctx, a, pris.x, pris.y, R * 1.08, Math.sin(ui.temps * 3) * 0.05, 1);
  }
  if (info && ui.temps - info.depuis < 3) {
    const a = info.a;
    boite(ctx, 30, POCHETTE.y - 70, W - 60, 60, { couleur: a.gagne() ? BLEU : ROUGE, epaisseur: 1.6, graine: 402, fond: "rgba(255,252,240,0.97)" });
    ecrire(ctx, a.nom(), W / 2, POCHETTE.y - 54, { police: "titre", taille: 22, couleur: a.gagne() ? BLEU : ROUGE });
    paragraphe(ctx, a.texte(), W / 2, POCHETTE.y - 40, W - 80, { taille: 13, couleur: CRAYON });
  }
  bouton(14, H - 66, 120, 48, t("Retour"), () => nav.aller("titre"), { taille: 18 });
}

/** Le doigt se pose : sur un autocollant collé (on le décolle) ou dans la pochette (on en prend un). */
export function toucherCouverture(x: number, y: number): boolean {
  const liste = tous();
  deplace = false;
  // Le dernier collé est par-dessus : on cherche en partant de la fin
  for (const a of [...liste].reverse()) {
    const c = sauvegarde.couverture[a.id];
    if (c && a.gagne() && Math.hypot(x - c.x, y - c.y) < R) {
      pris = { id: a.id, x, y, dx: c.x - x, dy: c.y - y };
      return true;
    }
  }
  for (const s of pochette()) {
    if (Math.hypot(x - s.x, y - s.y) > R * 0.9) continue;
    info = { a: s.a, depuis: ui.temps };
    if (s.a.gagne()) pris = { id: s.a.id, x, y, dx: s.x - x, dy: s.y - y };
    return true;
  }
  return false;
}

export function glisserCouverture(x: number, y: number): void {
  if (!pris) return;
  if (Math.hypot(x + pris.dx - pris.x, y + pris.dy - pris.y) > 3) deplace = true;
  pris.x = x + pris.dx;
  pris.y = y + pris.dy;
}

/** Le doigt se lève : collé sur la couverture (un peu de travers), ou rangé dans la pochette. */
export function leverCouverture(): void {
  const p = pris;
  pris = null;
  if (!p) return;
  const avant = sauvegarde.couverture[p.id];
  if (dansCouverture(p.x, p.y)) {
    if (!deplace && avant) return;
    sauvegarde.couverture[p.id] = { x: Math.round(p.x), y: Math.round(p.y), r: avant?.r ?? Math.round((Math.random() - 0.5) * 50) / 100 };
  } else if (avant) delete sauvegarde.couverture[p.id];
  else return;
  enregistrer();
}
