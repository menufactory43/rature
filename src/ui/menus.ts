// Les écrans hors partie : le titre, l'aide, les cahiers de la campagne, les talents.
import { BLEU, CRAYON, ROUGE, ecrire, paragraphe, rectangle, trait } from "../render/encre";
import { monstre } from "../render/monstres";
import { coeur } from "../render/scene";
import { dessinerTour, symbole } from "../render/tours";
import { ENNEMIS, type TypeEnnemi } from "../sim/ennemis";
import { PAGES, TEXTE_DEFI, type Page } from "../sim/pages";
import { TOURS, TYPES_TOURS } from "../sim/tours";
import {
  IDS_TALENTS, TALENTS, enregistrer, pageGagnee, pageOuverte, pointsLibres, sauvegarde, toursDebloquees, totalEtoiles,
} from "../progression";
import { grainePageDuJour } from "../sauvegarde";
import { H, W, bouton, boutonSon, titre, ui, zone } from "./base";
import { nav } from "./nav";
import { etoile } from "./partie";

export const actions = {
  pageDuJour: () => {},
  jouerPage: (_p: Page, _mode: "campagne" | "defi" | "sansFin") => {},
};

// --- Le titre ---

export function dessinerTitre(): void {
  const ctx = ui.ctx;
  ecrire(ctx, "Rature", W / 2, 150, { police: "titre", taille: 100 });
  trait(ctx, [{ x: 90, y: 204 }, { x: 200, y: 208 }, { x: 310, y: 202 }], { couleur: ROUGE, epaisseur: 2.4, graine: 2 });
  ecrire(ctx, "un tower defense au stylo bille", W / 2, 236, { couleur: CRAYON, taille: 18 });
  // Une petite scène : trois tours, des monstres qui passent
  const t = ui.temps;
  dessinerTour(ctx, { type: "plume", x: 130, y: 350, angle: t, niveau: 2, spec: 0, temps: t, id: 1 });
  dessinerTour(ctx, { type: "roquette", x: 200, y: 330, angle: -t * 0.7, niveau: 3, spec: 0, temps: t, id: 2 });
  dessinerTour(ctx, { type: "foudre", x: 270, y: 350, angle: t * 1.3, niveau: 1, spec: 1, temps: t, id: 3 });
  const types: TypeEnnemi[] = ["gribouille", "carre", "avion", "araignee", "tache", "punaise", "postit"];
  types.forEach((ty, i) => {
    const x = ((t * 30 + i * 70) % 480) - 40;
    monstre(ctx, ty, x, 410 + Math.sin(i * 2) * 8, ENNEMIS[ty].rayon * 0.9, i + 1, t, ROUGE, 0);
  });
  coeur(ctx, 360, 412, 9, Math.sin(t * 2.4) * 0.15);
  const etoiles = totalEtoiles();
  bouton(60, 480, 280, 64, "Campagne", () => nav.aller("campagne"), { principal: true, sous: etoiles ? `${etoiles} étoile${etoiles > 1 ? "s" : ""}` : "trois cahiers à défendre" });
  const jour = grainePageDuJour();
  const mj = sauvegarde.jour[jour];
  bouton(60, 560, 280, 64, "Page du jour", () => actions.pageDuJour(), { sous: mj ? `record : ${mj.vagues} vagues, ${mj.vies} vies` : "la même page pour tout le monde" });
  bouton(60, 640, 134, 50, "Comment jouer", () => nav.aller("aide"), { taille: 17 });
  bouton(206, 640, 134, 50, "Trousse", () => nav.aller("trousse"), { taille: 18 });
  boutonSon(W - 54, 14);
  paragraphe(ctx, "Dessine tes tours. Trace des murs. Rature les monstres.", W / 2, 726, 320, { couleur: CRAYON, taille: 15 });
}

// --- L'aide, en trois onglets ---

let onglet = 0;

