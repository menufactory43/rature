// L'écran de jeu : la page, les bandeaux, le pense-bête des symboles, le menu des tours, la pause et la fin.
import * as audio from "../audio";
import * as fx from "../render/fx";
import { vibrer } from "../vibre";
import { BLEU, CRAYON, PAPIER, ROUGE, cercle, ecrire, paragraphe, rectangle, trait } from "../render/encre";
import { monstre } from "../render/monstres";
import { papier } from "../render/papier";
import { decor, scene, type Brouillon } from "../render/scene";
import { symbole } from "../render/tours";
import { ENNEMIS, type TypeEnnemi } from "../sim/ennemis";
import { polylineLength, truncate, type V } from "../sim/geom";
import { classer, type Pt } from "../sim/gestures";
import {
  ameliorer, apercuTrajets, appliquerTrace, changerCible, coutAmelioration, coutPose, coutRature, ENCRE_PAR_PX_COLLE, ENCRE_PAR_PX_MUR, etoiles,
  gestesPermis, lancerVague, longueurPossible, nouveauJeu, refusPose, stats, step, valeurRevente, vendre, type Jeu, type Options, type Tour,
} from "../sim/jeu";
import { PAGES, TEXTE_DEFI, type Page } from "../sim/pages";
import { PORTEE_INFINIE, TOURS, statsTour, type TypeTour } from "../sim/tours";
import { resume, type PlanVague } from "../sim/vagues";
import { enregistrer, noterPage, sauvegarde } from "../progression";
import { BAS, H, HAUT, PAGE_H, W, bouton, boutonSon, ui, voile, zone } from "./base";
import { nav } from "./nav";

export type Mode = "campagne" | "defi" | "sansFin" | "jour";

interface Partie {
  jeu: Jeu;
  options: () => Options;
  page: Page | null;
  mode: Mode;
  libelle: string;
  cleJour?: string;
  selection: Tour | null;
  trace: Pt[] | null;
  doigt: number | null;
  sec: boolean;
  vitesse: number;
  pause: boolean;
  finDepuis: number;
  fin: boolean;
  /** Les fiches à montrer (apprentissage d'une tour, ou pense-bête touché). */
  fiches: TypeTour[];
  message: string | null;
  record: boolean;
  fond: HTMLCanvasElement | null;
  echelleFond: number;
  reste: number;
}

export let partie: Partie | null = null;

export function demarrerPartie(options: () => Options, quoi: { page?: Page; mode: Mode; libelle: string; cleJour?: string }): void {
  const jeu = nouveauJeu(options());
  partie = {
    jeu, options, page: quoi.page ?? null, mode: quoi.mode, libelle: quoi.libelle, cleJour: quoi.cleJour,
    selection: null, trace: null, doigt: null, sec: false, vitesse: 1, pause: false, finDepuis: 0, fin: false,
    fiches: jeu.options.toursDispo.filter((t) => !sauvegarde.appris.includes(t)), message: null, record: false,
    fond: null, echelleFond: 0, reste: 0,
  };
  nav.aller("partie");
  fx.remettreAZero();
  fx.reglerCibleEncre({ x: 18, y: PAGE_H + 20 });
  audio.jouer(["page"]);
}

function recommencer(): void {
  if (!partie) return;
  demarrerPartie(partie.options, { page: partie.page ?? undefined, mode: partie.mode, libelle: partie.libelle, cleJour: partie.cleJour });
}

export function mettreEnPause(): void {
  if (partie && !partie.fin && nav.ecran === "partie") partie.pause = true;
}

// --- La boucle ---

const PAS = 1 / 60;

export function avancerPartie(dt: number): void {
  const p = partie;
  if (!p || p.pause || p.fiches.length) return;
  const j = p.jeu;
  p.reste += dt * (j.phase === "jeu" ? p.vitesse : 1);
  let n = 0;
  while (p.reste >= PAS && n++ < 20) {
    step(j, PAS);
    p.reste -= PAS;
  }
  if (p.reste > PAS) p.reste = 0;
  audio.jouer(j.sons);
  j.sons.length = 0;
  fx.absorber(j, dt);
  if (p.selection && !j.tours.includes(p.selection)) p.selection = null;
  if ((j.phase === "gagne" || j.phase === "perdu") && !p.fin) {
    if (!p.finDepuis) p.finDepuis = ui.temps;
    if (ui.temps - p.finDepuis > 1.2) terminer(p);
  }
}

