// La trousse : on repasse le pochoir d'une tour au doigt, la prof tamponne « ACCEPTÉ », et ce dessin devient
// l'apparence de la tour en jeu. Purement esthétique.
import { debloquer } from "../succes";
import { BLEU, CRAYON, ROUGE, ecrire, paragraphe, boite, trait } from "../render/encre";
import { dessinerTour, reglerApparences } from "../render/tours";
import type { V } from "../sim/geom";
import { TOURS, TYPES_TOURS, type TypeTour } from "../sim/tours";
import { enregistrer, sauvegarde, toursDebloquees } from "../progression";
import { H, W, bouton, titre, ui, zone } from "./base";
import { nav } from "./nav";
import { t } from "../i18n";

const cercleN = (r: number, n = 28, cx = 0, cy = 0): V[] => Array.from({ length: n + 1 }, (_, i) => ({ x: cx + Math.cos((i / n) * Math.PI * 2) * r, y: cy + Math.sin((i / n) * Math.PI * 2) * r }));
const pts = (a: [number, number][]): V[] => a.map(([x, y]) => ({ x, y }));

/** Les pochoirs : des traits dans [-1, 1]. */
export const POCHOIRS: Record<TypeTour, V[][]> = {
  plume: [cercleN(0.8), cercleN(0.45), pts([[-0.2, -0.8], [-0.2, -1], [0.2, -1], [0.2, -0.8]])],
  roquette: [pts([[0, -0.95], [-0.85, 0.65], [0.85, 0.65], [0, -0.95]]), pts([[0, -0.4], [-0.35, 0.3], [0.35, 0.3], [0, -0.4]])],
  foudre: [cercleN(0.85), pts([[0.15, -0.6], [-0.3, 0.05], [0.2, 0], [-0.15, 0.6]])],
  correction: [pts([[-0.75, -0.75], [0.75, -0.75], [0.75, 0.75], [-0.75, 0.75], [-0.75, -0.75]]), pts([[-0.75, -0.45], [-0.95, -0.45]]), pts([[0.75, -0.45], [0.95, -0.45]])],
  spirale: [cercleN(0.9, 32), Array.from({ length: 41 }, (_, i) => ({ x: Math.cos((i / 40) * Math.PI * 4) * (0.1 + (i / 40) * 0.6), y: Math.sin((i / 40) * Math.PI * 4) * (0.1 + (i / 40) * 0.6) }))],
  scie: [Array.from({ length: 11 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 ? 0.42 : 0.92;
    return { x: Math.cos(a) * r, y: Math.sin(a) * r };
  }), cercleN(0.2, 12)],
  encrier: [pts([[-0.8, -0.2], [-0.8, 0.7], [0.8, 0.7], [0.8, -0.2], [0.4, -0.5], [-0.4, -0.5], [-0.8, -0.2]]), pts([[-0.3, -0.5], [-0.3, -0.85], [0.3, -0.85], [0.3, -0.5]])],
};

const CX = W / 2;
const CY = 380;
const ECHELLE = 120;

let choisi: TypeTour | null = null;
let traits: V[][] = [];
let enCours: V[] | null = null;
let accepte = 0;

export function chargerApparences(): void {
  reglerApparences(sauvegarde.apparences);
}

/** La part du pochoir couverte par le dessin. */
function couverture(type: TypeTour): number {
  const modele = POCHOIRS[type].flat();
  const tous = traits.flat();
  if (!tous.length) return 0;
  let ok = 0;
  for (const p of modele) if (tous.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < 0.09)) ok++;
  return ok / modele.length;
}