export function dessinerAide(): void {
  const ctx = ui.ctx;
  titre("Comment jouer", 40, 40);
  ["Dessiner", "Tours", "Monstres"].forEach((nom, i) => bouton(20 + i * 122, 76, 114, 34, nom, () => (onglet = i), { taille: 17, principal: onglet === i }));
  if (onglet === 0) {
    paragraphe(ctx, "Les monstres entrent par les flèches rouges et marchent vers le Cœur. Chaque monstre qui l'atteint te coûte des vies. Tout se paie en encre : elle revient lentement, et chaque monstre tué en rapporte.", W / 2, 128, 350, { taille: 15, couleur: CRAYON });
    const lignes: [string, string][] = [
      ["Petit symbole : une TOUR", "Un cercle, un triangle, un éclair… dessiné en petit, là où tu veux la tour. Touche une tour pour l'améliorer ou la vendre."],
      ["Grand trait lent : un MUR", "La horde le contourne… ou le ronge, si c'est plus court. Construis des labyrinthes."],
      ["Trait sec : une RATURE", "Frappe tout ce qu'elle touche, même les volants. Dans le vide, c'est de l'encre perdue."],
      ["Grande boucle : de la COLLE", "Ralentit tout ce qui est dedans (pas les volants)."],
    ];
    lignes.forEach(([t, d], i) => {
      const y = 240 + i * 96;
      ecrire(ctx, t, 30, y, { align: "left", taille: 19 });
      paragraphe(ctx, d, 30, y + 14, 340, { align: "left", taille: 14, couleur: CRAYON });
    });
    paragraphe(ctx, "Enfermer complètement la horde ? Elle s'attaque alors à tes tours. Le chemin qu'elle prendra est tracé au crayon.", W / 2, 640, 340, { taille: 14, couleur: ROUGE });
  } else if (onglet === 1) {
    const debloquees = toursDebloquees();
    TYPES_TOURS.forEach((t, i) => {
      const f = TOURS[t];
      const y = 140 + i * 86;
      const ok = debloquees.includes(t);
      symbole(ctx, f.glyphe, 44, y + 6, 14, ok ? BLEU : CRAYON, 2.4);
      dessinerTour(ctx, { type: t, x: 96, y: y + 6, angle: -0.5, niveau: 1, spec: 0, temps: ui.temps, id: i });
      ecrire(ctx, ok ? f.nom : `${f.nom} (à débloquer)`, 126, y - 8, { align: "left", taille: 18, couleur: ok ? BLEU : CRAYON });
      paragraphe(ctx, `${f.role} Spécialisations : ${f.specs[0].nom} ou ${f.specs[1].nom}.`, 126, y + 4, 260, { align: "left", taille: 13, couleur: CRAYON });
    });
  } else {
    const liste: TypeEnnemi[] = ["gribouille", "carre", "avion", "araignee", "tache", "gomme", "postit", "fantome", "tippex", "punaise", "mere", "compas", "taille"];
    liste.forEach((t, i) => {
      const y = 134 + i * 51;
      const f = ENNEMIS[t];
      monstre(ctx, t, 40, y + 4, Math.min(13, f.rayon), i + 1, ui.temps, ROUGE, -0.6);
      ecrire(ctx, f.nom, 68, y - 7, { align: "left", taille: 16, couleur: ROUGE });
      paragraphe(ctx, f.conseil, 68, y + 3, 316, { align: "left", taille: 12, couleur: CRAYON });
    });
  }
  bouton(120, H - 62, 160, 44, "Retour", () => nav.aller("titre"));
}

// --- Les cahiers ---

const CAHIERS = ["Cahier de brouillon", "Cahier de maths", "Cahier de musique"];
let cahier = 0;
let pageChoisie: Page | null = null;