function terminer(p: Partie): void {
  const j = p.jeu;
  p.fin = true;
  p.finDepuis = ui.temps;
  p.trace = null;
  p.doigt = null;
  p.selection = null;
  const gagne = j.phase === "gagne";
  if (p.page && p.mode === "campagne" && gagne) {
    const premiere = !(sauvegarde.etoiles[p.page.id] > 0);
    p.record = noterPage(p.page.id, etoiles(j));
    if (premiere && p.page.debloque) {
      p.message = p.page.debloque === "colle" ? "Nouveau geste : la colle (une grande boucle)" : `Nouvelle tour : ${TOURS[p.page.debloque].nom}`;
    }
  }
  if (p.page && p.mode === "defi" && gagne && !sauvegarde.defis[p.page.id]) {
    sauvegarde.defis[p.page.id] = true;
    p.record = true;
    p.message = "Défi réussi : un bon point de plus";
    enregistrer();
  }
  if (p.page && p.mode === "sansFin") {
    const tenues = j.vague - 1;
    if (tenues > (sauvegarde.sansFin[p.page.id] ?? 0)) {
      sauvegarde.sansFin[p.page.id] = tenues;
      p.record = true;
      enregistrer();
    }
  }
  if (p.mode === "jour" && p.cleJour) {
    const r = { vagues: gagne ? j.regles.total : j.vague - 1, vies: j.vies };
    const avant = sauvegarde.jour[p.cleJour];
    if (!avant || r.vagues > avant.vagues || (r.vagues === avant.vagues && r.vies > avant.vies)) {
      sauvegarde.jour[p.cleJour] = r;
      p.record = true;
      enregistrer();
    }
  }
}

// --- Le doigt ---

/** Renvoie vrai si le toucher a été pris (les boutons passent avant, dans main). */
export function toucherPartie(x: number, y: number, e: PointerEvent): boolean {
  const p = partie;
  if (!p || p.pause || p.fin) return false;
  if (p.fiches.length) {
    marquerAppris(p.fiches.shift()!);
    return true;
  }
  const j = p.jeu;
  if (j.phase !== "attente" && j.phase !== "jeu") return false;
  if (y < HAUT || y > HAUT + PAGE_H || p.doigt !== null) return false;
  p.doigt = e.pointerId;
  p.trace = [{ x, y: y - HAUT, t: e.timeStamp }];
  p.sec = false;
  return true;
}

function marquerAppris(t: TypeTour): void {
  if (!sauvegarde.appris.includes(t)) {
    sauvegarde.appris.push(t);
    enregistrer();
  }
}

export function glisserPartie(e: PointerEvent, versPage: (ev: PointerEvent) => { x: number; y: number }): void {
  const p = partie;
  if (!p || e.pointerId !== p.doigt || !p.trace) return;
  const evts = e.getCoalescedEvents?.() ?? [];
  for (const ev of evts.length ? evts : [e]) {
    if (p.sec) break;
    const q = versPage(ev);
    const pt = { x: q.x, y: q.y - HAUT, t: ev.timeStamp };
    const dernier = p.trace[p.trace.length - 1];
    if (Math.hypot(pt.x - dernier.x, pt.y - dernier.y) < 2) continue;
    p.trace.push(pt);
    const possible = longueurPossible(p.jeu);
    if (polylineLength(p.trace) > possible) {
      const avant: Pt[] = p.trace;
      p.trace = truncate(avant, possible).map((q2, i) => ({ ...q2, t: avant[Math.min(i, avant.length - 1)].t }));
      p.sec = true;
    }
  }
  const n = p.trace.length;
  if (n > 2) {
    const a = p.trace[Math.max(0, n - 4)];
    const b = p.trace[n - 1];
    audio.gratter(Math.hypot(b.x - a.x, b.y - a.y) / Math.max(1, b.t - a.t));
  }
}

export function leverPartie(e: PointerEvent): void {
  const p = partie;
  if (!p || e.pointerId !== p.doigt) return;
  p.doigt = null;
  audio.gratter(0);
  const trace = p.trace;
  p.trace = null;
  if (!trace) return;
  const j = p.jeu;
  const l = polylineLength(trace);
  const duree = trace[trace.length - 1].t - trace[0].t;
  // Un simple toucher : choisir une tour (ou fermer son menu)
  if (l < 10 && duree < 400) {
    const q = trace[0];
    let best: Tour | null = null;
    let bd = 22;
    for (const t of j.tours) {
      const d = Math.hypot(t.x - q.x, t.y - q.y);
      if (d < bd) {
        bd = d;
        best = t;
      }
    }
    p.selection = best && best !== p.selection ? best : null;
    return;
  }
  const r = appliquerTrace(j, trace);
  if (r.ok) p.selection = null;
  if (!r.ok && r.geste !== "rien") vibrer("refus");
  if (r.geste === "tour" || r.geste === "rien" || !r.ok) {
    const pose = r.ok ? j.tours[j.tours.length - 1] : null;
    fx.ajouterTrace(trace, pose ? { x: pose.x, y: pose.y } : null, r.ok ? BLEU : CRAYON);
  }
}

// --- Le dessin ---

