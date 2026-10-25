// Rature : la mise en page, le doigt, la boucle, et l'aiguillage entre les écrans.
import "@fontsource/caveat/700.css";
import "@fontsource/patrick-hand/400.css";
import "./style.css";
import * as audio from "./audio";
import * as musique from "./musique";
import { ENNEMIS } from "./sim/ennemis";
import { regler } from "./render/encre";
import { papier } from "./render/papier";
import { bureau, coinCorne, dessous, ombrePli, reliure } from "./render/bureau";
import { ameliorer, blesser, choisirFourniture, lancerPouvoir, lancerVague, poserTour } from "./sim/jeu";
import { PAGES, optionsDePage, optionsInterro, optionsPageDuJour, type Page } from "./sim/pages";
import { TYPES_TOURS } from "./sim/tours";
import { colleDebloquee, effacer, pageGagnee, pouvoirsDebloques, sauvegarde, talentsActifs, toursDebloquees } from "./progression";
import { TYPES_POUVOIRS } from "./sim/pouvoirs";
import { grainePageDuJour } from "./sauvegarde";
import { synchroniser } from "./progression";
import { connecterGameCenter } from "./succes";
import { surChangement } from "./reglages";
import { H, W, boutonSous, dessinerAppui, ui } from "./ui/base";
import { RELIURE, calculer, ecranDans, pageDroiteMenu, type Rect, type Vue } from "./ui/vue";
import { actions, pageDeGarde, dessinerAide, dessinerCampagne, dessinerTalents, dessinerTitre } from "./ui/menus";
import { nav } from "./ui/nav";
import { compagnonMenu, dessinerScene, glisser as glisserBille, lacher as lacherBille, saisir as saisirBille, taire } from "./ui/compagnon";
import { dessinerReglages } from "./ui/reglages";
import { dessinerCoop, ouvrirCoop } from "./ui/coop";
import { coop } from "./coop/session";
import { basculerPause, avancerPartie, crochets, demarrerPartie, dessinerPartie, glisserPartie, lancerTuto, leverPartie, mettreEnPause, partie, toucherPartie } from "./ui/partie";
import { chargerApparences, dessinerTrousse, glisserTrousse, leverTrousse, toucherTrousse } from "./ui/trousse";
import { t } from "./i18n";

const canvas = document.getElementById("jeu") as HTMLCanvasElement;
ui.ctx = canvas.getContext("2d")!;
let vue: Vue = calculer(window.innerWidth, window.innerHeight, 1);
let fond: HTMLCanvasElement | null = null;
let zoneFond = { x: 0, y: 0, w: W, h: H };
let table: HTMLCanvasElement | null = null;
let tableEnPartie: HTMLCanvasElement | null = null;

// Une sonde pour lire les marges de sûreté (encoche, Dynamic Island, barre du bas) que le CSS connaît
const sonde = document.createElement("div");
sonde.style.cssText = "position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)";
document.body.appendChild(sonde);

function encoches() {
  const c = getComputedStyle(sonde);
  return { haut: parseFloat(c.paddingTop) || 0, droite: parseFloat(c.paddingRight) || 0, bas: parseFloat(c.paddingBottom) || 0, gauche: parseFloat(c.paddingLeft) || 0 };
}

function redimensionner(): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const cw = window.innerWidth;
  const ch = window.innerHeight;
  canvas.width = Math.round(cw * dpr);
  canvas.height = Math.round(ch * dpr);
  vue = calculer(cw, ch, dpr, encoches());
  // En portrait, la feuille des menus va jusqu'aux bords de l'écran
  zoneFond = vue.plein ? ecranDans(vue, vue.menu) : { x: 0, y: 0, w: W, h: H };
  fond = papier(W, H, vue.m * dpr, "seyes", 0, zoneFond);
  const enPixels = (f: Rect[]) => {
    const x = Math.min(...f.map((r) => r.x));
    const y = Math.min(...f.map((r) => r.y));
    return { x: x * dpr, y: y * dpr, w: (Math.max(...f.map((r) => r.x + r.w)) - x) * dpr, h: (Math.max(...f.map((r) => r.y + r.h)) - y) * dpr };
  };
  table = bureau(canvas.width, canvas.height, enPixels(vue.feuillesMenu));
  tableEnPartie = vue.mise === "portrait" ? table : bureau(canvas.width, canvas.height, enPixels(vue.feuilles));
}

