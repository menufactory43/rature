// Le cartable : avant une page, on voit ce qui arrive (les monstres annoncés, le boss) et on choisit ce qu'on emporte,
// quatre tours et un pouvoir, pas tout. Le dernier cartable de chaque page est gardé pour la fois suivante.
import { BLEU, CRAYON, ROUGE, boite, ecrire, paragraphe } from "../render/encre";
import { monstre } from "../render/monstres";
import { icone } from "../render/pouvoirs";
import { symbole } from "../render/tours";
import { ENNEMIS, type TypeEnnemi } from "../sim/ennemis";
import type { Page } from "../sim/pages";
import { POUVOIRS, type Pouvoir } from "../sim/pouvoirs";
import { TOURS, type TypeTour } from "../sim/tours";
import { planifier, type ReglesVagues } from "../sim/vagues";
import { enregistrer, sauvegarde } from "../progression";
import { t } from "../i18n";
import { H, W, bouton, ui, zone } from "./base";
import { nav } from "./nav";

export const TOURS_CARTABLE = 4;
export const POUVOIRS_CARTABLE = 1;

export interface Choix {
  tours: TypeTour[];
  pouvoir: Pouvoir | null;
}

interface Ouvert {
  page: Page;
  libelle: string;
  regles: ReglesVagues;
  dispo: TypeTour[];
  pouvoirs: Pouvoir[];
  choix: Choix;
  annonce: TypeEnnemi[];
  partir: (c: Choix) => void;
  depuis: number;
}

let ouvert: Ouvert | null = null;

/** Faut-il choisir ? Seulement s'il y a plus à emporter que le cartable n'en contient. */
export const cartableUtile = (dispo: TypeTour[], pouvoirs: Pouvoir[]) => dispo.length > TOURS_CARTABLE || pouvoirs.length > POUVOIRS_CARTABLE;

/** Ce qui arrive sur la page, dans l'ordre où on le rencontre (le boss en dernier). */
function annonce(r: ReglesVagues): TypeEnnemi[] {
  const vus: TypeEnnemi[] = [];
  for (let v = 1; v <= Math.min(r.total, 40); v++) for (const g of planifier(r, v).groupes) if (!vus.includes(g.type)) vus.push(g.type);
  return [...vus.filter((x) => !ENNEMIS[x].boss), ...vus.filter((x) => ENNEMIS[x].boss)];
}

/** Ouvre le cartable d'une page ; `partir` lance la page avec ce qu'on a choisi. */
export function ouvrirCartable(page: Page, libelle: string, regles: ReglesVagues, dispo: TypeTour[], pouvoirs: Pouvoir[], partir: (c: Choix) => void): void {
  const avant = sauvegarde.cartables[page.id];
  const tours = (avant?.tours ?? []).filter((x) => dispo.includes(x)).slice(0, TOURS_CARTABLE);
  // Ce qui manque : les tours dans l'ordre où on les a gagnées
  for (const x of dispo) if (tours.length < TOURS_CARTABLE && !tours.includes(x)) tours.push(x);
  const pouvoir = avant?.pouvoir && pouvoirs.includes(avant.pouvoir) ? avant.pouvoir : pouvoirs[0] ?? null;
  ouvert = { page, libelle, regles, dispo, pouvoirs, choix: { tours, pouvoir }, annonce: annonce(regles), partir, depuis: ui.temps };
  nav.aller("cartable");
}

function basculerTour(o: Ouvert, x: TypeTour): void {
  const c = o.choix.tours;
  if (c.includes(x)) o.choix.tours = c.filter((y) => y !== x);
  else if (c.length < TOURS_CARTABLE) o.choix.tours = [...c, x];
  else o.choix.tours = [...c.slice(1), x];
}