function fond(p: Partie, echelle: number): HTMLCanvasElement {
  if (!p.fond || p.echelleFond !== echelle) {
    const c = papier(W, H, echelle, p.jeu.carte.papier, HAUT);
    const ctx = c.getContext("2d")!;
    ctx.save();
    ctx.translate(0, HAUT);
    decor(ctx, p.jeu.carte);
    ctx.restore();
    p.fond = c;
    p.echelleFond = echelle;
  }
  return p.fond;
}

export function dessinerPartie(echelle: number): void {
  const p = partie;
  if (!p) return;
  const ctx = ui.ctx;
  const j = p.jeu;
  ctx.drawImage(fond(p, echelle), 0, 0, W, H);
  // La page
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, HAUT, W, PAGE_H);
  ctx.clip();
  const sec = fx.secousse();
  ctx.translate(sec.x, HAUT + sec.y);
  let brouillon: Brouillon | null = null;
  if (p.trace) brouillon = { pts: p.trace, geste: classer([...p.trace, { ...p.trace[p.trace.length - 1], t: performance.now() }]).geste };
  scene(ctx, j, brouillon, p.selection);
  if (p.trace && p.trace.length > 3) apercu(p);
  if (brouillon && p.trace && p.trace.length > 3) {
    const b = p.trace[p.trace.length - 1];
    const c = classer([...p.trace, { ...b, t: performance.now() }]);
    const nom = p.sec ? "plus d'encre" : c.geste === "cercle" ? "colle" : c.geste === "tour" ? TOURS[tourDe(c.glyphe!)].nom : c.geste === "rien" ? "" : c.geste;
    ecrire(ctx, nom, b.x + 18, b.y - 24, { couleur: p.sec ? ROUGE : CRAYON, taille: 15 });
  }
  ctx.restore();
  if (j.phase === "attente") carteAttente(p);
  const conseil = astuce(p);
  if (conseil && !p.trace) {
    const y = j.carte.coeur.y > PAGE_H - 140 ? HAUT + 160 : HAUT + PAGE_H - 30;
    ctx.fillStyle = "rgba(246,239,220,0.85)";
    ctx.fillRect(20, y - 22, W - 40, 44);
    paragraphe(ctx, conseil, W / 2, y - 8, W - 60, { taille: 15, couleur: ROUGE });
  }
  trait(ctx, [{ x: 0, y: HAUT }, { x: W, y: HAUT }], { couleur: CRAYON, epaisseur: 1, amp: 0.3, graine: 80 });
  trait(ctx, [{ x: 0, y: HAUT + PAGE_H }, { x: W, y: HAUT + PAGE_H }], { couleur: CRAYON, epaisseur: 1, amp: 0.3, graine: 81 });
  bandeauHaut(p);
  bandeauBas(p);
  fx.dessinerEcran(ctx, HAUT, W, H);
  if (p.selection) menuTour(p, p.selection);
  if (p.fiches.length) fiche(p.fiches[0], j);
  if (p.pause) dessinerPause();
  if (p.fin) dessinerFin(p);
}

/** Les conseils des premières pages : le tutoriel, au fil de la partie. */
function astuce(p: Partie): string | null {
  const j = p.jeu;
  const id = p.page?.id;
  if (p.mode !== "campagne" || p.fiches.length || p.selection || (sauvegarde.etoiles[id ?? ""] ?? 0) > 0) return null;
  if (id === "1-1") {
    if (!j.tours.length) return "Dessine un PETIT cercle à côté du chemin pointillé : une Plume.";
    if (j.phase === "attente") return "Une tour de plus si tu peux, puis « Go ! ». Touche une tour pour l'améliorer.";
    if (j.vague <= 2) return "Un grand trait LENT trace un mur : la horde le contourne, et le chemin s'allonge.";
    if (j.vague <= 4) return "Un trait SEC et rapide rature ce qu'il touche. Dans le vide, l'encre est perdue.";
    if (j.vague <= 6) return "Appelle la vague suivante plus tôt (en haut) : chaque seconde gagnée rapporte de l'encre.";
  }
  if (id === "1-2" && j.vague <= 2) return "Des murs en travers du zigzag : plus le chemin est long, plus tes tours tirent.";
  const present = (t: TypeEnnemi) => j.ennemis.some((e) => !e.mort && e.type === t);
  if (id === "1-3" && present("avion")) return "Les avions volent par-dessus les murs. Les ratures les arrêtent.";
  if (id === "1-3" && j.vague <= 3) return "Une grande boucle autour du chemin pose de la colle : tout ce qui passe dedans ralentit.";
  if (id === "1-4" && present("tache")) return "Les taches rongent les murs, et se divisent en mourant.";
  return null;
}

/** L'aperçu pendant qu'on dessine : la portée de la tour qui va naître, et le nouveau chemin de la horde. */
let apercuCache: { n: number; quand: number; trajets: V[][] } | null = null;