/** Les coordonnées du cadre sous le doigt : celles de la carte en partie, celles du menu ailleurs. */
function versPage(e: PointerEvent): { x: number; y: number } {
  const r = canvas.getBoundingClientRect();
  const m = nav.ecran === "partie" ? vue.carte : vue.menu;
  const p = m.inverse().transformPoint({ x: (e.clientX - r.left) * vue.dpr, y: (e.clientY - r.top) * vue.dpr });
  return { x: p.x, y: p.y };
}

// --- Les parties ---

function jouerPage(p: Page, mode: "campagne" | "defi" | "sansFin"): void {
  const base = `${p.id} ${t(p.nom)}`;
  const libelle = mode === "defi" ? t("{base} (défi)", { base }) : mode === "sansFin" ? t("{base} (sans fin)", { base }) : base;
  demarrerPartie(() => ({
    ...optionsDePage(p, {
      toursDispo: toursDebloquees(), colle: colleDebloquee(), talents: talentsActifs(),
      defi: mode === "defi" ? p.defi : undefined, sansFin: mode === "sansFin",
    }),
    pouvoirs: pouvoirsDebloques(),
    // Bille descend sur la page dès la première page gagnée
    heros: pageGagnee("1-1"),
  }), { page: p, mode, libelle });
}

function pageDuJour(): void {
  const g = grainePageDuJour();
  demarrerPartie(() => ({ ...optionsPageDuJour(g, [...TYPES_TOURS]), pouvoirs: [...TYPES_POUVOIRS], heros: true }), { mode: "jour", libelle: t("Page du {d}", { d: g.split("-").reverse().slice(0, 2).join("/") }), cleJour: g });
}

/** Une nouvelle graine à chaque interro (et à chaque « nouvelle interro »). */
function interro(): void {
  demarrerPartie(() => ({ ...optionsInterro((Math.random() * 2 ** 31) >>> 0), heros: true }), { mode: "interro", libelle: t("Interro surprise") });
}

actions.jouerPage = jouerPage;
actions.tuto = lancerTuto;
crochets.pageUne = () => jouerPage(PAGES[0], "campagne");
actions.interro = interro;
actions.pageDuJour = pageDuJour;
nav.ouvrirPage = (p) => jouerPage(p, "campagne");

// --- Le doigt ---

canvas.addEventListener("pointerdown", (e) => {
  audio.deverrouiller();
  const r = canvas.getBoundingClientRect();
  // Bille d'abord : on la touche, ou on l'emmène ailleurs
  if (saisirBille((e.clientX - r.left) * vue.dpr, (e.clientY - r.top) * vue.dpr)) {
    canvas.setPointerCapture(e.pointerId);
    return;
  }
  const b = boutonSous((e.clientX - r.left) * vue.dpr, (e.clientY - r.top) * vue.dpr);
  if (b) {
    if (b.visible !== false) ui.appui = { ...b, depuis: ui.temps };
    b.action();
    return;
  }
  const p = versPage(e);
  let pris = false;
  if (nav.ecran === "partie") pris = toucherPartie(p.x, p.y, e);
  if (nav.ecran === "trousse") pris = toucherTrousse(p.x, p.y);
  if (pris) canvas.setPointerCapture(e.pointerId);
});

canvas.addEventListener("pointermove", (e) => {
  const r = canvas.getBoundingClientRect();
  if (glisserBille((e.clientX - r.left) * vue.dpr, (e.clientY - r.top) * vue.dpr)) return;
  if (nav.ecran === "partie") glisserPartie(e, versPage);
  if (nav.ecran === "trousse") {
    const p = versPage(e);
    glisserTrousse(p.x, p.y);
  }
});

function lever(e: PointerEvent): void {
  if (lacherBille()) return;
  if (nav.ecran === "partie") leverPartie(e);
  if (nav.ecran === "trousse") leverTrousse();
}
canvas.addEventListener("pointerup", lever);
canvas.addEventListener("pointercancel", lever);

