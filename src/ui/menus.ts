// Les écrans hors partie : le titre, l'aide, les cahiers de la campagne, les talents.
import { BLEU, CRAYON, ROUGE, ecrire, paragraphe, boite, feuille, trait } from "../render/encre";
import { monstre } from "../render/monstres";
import { coeur } from "../render/scene";
import { dessinerTour, symbole } from "../render/tours";
import { ENNEMIS, type TypeEnnemi } from "../sim/ennemis";
import type { Carte } from "../sim/carte";
import { carteDePage, PAGES, TEXTE_DEFI, type Page } from "../sim/pages";
import { TOURS, TYPES_TOURS } from "../sim/tours";
import {
  IDS_TALENTS, TALENTS, enregistrer, pageGagnee, pageOuverte, pointsLibres, sauvegarde, toursDebloquees, totalEtoiles,
} from "../progression";
import { grainePageDuJour, tutoVu } from "../sauvegarde";
import { compagnonTitre } from "./compagnon";
import { gameCenterDispo, ouvrirGameCenter } from "../succes";
import { H, W, bouton, boutonSon, titre, ui, zone } from "./base";
import { t } from "../i18n";
import { nav } from "./nav";
import { ouvrirReglages } from "./reglages";
import { ouvrirCoop } from "./coop";
import { etoile } from "./partie";

export const actions = {
  tuto: () => {},
  pageDuJour: () => {},
  interro: () => {},
  jouerPage: (_p: Page, _mode: "campagne" | "defi" | "sansFin") => {},
};

// --- Le titre ---