function apercu(p: Partie): void {
  const ctx = ui.ctx;
  const j = p.jeu;
  const trace = p.trace!;
  const b = trace[trace.length - 1];
  const c = classer([...trace, { ...b, t: performance.now() }]);
  let ajout: { mur?: V[]; tour?: V } | null = null;
  if (c.geste === "tour") {
    const type = tourDe(c.glyphe!);
    const cx = trace.reduce((s, q) => s + q.x, 0) / trace.length;
    const cy = trace.reduce((s, q) => s + q.y, 0) / trace.length;
    const refus = refusPose(j, cx, cy) || (!j.options.toursDispo.includes(type) ? "pas débloquée" : null);
    const portee = statsTour(type, 1, 0).portee;
    if (portee && portee < PORTEE_INFINIE) {
      ctx.save();
      ctx.fillStyle = refus ? "rgba(196,48,43,0.07)" : "rgba(34,64,143,0.07)";
      ctx.beginPath();
      ctx.arc(cx, cy, portee, 0, Math.PI * 2);
      ctx.fill();
      ctx.setLineDash([4, 5]);
      ctx.strokeStyle = refus ? "rgba(196,48,43,0.6)" : "rgba(34,64,143,0.55)";
      ctx.lineWidth = 1.3;
      ctx.stroke();
      ctx.restore();
    }
    if (refus) ecrire(ctx, refus, cx, cy + 26, { taille: 13, couleur: ROUGE });
    else ajout = { tour: { x: cx, y: cy } };
  } else if (c.geste === "mur" && gestesPermis(j).mur) ajout = { mur: trace };
  if (!ajout) {
    apercuCache = null;
    return;
  }
  // Recalculer le chemin coûte un peu : pas plus de dix fois par seconde
  const maintenant = performance.now();
  if (!apercuCache || (apercuCache.n !== trace.length && maintenant - apercuCache.quand > 100)) apercuCache = { n: trace.length, quand: maintenant, trajets: apercuTrajets(j, ajout) };
  ctx.save();
  ctx.setLineDash([3, 5]);
  ctx.lineDashOffset = -ui.temps * 20;
  ctx.strokeStyle = "rgba(196,48,43,0.6)";
  ctx.lineWidth = 1.8;
  ctx.lineCap = "round";
  for (const t of apercuCache.trajets) {
    ctx.beginPath();
    t.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
    ctx.stroke();
  }
  ctx.restore();
  // L'allongement du chemin, en clair
  const avant = j.trajets.reduce((s, t) => s + polylineLength(t), 0);
  const apres = apercuCache.trajets.reduce((s, t) => s + polylineLength(t), 0);
  const d = Math.round((apres - avant) / 10);
  if (Math.abs(d) >= 2) ecrire(ctx, `chemin ${d > 0 ? "+" : ""}${d}`, b.x + 18, b.y - 42, { taille: 13, couleur: d > 0 ? BLEU : ROUGE });
}

const tourDe = (g: string): TypeTour => (Object.keys(TOURS) as TypeTour[]).find((t) => TOURS[t].glyphe === g)!;

function listeVague(plan: PlanVague, x: number, y: number, largeur: number, taille = 15): number {
  const ctx = ui.ctx;
  let cx = x;
  let cy = y;
  for (const it of resume(plan)) {
    const f = ENNEMIS[it.type];
    const texte = f.boss ? f.nom : `${it.nombre} ${it.nombre > 1 ? f.pluriel : f.nom}`;
    ctx.font = `${taille}px "Patrick Hand", cursive`;
    const w = 24 + ctx.measureText(texte).width + 12;
    if (cx + w > x + largeur && cx > x) {
      cx = x;
      cy += taille + 9;
    }
    monstre(ctx, it.type, cx + 9, cy, Math.min(it.type === "gomme" ? 6 : 8, f.rayon * 0.7), 3, ui.temps, ROUGE, -0.5);
    ecrire(ctx, texte, cx + 22, cy, { align: "left", taille, couleur: f.boss ? ROUGE : BLEU });
    cx += w;
  }
  return cy - y + taille + 9;
}

/** Calculée une fois par partie, pour que la carte ne saute pas quand on trace des murs. */
const placeCarte = new WeakMap<Jeu, number>();

