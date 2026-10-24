// Rature : la mise en page, le doigt, la boucle, et l'aiguillage entre les écrans.
import "@fontsource/caveat/700.css";
import "@fontsource/patrick-hand/400.css";
import "./style.css";
import * as audio from "./audio";
import * as musique from "./musique";
import { ENNEMIS } from "./sim/ennemis";
import { regler } from "./render/encre";
import { papier } from "./render/papier";
import { ameliorer, blesser, lancerPouvoir, lancerVague, poserTour } from "./sim/jeu";
import { PAGES, optionsDePage, optionsPageDuJour, type Page } from "./sim/pages";
import { TYPES_TOURS } from "./sim/tours";
import { colleDebloquee, effacer, pouvoirsDebloques, sauvegarde, talentsActifs, toursDebloquees } from "./progression";
import { TYPES_POUVOIRS } from "./sim/pouvoirs";
import { grainePageDuJour } from "./sauvegarde";
import { H, W, dessinerAppui, ui } from "./ui/base";
import { actions, dessinerAide, dessinerCampagne, dessinerTalents, dessinerTitre } from "./ui/menus";
import { nav } from "./ui/nav";
import { dessinerReglages } from "./ui/reglages";
import { avancerPartie, demarrerPartie, dessinerPartie, glisserPartie, leverPartie, mettreEnPause, partie, toucherPartie } from "./ui/partie";
import { chargerApparences, dessinerTrousse, glisserTrousse, leverTrousse, toucherTrousse } from "./ui/trousse";

const canvas = document.getElementById("jeu") as HTMLCanvasElement;
ui.ctx = canvas.getContext("2d")!;
let echelle = 1;
let ox = 0;
let oy = 0;
let dpr = 1;
let fond: HTMLCanvasElement | null = null;

function redimensionner(): void {
  dpr = Math.min(window.devicePixelRatio || 1, 3);
  const cw = window.innerWidth;
  const ch = window.innerHeight;
  canvas.width = Math.round(cw * dpr);
  canvas.height = Math.round(ch * dpr);
  echelle = Math.min(cw / W, ch / H);
  ox = (cw - W * echelle) / 2;
  oy = (ch - H * echelle) / 2;
  fond = papier(W, H, echelle * dpr, "seyes");
}

function versPage(e: PointerEvent): { x: number; y: number } {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left - ox) / echelle, y: (e.clientY - r.top - oy) / echelle };
}

// --- Les parties ---

function jouerPage(p: Page, mode: "campagne" | "defi" | "sansFin"): void {
  const libelle = `${p.id} ${p.nom}${mode === "defi" ? " (défi)" : mode === "sansFin" ? " (sans fin)" : ""}`;
  demarrerPartie(() => ({
    ...optionsDePage(p, {
      toursDispo: toursDebloquees(), colle: colleDebloquee(), talents: talentsActifs(),
      defi: mode === "defi" ? p.defi : undefined, sansFin: mode === "sansFin",
    }),
    pouvoirs: pouvoirsDebloques(),
  }), { page: p, mode, libelle });
}

function pageDuJour(): void {
  const g = grainePageDuJour();
  demarrerPartie(() => ({ ...optionsPageDuJour(g, [...TYPES_TOURS]), pouvoirs: [...TYPES_POUVOIRS] }), { mode: "jour", libelle: "Page du " + g.split("-").reverse().slice(0, 2).join("/"), cleJour: g });
}

actions.jouerPage = jouerPage;
actions.pageDuJour = pageDuJour;
nav.ouvrirPage = (p) => jouerPage(p, "campagne");

// --- Le doigt ---

canvas.addEventListener("pointerdown", (e) => {
  audio.deverrouiller();
  const p = versPage(e);
  for (let i = ui.boutons.length - 1; i >= 0; i--) {
    const b = ui.boutons[i];
    if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) {
      if (b.visible !== false) ui.appui = { ...b, depuis: ui.temps };
      b.action();
      return;
    }
  }
  let pris = false;
  if (nav.ecran === "partie") pris = toucherPartie(p.x, p.y, e);
  if (nav.ecran === "trousse") pris = toucherTrousse(p.x, p.y);
  if (pris) canvas.setPointerCapture(e.pointerId);
});

canvas.addEventListener("pointermove", (e) => {
  if (nav.ecran === "partie") glisserPartie(e, versPage);
  if (nav.ecran === "trousse") {
    const p = versPage(e);
    glisserTrousse(p.x, p.y);
  }
});

function lever(e: PointerEvent): void {
  if (nav.ecran === "partie") leverPartie(e);
  if (nav.ecran === "trousse") leverTrousse();
}
canvas.addEventListener("pointerup", lever);
canvas.addEventListener("pointercancel", lever);

window.addEventListener("keydown", (e) => {
  if ((e.key === "Escape" || e.key === " ") && partie && nav.ecran === "partie") partie.pause = !partie.pause;
});
window.addEventListener("blur", mettreEnPause);
document.addEventListener("visibilitychange", () => document.hidden && mettreEnPause());
window.addEventListener("resize", redimensionner);

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
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#e4d9bf";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(dpr * echelle, 0, 0, dpr * echelle, ox * dpr, oy * dpr);
  ctx.fillStyle = "rgba(80,60,30,0.18)";
  ctx.fillRect(3, 4, W, H);
  if (nav.ecran === "partie" && partie) dessinerPartie(echelle * dpr);
  else {
    if (fond) ctx.drawImage(fond, 0, 0, W, H);
    if (nav.ecran === "titre") dessinerTitre();
    else if (nav.ecran === "aide") dessinerAide();
    else if (nav.ecran === "campagne") dessinerCampagne();
    else if (nav.ecran === "talents") dessinerTalents();
    else if (nav.ecran === "trousse") dessinerTrousse();
    else if (nav.ecran === "reglages") dessinerReglages();
  }
  dessinerAppui();
  tournerPage();
  requestAnimationFrame(image);
}

redimensionner();
chargerApparences();
void document.fonts.load("700 20px Caveat").then(() => document.fonts.load('20px "Patrick Hand"')).finally(() => requestAnimationFrame(image));

if (import.meta.env.PROD && "serviceWorker" in navigator) void navigator.serviceWorker.register("./sw.js");

// Pour les tests de bout en bout : l'état du jeu, lisible depuis la console
(window as unknown as { rature: unknown }).rature = {
  get partie() { return partie; },
  get ecran() { return nav.ecran; },
  sauvegarde: () => sauvegarde,
  effacer,
  jouerPage,
  pageDuJour,
  aller: nav.aller,
  pages: PAGES,
  sim: { poserTour, ameliorer, lancerVague, blesser, lancerPouvoir },
};