window.addEventListener("keydown", (e) => {
  if ((e.key === "Escape" || e.key === " ") && partie && nav.ecran === "partie") basculerPause();
});
window.addEventListener("blur", mettreEnPause);
document.addEventListener("visibilitychange", () => document.hidden && mettreEnPause());
window.addEventListener("resize", redimensionner);
// Les marges de sûreté arrivent parfois après le premier affichage (l'app iPhone) : on les surveille
let encochesVues = "";
setInterval(() => {
  const e = JSON.stringify(encoches());
  if (e !== encochesVues) {
    encochesVues = e;
    redimensionner();
  }
}, 500);
// Gaucher : la bande passe de l'autre côté de la carte
surChangement(redimensionner);

// --- On tourne la page ---

const ancienne = document.createElement("canvas");
let tourneDepuis = -1;
const DUREE_TOURNE = 0.5;
nav.avantChangement = () => {
  ancienne.width = canvas.width;
  ancienne.height = canvas.height;
  ancienne.getContext("2d")!.drawImage(canvas, 0, 0);
  tourneDepuis = performance.now() / 1000;
};

/** L'ancienne page se soulève par la droite et part vers la gauche, avec son ombre sur la nouvelle. */
function tournerPage(): void {
  if (tourneDepuis < 0) return;
  const t = (performance.now() / 1000 - tourneDepuis) / DUREE_TOURNE;
  if (t >= 1) {
    tourneDepuis = -1;
    return;
  }
  const e = t * t * (3 - 2 * t);
  const ctx = ui.ctx;
  const w = canvas.width;
  const h = canvas.height;
  const largeur = Math.max(1, w * (1 - e));
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  // L'ombre portée sur la nouvelle page
  const ombre = ctx.createLinearGradient(largeur, 0, largeur + w * 0.12, 0);
  ombre.addColorStop(0, `rgba(60,45,20,${0.35 * (1 - e)})`);
  ombre.addColorStop(1, "rgba(60,45,20,0)");
  ctx.fillStyle = ombre;
  ctx.fillRect(largeur, 0, w * 0.12, h);
  // La page qui tourne : écrasée vers la gauche, un peu bombée, assombrie vers le pli
  ctx.drawImage(ancienne, 0, 0, w, h, 0, -h * 0.02 * Math.sin(e * Math.PI), largeur, h * (1 + 0.04 * Math.sin(e * Math.PI)));
  const pli = ctx.createLinearGradient(0, 0, largeur, 0);
  pli.addColorStop(0, "rgba(0,0,0,0)");
  pli.addColorStop(0.7, `rgba(0,0,0,${0.08 * e})`);
  pli.addColorStop(1, `rgba(0,0,0,${0.3 * e})`);
  ctx.fillStyle = pli;
  ctx.fillRect(0, 0, largeur, h);
  ctx.restore();
}

// --- La boucle ---

let phaseAvant = "";

/** La musique suit ce qui se passe : menus, attente, vague, boss ; un petit air à la fin de la page. */
function choisirMusique(): void {
  const p = partie;
  if (nav.ecran !== "partie" || !p) {
    phaseAvant = "";
    musique.ambiance("menu", { graine: 0, cahier: 0 });
    return;
  }
  const j = p.jeu;
  if (j.phase !== phaseAvant && (j.phase === "gagne" || j.phase === "perdu")) musique.jingle(j.phase);
  phaseAvant = j.phase;
  const o = { graine: j.regles.graine, cahier: p.page?.cahier ?? 2, danger: j.vies < j.viesMax * 0.3 ? 1 : 0 };
  if (j.phase === "gagne" || j.phase === "perdu") musique.ambiance("silence", o);
  else if (j.ennemis.some((e) => !e.mort && ENNEMIS[e.type].boss)) musique.ambiance("boss", o);
  else if (j.phase === "jeu" && (j.ennemis.length || j.file.length)) musique.ambiance("vague", o);
  else musique.ambiance("calme", o);
}

let avant = performance.now();