function carteAttente(p: Partie): void {
  const ctx = ui.ctx;
  const j = p.jeu;
  const x = 14;
  const w = W - 28;
  const h = 118;
  // La carte se pose là où elle cache le moins : ni entrée ni Cœur, et le moins de chemin possible
  const poids = [
    ...j.carte.entrees.map((e) => ({ ...e.bord, k: 10 })),
    { ...j.carte.coeur, k: 30 },
    ...j.trajets.flat().map((q) => ({ ...q, k: 0.3 })),
  ];
  let y = placeCarte.get(j) ?? HAUT + 10;
  let meilleur = placeCarte.has(j) ? -Infinity : Infinity;
  // En haut ou en bas seulement : le milieu de la page, c'est là qu'on construit
  for (const yy of [10, PAGE_H - h - 10]) {
    const cout = poids.reduce((s, q) => s + (q.y > yy - 25 && q.y < yy + h + 25 ? q.k : 0), 0) + yy * 0.001;
    if (cout < meilleur) {
      meilleur = cout;
      y = HAUT + yy;
    }
  }
  placeCarte.set(j, y);
  ctx.fillStyle = "rgba(246,239,220,0.9)";
  ctx.fillRect(x, y, w, h);
  rectangle(ctx, x, y, w, h, { epaisseur: 1.4, graine: 90, couleur: CRAYON });
  ecrire(ctx, p.libelle, x + 12, y + 20, { align: "left", police: "titre", taille: 26 });
  const total = Number.isFinite(j.regles.total) ? `${j.regles.total} vagues` : "sans fin";
  ecrire(ctx, total + (p.mode === "defi" && j.options.defi ? ` · défi : ${TEXTE_DEFI[j.options.defi].toLowerCase()}` : ""), x + 12, y + 44, { align: "left", taille: 13, couleur: CRAYON });
  ecrire(ctx, "Vague 1 :", x + 12, y + 66, { align: "left", taille: 14, couleur: CRAYON });
  if (j.plan) listeVague(j.plan, x + 76, y + 66, w - 200, 14);
  ecrire(ctx, "Pose tes tours, puis :", x + w - 64, y + 52, { taille: 12, couleur: CRAYON });
  bouton(x + w - 116, y + 64, 104, 40, "Go !", () => lancerVague(j), { principal: true });
}

function bandeauHaut(p: Partie): void {
  const ctx = ui.ctx;
  const j = p.jeu;
  bouton(8, 8, 38, 30, "II", () => (p.pause = true), { taille: 17 });
  ecrire(ctx, "♥", 62, 22, { couleur: ROUGE, taille: 22 });
  ecrire(ctx, String(j.vies), 76, 23, { align: "left", couleur: ROUGE, taille: 22, police: "titre" });
  const total = Number.isFinite(j.regles.total) ? `/${j.regles.total}` : "";
  ecrire(ctx, `vague ${Math.max(1, j.vague)}${total}`, 118, 23, { align: "left", taille: 19 });
  bouton(W - 50, 8, 42, 30, `×${p.vitesse}`, () => (p.vitesse = p.vitesse === 3 ? 1 : p.vitesse + 1), { taille: 17, principal: p.vitesse > 1 });
  ecrire(ctx, p.libelle, W - 60, 22, { align: "right", taille: 13, couleur: CRAYON });
  if (j.phase === "jeu" && j.prochaine !== null && j.plan) {
    const bonus = Math.round(j.prochaine * 2);
    bouton(W - 230, 40, 222, 18, `▸ vague ${j.vague + 1} dans ${Math.ceil(j.prochaine)} s (+${bonus})`, () => lancerVague(j), { taille: 13 });
  } else if (j.phase === "jeu" && !j.plan) ecrire(ctx, "dernière vague !", W - 12, 49, { align: "right", taille: 14, couleur: ROUGE });
  else if (j.phase === "jeu") ecrire(ctx, "la vague arrive…", W - 12, 49, { align: "right", taille: 13, couleur: CRAYON });
}

function bandeauBas(p: Partie): void {
  const ctx = ui.ctx;
  const j = p.jeu;
  const y0 = HAUT + PAGE_H;
  // L'encre : la seule monnaie
  ctx.fillStyle = BLEU;
  ctx.beginPath();
  ctx.moveTo(18, y0 + 8);
  ctx.quadraticCurveTo(28, y0 + 22, 18, y0 + 30);
  ctx.quadraticCurveTo(8, y0 + 22, 18, y0 + 8);
  ctx.fill();
  const pulse = fx.pulseEncre();
  ecrire(ctx, String(Math.floor(j.encre)), 34, y0 + 21, { align: "left", police: "titre", taille: 30 * (1 + pulse * 0.18), couleur: pulse > 0.5 ? "#3a5fc4" : BLEU });
  if (p.trace && p.trace.length > 1) {
    const l = polylineLength(p.trace);
    const c = classer([...p.trace, { ...p.trace[p.trace.length - 1], t: performance.now() }]);
    const cout = c.geste === "tour" ? coutPose(j, tourDe(c.glyphe!)) : c.geste === "rature" ? coutRature(l) : c.geste === "cercle" ? l * ENCRE_PAR_PX_COLLE : c.geste === "mur" ? l * ENCRE_PAR_PX_MUR : 0;
    if (cout) ecrire(ctx, `−${Math.ceil(cout)}`, 100, y0 + 22, { align: "left", taille: 20, couleur: cout > j.encre ? ROUGE : CRAYON });
  }
  // Les gestes permis
  const g = gestesPermis(j);
  const gestes = [
    g.mur && ["mur", "lent"],
    g.rature && ["rature", "sec"],
    g.colle && j.options.gestes?.colle !== false && ["colle", "boucle"],
  ].filter(Boolean) as string[][];
  gestes.forEach(([nom, comment], i) => {
    const x = 170 + i * 76;
    ecrire(ctx, nom, x, y0 + 15, { taille: 14 });
    ecrire(ctx, comment, x, y0 + 30, { taille: 11, couleur: CRAYON });
  });
  // Le pense-bête : les symboles des tours débloquées
  const types = j.options.toursDispo;
  const largeur = Math.min(56, (W - 16) / Math.max(1, types.length));
  types.forEach((t, i) => {
    const x = 8 + i * largeur + largeur / 2;
    const y = y0 + 60;
    const cout = coutPose(j, t);
    const possible = j.encre >= cout;
    symbole(ctx, TOURS[t].glyphe, x, y - 6, 9, possible ? BLEU : CRAYON, 1.8);
    ecrire(ctx, String(cout), x, y + 16, { taille: 12, couleur: possible ? BLEU : CRAYON });
    zone(x - largeur / 2, y - 22, largeur, 46, () => (p.fiches = [t]));
  });
}