export function dessinerTrousse(): void {
  const ctx = ui.ctx;
  if (!choisi) {
    titre(t("La trousse"), 40, 44);
    paragraphe(ctx, t("Repasse le pochoir d'une tour : ton dessin deviendra son apparence en jeu."), W / 2, 84, 330, { taille: 15, couleur: CRAYON });
    const debloquees = toursDebloquees();
    TYPES_TOURS.forEach((ty, i) => {
      const x = 70 + (i % 3) * 130;
      const y = 190 + Math.floor(i / 3) * 150;
      const ok = debloquees.includes(ty);
      boite(ctx, x - 52, y - 52, 104, 128, { couleur: ok ? BLEU : CRAYON, epaisseur: 1.6, graine: 400 + i, fond: "rgba(255,252,240,0.85)" });
      if (ok) {
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(2, 2);
        dessinerTour(ctx, { type: ty, x: 0, y: 0, angle: -0.6, niveau: 1, spec: 0, temps: ui.temps, id: i });
        ctx.restore();
        zone(x - 52, y - 52, 104, 128, () => ouvrir(ty));
      } else ecrire(ctx, "?", x, y, { police: "titre", taille: 40, couleur: CRAYON });
      ecrire(ctx, ok ? t(TOURS[ty].nom) : t("à débloquer"), x, y + 56, { taille: 15, couleur: ok ? BLEU : CRAYON });
      if (sauvegarde.apparences[ty]) ecrire(ctx, t("perso"), x + 34, y - 40, { taille: 11, couleur: ROUGE, rotation: 0.2 });
    });
    bouton(120, H - 62, 160, 44, t("Retour"), () => nav.aller("titre"));
    return;
  }
  const ty = choisi;
  titre(t(TOURS[ty].nom), 40, 40);
  paragraphe(ctx, t("Repasse les pointillés au doigt, en autant de traits que tu veux. Ajoute ta touche : tout ce que tu dessines dans le cadre compte."), W / 2, 80, 340, { taille: 14, couleur: CRAYON });
  boite(ctx, CX - 150, CY - 150, 300, 300, { couleur: CRAYON, epaisseur: 1.4, graine: 450, fond: "rgba(255,255,255,0.5)" });
  ctx.save();
  ctx.setLineDash([4, 6]);
  for (const s of POCHOIRS[ty]) trait(ctx, s.map((p) => ({ x: CX + p.x * ECHELLE, y: CY + p.y * ECHELLE })), { couleur: "rgba(60,62,75,0.45)", epaisseur: 2, amp: 0 });
  ctx.restore();
  for (const [i, s] of [...traits, ...(enCours ? [enCours] : [])].entries()) trait(ctx, s.map((p) => ({ x: CX + p.x * ECHELLE, y: CY + p.y * ECHELLE })), { epaisseur: 3.5, graine: i + 1, amp: 0.4 });
  const c = couverture(ty);
  ecrire(ctx, t("pochoir repassé : {n} %", { n: Math.round(c * 100) }), CX, CY + 172, { taille: 15, couleur: c >= 0.7 ? BLEU : CRAYON });
  if (accepte && ui.temps - accepte < 1.6) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, (1.6 - (ui.temps - accepte)) * 2);
    boite(ctx, CX - 90, CY - 30, 180, 56, { couleur: ROUGE, epaisseur: 3, graine: 460 });
    ecrire(ctx, t("ACCEPTÉ"), CX, CY - 1, { police: "titre", taille: 40, couleur: ROUGE, rotation: -0.12 });
    ctx.restore();
  } else if (accepte) {
    choisi = null;
    accepte = 0;
    return;
  }
  bouton(20, H - 120, 112, 46, t("Effacer"), () => (traits = []), { taille: 18 });
  bouton(144, H - 120, 112, 46, t("Original"), () => {
    delete sauvegarde.apparences[ty];
    enregistrer();
    chargerApparences();
    choisi = null;
  }, { taille: 18 });
  bouton(268, H - 120, 112, 46, t("Valider"), () => {
    if (couverture(ty) < 0.7) return;
    debloquer("rature.trousse");
    sauvegarde.apparences[ty] = traits.map((s) => s.map((p) => ({ x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100 })));
    enregistrer();
    chargerApparences();
    accepte = ui.temps;
  }, { taille: 18, principal: true, inactif: c < 0.7 });
  bouton(120, H - 62, 160, 44, t("Retour"), () => (choisi = null), { taille: 18 });
}

function ouvrir(t: TypeTour): void {
  choisi = t;
  traits = [];
  enCours = null;
  accepte = 0;
}

export function toucherTrousse(x: number, y: number): boolean {
  if (!choisi || accepte) return false;
  if (Math.abs(x - CX) > 150 || Math.abs(y - CY) > 150) return false;
  enCours = [{ x: (x - CX) / ECHELLE, y: (y - CY) / ECHELLE }];
  return true;
}

export function glisserTrousse(x: number, y: number): void {
  if (!enCours) return;
  const p = { x: Math.max(-1.25, Math.min(1.25, (x - CX) / ECHELLE)), y: Math.max(-1.25, Math.min(1.25, (y - CY) / ECHELLE)) };
  const d = enCours[enCours.length - 1];
  if (Math.hypot(p.x - d.x, p.y - d.y) > 0.02) enCours.push(p);
}

export function leverTrousse(): void {
  if (enCours && enCours.length > 1) traits.push(enCours);
  enCours = null;
}