export function dessinerTitre(): void {
  const ctx = ui.ctx;
  const tps = ui.temps;
  // Le titre s'écrit au lancement, puis se fait souligner
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 60, 60 + Math.min(1, tps / 0.9) * 300, 140);
  ctx.clip();
  ecrire(ctx, "Rature", W / 2, 150, { police: "titre", taille: 100 });
  ctx.restore();
  const souligne = Math.max(0, Math.min(1, (tps - 0.8) / 0.35));
  if (souligne > 0) trait(ctx, [{ x: 90, y: 204 }, { x: 90 + 110 * Math.min(1, souligne * 2), y: 208 }, ...(souligne > 0.5 ? [{ x: 90 + 220 * souligne, y: 202 }] : [])], { couleur: ROUGE, epaisseur: 2.4, graine: 2 });
  ecrire(ctx, t("un tower defense au stylo bille"), W / 2, 236, { couleur: CRAYON, taille: 18, alpha: Math.min(1, Math.max(0, (tps - 1) * 2)) });
  // Bille, la mascotte, à côté du titre : la première fois, elle propose le tutoriel
  compagnonTitre(ctx, tutoVu(), () => actions.tuto());
  // Une petite bataille : les monstres passent, les tours tirent, et ils se font raturer
  const types: TypeEnnemi[] = ["gribouille", "carre", "avion", "araignee", "tache", "punaise", "postit"];
  const MORT = 262;
  const monstres = types.map((ty, i) => ({ ty, i, x: ((tps * 30 + i * 70) % 490) - 40, y: 410 + Math.sin(i * 2) * 8 }));
  // Les taches laissées sur la page
  ctx.save();
  ctx.fillStyle = "rgba(196,48,43,0.14)";
  for (let k = 0; k < 6; k++) {
    ctx.beginPath();
    ctx.arc(MORT + 8 + Math.sin(k * 3.1) * 16, 410 + Math.cos(k * 1.7) * 10, 5 + (k % 3) * 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  const vivants = monstres.filter((m) => m.x > 40 && m.x < MORT);
  const viser = (tx: number, ty: number) => vivants.reduce<{ x: number; y: number } | null>((b, m) => (!b || Math.hypot(m.x - tx, m.y - ty) < Math.hypot(b.x - tx, b.y - ty) ? m : b), null);
  const tours = [
    { type: "plume" as const, x: 130, y: 345, id: 1, cadence: 0.55 },
    { type: "roquette" as const, x: 200, y: 325, id: 2, cadence: 1.3 },
    { type: "foudre" as const, x: 270, y: 345, id: 3, cadence: 1.1 },
  ];
  for (const to of tours) {
    const c = viser(to.x, to.y);
    const angle = c ? Math.atan2(c.y - to.y, c.x - to.x) : -Math.PI / 2;
    const phase = (tps / to.cadence + to.id * 0.3) % 1;
    dessinerTour(ctx, { type: to.type, x: to.x, y: to.y, angle, niveau: to.id === 2 ? 3 : 2, spec: to.id === 3 ? 1 : 0, recul: c ? Math.max(0, 1 - phase * 5) : 0, temps: tps, id: to.id });
    if (!c) continue;
    if (to.type === "foudre" && phase < 0.12) {
      const pts = [{ x: to.x, y: to.y }];
      for (let k = 1; k < 6; k++) pts.push({ x: to.x + ((c.x - to.x) * k) / 6 + Math.sin(k * 7 + tps * 50) * 6, y: to.y + ((c.y - to.y) * k) / 6 + Math.cos(k * 5 + tps * 40) * 6 });
      pts.push({ x: c.x, y: c.y });
      trait(ctx, pts, { couleur: "rgba(90,130,230,0.35)", epaisseur: 6, amp: 1.5 });
      trait(ctx, pts, { epaisseur: 2, amp: 1.5 });
    } else if (to.type !== "foudre" && phase < 0.35) {
      const u = phase / 0.35;
      const x = to.x + (c.x - to.x) * u;
      const y = to.y + (c.y - to.y) * u - (to.type === "roquette" ? Math.sin(u * Math.PI) * 30 : 0);
      ctx.fillStyle = BLEU;
      ctx.beginPath();
      ctx.arc(x, y, to.type === "roquette" ? 3.5 : 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  for (const m of monstres) {
    const r = ENNEMIS[m.ty].rayon * 0.9;
    if (m.x < MORT) {
      monstre(ctx, m.ty, m.x, m.y - Math.abs(Math.sin(tps * 9 + m.i)) * 2, r, m.i + 1, tps + m.i, ROUGE, 0);
    } else if (m.x < MORT + 22) {
      // Raturé à grands traits, puis effacé
      const p = Math.min(1, (m.x - MORT) / 6);
      ctx.save();
      ctx.globalAlpha = 1 - Math.max(0, (m.x - MORT - 6) / 16);
      monstre(ctx, m.ty, MORT, m.y, r, m.i + 1, 0, ROUGE, 0);
      const pts = Array.from({ length: 8 }, (_, k) => ({ x: MORT - r + (k / 7) * 2 * r, y: m.y + (k % 2 ? -r : r) * 0.8 }));
      trait(ctx, pts.slice(0, Math.max(2, Math.ceil(8 * p))), { couleur: BLEU, epaisseur: 2.2, graine: m.i });
      ctx.restore();
    }
  }
  coeur(ctx, 360, 412, 9, Math.max(0, Math.sin(tps * 2.4)) ** 4 * 0.35);
  const etoiles = totalEtoiles();
  bouton(60, 480, 280, 64, t("Campagne"), () => nav.aller("campagne"), { principal: true, sous: etoiles ? t(etoiles > 1 ? "{n} étoiles" : "{n} étoile", { n: etoiles }) : t("trois cahiers à défendre") });
  const jour = grainePageDuJour();
  const mj = sauvegarde.jour[jour];
  bouton(60, 560, 134, 64, t("Page du jour"), () => actions.pageDuJour(), { taille: 19, sous: mj ? t("{v} vagues, {n} ♥", { v: mj.vagues, n: mj.vies }) : t("la même pour tous") });
  const ri = sauvegarde.interro;
  bouton(206, 560, 134, 64, t("Interro"), () => actions.interro(), { taille: 19, sous: ri ? t("record : {n}/20", { n: Math.round((ri / 30) * 20) }) : t("surprise !") });
  bouton(60, 640, 134, 50, t("Comment jouer"), () => nav.aller("aide"), { taille: 17 });
  bouton(206, 640, 134, 50, t("Trousse"), () => nav.aller("trousse"), { taille: 18 });
  bouton(60, 702, 134, 44, t("À deux"), () => ouvrirCoop(), { taille: 19 });
  bouton(206, 702, 134, 44, t("Réglages"), () => ouvrirReglages("titre"), { taille: 18 });
  boutonSon(W - 54, 14);
  // Les classements et les succès de Game Center, sur l'iPhone
  if (gameCenterDispo()) bouton(W - 104, 14, 44, 32, "🏆", ouvrirGameCenter, { taille: 17 });
  paragraphe(ctx, t("Dessine tes tours. Trace des murs. Rature les monstres."), W / 2, 786, 320, { couleur: CRAYON, taille: 15 });
}

// --- L'aide, en trois onglets ---

let onglet = 0;

export function dessinerAide(): void {
  const ctx = ui.ctx;
  titre(t("Comment jouer"), 40, 40);
  ["Dessiner", "Tours", "Monstres"].forEach((nom, i) => bouton(20 + i * 122, 76, 114, 34, t(nom), () => (onglet = i), { taille: 17, principal: onglet === i }));
  if (onglet === 0) {
    paragraphe(ctx, t("Les monstres entrent par les flèches rouges et marchent vers le Cœur. Chaque monstre qui l'atteint te coûte des vies. Tout se paie en encre : elle revient lentement, et chaque monstre tué en rapporte."), W / 2 + 8, 128, 330, { taille: 15, couleur: CRAYON });
    const lignes: [string, string][] = [
      ["Petit symbole : une TOUR", "Un cercle, un triangle, un éclair… dessiné en petit, là où tu veux la tour. Touche une tour pour l'améliorer ou la vendre."],
      ["Grand trait lent : un MUR", "La horde le contourne… ou le ronge, si c'est plus court. Construis des labyrinthes."],
      ["Trait sec : une RATURE", "Frappe tout ce qu'elle touche, même les volants. Dans le vide, c'est de l'encre perdue."],
      ["Grande boucle : de la COLLE", "Ralentit tout ce qui est dedans (pas les volants)."],
    ];
    lignes.forEach(([ti, d], i) => {
      const y = 240 + i * 96;
      ecrire(ctx, t(ti), 44, y, { align: "left", taille: 19 });
      paragraphe(ctx, t(d), 44, y + 14, 330, { align: "left", taille: 14, couleur: CRAYON });
    });
    paragraphe(ctx, t("Enfermer complètement la horde ? Elle s'attaque alors à tes tours. Le chemin qu'elle prendra est tracé au crayon."), W / 2, 640, 340, { taille: 14, couleur: ROUGE });
  } else if (onglet === 1) {
    const debloquees = toursDebloquees();
    TYPES_TOURS.forEach((ty, i) => {
      const f = TOURS[ty];
      const y = 140 + i * 86;
      const ok = debloquees.includes(ty);
      symbole(ctx, f.glyphe, 44, y + 6, 14, ok ? BLEU : CRAYON, 2.4);
      dessinerTour(ctx, { type: ty, x: 96, y: y + 6, angle: -0.5, niveau: 1, spec: 0, temps: ui.temps, id: i });
      ecrire(ctx, ok ? t(f.nom) : t("{nom} (à débloquer)", { nom: t(f.nom) }), 126, y - 8, { align: "left", taille: 18, couleur: ok ? BLEU : CRAYON });
      paragraphe(ctx, t("{role} Spécialisations : {a} ou {b}.", { role: t(f.role), a: t(f.specs[0].nom), b: t(f.specs[1].nom) }), 126, y + 4, 260, { align: "left", taille: 13, couleur: CRAYON });
    });
  } else {
    const liste: TypeEnnemi[] = ["gribouille", "carre", "avion", "araignee", "tache", "gomme", "postit", "fantome", "tippex", "punaise", "mere", "compas", "taille", "point"];
    liste.forEach((ty, i) => {
      const y = 128 + i * 46;
      const f = ENNEMIS[ty];
      monstre(ctx, ty, 40, y + 4, Math.min(13, f.rayon), i + 1, ui.temps, ROUGE, -0.6);
      ecrire(ctx, t(f.nom), 68, y - 7, { align: "left", taille: 16, couleur: ROUGE });
      paragraphe(ctx, t(f.conseil), 68, y + 3, 316, { align: "left", taille: 12, couleur: CRAYON });
    });
  }
  bouton(24, H - 62, 160, 44, t("Retour"), () => nav.aller("titre"));
  bouton(W - 184, H - 62, 160, 44, t("Le tutoriel"), () => actions.tuto(), { principal: true, taille: 19 });
}

// --- Les cahiers ---

const CAHIERS = ["Cahier de brouillon", "Cahier de maths", "Cahier de musique", "Cahier de dictée"];
const ONGLETS = ["brouillon", "maths", "musique", "dictée"];
let cahier = 0;
let pageChoisie: Page | null = null;

const cartes = new Map<string, Carte>();

/** La carte de la page en tout petit : taches, Cœur, entrées. */
function miniature(ctx: CanvasRenderingContext2D, p: Page, x: number, y: number, w: number, h: number, ouverte: boolean): void {
  let c = cartes.get(p.id);
  if (!c) {
    c = carteDePage(p);
    cartes.set(p.id, c);
  }
  const k = w / 400;
  ctx.save();
  ctx.globalAlpha = ouverte ? 1 : 0.4;
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "rgba(60,62,75,0.4)";
  ctx.lineWidth = 0.8;
  ctx.strokeRect(x, y, w, h);
  for (const b of c.blocs) {
    ctx.fillStyle = b.type === "tache" ? "rgba(28,38,80,0.8)" : b.type === "trou" ? "rgba(120,100,70,0.5)" : "rgba(150,100,50,0.3)";
    ctx.fillRect(x + b.x * k, y + b.y * k, 20 * k + 0.3, 20 * k + 0.3);
  }
  ctx.fillStyle = "rgba(150,120,80,0.75)";
  for (const o of c.objets) ctx.fillRect(x + o.x * k, y + o.y * k, o.w * k, o.h * k);
  ctx.fillStyle = ROUGE;
  for (const e of c.entrees) {
    ctx.beginPath();
    ctx.arc(x + e.bord.x * k, y + e.bord.y * k, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.font = "9px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("♥", x + c.coeur.x * k, y + c.coeur.y * k);
  ctx.restore();
}

export function dessinerCampagne(): void {
  const ctx = ui.ctx;
  titre(t("Les cahiers"), 40, 42);
  CAHIERS.forEach((_nom, i) => {
    const pages = PAGES.filter((p) => p.cahier === i + 1);
    const ouvert = pages.length > 0 && pageOuverte(pages[0]);
    const etoiles = pages.reduce((s, p) => s + (sauvegarde.etoiles[p.id] ?? 0), 0);
    bouton(10 + i * 96, 82, 90, 52, t(ONGLETS[i]), () => ouvert && ((cahier = i), (pageChoisie = null)), {
      taille: 16, principal: cahier === i, inactif: !ouvert, sous: pages.length ? `${etoiles}/${pages.length * 3} ★` : t("bientôt"),
    });
  });
  ecrire(ctx, t(CAHIERS[cahier]), W / 2, 162, { police: "titre", taille: 28 });
  const pages = PAGES.filter((p) => p.cahier === cahier + 1);
  pages.forEach((p, i) => {
    const y = 186 + i * 92;
    const ouverte = pageOuverte(p);
    const choisie = pageChoisie === p;
    boite(ctx, 24, y, W - 48, 80, { couleur: ouverte ? (choisie ? ROUGE : BLEU) : CRAYON, epaisseur: choisie ? 2.4 : 1.6, graine: 200 + i, fond: "rgba(255,252,240,0.9)" });
    miniature(ctx, p, 32, y + 7, 36, 66, ouverte);
    ecrire(ctx, `${p.id}  ${t(p.nom)}`, 80, y + 24, { align: "left", police: "titre", taille: 24, couleur: ouverte ? BLEU : CRAYON });
    const n = sauvegarde.etoiles[p.id] ?? 0;
    for (let k = 0; k < 3; k++) etoile(W - 110 + k * 30, y + 24, 11, k < n, 210 + i * 3 + k);
    const infos = ouverte ? `${t("{n} vagues", { n: p.vagues })}${p.boss ? " · " + t("boss : {nom}", { nom: t(ENNEMIS[p.boss].nom) }) : ""}${p.debloque && !pageGagnee(p.id) ? " · " + t("débloque : {nom}", { nom: p.debloque === "colle" ? t("la colle") : t(TOURS[p.debloque].nom) }) : ""}` : t("gagne la page précédente pour l'ouvrir");
    paragraphe(ctx, infos, 80, y + 44, 230, { align: "left", taille: 13, couleur: CRAYON });
    const extras = [sauvegarde.defis[p.id] ? t("défi ✓") : "", sauvegarde.sansFin[p.id] ? t("sans fin : {n}", { n: sauvegarde.sansFin[p.id] }) : ""].filter(Boolean).join(" · ");
    if (extras) ecrire(ctx, extras, W - 40, y + 52, { align: "right", taille: 12, couleur: ROUGE });
    if (ouverte) zone(24, y, W - 48, 80, () => (pageChoisie = choisie ? null : p));
  });
  if (pageChoisie) {
    const p = pageChoisie;
    const y = H - 210;
    feuille(ctx, 10, y - 10, W - 20, 140, "rgba(246,239,220,0.96)", 77, 0.1);
    bouton(24, y, W - 48, 54, t("Jouer {id}", { id: p.id }), () => actions.jouerPage(p, "campagne"), { principal: true, taille: 22 });
    const gagnee = pageGagnee(p.id);
    bouton(24, y + 64, (W - 60) / 2, 54, t("Défi"), () => actions.jouerPage(p, "defi"), { inactif: !gagnee, taille: 18, sous: gagnee ? t(TEXTE_DEFI[p.defi]).toLowerCase() : t("gagne la page d'abord") });
    bouton(36 + (W - 60) / 2, y + 64, (W - 60) / 2, 54, t("Sans fin"), () => actions.jouerPage(p, "sansFin"), { inactif: !gagnee, taille: 18, sous: gagnee ? t("jusqu'où tiendras-tu ?") : t("gagne la page d'abord") });
  }
  const libres = pointsLibres();
  bouton(14, H - 62, 120, 44, t("Retour"), () => nav.aller("titre"), { taille: 18 });
  bouton(146, H - 62, 120, 44, t("Talents"), () => nav.aller("talents"), { taille: 18, principal: libres > 0, sous: libres ? t("{n} à placer", { n: libres }) : undefined });
  bouton(278, H - 62, 108, 44, t("Trousse"), () => nav.aller("trousse"), { taille: 18 });
}

// --- Les talents ---

export function dessinerTalents(): void {
  const ctx = ui.ctx;
  titre(t("Talents"), 40, 44);
  const libres = pointsLibres();
  paragraphe(ctx, t("Chaque étoile et chaque défi réussi donnent un bon point. {n} à placer sur {total}. Ils ne servent pas pour la page du jour.", { n: libres, total: totalEtoiles() }), W / 2, 84, 340, { taille: 14, couleur: CRAYON });
  IDS_TALENTS.forEach((id, i) => {
    const f = TALENTS[id];
    const n = sauvegarde.talents[id] ?? 0;
    const y = 148 + i * 74;
    ecrire(ctx, t(f.nom), 44, y, { align: "left", taille: 19 });
    ecrire(ctx, t("{texte} par point", { texte: t(f.texte) }), 44, y + 22, { align: "left", taille: 13, couleur: CRAYON });
    for (let k = 0; k < f.max; k++) boite(ctx, 236 + k * 18, y - 6, 12, 12, { couleur: k < n ? ROUGE : CRAYON, fond: k < n ? "rgba(196,48,43,0.6)" : undefined, epaisseur: 1.4, graine: 300 + i * 5 + k });
    bouton(W - 102, y - 14, 36, 32, "−", () => {
      if (n > 0) {
        sauvegarde.talents[id] = n - 1;
        enregistrer();
      }
    }, { inactif: n === 0, taille: 20 });
    bouton(W - 60, y - 14, 36, 32, "+", () => {
      if (n < f.max && pointsLibres() > 0) {
        sauvegarde.talents[id] = n + 1;
        enregistrer();
      }
    }, { inactif: n >= f.max || libres <= 0, taille: 20, principal: true });
  });
  bouton(120, H - 62, 160, 44, t("Retour"), () => nav.aller("campagne"));
}

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/** Le cahier ouvert, côté menus : la page d'en face, c'est le pense-bête du joueur (ses tours, les monstres déjà croisés). */
export function pageDeGarde(): void {
  const ctx = ui.ctx;
  const d = new Date();
  ecrire(ctx, t("le {j} {mois}", { j: d.getDate(), mois: t(MOIS[d.getMonth()]) }), W - 24, 40, { align: "right", taille: 18, couleur: CRAYON, rotation: -0.02 });
  ecrire(ctx, t("Mes notes"), 50, 92, { align: "left", police: "titre", taille: 44 });
  souligne(50, 120, 170, 5);
  ecrire(ctx, t("Les tours"), 50, 168, { align: "left", police: "titre", taille: 28, couleur: BLEU });
  const tours = toursDebloquees();
  tours.forEach((ty, i) => {
    const y = 210 + i * 46;
    symbole(ctx, TOURS[ty].glyphe, 70, y, 12, BLEU, 2);
    ecrire(ctx, t(TOURS[ty].nom), 98, y - 6, { align: "left", taille: 19 });
    ecrire(ctx, t(TOURS[ty].role), 98, y + 12, { align: "left", taille: 13, couleur: CRAYON });
  });
  let y = 210 + tours.length * 46 + 26;
  ecrire(ctx, t("Les monstres"), 50, y, { align: "left", police: "titre", taille: 28, couleur: ROUGE });
  y += 40;
  const vus = (Object.keys(ENNEMIS) as TypeEnnemi[]).filter((ty) => sauvegarde.vus.includes(ty) && !ENNEMIS[ty].boss && ty !== "petite");
  if (!vus.length) ecrire(ctx, t("(aucun encore : ils viendront bien assez tôt)"), 50, y, { align: "left", taille: 15, couleur: CRAYON });
  for (const ty of vus) {
    if (y > H - 70) break;
    monstre(ctx, ty, 68, y + 4, 10, 3, ui.temps, ROUGE, 0);
    const f = ENNEMIS[ty];
    const nom = t(f.nom);
    y += paragraphe(ctx, t("{nom} : {conseil}", { nom: nom.charAt(0).toUpperCase() + nom.slice(1), conseil: t(f.conseil) }), 92, y - 6, W - 120, { align: "left", taille: 14 }) + 10;
  }
}

function souligne(x: number, y: number, w: number, graine: number): void {
  trait(ui.ctx, [{ x, y }, { x: x + w * 0.5, y: y + 3 }, { x: x + w, y: y - 1 }], { couleur: ROUGE, epaisseur: 2.2, graine });
}