function image(maintenant: number): void {
  const dt = Math.min(0.1, (maintenant - avant) / 1000);
  avant = maintenant;
  ui.temps += dt;
  regler(ui.temps);
  if (nav.ecran === "partie") avancerPartie(dt);
  choisirMusique();

  const ctx = ui.ctx;
  ui.boutons = [];
  const enPartie = nav.ecran === "partie" && !!partie;
  const feuilles = enPartie ? vue.feuilles : vue.feuillesMenu;
  const unite = enPartie ? vue.s : vue.m;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const t = enPartie ? tableEnPartie : table;
  if (t && !vue.plein) ctx.drawImage(t, 0, 0);
  // Le cahier : sa couverture et l'épaisseur de ses pages, sous la ou les feuilles
  const x0 = Math.min(...feuilles.map((f) => f.x));
  const y0 = Math.min(...feuilles.map((f) => f.y));
  const lw = (Math.max(...feuilles.map((f) => f.x + f.w)) - x0) / unite;
  const lh = (Math.max(...feuilles.map((f) => f.y + f.h)) - y0) / unite;
  const dpr = vue.dpr;
  ctx.setTransform(dpr * unite, 0, 0, dpr * unite, x0 * dpr, y0 * dpr);
  if (!vue.plein) dessous(ctx, lw, lh, enPartie ? partie?.page?.cahier ?? 2 : 1);
  if (vue.pli !== null) reliure(ctx, (vue.pli - x0) / unite, lh, RELIURE / unite);
  if (enPartie) dessinerPartie(vue);
  else {
    ctx.setTransform(vue.menu);
    if (fond) ctx.drawImage(fond, zoneFond.x, zoneFond.y, zoneFond.w, zoneFond.h);
    if (nav.ecran === "titre") dessinerTitre();
    else if (nav.ecran === "aide") dessinerAide();
    else if (nav.ecran === "campagne") dessinerCampagne();
    else if (nav.ecran === "talents") dessinerTalents();
    else if (nav.ecran === "trousse") dessinerTrousse();
    else if (nav.ecran === "reglages") dessinerReglages();
    else if (nav.ecran === "coop") dessinerCoop();
    // Bille, dans son coin (le titre la dessine lui-même)
    compagnonMenu(nav.ecran, lancerTuto);
    if (vue.mise === "ouvert") {
      ctx.setTransform(pageDroiteMenu(vue));
      if (fond) ctx.drawImage(fond, 0, 0, W, H);
      pageDeGarde();
    }
  }
  if (vue.pli !== null) {
    ctx.setTransform(dpr * unite, 0, 0, dpr * unite, x0 * dpr, y0 * dpr);
    ombrePli(ctx, (vue.pli - x0) / unite, lh, RELIURE / unite);
  }
  // Bille, par-dessus tout ce qui précède (sauf dans le tutoriel, qui a la sienne)
  if (!(enPartie && partie?.tuto)) dessinerScene(ctx, { menu: vue.menu, carte: vue.carte, dessus: vue.dessus });
  dessinerAppui();
  ctx.setTransform(dpr * unite, 0, 0, dpr * unite, x0 * dpr, y0 * dpr);
  if (!vue.plein) coinCorne(ctx, lw, lh);
  tournerPage();
  requestAnimationFrame(image);
}

redimensionner();
chargerApparences();
// L'app iPhone : la sauvegarde d'iCloud, puis Game Center
void synchroniser().then(() => chargerApparences()).finally(() => void connecterGameCenter());
// Un lien de salon (…/?salon=ABCD) : on rejoint directement son ami
const salon = new URLSearchParams(location.search).get("salon");
if (salon) ouvrirCoop(salon);
void document.fonts.load("700 20px Caveat").then(() => document.fonts.load('20px "Patrick Hand"')).finally(() => requestAnimationFrame(image));

if (import.meta.env.PROD && "serviceWorker" in navigator) void navigator.serviceWorker.register("./sw.js");

// Pour les tests de bout en bout : l'état du jeu, lisible depuis la console
(window as unknown as { rature: unknown }).rature = {
  get partie() { return partie; },
  get ecran() { return nav.ecran; },
  get vue() { return vue; },
  get coop() { return coop; },
  sauvegarde: () => sauvegarde,
  effacer,
  jouerPage,
  pageDuJour,
  aller: nav.aller,
  pages: PAGES,
  sim: { poserTour, ameliorer, lancerVague, blesser, lancerPouvoir, choisirFourniture },
  interro,
  taire,
};
