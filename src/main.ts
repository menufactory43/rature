// Rature : la mise en page, le doigt, la boucle, et l'aiguillage entre les écrans.
import "@fontsource/caveat/700.css";
import "@fontsource/patrick-hand/400.css";
import "./style.css";
import * as audio from "./audio";
import { regler } from "./render/encre";
import { papier } from "./render/papier";
import { PAGES, optionsDePage, optionsPageDuJour, type Page } from "./sim/pages";
import { TYPES_TOURS } from "./sim/tours";
import { colleDebloquee, effacer, sauvegarde, talentsActifs, toursDebloquees } from "./progression";
import { grainePageDuJour } from "./sauvegarde";
import { H, W, ui } from "./ui/base";
import { actions, dessinerAide, dessinerCampagne, dessinerTalents, dessinerTitre } from "./ui/menus";
import { nav } from "./ui/nav";
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
  demarrerPartie(() => optionsDePage(p, {
    toursDispo: toursDebloquees(), colle: colleDebloquee(), talents: talentsActifs(),
    defi: mode === "defi" ? p.defi : undefined, sansFin: mode === "sansFin",
  }), { page: p, mode, libelle });
}

function pageDuJour(): void {
  const g = grainePageDuJour();
  demarrerPartie(() => optionsPageDuJour(g, [...TYPES_TOURS]), { mode: "jour", libelle: "Page du " + g.split("-").reverse().slice(0, 2).join("/"), cleJour: g });
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

// --- La boucle ---

let avant = performance.now();

function image(maintenant: number): void {
  const dt = Math.min(0.1, (maintenant - avant) / 1000);
  avant = maintenant;
  ui.temps += dt;
  regler(ui.temps);
  if (nav.ecran === "partie") avancerPartie(dt);

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
  }
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
};