let menuOuvert: { t: Tour | null; depuis: number } = { t: null, depuis: 0 };

function menuTour(p: Partie, t: Tour): void {
  const ctx = ui.ctx;
  if (menuOuvert.t !== t) menuOuvert = { t, depuis: ui.temps };
  const ouvre = Math.min(1, (ui.temps - menuOuvert.depuis) / 0.18);
  const j = p.jeu;
  const f = TOURS[t.type];
  const s = stats(t);
  const h = t.niveau === 3 && !t.spec ? 196 : 150;
  const x = 10;
  const w = W - 20;
  const y = t.y > PAGE_H / 2 ? HAUT + 8 : HAUT + PAGE_H - h - 8;
  zone(0, HAUT, W, PAGE_H, () => (p.selection = null));
  zone(x, y, w, h, () => {});
  // Le menu se déplie depuis la tour, avec un petit rebond
  const k = 1 - Math.exp(-ouvre * 6) * Math.cos(ouvre * 9);
  ctx.save();
  const ox = t.x;
  const oy = HAUT + t.y;
  ctx.translate(ox, oy);
  ctx.scale(0.3 + 0.7 * k, 0.3 + 0.7 * k);
  ctx.translate(-ox, -oy);
  ctx.globalAlpha = Math.min(1, ouvre * 3);
  ctx.fillStyle = "rgba(255,252,240,0.96)";
  ctx.fillRect(x, y, w, h);
  rectangle(ctx, x, y, w, h, { epaisseur: 2, graine: 120 });
  const titre = t.spec ? f.specs[t.spec - 1].nom : f.nom;
  ecrire(ctx, titre, x + 14, y + 22, { align: "left", police: "titre", taille: 28 });
  ecrire(ctx, t.spec ? `${f.nom} · spécialisée` : `niveau ${t.niveau}/3`, x + 14, y + 46, { align: "left", taille: 13, couleur: CRAYON });
  ecrire(ctx, decrireStats(t.type, s), x + 14, y + 66, { align: "left", taille: 14 });
  bouton(x + w - 40, y + 8, 30, 28, "×", () => (p.selection = null), { taille: 18 });
  let by = y + 84;
  if (t.niveau < 3) {
    const cout = coutAmelioration(j, t)!;
    bouton(x + 12, by, 170, 50, `Améliorer`, () => ameliorer(j, t), { sous: `−${cout} d'encre`, inactif: j.encre < cout, principal: true, taille: 19 });
  } else if (!t.spec) {
    f.specs.forEach((sp, i) => {
      const cout = coutAmelioration(j, t, i + 1)!;
      const bx = x + 12 + i * ((w - 36) / 2 + 12);
      const bw = (w - 36) / 2;
      bouton(bx, by, bw, 50, sp.nom, () => ameliorer(j, t, i + 1), { sous: `−${cout}`, inactif: j.encre < cout, principal: true, taille: 18 });
      paragraphe(ctx, sp.texte, bx + 4, by + 56, bw - 8, { align: "left", taille: 12, couleur: CRAYON });
    });
    by += 96;
  } else ecrire(ctx, "au maximum", x + 96, by + 25, { taille: 16, couleur: CRAYON });
  const bx2 = t.niveau === 3 && !t.spec ? x + 12 : x + 194;
  if (!f.passive) bouton(bx2, t.niveau === 3 && !t.spec ? by + 8 : by, 88, 50, "Cible", () => changerCible(t), { sous: t.cible, taille: 16 });
  bouton(x + w - 98, t.niveau === 3 && !t.spec ? by + 8 : by, 86, 50, "Vendre", () => vendre(j, t), { sous: `+${valeurRevente(t)}`, taille: 16 });
  ctx.restore();
}