export function dessinerCampagne(): void {
  const ctx = ui.ctx;
  titre("Les cahiers", 40, 42);
  CAHIERS.forEach((nom, i) => {
    const pages = PAGES.filter((p) => p.cahier === i + 1);
    const ouvert = pages.length > 0 && pageOuverte(pages[0]);
    const etoiles = pages.reduce((s, p) => s + (sauvegarde.etoiles[p.id] ?? 0), 0);
    bouton(14 + i * 126, 82, 120, 52, nom.replace("Cahier de ", ""), () => ouvert && ((cahier = i), (pageChoisie = null)), {
      taille: 17, principal: cahier === i, inactif: !ouvert, sous: pages.length ? `${etoiles}/${pages.length * 3} ★` : "bientôt",
    });
  });
  ecrire(ctx, CAHIERS[cahier], W / 2, 162, { police: "titre", taille: 28 });
  const pages = PAGES.filter((p) => p.cahier === cahier + 1);
  pages.forEach((p, i) => {
    const y = 186 + i * 92;
    const ouverte = pageOuverte(p);
    const choisie = pageChoisie === p;
    rectangle(ctx, 24, y, W - 48, 80, { couleur: ouverte ? (choisie ? ROUGE : BLEU) : CRAYON, epaisseur: choisie ? 2.4 : 1.6, graine: 200 + i, fond: "rgba(255,252,240,0.9)" });
    ecrire(ctx, `${p.id}  ${p.nom}`, 40, y + 24, { align: "left", police: "titre", taille: 26, couleur: ouverte ? BLEU : CRAYON });
    const n = sauvegarde.etoiles[p.id] ?? 0;
    for (let k = 0; k < 3; k++) etoile(W - 110 + k * 30, y + 24, 11, k < n, 210 + i * 3 + k);
    const infos = ouverte ? `${p.vagues} vagues${p.boss ? " · boss : " + ENNEMIS[p.boss].nom : ""}${p.debloque && !pageGagnee(p.id) ? " · débloque : " + (p.debloque === "colle" ? "la colle" : TOURS[p.debloque].nom) : ""}` : "gagne la page précédente pour l'ouvrir";
    ecrire(ctx, infos, 40, y + 52, { align: "left", taille: 13, couleur: CRAYON });
    const extras = [sauvegarde.defis[p.id] ? "défi ✓" : "", sauvegarde.sansFin[p.id] ? `sans fin : ${sauvegarde.sansFin[p.id]}` : ""].filter(Boolean).join(" · ");
    if (extras) ecrire(ctx, extras, W - 40, y + 52, { align: "right", taille: 12, couleur: ROUGE });
    if (ouverte) zone(24, y, W - 48, 80, () => (pageChoisie = choisie ? null : p));
  });
  if (pageChoisie) {
    const p = pageChoisie;
    const y = H - 210;
    ctx.fillStyle = "rgba(246,239,220,0.95)";
    ctx.fillRect(10, y - 10, W - 20, 140);
    bouton(24, y, W - 48, 54, `Jouer ${p.id}`, () => actions.jouerPage(p, "campagne"), { principal: true, taille: 22 });
    const gagnee = pageGagnee(p.id);
    bouton(24, y + 64, (W - 60) / 2, 54, "Défi", () => actions.jouerPage(p, "defi"), { inactif: !gagnee, taille: 18, sous: gagnee ? TEXTE_DEFI[p.defi].toLowerCase() : "gagne la page d'abord" });
    bouton(36 + (W - 60) / 2, y + 64, (W - 60) / 2, 54, "Sans fin", () => actions.jouerPage(p, "sansFin"), { inactif: !gagnee, taille: 18, sous: gagnee ? "jusqu'où tiendras-tu ?" : "gagne la page d'abord" });
  }
  const libres = pointsLibres();
  bouton(14, H - 62, 120, 44, "Retour", () => nav.aller("titre"), { taille: 18 });
  bouton(146, H - 62, 120, 44, "Talents", () => nav.aller("talents"), { taille: 18, principal: libres > 0, sous: libres ? `${libres} à placer` : undefined });
  bouton(278, H - 62, 108, 44, "Trousse", () => nav.aller("trousse"), { taille: 18 });
}

// --- Les talents ---

export function dessinerTalents(): void {
  const ctx = ui.ctx;
  titre("Talents", 40, 44);
  const libres = pointsLibres();
  paragraphe(ctx, `Chaque étoile et chaque défi réussi donnent un bon point. ${libres} à placer sur ${totalEtoiles()}. Ils ne servent pas pour la page du jour.`, W / 2, 84, 340, { taille: 14, couleur: CRAYON });
  IDS_TALENTS.forEach((id, i) => {
    const f = TALENTS[id];
    const n = sauvegarde.talents[id] ?? 0;
    const y = 148 + i * 74;
    ecrire(ctx, f.nom, 24, y, { align: "left", taille: 19 });
    ecrire(ctx, f.texte + " par point", 24, y + 22, { align: "left", taille: 13, couleur: CRAYON });
    for (let k = 0; k < f.max; k++) rectangle(ctx, 236 + k * 18, y - 6, 12, 12, { couleur: k < n ? ROUGE : CRAYON, fond: k < n ? "rgba(196,48,43,0.6)" : undefined, epaisseur: 1.4, graine: 300 + i * 5 + k });
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
  bouton(120, H - 62, 160, 44, "Retour", () => nav.aller("campagne"));
}