export function dessinerCartable(): void {
  const o = ouvert;
  if (!o) {
    nav.aller("campagne");
    return;
  }
  const ctx = ui.ctx;
  ecrire(ctx, t("Le cartable"), W / 2, 44, { police: "titre", taille: 44 });
  ecrire(ctx, o.libelle, W / 2, 84, { taille: 17, couleur: CRAYON });

  // Au programme : ce qui va passer sur la page
  let y = 118;
  ecrire(ctx, t("Au programme"), 24, y, { align: "left", police: "titre", taille: 26, couleur: ROUGE });
  y += 30;
  const n = o.annonce.length;
  const pas = Math.min(64, (W - 40) / Math.max(1, n));
  o.annonce.forEach((ty, i) => {
    const f = ENNEMIS[ty];
    const x = 20 + pas / 2 + i * pas;
    const r = f.boss ? 15 : Math.min(12, f.rayon);
    monstre(ctx, ty, x, y + 14 + Math.sin(ui.temps * 3 + i) * 1.5, r, i + 1, ui.temps + i, ROUGE, 0);
    if (f.boss) ecrire(ctx, t("boss"), x, y + 44, { taille: 12, couleur: ROUGE });
  });
  y += 60;
  // Ce qu'ils demandent : les conseils des monstres les plus particuliers
  const durs = o.annonce.filter((ty) => ENNEMIS[ty].vole || ENNEMIS[ty].furtif || ENNEMIS[ty].armure || ENNEMIS[ty].bouclier || ENNEMIS[ty].soigne || ENNEMIS[ty].boss).slice(0, 2);
  for (const ty of durs) {
    y += paragraphe(ctx, `${t(ENNEMIS[ty].nom)} : ${t(ENNEMIS[ty].conseil)}`, 24, y, W - 48, { align: "left", taille: 13, couleur: CRAYON }) + 4;
  }

  // Les tours : quatre dans le cartable
  y = Math.max(y + 8, 300);
  ecrire(ctx, t("Tes tours ({n}/{max})", { n: o.choix.tours.length, max: TOURS_CARTABLE }), 24, y, { align: "left", police: "titre", taille: 26 });
  y += 22;
  const col = 2;
  const lw = (W - 48 - 10) / col;
  const lh = 62;
  o.dispo.forEach((ty, i) => {
    const x = 24 + (i % col) * (lw + 10);
    const yy = y + Math.floor(i / col) * (lh + 8);
    const pris = o.choix.tours.includes(ty);
    boite(ctx, x, yy, lw, lh, { couleur: pris ? BLEU : CRAYON, epaisseur: pris ? 2.4 : 1.4, graine: 300 + i, fond: pris ? "rgba(34,64,143,0.08)" : "rgba(255,252,240,0.9)" });
    symbole(ctx, TOURS[ty].glyphe, x + 28, yy + lh / 2, 15, pris ? BLEU : CRAYON, 2.2);
    ecrire(ctx, t(TOURS[ty].nom), x + 54, yy + 20, { align: "left", police: "titre", taille: 22, couleur: pris ? BLEU : CRAYON });
    paragraphe(ctx, t(TOURS[ty].role), x + 54, yy + 32, lw - 60, { align: "left", taille: 11, couleur: CRAYON });
    if (pris) ecrire(ctx, "✓", x + lw - 14, yy + 14, { taille: 18, couleur: ROUGE });
    zone(x, yy, lw, lh, () => basculerTour(o, ty));
  });
  y += Math.ceil(o.dispo.length / col) * (lh + 8) + 14;

  // Le pouvoir
  if (o.pouvoirs.length) {
    ecrire(ctx, t("Ton pouvoir"), 24, y, { align: "left", police: "titre", taille: 26 });
    y += 22;
    const pw = (W - 48 - 10 * (o.pouvoirs.length - 1)) / o.pouvoirs.length;
    o.pouvoirs.forEach((k, i) => {
      const x = 24 + i * (pw + 10);
      const pris = o.choix.pouvoir === k;
      boite(ctx, x, y, pw, 54, { couleur: pris ? BLEU : CRAYON, epaisseur: pris ? 2.4 : 1.4, graine: 330 + i, fond: pris ? "rgba(34,64,143,0.08)" : "rgba(255,252,240,0.9)" });
      icone(ctx, k, x + 24, y + 27, 26, pris);
      ecrire(ctx, t(POUVOIRS[k].nom), x + 44, y + 27, { align: "left", taille: 15, couleur: pris ? BLEU : CRAYON });
      zone(x, y, pw, 54, () => (o.choix.pouvoir = pris ? null : k));
    });
  }

  const pret = o.choix.tours.length > 0;
  bouton(14, H - 72, 120, 54, t("Retour"), () => {
    ouvert = null;
    nav.aller("campagne");
  }, { taille: 18 });
  bouton(146, H - 72, W - 160, 54, t("En route !"), () => {
    sauvegarde.cartables[o.page.id] = { tours: o.choix.tours, pouvoir: o.choix.pouvoir };
    enregistrer();
    const c = o.choix;
    ouvert = null;
    o.partir(c);
  }, { principal: true, inactif: !pret, taille: 22, sous: pret ? undefined : t("prends au moins une tour") });
}