function decrireStats(type: TypeTour, s: ReturnType<typeof stats>): string {
  const c = (n: number) => String(Math.round(n * 100) / 100).replace(".", ",");
  const portee = s.portee >= PORTEE_INFINIE ? "portée infinie" : `portée ${s.portee}`;
  switch (type) {
    case "plume": return `dégâts ${s.degats} · tous les ${c(s.intervalle)} s · ${portee}${s.perce ? ` · traverse ${s.perce}` : ""}`;
    case "roquette": return `dégâts ${s.degats} · zone ${s.zone} · tous les ${c(s.intervalle)} s${s.dps ? " · napalm" : ""}`;
    case "foudre": return `dégâts ${s.degats} · ${s.rebonds} rebonds · tous les ${c(s.intervalle)} s`;
    case "correction": return `dégâts ${s.degats} · tous les ${c(s.intervalle)} s · ${portee}`;
    case "spirale": return `ralentit ${Math.round((s.ralenti ?? 0) * 100)} % · portée ${s.portee}${s.dps ? ` · brûle ${s.dps}/s` : ""}`;
    case "scie": return `${s.lames} lames · ${s.dps} dégâts/s${s.ignoreArmure ? " · ignore l'armure" : ""}`;
    case "encrier": return `+${c(s.encre ?? 0)} d'encre/s${s.interets ? " · intérêts" : ""}${s.primeBonus ? " · primes +50 %" : ""}`;
  }
}

/** La fiche d'une tour : le symbole qui se dessine, son prix, son rôle. */
function fiche(type: TypeTour, j: Jeu): void {
  const ctx = ui.ctx;
  const f = TOURS[type];
  voile(0.75);
  const x = 30;
  const y = 200;
  const w = W - 60;
  const h = 380;
  ctx.fillStyle = "rgba(255,252,240,0.97)";
  ctx.fillRect(x, y, w, h);
  rectangle(ctx, x, y, w, h, { epaisseur: 2.2, graine: 150 });
  const nouvelle = !sauvegarde.appris.includes(type);
  if (nouvelle) ecrire(ctx, "nouvelle tour !", x + w - 20, y + 22, { align: "right", taille: 15, couleur: ROUGE, rotation: 0.08 });
  ecrire(ctx, f.nom, W / 2, y + 44, { police: "titre", taille: 40 });
  ecrire(ctx, f.role, W / 2, y + 78, { taille: 16, couleur: CRAYON });
  // Le symbole se dessine en boucle
  const avance = Math.min(1, ((ui.temps % 2.2) / 2.2) * 1.4);
  ctx.save();
  ctx.setLineDash([3, 5]);
  symbole(ctx, f.glyphe, W / 2, y + 178, 52, "rgba(60,62,75,0.3)", 2);
  ctx.restore();
  symbole(ctx, f.glyphe, W / 2, y + 178, 52, BLEU, 3.5, avance);
  paragraphe(ctx, "Dessine ce symbole en PETIT (moins de 2 cm) là où tu veux la tour.", W / 2, y + 256, w - 40, { taille: 16 });
  ecrire(ctx, `${coutPose(j, type)} d'encre`, W / 2, y + 318, { taille: 20, couleur: BLEU });
  ecrire(ctx, "touche pour continuer", W / 2, y + h - 18, { taille: 13, couleur: CRAYON });
}

function dessinerPause(): void {
  voile(0.88);
  ecrire(ui.ctx, "Pause", W / 2, 230, { police: "titre", taille: 64 });
  bouton(90, 300, 220, 56, "Reprendre", () => partie && (partie.pause = false), { principal: true });
  bouton(90, 376, 220, 50, "Recommencer la page", recommencer, { taille: 19 });
  bouton(90, 446, 220, 50, "Quitter la page", () => nav.aller(partie?.mode === "jour" ? "titre" : "campagne"), { taille: 19 });
  boutonSon(W / 2 - 20, 526);
}

function etoile(x: number, y: number, r: number, pleine: boolean, graine: number): void {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    pts.push({ x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr });
  }
  trait(ui.ctx, pts, { ferme: true, couleur: pleine ? ROUGE : CRAYON, epaisseur: 2.4, graine, fond: pleine ? "rgba(196,48,43,0.55)" : undefined });
}
export { etoile };

function dessinerFin(p: Partie): void {
  const ctx = ui.ctx;
  const j = p.jeu;
  voile(0.92);
  const gagne = j.phase === "gagne";
  const sansFin = p.mode === "sansFin";
  const titreFin = sansFin ? "Fin de la page" : gagne ? "Page gagnée !" : "Page perdue";
  const t = ui.temps - p.finDepuis;
  // Le titre s'écrit de gauche à droite
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 60, W * Math.min(1, t / 0.5), 120);
  ctx.clip();
  ecrire(ctx, titreFin, W / 2, 120, { police: "titre", taille: 54, couleur: gagne || sansFin ? BLEU : ROUGE });
  ctx.restore();
  const apparition = Math.min(1, Math.max(0, (t - 0.3) * 3));
  ctx.save();
  ctx.globalAlpha = apparition;
  if (gagne && p.mode === "campagne") {
    ctx.globalAlpha = 1;
    const n = etoiles(j);
    for (let k = 0; k < 3; k++) {
      // Chaque étoile est tamponnée à son tour : elle tombe de haut, s'écrase, et l'encre gicle
      const tk = t - 0.55 - k * 0.35;
      if (tk < 0) continue;
      const sx = W / 2 - 70 + k * 70;
      const sy = 220 - (k === 1 ? 14 : 0);
      const chute = Math.max(0, 1 - tk / 0.16);
      const ecrase = tk > 0.16 ? Math.exp(-(tk - 0.16) * 14) * Math.sin((tk - 0.16) * 40) * 0.25 : 0;
      ctx.save();
      ctx.globalAlpha = Math.min(1, tk * 8);
      ctx.translate(sx, sy);
      ctx.scale((1 + chute * 1.6) * (1 + ecrase), (1 + chute * 1.6) * (1 - ecrase));
      ctx.rotate(chute * (k - 1) * 0.6);
      ctx.translate(-sx, -sy);
      etoile(sx, sy, 28, k < n, 160 + k);
      ctx.restore();
      if (k < n && tk > 0.16 && tk < 0.6) {
        const u = (tk - 0.16) / 0.44;
        for (let i = 0; i < 9; i++) {
          const a = (i / 9) * Math.PI * 2 + k;
          const d1 = 30 + u * 18;
          trait(ctx, [{ x: sx + Math.cos(a) * d1, y: sy + Math.sin(a) * d1 }, { x: sx + Math.cos(a) * (d1 + 8), y: sy + Math.sin(a) * (d1 + 8) }], { couleur: ROUGE, epaisseur: 2, alpha: 1 - u, graine: 170 + i });
        }
      }
    }
  } else if (sansFin) {
    ecrire(ctx, `${j.vague - 1} vagues tenues`, W / 2, 220, { police: "titre", taille: 44, couleur: ROUGE });
  } else if (!gagne) {
    ecrire(ctx, `tombée à la vague ${j.vague}`, W / 2, 200, { police: "titre", taille: 32, couleur: ROUGE, rotation: -0.04 });
    // Le tampon de la prof
    const tk = t - 0.6;
    if (tk > 0) {
      const chute = Math.max(0, 1 - tk / 0.14);
      ctx.save();
      ctx.globalAlpha = Math.min(1, tk * 8) * 0.9;
      ctx.translate(W / 2, 250);
      ctx.rotate(-0.18);
      ctx.scale(1 + chute * 1.8, 1 + chute * 1.8);
      rectangle(ctx, -78, -24, 156, 48, { couleur: ROUGE, epaisseur: 3.5, graine: 181 });
      rectangle(ctx, -72, -19, 144, 38, { couleur: ROUGE, epaisseur: 1.2, graine: 182 });
      ecrire(ctx, "À REFAIRE", 0, 1, { police: "titre", taille: 34, couleur: ROUGE });
      ctx.restore();
    }
  } else {
    ecrire(ctx, `${j.vies} vies gardées`, W / 2, 220, { police: "titre", taille: 40, couleur: ROUGE });
  }
  ctx.restore();
  if (p.record) ecrire(ctx, "record !", W / 2 + 120, 175, { couleur: ROUGE, taille: 18, rotation: 0.3 });
  if (p.message) {
    rectangle(ctx, 40, 278, W - 80, 44, { couleur: ROUGE, epaisseur: 1.8, graine: 170 });
    ecrire(ctx, p.message, W / 2, 300, { taille: 17, couleur: ROUGE });
  }
  const precision = j.stats.ratures ? Math.round((100 * (j.stats.ratures - j.stats.ratees)) / j.stats.ratures) : 0;
  [`monstres raturés : ${j.stats.tues}`, `vies perdues : ${j.stats.fuites}`, `tours posées : ${j.stats.toursPosees}`, `ratures dans le mille : ${precision} %`]
    .forEach((l, i) => ecrire(ctx, l, W / 2, 360 + i * 28, { taille: 18 }));
  if (ui.temps - p.finDepuis < 0.8) return;
  const suivante = p.page && p.mode === "campagne" && gagne ? PAGES[PAGES.indexOf(p.page) + 1] : undefined;
  let y = 500;
  if (suivante) {
    bouton(70, y, 260, 56, "Page suivante", () => nav.ouvrirPage?.(suivante), { principal: true, taille: 22 });
    y += 70;
  }
  bouton(70, y, 260, 50, "Rejouer cette page", recommencer, { principal: !suivante, taille: 20 });
  bouton(70, y + 64, 260, 50, p.mode === "jour" ? "Menu" : "Les cahiers", () => nav.aller(p.mode === "jour" ? "titre" : "campagne"), { taille: 20 });
}

export { PAPIER, cercle, BAS };
