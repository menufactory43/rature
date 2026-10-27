// L'écran de jeu : la page, les bandeaux, le pense-bête des symboles, le menu des tours, la pause et la fin.
import { debloquer, finDePage, surveiller } from "../succes";
import { astuceDe, billeActive, conseil, dire, observerPartie, placer, refusBille, toucherBille } from "./compagnon";
import * as audio from "../audio";
import * as fx from "../render/fx";
import { vibrer } from "../vibre";
import { BLEU, CRAYON, PAPIER, ROUGE, cercle, ecrire, paragraphe, boite, feuille, ligne, trait } from "../render/encre";
import { monstre } from "../render/monstres";
import { papier, type Zone } from "../render/papier";
import { decor, scene, type Brouillon } from "../render/scene";
import { STYLOS, symbole } from "../render/tours";
import { icone } from "../render/pouvoirs";
import { POUVOIRS, type Pouvoir } from "../sim/pouvoirs";
import type { Fourniture } from "../sim/interro";
import { ENNEMIS, type TypeEnnemi } from "../sim/ennemis";
import { polylineLength, truncate, type V } from "../sim/geom";
import { classer, type Pt } from "../sim/gestures";
import {
  ameliorer, apercuTrajets, appliquerTrace, changerCible, coutAmelioration, coutPose, coutRature, ENCRE_PAR_PX_COLLE, ENCRE_PAR_PX_MUR, etoiles,
  PAS_SIM, choisirFourniture, fournitureDue, ordonnerHeros, gestesPermis, lancerPouvoir, lancerVague, longueurPossible, nouveauJeu, refusPose, stats, step, valeurRevente, vendre, type Jeu, type Mur, type Options, type Tour, effacerMur, encreDuMur, murSous,
} from "../sim/jeu";
import { PAGES, TEXTE_DEFI, optionsDePage, type Page } from "../sim/pages";
import { PORTEE_INFINIE, TOURS, statsTour, type TypeTour } from "../sim/tours";
import { resume, type PlanVague } from "../sim/vagues";
import { enregistrer, noterPage, sauvegarde } from "../progression";
import { reglages } from "../reglages";
import { BAS, H, HAUT, PAGE_H, W, bouton, boutonSon, ui, voile, zone } from "./base";
import { nav } from "./nav";
import { BANDE, BAS_PORTRAIT, HAUT_PORTRAIT, PANNEAU_W, ecranDans, type Vue } from "./vue";
import type { Lockstep, Action } from "../coop/lockstep";
import { aplatir, empreinte, jouerTour, type Commun } from "../coop/partage";
import { ouvrirReglages } from "./reglages";
import { avancerTuto, creerTuto, dessinerTuto, toucherTuto, tutoApres, tutoRefuse, type Tuto } from "./tuto";
import { marquerTutoVu } from "../sauvegarde";
import { anglais, t } from "../i18n";
import { afficherNote, annoter, dessinerAnnotations, dureeCopie, imageCopie, lienDefi, noteSur20, partager, type Annotation, type Defi } from "./copie";

const majuscule = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export type Mode = "campagne" | "defi" | "sansFin" | "jour" | "interro" | "coop" | "tuto" | "ami";

/** La coop : le lockstep, ce que les deux partagent, et de quoi parler à l'autre (branché par coop/session.ts). */
export interface CoopPartie {
  ls: Lockstep;
  commun: Commun;
  hote: boolean;
  code: string;
  envoyer: (m: object) => void;
  pair: () => boolean;
  quitter: () => void;
  /** L'hôte relance la page pour les deux. */
  rejouer: (() => void) | null;
  /** Le trait que l'autre est en train de dessiner. */
  crayon: V[] | null;
  /** Combien de points de mon trait sont déjà partis chez l'autre, et quand. */
  envoye: number;
  dernierEnvoi: number;
  /** Depuis quand l'autre n'est plus branché (0 s'il l'est). */
  absentDepuis: number;
  /** L'autre a quitté la partie : on continue seul. */
  parti: boolean;
  /** La vitesse demandée, pas encore jouée par le lockstep. */
  vitesseDemandee: number | null;
}

/** Le stylo de l'autre, en coop : une encre brune, qu'on ne confond avec aucune tour. */
export const STYLO_BINOME = "#a0522d";

interface Partie {
  jeu: Jeu;
  options: () => Options;
  page: Page | null;
  mode: Mode;
  libelle: string;
  cleJour?: string;
  selection: Tour | null;
  /** Le mur touché : on peut l'effacer pour reprendre son encre. */
  selectionMur: Mur | null;
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
  /** La zone peinte du fond (toute la page, ou tout l'écran en portrait), en unités du cadre. */
  zoneFond: Zone;
  reste: number;
  /** Le pouvoir armé : le prochain trait le lance. */
  arme: Pouvoir | null;
  /** Les monstres qu'on voit pour la première fois : un post-it chacun, l'un après l'autre. */
  nouveaux: { type: TypeEnnemi; depuis: number }[];
  /** Depuis quand les fournitures sont proposées (pour les faire glisser). */
  choixDepuis: number;
  coop: CoopPartie | null;
  /** Mes traits partis en coop, qui attendent leur tour pour être joués. */
  enAttente: Pt[][];
  /** Le tutoriel, quand c'en est un. */
  tuto: Tuto | null;
  /** Bille prise au doigt : où on l'emmène. */
  herosPris: { x: number; y: number } | null;
  /** Les conseils fermés d'un toucher : ils ne reviennent plus de la partie. */
  astucesFermees: string[];
  /** Depuis quand chaque pouvoir nouveau est annoncé (l'annonce s'en va seule). */
  annonces: Partial<Record<Pouvoir, number>>;
  /** La copie corrigée, une fois la page finie. */
  copie: CopieFin | null;
  /** Le dernier mot rayé : la page se fige un instant (secondes qui restent). */
  fige: number;
  phaseAvant: string;
  /** Un ami nous a défié : sa note à battre. */
  defiAmi: Defi | null;
  /** La mise en page de la dernière image (la copie et le bilan se partagent l'écran autrement sur le cahier ouvert). */
  mise: Vue["mise"];
}

/** La fin de page : d'abord la copie corrigée (la page annotée), puis le bilan. */
interface CopieFin {
  notes: Annotation[];
  note: number | null;
  etape: "copie" | "bilan";
  depuis: number;
  /** Revue depuis le bilan : tout est déjà écrit. */
  revue: boolean;
  image: HTMLCanvasElement | null;
}

export let partie: Partie | null = null;

/** Ce que main branche ici : lancer la page 1-1 à la fin du tutoriel. */
export const crochets = { pageUne: () => {} };

export function demarrerPartie(options: () => Options, quoi: { page?: Page; mode: Mode; libelle: string; cleJour?: string; coop?: CoopPartie; defiAmi?: Defi }): void {
  const jeu = nouveauJeu(options());
  partie = {
    jeu, options, page: quoi.page ?? null, mode: quoi.mode, libelle: quoi.libelle, cleJour: quoi.cleJour,
    selection: null, selectionMur: null, trace: null, doigt: null, sec: false, vitesse: 1, pause: false, finDepuis: 0, fin: false,
    fiches: jeu.options.toursDispo.filter((t) => !sauvegarde.appris.includes(t)), message: null, record: false,
    fond: null, echelleFond: 0, zoneFond: { x: 0, y: 0, w: W, h: H }, reste: 0, arme: null, nouveaux: [], choixDepuis: 0, coop: quoi.coop ?? null, enAttente: [], tuto: null, herosPris: null, astucesFermees: [], annonces: {},
    copie: null, fige: 0, phaseAvant: "attente", defiAmi: quoi.defiAmi ?? null, mise: "portrait",
  };
  nav.aller("partie");
  fx.remettreAZero();
  fx.reglerCibleEncre({ x: reglages.gaucher ? W - 102 : 18, y: PAGE_H + 20 });
  audio.jouer(["page"]);
}

/** Le tutoriel : la page 1-1, une seule tour, et Bille qui mène tout. */
export function lancerTuto(): void {
  const page = PAGES[0];
  demarrerPartie(() => ({ ...optionsDePage(page, { toursDispo: ["plume"], colle: true }), regles: { graine: 7, total: 99, pool: ["gribouille"], difficulte: 1, entrees: 1 }, encreDepart: 160, vies: 20 }), { mode: "tuto", libelle: t("Tutoriel") });
  if (!partie) return;
  partie.fiches = [];
  partie.tuto = creerTuto(partie.jeu);
}

function recommencer(): void {
  if (!partie) return;
  if (partie.mode === "tuto") return lancerTuto();
  demarrerPartie(partie.options, { page: partie.page ?? undefined, mode: partie.mode, libelle: partie.libelle, cleJour: partie.cleJour, defiAmi: partie.defiAmi ?? undefined });
}

export function mettreEnPause(): void {
  if (partie && !partie.fin && nav.ecran === "partie") mettrePause(partie, true);
}

export function basculerPause(): void {
  if (partie && !partie.fin && nav.ecran === "partie") mettrePause(partie, !partie.pause);
}

/** En coop, tout ce qui touche à la partie passe par le lockstep ; seul, ça se fait tout de suite. */
function faire(p: Partie, a: Action, seul: () => void): void {
  if (p.coop) p.coop.ls.agir(a);
  else seul();
}

function mettrePause(p: Partie, on: boolean): void {
  faire(p, { k: "pause", on }, () => (p.pause = on));
}

function changerVitesse(p: Partie): void {
  // En coop, la vitesse change deux dixièmes plus tard : on part de la dernière demandée, pour qu'un double toucher fasse ×3
  const avant = p.coop?.vitesseDemandee ?? p.vitesse;
  const v = avant === 3 ? 1 : avant + 1;
  if (p.coop) p.coop.vitesseDemandee = v;
  faire(p, { k: "vitesse", v }, () => (p.vitesse = v));
}

const vitesseAffichee = (p: Partie) => p.coop?.vitesseDemandee ?? p.vitesse;

function appelerVague(p: Partie): void {
  faire(p, { k: "vague" }, () => lancerVague(p.jeu));
}

/** L'autre est parti : la partie continue, seul. */
export function continuerSeul(p: Partie): void {
  if (!p.coop) return;
  p.vitesse = p.coop.commun.vitesse;
  p.pause = false;
  p.coop = null;
  p.enAttente = [];
}

// --- La boucle ---

const PAS = PAS_SIM;
/** Le dernier mot de la page : le temps passe à cette vitesse, et la page se fige autant de secondes quand il tombe. */
const RALENTI = 0.35;
const FIGE = 0.45;

/** Vrai quand il ne reste plus qu'un mot sur la dernière vague (seul : en coop, le temps est partagé). */
export function dernierMot(): boolean {
  const p = partie;
  if (!p || p.coop || p.tuto || p.fin) return false;
  const j = p.jeu;
  if (j.phase !== "jeu" || !Number.isFinite(j.regles.total) || j.vague < j.regles.total || j.file.length) return false;
  let n = 0;
  for (const e of j.ennemis) if (!e.mort && !e.retour && ++n > 1) return false;
  return n === 1;
}

export function avancerPartie(dt: number): void {
  const p = partie;
  if (!p) return;
  const j = p.jeu;
  if (p.coop) {
    // En coop, le temps ne s'arrête jamais tout à fait : les tours vides continuent de passer, pour qu'on puisse reprendre
    const c = p.coop;
    c.absentDepuis = c.pair() ? 0 : c.absentDepuis + dt;
    c.ls.avancer(dt, (actions) => {
      const faits = jouerTour(j, c.commun, actions.map((x) => x.a));
      faits.forEach((f, i) => {
        if (!f.trace) return;
        const moi = actions[i].hote === c.hote;
        if (moi) p.enAttente.shift();
        const r = f.resultat;
        const pose = r?.ok && r.geste === "tour" ? j.tours[j.tours.length - 1] : null;
        if (r && (r.geste === "tour" || r.geste === "rien" || !r.ok)) fx.ajouterTrace(f.trace, pose ? { x: pose.x, y: pose.y } : null, r.ok ? (moi ? BLEU : STYLO_BINOME) : CRAYON);
        if (moi && r && !r.ok && r.geste !== "rien") vibrer("refus");
        if (moi && r && !r.ok && r.raison) refusBille(r.geste, r.raison);
        if (!moi) c.crayon = null;
      });
      p.vitesse = c.commun.vitesse;
      if (c.vitesseDemandee === p.vitesse) c.vitesseDemandee = null;
      p.pause = c.commun.pause;
      return empreinte(j);
    });
  } else {
    if (p.pause || p.fiches.length) return;
    if (p.tuto) {
      p.tuto.menu = p.selection ? (p.selection.y > PAGE_H / 2 ? "haut" : "bas") : null;
      p.reste += dt * avancerTuto(p.tuto, j, dt) * p.vitesse;
    } else if (p.fige > 0) p.fige = Math.max(0, p.fige - dt);
    // Le dernier mot de la page passe au ralenti
    else p.reste += dt * (j.phase === "jeu" ? (dernierMot() ? RALENTI : p.vitesse) : 1);
    let n = 0;
    while (p.reste >= PAS && n++ < 20) {
      step(j, PAS);
      p.reste -= PAS;
    }
    if (p.reste > PAS) p.reste = 0;
  }
  // Il est rayé : la page se fige, tremble et s'illumine
  if (p.phaseAvant === "jeu" && j.phase === "gagne") {
    p.fige = p.coop ? 0 : FIGE;
    fx.moment(12);
    vibrer("fort");
  }
  p.phaseAvant = j.phase;
  audio.jouer(j.sons);
  j.sons.length = 0;
  surveiller(j);
  fx.absorber(j, p.fige > 0 ? dt * 0.06 : dernierMot() ? dt * RALENTI : dt);
  if (p.selection && !j.tours.includes(p.selection)) p.selection = null;
  if (p.selectionMur && !j.murs.includes(p.selectionMur)) p.selectionMur = null;
  if ((j.phase === "gagne" || j.phase === "perdu") && !p.fin) {
    if (!p.finDepuis) p.finDepuis = ui.temps;
    if (ui.temps - p.finDepuis > (j.phase === "gagne" ? 1.2 + FIGE : 1.2)) terminer(p);
  }
}

function terminer(p: Partie): void {
  terminerPage(p);
  const j = p.jeu;
  const tenues = j.phase === "gagne" ? j.regles.total : j.vague - 1;
  const note = p.mode === "sansFin" || p.mode === "tuto" ? null : p.mode === "interro" ? Math.round((tenues / j.regles.total) * 20) : noteSur20(j);
  p.copie = { notes: annoter(j, note, motDeLaProf(p), anglais()), note, etape: p.mise === "ouvert" ? "bilan" : "copie", depuis: ui.temps, revue: false, image: null };
  finDePage({
    mode: p.mode, pageId: p.page?.id, gagne: j.phase === "gagne", fuites: j.stats.fuites, defi: p.mode === "defi" && j.phase === "gagne",
    vagues: j.phase === "gagne" ? j.regles.total : j.vague - 1, vies: j.vies, total: j.regles.total, joursJoues: Object.keys(sauvegarde.jour).length,
  });
}

function terminerPage(p: Partie): void {
  const j = p.jeu;
  p.fin = true;
  p.finDepuis = ui.temps;
  p.trace = null;
  p.doigt = null;
  p.selection = null;
  p.selectionMur = null;
  const gagne = j.phase === "gagne";
  if (p.page && p.mode === "campagne" && gagne) {
    const premiere = !(sauvegarde.etoiles[p.page.id] > 0);
    p.record = noterPage(p.page.id, etoiles(j));
    if (premiere && p.page.debloque) {
      p.message = p.page.debloque === "colle" ? t("Nouveau geste : la colle (une grande boucle)") : t("Nouvelle tour : {nom}", { nom: t(TOURS[p.page.debloque].nom) });
    }
  }
  if (p.page && p.mode === "defi" && gagne && !sauvegarde.defis[p.page.id]) {
    sauvegarde.defis[p.page.id] = true;
    p.record = true;
    p.message = t("Défi réussi : un bon point de plus");
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
  if (p.mode === "interro") {
    const tenues = gagne ? j.regles.total : j.vague - 1;
    if (tenues > sauvegarde.interro) {
      sauvegarde.interro = tenues;
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
  if (p.tuto && toucherTuto(p.tuto, p.jeu)) return true;
  if (p.fiches.length) {
    marquerAppris(p.fiches.shift()!);
    return true;
  }
  const j = p.jeu;
  if (j.phase !== "attente" && j.phase !== "jeu") return false;
  if (x < 0 || x > W || y < HAUT || y > HAUT + PAGE_H || p.doigt !== null) return false;
  // Sur Bille : on la prend pour l'emmener ailleurs (un simple toucher lui demande une astuce)
  const h = j.heros;
  if (h && !h.mort && Math.hypot(x - h.x, y - HAUT - (h.y - 6)) < 26) {
    p.doigt = e.pointerId;
    p.herosPris = { x, y: y - HAUT };
    p.selection = null;
    p.selectionMur = null;
    return true;
  }
  p.doigt = e.pointerId;
  p.trace = [{ x, y: y - HAUT, t: e.timeStamp }];
  if (p.coop) p.coop.envoye = 0;
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
  if (p && e.pointerId === p.doigt && p.herosPris) {
    const q = versPage(e);
    p.herosPris = { x: q.x, y: q.y - HAUT };
    return;
  }
  if (!p || e.pointerId !== p.doigt || !p.trace) return;
  const evts = e.getCoalescedEvents?.() ?? [];
  for (const ev of evts.length ? evts : [e]) {
    if (p.sec) break;
    const q = versPage(ev);
    const pt = { x: q.x, y: q.y - HAUT, t: ev.timeStamp };
    const dernier = p.trace[p.trace.length - 1];
    if (Math.hypot(pt.x - dernier.x, pt.y - dernier.y) < 2) continue;
    p.trace.push(pt);
    // Les pouvoirs ne coûtent pas d'encre
    const possible = p.arme ? 1500 : longueurPossible(p.jeu);
    if (polylineLength(p.trace) > possible) {
      const avant: Pt[] = p.trace;
      p.trace = truncate(avant, possible).map((q2, i) => ({ ...q2, t: avant[Math.min(i, avant.length - 1)].t }));
      p.sec = true;
    }
  }
  const n = p.trace.length;
  // En coop, l'autre voit mon stylo avancer (quelques fois par seconde, seulement les nouveaux points)
  const c = p.coop;
  if (c && !p.arme && ui.temps - c.dernierEnvoi > 0.07 && n > c.envoye) {
    c.envoyer({ t: "crayon", debut: c.envoye === 0, d: p.trace.slice(c.envoye).flatMap((q) => [Math.round(q.x * 10) / 10, Math.round(q.y * 10) / 10]) });
    c.envoye = n;
    c.dernierEnvoi = ui.temps;
  }
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
  if (p.herosPris) {
    const q = p.herosPris;
    const h = p.jeu.heros;
    p.herosPris = null;
    if (h && Math.hypot(q.x - h.x, q.y - h.y) > 18) faire(p, { k: "heros", x: q.x, y: q.y }, () => ordonnerHeros(p.jeu, q.x, q.y));
    else toucherBille(lancerTuto);
    return;
  }
  audio.gratter(0);
  const trace = p.trace;
  p.trace = null;
  if (!trace) return;
  const j = p.jeu;
  const l = polylineLength(trace);
  const duree = trace[trace.length - 1].t - trace[0].t;
  // Un simple toucher : choisir une tour (ou fermer son menu)
  if (l < 10 && duree < 400) {
    if (p.coop && p.coop.envoye) p.coop.envoyer({ t: "crayon", fin: true });
    // Toucher la page désarme le pouvoir
    if (p.arme) {
      p.arme = null;
      return;
    }
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
    // Pas de tour sous le doigt : peut-être un mur (raté, ou qui n'a plus rien à faire là)
    const mur = best ? null : murSous(j, q);
    p.selectionMur = mur && mur !== p.selectionMur ? mur : null;
    return;
  }
  p.selectionMur = null;
  if (p.coop) {
    // Le trait part dans le lockstep : il sera joué dans deux dixièmes de seconde, chez moi comme chez l'autre
    p.coop.envoyer({ t: "crayon", fin: true });
    p.coop.ls.agir({ k: "trace", p: aplatir(trace), ...(p.arme ? { arme: p.arme } : {}) });
    p.enAttente.push(trace);
    p.arme = null;
    p.selection = null;
    return;
  }
  if (p.arme) {
    const rp = lancerPouvoir(j, p.arme, trace);
    if (rp.ok) {
      p.arme = null;
      p.selection = null;
    } else {
      vibrer("refus");
      fx.ajouterTrace(trace, null, CRAYON);
    }
    return;
  }
  // Le tutoriel n'accepte que le geste qu'il demande (rien n'est dépensé sinon)
  if (p.tuto && tutoRefuse(p.tuto, trace)) {
    vibrer("refus");
    fx.ajouterTrace(trace, null, CRAYON);
    return;
  }
  const r = appliquerTrace(j, trace);
  if (p.tuto) tutoApres(p.tuto, r);
  else if (!r.ok && r.raison) refusBille(r.geste, r.raison);
  if (r.ok) p.selection = null;
  if (!r.ok && r.geste !== "rien") vibrer("refus");
  if (r.geste === "tour" || r.geste === "rien" || !r.ok) {
    const pose = r.ok ? j.tours[j.tours.length - 1] : null;
    fx.ajouterTrace(trace, pose ? { x: pose.x, y: pose.y } : null, r.ok ? BLEU : CRAYON);
  }
}

// --- Le dessin ---

function fond(p: Partie, echelle: number, z: Zone): HTMLCanvasElement {
  const zf = p.zoneFond;
  if (!p.fond || p.echelleFond !== echelle || zf.x !== z.x || zf.y !== z.y || zf.w !== z.w || zf.h !== z.h) {
    const c = papier(W, H, echelle, p.jeu.carte.papier, HAUT, z);
    const ctx = c.getContext("2d")!;
    ctx.save();
    ctx.translate(0, HAUT);
    decor(ctx, p.jeu.carte);
    ctx.restore();
    p.fond = c;
    p.echelleFond = echelle;
    p.zoneFond = z;
  }
  return p.fond;
}

export function dessinerPartie(v: Vue): void {
  const p = partie;
  if (!p) return;
  p.mise = v.mise;
  const ctx = ui.ctx;
  const j = p.jeu;
  const portrait = v.mise === "portrait";
  ctx.setTransform(v.carte);
  ctx.save();
  if (!portrait) {
    ctx.beginPath();
    ctx.rect(0, HAUT, W, PAGE_H);
    ctx.clip();
  }
  const z = v.plein ? ecranDans(v, v.carte) : { x: 0, y: 0, w: W, h: H };
  ctx.drawImage(fond(p, v.carte.a, z), z.x, z.y, z.w, z.h);
  ctx.restore();
  // La page
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, HAUT, W, PAGE_H);
  ctx.clip();
  const sec = fx.secousse();
  ctx.translate(sec.x, HAUT + sec.y);
  let brouillon: Brouillon | null = null;
  if (p.trace && p.arme) brouillon = { pts: p.trace, geste: "rien", pouvoir: p.arme };
  else if (p.trace) {
    const c = classer([...p.trace, { ...p.trace[p.trace.length - 1], t: performance.now() }]);
    brouillon = { pts: p.trace, geste: c.geste, couleur: c.geste === "tour" ? STYLOS[tourDe(c.glyphe!)] : undefined };
  }
  scene(ctx, j, brouillon, p.selection);
  // Bille qu'on emmène : la ligne jusqu'au doigt, et où elle ira
  if (p.herosPris && j.heros) {
    const q = p.herosPris;
    ctx.save();
    ctx.setLineDash([4, 5]);
    ctx.strokeStyle = BLEU;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(j.heros.x, j.heros.y);
    ctx.lineTo(q.x, q.y);
    ctx.stroke();
    ctx.restore();
    cercle(ctx, q.x, q.y, 10 + Math.sin(ui.temps * 8) * 1.5, { couleur: BLEU, epaisseur: 1.8, graine: 502 });
  }
  if (p.coop) traitsCoop(p);
  if (p.copie) dessinerAnnotations(ctx, p.copie.notes, p.copie.revue ? Infinity : ui.temps - p.copie.depuis);
  if (p.trace && p.trace.length > 3 && !p.arme) apercu(p);
  if (brouillon && p.trace && p.trace.length > 3 && !p.arme) {
    const b = p.trace[p.trace.length - 1];
    const c = classer([...p.trace, { ...b, t: performance.now() }]);
    const nom = p.sec ? t("plus d'encre") : c.geste === "cercle" ? t("colle") : c.geste === "tour" ? t(TOURS[tourDe(c.glyphe!)].nom) : c.geste === "rien" ? "" : t(c.geste);
    ecrire(ctx, nom, b.x + 18, b.y - 24, { couleur: p.sec ? ROUGE : CRAYON, taille: 15 });
  }
  ctx.restore();
  // Le cahier ouvert montre la vague à venir sur la page de droite : la carte reste dégagée
  if (j.phase === "attente" && v.mise !== "ouvert") carteAttente(p, v.mise === "bande");
  // Les conseils des premières pages : c'est Bille qui les donne (le bandeau, si on l'a fait taire)
  const brut = astuce(p);
  const aide = brut && !p.astucesFermees.includes(brut) ? brut : null;
  const parBille = billeActive() && !p.tuto;
  conseil(parBille ? aide : null);
  const bandeau = p.arme ? t("{consigne} (touche la page pour annuler)", { consigne: t(POUVOIRS[p.arme].consigne) }) : parBille ? null : aide;
  if (bandeau && !p.trace) {
    const y = j.carte.coeur.y > PAGE_H - 140 ? HAUT + 160 : HAUT + PAGE_H - 30;
    feuille(ctx, 20, y - 22, W - 40, 44, "rgba(246,239,220,0.88)", 41, 0);
    paragraphe(ctx, bandeau, W / 2, y - 8, W - 60, { taille: 15, couleur: ROUGE });
    // Un toucher le ferme (la consigne d'un pouvoir armé, elle, s'annule en touchant la page)
    if (!p.arme) zone(20, y - 22, W - 40, 44, () => p.astucesFermees.push(bandeau));
  }
  let encre = { x: reglages.gaucher ? W - 102 : 18, y: PAGE_H + 20 };
  if (portrait) {
    // Les deux traits qui séparent la carte des bandeaux, d'un bord à l'autre de l'écran
    const xa = Math.min(4, z.x + 4);
    const xb = Math.max(W - 4, z.x + z.w - 4);
    ligne(ctx, { x: xa, y: HAUT }, { x: xb, y: HAUT }, { couleur: CRAYON, epaisseur: 1.1, graine: 80 });
    ligne(ctx, { x: xa, y: HAUT + PAGE_H }, { x: xb, y: HAUT + PAGE_H }, { couleur: CRAYON, epaisseur: 1.1, graine: 81 });
    bandeauHaut(p);
    bandeauBas(p);
  } else {
    ctx.setTransform(v.panneau);
    const k = v.panneau.a;
    // La bande est découpée dans une page entière, loin de la marge rouge
    if (v.mise === "bande") ctx.drawImage(papierPanneau(PANNEAU_W, k), 60 * k, 0, BANDE * k, PAGE_H * k, 0, 0, BANDE, PAGE_H);
    else ctx.drawImage(papierPanneau(PANNEAU_W, k), 0, 0, PANNEAU_W, PAGE_H);
    const ou = v.mise === "bande" ? bande(p) : panneau(p);
    // L'encre gagnée vole jusqu'au compteur, sur l'autre page s'il le faut
    const q = v.carte.inverse().multiply(v.panneau).transformPoint(ou);
    encre = { x: q.x, y: q.y - HAUT };
    ctx.setTransform(v.carte);
  }
  fx.reglerCibleEncre(encre);
  ctx.save();
  if (!portrait) {
    // Les éclairs et les bannières restent sur le cahier
    ctx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
    const f = v.feuilles;
    const x1 = Math.min(...f.map((r) => r.x));
    const y1 = Math.min(...f.map((r) => r.y));
    ctx.beginPath();
    ctx.rect(x1, y1, Math.max(...f.map((r) => r.x + r.w)) - x1, Math.max(...f.map((r) => r.y + r.h)) - y1);
    ctx.clip();
    ctx.setTransform(v.carte);
  }
  fx.dessinerEcran(ctx, HAUT, W, portrait ? H : HAUT + PAGE_H);
  ctx.restore();
  postitNouveau(p);
  if (!p.tuto && !p.fin) {
    observerPartie(j, {
      mode: p.mode,
      nouvellePage: p.mode === "campagne" && p.page && !(sauvegarde.etoiles[p.page.id] > 0) ? t("Page {id}, « {nom} »", { id: p.page.id, nom: t(p.page.nom) }) : undefined,
      sec: p.sec,
      nouveaux: p.nouveaux.length,
      dessine: !!p.trace,
      heros: !!j.heros,
      tuto: lancerTuto,
    });
    if (p.fiches.length) dire(t("Une nouvelle tour ! Regarde bien son symbole : tu le dessineras en petit sur la page."), { cle: "fiche", recharge: 20, urgent: true, humeur: "joie" });
    if (j.choix) dire(t("Une fourniture au choix ! Prends ce qui manque à ta défense."), { cle: "fourniture", recharge: 90, urgent: true });
    const h = j.heros;
    if (h) {
      // Bille est sur la page : ses bulles partent d'elle (ou du Cœur, quand elle attend de revenir)
      const ou = h.mort > 0 ? { x: j.carte.coeur.x + 26, y: j.carte.coeur.y + 10 } : { x: h.x, y: h.y + 14 };
      placer({ x: ou.x, y: ou.y + HAUT, h: 40, cle: "heros", repere: "carte", sansCorps: true, immobile: true, muette: !!p.trace || !!p.arme || !!p.herosPris });
    } else placer({ x: 24, y: HAUT + PAGE_H - 6, h: 58, cle: "partie", repere: "carte", muette: !!p.trace || !!p.arme, alpha: p.trace ? 0.5 : 1, touche: () => toucherBille(lancerTuto) });
  }
  if (p.coop) attenteBinome(p, p.coop);
  if (j.choix) choixFournitures(p, j.choix);
  else p.choixDepuis = 0;
  if (p.selection) menuTour(p, p.selection);
  else if (p.selectionMur) menuMur(p, p.selectionMur);
  if (p.tuto) {
    dessinerTuto(ctx, p.tuto, j, portrait, {
      passer: () => {
        marquerTutoVu();
        nav.aller("titre");
      },
      finir: (rejouer) => {
        marquerTutoVu();
        debloquer("rature.tuto");
        if (rejouer) lancerTuto();
        else nav.aller("titre");
      },
      page: () => {
        marquerTutoVu();
        debloquer("rature.tuto");
        crochets.pageUne();
      },
    });
  }
  // Les fenêtres : sur toute la feuille en portrait et avec la bande, sur la page de droite du cahier ouvert
  ctx.save();
  ctx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
  const f = v.mise === "ouvert" ? [v.feuilles[1]] : v.feuilles;
  const x1 = Math.min(...f.map((r) => r.x));
  const y1 = Math.min(...f.map((r) => r.y));
  ctx.beginPath();
  ctx.rect(x1, y1, Math.max(...f.map((r) => r.x + r.w)) - x1, Math.max(...f.map((r) => r.y + r.h)) - y1);
  ctx.clip();
  ctx.setTransform(v.dessus);
  if (p.fiches.length) fiche(p.fiches[0], j);
  if (p.pause) dessinerPause();
  if (p.fin) dessinerFin(p);
  ctx.restore();
}

/** Mes traits partis qui attendent leur tour (encre fraîche, un peu pâle), et le stylo de l'autre en train d'écrire. */
function traitsCoop(p: Partie): void {
  const ctx = ui.ctx;
  p.enAttente.forEach((t, i) => trait(ctx, t, { couleur: BLEU, epaisseur: 2.2, graine: 300 + i, amp: 0, alpha: 0.55 }));
  const c = p.coop!;
  if (c.crayon && c.crayon.length > 1) {
    trait(ctx, c.crayon, { couleur: STYLO_BINOME, epaisseur: 2.4, graine: 310, amp: 0 });
    // La pointe du stylo de l'autre
    const b = c.crayon[c.crayon.length - 1];
    cercle(ctx, b.x, b.y, 5, { couleur: STYLO_BINOME, epaisseur: 1.4, graine: 311, fond: "rgba(160,82,45,0.25)" });
  }
}

/** Le réseau traîne ou l'autre est parti : une fiche au milieu de la page. */
function attenteBinome(p: Partie, c: CoopPartie): void {
  if (c.parti) {
    if (!p.fin) fx.banniere(t("Seul !"), t("ton binôme est parti, la page continue"), true, 2.4);
    continuerSeul(p);
    return;
  }
  if (c.ls.attente < 0.5 && c.absentDepuis < 1) return;
  const ctx = ui.ctx;
  const x = 50;
  const y = HAUT + PAGE_H / 2 - 70;
  bristol(ctx, x, y, W - 100, c.absentDepuis > 6 ? 150 : 100);
  ecrire(ctx, c.pair() ? t("On attend ton binôme…") : t("Ton binôme a perdu la connexion"), W / 2, y + 34, { police: "titre", taille: 24 });
  ecrire(ctx, c.pair() ? t("le réseau traîne un peu") : t("on l'attend une minute"), W / 2, y + 64, { taille: 14, couleur: CRAYON });
  if (c.absentDepuis > 6) bouton(110, y + 88, 180, 46, t("Continuer seul"), () => continuerSeul(p), { taille: 19 });
}

let papierBande: { c: HTMLCanvasElement; cle: string } | null = null;

function papierPanneau(largeur: number, echelle: number): HTMLCanvasElement {
  const cle = `${largeur}/${echelle}`;
  if (papierBande?.cle !== cle) {
    papierBande = { c: papier(largeur, PAGE_H, echelle, "seyes"), cle };
  }
  return papierBande.c;
}

/** L'interro : trois fiches bristol à choisir, la page vide derrière. */
function choixFournitures(p: Partie, choix: Fourniture[]): void {
  const ctx = ui.ctx;
  const j = p.jeu;
  if (!p.choixDepuis) {
    p.choixDepuis = ui.temps;
    p.selection = null;
    p.selectionMur = null;
    p.arme = null;
  }
  const tm = ui.temps - p.choixDepuis;
  ctx.save();
  ctx.globalAlpha = Math.min(1, tm * 4) * 0.7;
  ctx.fillStyle = PAPIER;
  ctx.fillRect(0, HAUT, W, PAGE_H);
  ctx.restore();
  zone(0, HAUT, W, PAGE_H, () => {});
  ecrire(ctx, t("Choisis une fourniture"), W / 2, HAUT + 60, { police: "titre", taille: 36, alpha: Math.min(1, tm * 3) });
  ecrire(ctx, t("vague {n} sur {total} tenue", { n: j.vague, total: j.regles.total }), W / 2, HAUT + 94, { taille: 15, couleur: CRAYON, alpha: Math.min(1, tm * 3) });
  const h = 132;
  choix.forEach((f, i) => {
    const arrivee = Math.min(1, Math.max(0, (tm - 0.1 - i * 0.12) / 0.3));
    const e = 1 - (1 - arrivee) ** 3;
    const x = 30 + (1 - e) * (i % 2 ? W : -W);
    const y = HAUT + 130 + i * (h + 22);
    const w = W - 60;
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate((i - 1) * 0.02);
    ctx.translate(-w / 2, -h / 2);
    // La fiche bristol : blanche, lignée de bleu, une ligne rouge en haut
    ctx.fillStyle = "rgba(40,30,10,0.16)";
    ctx.fillRect(4, 6, w, h);
    ctx.fillStyle = "#fffdf6";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(90,130,200,0.35)";
    ctx.lineWidth = 1;
    for (let l = 44; l < h; l += 20) {
      ctx.beginPath();
      ctx.moveTo(0, l);
      ctx.lineTo(w, l);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(196,48,43,0.6)";
    ctx.beginPath();
    ctx.moveTo(0, 30);
    ctx.lineTo(w, 30);
    ctx.stroke();
    if (f.pacte) boite(ctx, 2, 2, w - 4, h - 4, { couleur: ROUGE, epaisseur: 2.2, graine: 300 + i });
    iconeFourniture(ctx, f, 38, 74);
    ecrire(ctx, f.nom, 76, 18, { align: "left", police: "titre", taille: 24, couleur: f.pacte ? ROUGE : BLEU });
    paragraphe(ctx, f.texte, 76 + (w - 96) / 2, 56, w - 96, { taille: 15, couleur: f.pacte ? ROUGE : "#3d3f4a" });
    if (f.pacte) ecrire(ctx, t("pacte"), w - 14, 18, { align: "right", taille: 14, couleur: ROUGE, rotation: 0.1 });
    ctx.restore();
    if (arrivee >= 1) zone(30, y, w, h, () => choisirFourniture(j, i));
  });
}

function iconeFourniture(ctx: CanvasRenderingContext2D, f: Fourniture, x: number, y: number): void {
  if (f.tour) symbole(ctx, TOURS[f.tour].glyphe, x, y, 16, f.famille === "tour" ? STYLOS[f.tour] : CRAYON, 2.4);
  if (f.famille === "boost") ecrire(ctx, "+", x + (f.tour ? 18 : 0), y - (f.tour ? 16 : 0), { police: "titre", taille: f.tour ? 26 : 44, couleur: ROUGE });
  else if (f.famille === "pouvoir") icone(ctx, f.pouvoir ?? "regle", x, y, 16, true);
  else if (f.famille === "encre") {
    ctx.fillStyle = BLEU;
    ctx.beginPath();
    ctx.moveTo(x, y - 18);
    ctx.quadraticCurveTo(x + 14, y + 4, x, y + 14);
    ctx.quadraticCurveTo(x - 14, y + 4, x, y - 18);
    ctx.fill();
  } else if (f.famille === "defense") ecrire(ctx, "♥", x, y, { taille: 36, couleur: ROUGE });
  else if (f.famille === "pacte") ecrire(ctx, "!", x, y, { police: "titre", taille: 48, couleur: ROUGE });
}

const DUREE_POSTIT = 7;

/** Le post-it « nouveau ! » : collé en haut de la page au premier passage d'un monstre jamais vu. */
function postitNouveau(p: Partie): void {
  // Pendant le tutoriel, c'est Bille qui présente
  if (p.tuto) return;
  const j = p.jeu;
  for (const e of j.ennemis) {
    if (e.mort || sauvegarde.vus.includes(e.type) || e.y < 0) continue;
    sauvegarde.vus.push(e.type);
    enregistrer();
    p.nouveaux.push({ type: e.type, depuis: -1 });
  }
  const n = p.nouveaux[0];
  if (!n) return;
  if (n.depuis < 0) n.depuis = ui.temps;
  const tm = ui.temps - n.depuis;
  if (tm > DUREE_POSTIT) {
    p.nouveaux.shift();
    return;
  }
  const ctx = ui.ctx;
  const f = ENNEMIS[n.type];
  const w = 176;
  const h = 128;
  // Il arrive en se décollant un peu, et repart pareil
  const entre = Math.min(1, tm / 0.25);
  const sort = tm > DUREE_POSTIT - 0.3 ? (tm - (DUREE_POSTIT - 0.3)) / 0.3 : 0;
  const x = W - w - 12 + sort * (w + 20);
  const y = HAUT + 12 - (1 - entre) * 30;
  // Un toucher le décolle
  zone(W - w - 12, HAUT + 12, w, h, () => p.nouveaux.shift());
  ctx.save();
  ctx.globalAlpha = entre * (1 - sort);
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(0.03 - (1 - entre) * 0.1);
  ctx.fillStyle = "rgba(40,30,10,0.18)";
  ctx.fillRect(-w / 2 + 3, -h / 2 + 5, w, h);
  ctx.fillStyle = "#fbe98a";
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.fillRect(-w / 2, -h / 2, w, 18);
  // Le scotch
  ctx.fillStyle = "rgba(235,235,220,0.7)";
  ctx.save();
  ctx.rotate(-0.08);
  ctx.fillRect(-26, -h / 2 - 8, 52, 16);
  ctx.restore();
  ecrire(ctx, t("nouveau !"), -w / 2 + 10, -h / 2 + 18, { align: "left", taille: 15, couleur: ROUGE, rotation: -0.05 });
  monstre(ctx, n.type, w / 2 - 30, -h / 2 + 32, Math.min(16, f.rayon * 1.1), 3, ui.temps, ROUGE, 0);
  ecrire(ctx, t(f.nom), -w / 2 + 10, -h / 2 + 46, { align: "left", police: "titre", taille: 22 });
  paragraphe(ctx, t(f.conseil), 0, -h / 2 + 72, w - 20, { taille: 13, couleur: "#3d3f4a" });
  ctx.restore();
}

/** Les conseils des premières pages : le tutoriel, au fil de la partie. */
function astuce(p: Partie): string | null {
  const j = p.jeu;
  const id = p.page?.id;
  if (p.mode !== "campagne" || p.fiches.length || p.selection || (sauvegarde.etoiles[id ?? ""] ?? 0) > 0) return null;
  if (j.ennemis.some((e) => !e.mort && e.vol > 0)) return t("Un voleur repart avec tes vies : rature-le avant qu'il sorte de la page, et elles reviennent !");
  if (id === "1-1") {
    if (!j.tours.length) return t("Dessine un PETIT cercle à côté du chemin pointillé : une Plume.");
    if (j.phase === "attente") return t("Une tour de plus si tu peux, puis « Go ! ». Touche une tour pour l'améliorer.");
    if (j.vague <= 2) return t("Un grand trait LENT trace un mur : la horde le contourne, et le chemin s'allonge.");
    if (j.vague <= 4) return t("Un trait SEC et rapide rature ce qu'il touche. Dans le vide, l'encre est perdue.");
    if (j.vague <= 6) return t("Appelle la vague suivante plus tôt (en haut) : chaque seconde gagnée rapporte de l'encre.");
  }
  if (id === "1-2" && j.vague <= 2) return t("Des murs en travers du zigzag : plus le chemin est long, plus tes tours tirent.");
  const present = (t: TypeEnnemi) => j.ennemis.some((e) => !e.mort && e.type === t);
  if (id === "1-3" && present("avion")) return t("Les avions de dictée volent par-dessus les murs. Les ratures les arrêtent.");
  if (id === "1-3" && j.vague <= 3) return t("Une grande boucle autour du chemin pose de la colle : tout ce qui passe dedans ralentit.");
  if (id === "1-4" && present("tache")) return t("Les fautes rongent les murs, et éclatent en lettres quand on les rature.");
  if (id === "2-1" && j.vague <= 2) return t("Les cadres « ne rien écrire » : la horde y passe, mais aucune tour ne s'y pose.");
  // Les pouvoirs, la première fois qu'on les a
  const nouveau = (k: Pouvoir, page: string) => {
    if (id !== page || j.vague < 2 || j.recharges[k] > 0 || !j.options.pouvoirs?.includes(k)) return false;
    // Annoncé 15 s, pas jusqu'à ce qu'on s'en serve
    const depuis = (p.annonces[k] ??= ui.temps);
    return ui.temps - depuis < 15;
  };
  if (nouveau("regle", "1-2")) return t("Nouveau : la règle, en bas à droite. Touche-la, puis trace une ligne sur la horde.");
  if (nouveau("lasso", "1-4")) return t("Nouveau : le lasso. Arme-le, puis entoure un paquet de monstres.");
  if (nouveau("gomme", "2-3")) return t("Nouveau : la gomme. Arme-la, puis frotte là où ça grouille.");
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
    const refus = refusPose(j, cx, cy) || (!j.options.toursDispo.includes(type) ? t("pas débloquée") : null);
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
  if (Math.abs(d) >= 2) ecrire(ctx, t("chemin {d}", { d: (d > 0 ? "+" : "") + d }), b.x + 18, b.y - 42, { taille: 13, couleur: d > 0 ? BLEU : ROUGE });
}

const tourDe = (g: string): TypeTour => (Object.keys(TOURS) as TypeTour[]).find((t) => TOURS[t].glyphe === g)!;

function listeVague(plan: PlanVague, x: number, y: number, largeur: number, taille = 15): number {
  const ctx = ui.ctx;
  let cx = x;
  let cy = y;
  for (const it of resume(plan)) {
    const f = ENNEMIS[it.type];
    const texte = f.boss ? t(f.nom) : `${it.nombre} ${t(it.nombre > 1 ? f.pluriel : f.nom)}`;
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

/** Avec la bande, le bouton Go est sous le pouce, dans la bande : la carte ne fait que présenter la page. */
function carteAttente(p: Partie, sansBouton = false): void {
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
  bristol(ctx, x, y, w, h);
  ecrire(ctx, p.libelle, x + 12, y + 20, { align: "left", police: "titre", taille: 26 });
  const total = Number.isFinite(j.regles.total) ? t("{n} vagues", { n: j.regles.total }) : t("sans fin");
  ecrire(ctx, total + (p.mode === "defi" && j.options.defi ? " · " + t("défi : {d}", { d: t(TEXTE_DEFI[j.options.defi]).toLowerCase() }) : ""), x + 12, y + 44, { align: "left", taille: 13, couleur: CRAYON });
  ecrire(ctx, t("Vague 1 :"), x + 12, y + 66, { align: "left", taille: 14, couleur: CRAYON });
  if (j.plan) listeVague(j.plan, x + 76, y + 66, w - 200, 14);
  if (sansBouton) {
    ecrire(ctx, t("Pose tes tours,"), x + w - 64, y + 52, { taille: 13, couleur: CRAYON });
    ecrire(ctx, reglages.gaucher ? t("← puis Go !") : t("puis Go ! →"), x + w - 64, y + 72, { taille: 15, couleur: ROUGE });
    return;
  }
  ecrire(ctx, t("Pose tes tours, puis :"), x + w - 64, y + 52, { taille: 12, couleur: CRAYON });
  bouton(x + w - 116, y + 64, 104, 40, t("Go !"), () => appelerVague(p), { principal: true });
}

/** Une fiche bristol scotchée : blanche, lignée de bleu, ligne rouge en haut, deux bouts de scotch aux coins. */
function bristol(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.save();
  // Scotchée un peu de travers, comme on la colle d'une main
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(((Math.round(x + w) % 7) - 3) * 0.0025);
  ctx.translate(-x - w / 2, -y - h / 2);
  feuille(ctx, x, y, w, h, "#fffdf6", Math.round(w + h));
  ctx.strokeStyle = "rgba(90,130,200,0.3)";
  ctx.lineWidth = 1;
  for (let l = y + 52; l < y + h - 2; l += 18) {
    ctx.beginPath();
    ctx.moveTo(x + 1, l);
    ctx.lineTo(x + w - 1, l);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(196,48,43,0.55)";
  ctx.beginPath();
  ctx.moveTo(x + 1, y + 32);
  ctx.lineTo(x + w - 1, y + 32);
  ctx.stroke();
  for (const [sx, a] of [[x + 8, -0.6], [x + w - 8, 0.6]] as const) {
    ctx.save();
    ctx.translate(sx, y + 2);
    ctx.rotate(a);
    ctx.fillStyle = "rgba(240,238,225,0.75)";
    ctx.fillRect(-18, -7, 36, 14);
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fillRect(-18, -7, 36, 3);
    ctx.restore();
  }
  ctx.restore();
}

/** Le bandeau du haut, sur une seule ligne (HAUT_PORTRAIT de haut, juste au-dessus de la carte) : la pause, les vies,
 * la vague, puis ce qui vient (appeler la vague suivante) ou, à défaut, le nom de la page, et la vitesse. */
function bandeauHaut(p: Partie): void {
  const ctx = ui.ctx;
  const j = p.jeu;
  const y = HAUT - HAUT_PORTRAIT / 2;
  bouton(8, y - 15, 38, 30, "II", () => mettrePause(p, true), { taille: 17 });
  ecrire(ctx, "♥", 62, y, { couleur: ROUGE, taille: 22 });
  ecrire(ctx, String(j.vies), 76, y + 1, { align: "left", couleur: ROUGE, taille: 22, police: "titre" });
  const total = Number.isFinite(j.regles.total) && !p.tuto ? `/${j.regles.total}` : "";
  ecrire(ctx, p.tuto ? t("tutoriel") : t("vague {n}", { n: `${Math.max(1, j.vague)}${total}` }), 112, y + 1, { align: "left", taille: 19 });
  bouton(W - 50, y - 15, 42, 30, `×${vitesseAffichee(p)}`, () => changerVitesse(p), { taille: 17, principal: vitesseAffichee(p) > 1 });
  const droite = W - 58;
  if (p.tuto) ecrire(ctx, t("avec Bille, tout doucement"), droite - 4, y, { align: "right", taille: 14, couleur: CRAYON });
  else if (j.phase === "jeu" && j.prochaine !== null && j.plan) {
    const bonus = Math.round(j.prochaine * 2);
    bouton(droite - 150, y - 14, 146, 28, t("▸ vague {n} · {s} s (+{b})", { n: j.vague + 1, s: Math.ceil(j.prochaine), b: bonus }), () => appelerVague(p), { taille: 13 });
  } else if (j.phase === "jeu" && !j.plan) ecrire(ctx, t("dernière vague !"), droite - 4, y, { align: "right", taille: 15, couleur: ROUGE });
  else if (j.phase === "jeu") ecrire(ctx, fournitureDue(j) ? t("puis une fourniture") : t("la vague arrive…"), droite - 4, y, { align: "right", taille: 14, couleur: fournitureDue(j) ? ROUGE : CRAYON });
  else {
    // Le nom de la page, rapetissé s'il est long
    ctx.font = `13px "Patrick Hand", cursive`;
    const place = droite - 4 - 200;
    ecrire(ctx, p.libelle, droite - 4, y, { align: "right", taille: 13 * Math.min(1, place / ctx.measureText(p.libelle).width), couleur: CRAYON });
  }
}

function bandeauBas(p: Partie): void {
  const ctx = ui.ctx;
  const j = p.jeu;
  const y0 = HAUT + PAGE_H;
  // Pour les gauchers, l'encre passe à droite et les pouvoirs sous le pouce gauche
  const xe = reglages.gaucher ? W - 120 : 0;
  // L'encre : la seule monnaie
  ctx.fillStyle = BLEU;
  ctx.beginPath();
  ctx.moveTo(xe + 18, y0 + 8);
  ctx.quadraticCurveTo(xe + 28, y0 + 22, xe + 18, y0 + 30);
  ctx.quadraticCurveTo(xe + 8, y0 + 22, xe + 18, y0 + 8);
  ctx.fill();
  const pulse = fx.pulseEncre();
  ecrire(ctx, String(Math.floor(j.encre)), xe + 34, y0 + 21, { align: "left", police: "titre", taille: 30 * (1 + pulse * 0.18), couleur: pulse > 0.5 ? "#3a5fc4" : BLEU });
  if (p.trace && p.trace.length > 1 && !p.arme) {
    const l = polylineLength(p.trace);
    const c = classer([...p.trace, { ...p.trace[p.trace.length - 1], t: performance.now() }]);
    const cout = c.geste === "tour" ? coutPose(j, tourDe(c.glyphe!)) : c.geste === "rature" ? coutRature(l) : c.geste === "cercle" ? l * ENCRE_PAR_PX_COLLE : c.geste === "mur" ? l * ENCRE_PAR_PX_MUR : 0;
    if (cout) ecrire(ctx, `−${Math.ceil(cout)}`, reglages.gaucher ? xe - 8 : 100, y0 + 22, { align: reglages.gaucher ? "right" : "left", taille: 20, couleur: cout > j.encre ? ROUGE : CRAYON });
  }
  // Les pouvoirs, à droite ; les gestes permis, tant qu'il reste de la place
  const pouvoirs = j.options.pouvoirs ?? [];
  pouvoirs.forEach((k, i) => boutonPouvoir(p, k, reglages.gaucher ? 30 + i * 50 : W - 30 - (pouvoirs.length - 1 - i) * 50, y0 + 19));
  const g = gestesPermis(j);
  const gestes = [
    g.mur && ["mur", "lent"],
    g.rature && ["rature", "sec"],
    g.colle && j.options.gestes?.colle !== false && ["colle", "boucle"],
  ].filter(Boolean).slice(0, pouvoirs.length >= 2 ? 0 : pouvoirs.length ? 2 : 3) as string[][];
  gestes.forEach(([nom, comment], i) => {
    const x = 170 + i * 76;
    ecrire(ctx, t(nom), x, y0 + 15, { taille: 14 });
    ecrire(ctx, t(comment), x, y0 + 30, { taille: 11, couleur: CRAYON });
  });
  // Le pense-bête : les symboles des tours débloquées
  const types = j.options.toursDispo;
  const largeur = Math.min(56, (W - 16) / Math.max(1, types.length));
  types.forEach((t, i) => {
    const x = 8 + i * largeur + largeur / 2;
    // Juste sous la première ligne : le bandeau ne fait que BAS_PORTRAIT de haut
    const y = y0 + BAS_PORTRAIT - 26;
    const cout = coutPose(j, t);
    const possible = j.encre >= cout;
    symbole(ctx, TOURS[t].glyphe, x, y - 6, 9, possible ? STYLOS[t] : CRAYON, 1.8);
    ecrire(ctx, String(cout), x, y + 16, { taille: 12, couleur: possible ? STYLOS[t] : CRAYON });
    zone(x - largeur / 2, y - 22, largeur, 46, () => (p.fiches = [t]));
  });
}

/** La goutte d'encre et le compteur ; le coût du trait en cours juste dessous. */
function compteurEncre(p: Partie, x: number, y: number, taille: number, xCout: number, yCout: number): void {
  const ctx = ui.ctx;
  const j = p.jeu;
  const k = taille / 30;
  ctx.fillStyle = BLEU;
  ctx.beginPath();
  ctx.moveTo(x, y - 13 * k);
  ctx.quadraticCurveTo(x + 10 * k, y + k, x, y + 9 * k);
  ctx.quadraticCurveTo(x - 10 * k, y + k, x, y - 13 * k);
  ctx.fill();
  const pulse = fx.pulseEncre();
  ecrire(ctx, String(Math.floor(j.encre)), x + 16 * k, y, { align: "left", police: "titre", taille: taille * (1 + pulse * 0.18), couleur: pulse > 0.5 ? "#3a5fc4" : BLEU });
  if (p.trace && p.trace.length > 1 && !p.arme) {
    const l = polylineLength(p.trace);
    const c = classer([...p.trace, { ...p.trace[p.trace.length - 1], t: performance.now() }]);
    const cout = c.geste === "tour" ? coutPose(j, tourDe(c.glyphe!)) : c.geste === "rature" ? coutRature(l) : c.geste === "cercle" ? l * ENCRE_PAR_PX_COLLE : c.geste === "mur" ? l * ENCRE_PAR_PX_MUR : 0;
    if (cout) ecrire(ctx, `−${Math.ceil(cout)}`, xCout, yCout, { align: "left", taille: 18, couleur: cout > j.encre ? ROUGE : CRAYON });
  }
}

/** iPhone Duo fermé, tablette debout : la carte en grand, et tous les outils dans une bande sous le pouce. */
function bande(p: Partie): { x: number; y: number } {
  const ctx = ui.ctx;
  const j = p.jeu;
  const w = BANDE;
  // Le trait qui sépare la bande de la carte, du côté de la carte
  const bord = reglages.gaucher ? w - 1 : 1;
  ligne(ctx, { x: bord, y: 6 }, { x: bord, y: PAGE_H - 6 }, { couleur: CRAYON, epaisseur: 1.1, graine: 82 });
  bouton(8, 8, 40, 34, "II", () => mettrePause(p, true), { taille: 17 });
  bouton(54, 8, 40, 34, `×${vitesseAffichee(p)}`, () => changerVitesse(p), { taille: 17, principal: vitesseAffichee(p) > 1 });
  ecrire(ctx, "♥", 24, 68, { couleur: ROUGE, taille: 24 });
  ecrire(ctx, String(j.vies), 40, 69, { align: "left", couleur: ROUGE, taille: 28, police: "titre" });
  const total = Number.isFinite(j.regles.total) && !p.tuto ? `/${j.regles.total}` : "";
  ecrire(ctx, p.tuto ? t("tutoriel") : t("vague"), w / 2, 96, { taille: 13, couleur: CRAYON });
  if (!p.tuto) ecrire(ctx, `${Math.max(1, j.vague)}${total}`, w / 2, 116, { police: "titre", taille: 24 });
  if (p.tuto) { /* le tutoriel n'appelle pas de vague */ }
  else if (j.phase === "attente") bouton(8, 136, w - 16, 52, t("Go !"), () => appelerVague(p), { principal: true, sous: t("vague 1"), taille: 20 });
  else if (j.phase === "jeu" && j.prochaine !== null && j.plan) {
    bouton(8, 136, w - 16, 52, `▸ ${j.vague + 1}`, () => appelerVague(p), { sous: `${Math.ceil(j.prochaine)} s · +${Math.round(j.prochaine * 2)}`, taille: 20 });
  } else if (j.phase === "jeu" && !j.plan) paragraphe(ctx, t("dernière vague !"), w / 2, 150, w - 12, { taille: 15, couleur: ROUGE });
  else if (j.phase === "jeu") paragraphe(ctx, fournitureDue(j) ? t("puis une fourniture") : t("la vague arrive…"), w / 2, 150, w - 12, { taille: 14, couleur: fournitureDue(j) ? ROUGE : CRAYON });
  compteurEncre(p, 20, 222, 30, 34, 248);
  const pouvoirs = j.options.pouvoirs ?? [];
  pouvoirs.forEach((k, i) => boutonPouvoir(p, k, w / 2, 292 + i * 56));
  // Le pense-bête des tours, en colonne : le symbole, et son prix à côté
  const types = j.options.toursDispo;
  const haut = pouvoirs.length ? 268 + pouvoirs.length * 56 : 268;
  const rang = Math.min(54, (PAGE_H - 6 - haut) / Math.max(1, types.length));
  types.forEach((t, i) => {
    const y = haut + i * rang + rang / 2;
    const cout = coutPose(j, t);
    const possible = j.encre >= cout;
    symbole(ctx, TOURS[t].glyphe, 30, y, Math.min(10, rang * 0.24), possible ? STYLOS[t] : CRAYON, 1.8);
    ecrire(ctx, String(cout), 52, y + 1, { align: "left", taille: 15, couleur: possible ? STYLOS[t] : CRAYON });
    zone(4, y - rang / 2, w - 8, rang, () => (p.fiches = [t]));
  });
  return { x: 20, y: 222 };
}

/** iPhone Duo déplié, ordinateur : la page de droite du cahier ouvert, tout ce qu'il faut savoir de la partie. */
function panneau(p: Partie): { x: number; y: number } {
  const ctx = ui.ctx;
  const j = p.jeu;
  const w = PANNEAU_W;
  const x0 = 46;
  const droite = w - 14;
  // L'en-tête : la page en titre, et les commandes
  // Le titre rapetisse s'il le faut pour laisser la place aux boutons
  ctx.font = "700 28px Caveat, cursive";
  const place = droite - 144 - x0;
  const tt = Math.max(16, Math.min(28, (28 * place) / Math.max(1, ctx.measureText(p.libelle).width)));
  ecrire(ctx, p.libelle, x0, 30, { align: "left", police: "titre", taille: tt });
  bouton(droite - 40, 12, 40, 34, "II", () => mettrePause(p, true), { taille: 17 });
  boutonSon(droite - 86, 13);
  bouton(droite - 134, 12, 42, 34, `×${vitesseAffichee(p)}`, () => changerVitesse(p), { taille: 17, principal: vitesseAffichee(p) > 1 });
  // Les vies, la vague, l'encre
  ecrire(ctx, "♥", x0 + 8, 86, { couleur: ROUGE, taille: 30 });
  ecrire(ctx, String(j.vies), x0 + 28, 87, { align: "left", couleur: ROUGE, taille: 36, police: "titre" });
  const vagueTxt = Number.isFinite(j.regles.total) && !p.tuto ? t("{a} sur {b}", { a: Math.max(1, j.vague), b: j.regles.total }) : String(Math.max(1, j.vague));
  ecrire(ctx, p.tuto ? t("tutoriel") : t("vague"), x0 + 116, 74, { align: "left", taille: 13, couleur: CRAYON });
  ecrire(ctx, p.tuto ? t("Bille") : vagueTxt, x0 + 116, 96, { align: "left", police: "titre", taille: 28 });
  compteurEncre(p, x0 + 236, 86, 36, x0 + 262, 116);
  ligne(ctx, { x: x0 - 10, y: 128 }, { x: droite, y: 128 }, { couleur: CRAYON, epaisseur: 1.1, graine: 83 });
  // La vague qui vient : qui, combien, et comment les prendre
  let y = 150;
  if (j.phase === "attente") {
    const tot = Number.isFinite(j.regles.total) ? t("{n} vagues", { n: j.regles.total }) : t("sans fin");
    ecrire(ctx, t("Vague 1"), x0, y, { align: "left", police: "titre", taille: 26 });
    ecrire(ctx, tot + (p.mode === "defi" && j.options.defi ? " · " + t("défi : {d}", { d: t(TEXTE_DEFI[j.options.defi]).toLowerCase() }) : ""), x0 + 90, y + 2, { align: "left", taille: 14, couleur: CRAYON });
  } else if (j.plan) ecrire(ctx, t("Vague {n}", { n: j.vague + 1 }), x0, y, { align: "left", police: "titre", taille: 26 });
  else ecrire(ctx, j.phase === "jeu" ? t("Dernière vague !") : "", x0, y, { align: "left", police: "titre", taille: 26, couleur: ROUGE });
  y += 30;
  if (j.plan) {
    y += listeVague(j.plan, x0, y, droite - x0, 16);
    // Les conseils, tant qu'il reste de la place avant le bouton
    for (const it of resume(j.plan)) {
      if (y > 236) break;
      const f = ENNEMIS[it.type];
      y += paragraphe(ctx, t("{nom} : {conseil}", { nom: majuscule(t(f.nom)), conseil: t(f.conseil) }), x0, y, droite - x0, { align: "left", taille: 14, couleur: CRAYON }) + 4;
    }
  }
  y = Math.max(y, 262);
  if (p.tuto) { /* le tutoriel n'appelle pas de vague */ }
  else if (j.phase === "attente") bouton(x0, y, droite - x0, 46, t("Go !"), () => appelerVague(p), { principal: true, sous: t("pose tes tours, puis lance la vague"), taille: 22 });
  else if (j.phase === "jeu" && j.prochaine !== null && j.plan) {
    bouton(x0, y, droite - x0, 46, t("▸ Appeler la vague {n}", { n: j.vague + 1 }), () => appelerVague(p), { sous: t("elle arrive dans {s} s · +{b} d'encre si tu l'appelles", { s: Math.ceil(j.prochaine), b: Math.round(j.prochaine * 2) }), taille: 20 });
  } else if (j.phase === "jeu" && j.plan) ecrire(ctx, fournitureDue(j) ? t("puis une fourniture à choisir") : t("la vague arrive…"), x0, y + 20, { align: "left", taille: 16, couleur: fournitureDue(j) ? ROUGE : CRAYON });
  // Les pouvoirs : un gros bouton chacun, son nom à côté
  const pouvoirs = j.options.pouvoirs ?? [];
  y = 342;
  if (pouvoirs.length) {
    ecrire(ctx, t("Pouvoirs"), x0, y, { align: "left", taille: 15, couleur: CRAYON });
    pouvoirs.forEach((k, i) => {
      const x = x0 + 22 + i * 116;
      boutonPouvoir(p, k, x, y + 40);
      const pret = j.recharges[k] <= 0;
      ecrire(ctx, t(POUVOIRS[k].nom), x + 28, y + 34, { align: "left", taille: 15, couleur: p.arme === k ? ROUGE : pret ? BLEU : CRAYON });
      ecrire(ctx, p.arme === k ? t("trace !") : pret ? t("prêt") : t("recharge"), x + 28, y + 52, { align: "left", taille: 12, couleur: p.arme === k ? ROUGE : CRAYON });
    });
  }
  // Les tours : symbole, nom, prix ; on touche pour revoir la fiche
  y = 432;
  ecrire(ctx, t("Les tours : dessine le symbole sur la carte"), x0, y, { align: "left", taille: 15, couleur: CRAYON });
  const types = j.options.toursDispo;
  const cols = 4;
  const cw = (droite - x0 + 10) / cols;
  types.forEach((ty, i) => {
    const cx = x0 - 10 + (i % cols) * cw + cw / 2;
    const cy = y + 46 + Math.floor(i / cols) * 82;
    const cout = coutPose(j, ty);
    const possible = j.encre >= cout;
    symbole(ctx, TOURS[ty].glyphe, cx, cy, 13, possible ? STYLOS[ty] : CRAYON, 2);
    ecrire(ctx, t(TOURS[ty].nom), cx, cy + 26, { taille: 14, couleur: possible ? "#2b2d38" : CRAYON });
    ecrire(ctx, String(cout), cx, cy + 43, { taille: 14, couleur: possible ? STYLOS[ty] : CRAYON });
    zone(cx - cw / 2, cy - 24, cw, 76, () => (p.fiches = [ty]));
  });
  // Les gestes, pour mémoire
  y = 624;
  ligne(ctx, { x: x0 - 10, y: y - 14 }, { x: droite, y: y - 14 }, { couleur: CRAYON, epaisseur: 1.1, graine: 84 });
  const g = gestesPermis(j);
  const gestes = [
    g.mur && ["trait lent", "un mur"],
    g.rature && ["trait sec", "une rature"],
    g.colle && j.options.gestes?.colle !== false && ["boucle", "de la colle"],
  ].filter(Boolean) as string[][];
  const gw = (droite - x0) / gestes.length;
  gestes.forEach(([comment, quoi], i) => {
    ecrire(ctx, t(comment), x0 + i * gw, y + 8, { align: "left", taille: 14 });
    ecrire(ctx, t(quoi), x0 + i * gw, y + 26, { align: "left", taille: 12, couleur: CRAYON });
  });
  ecrire(ctx, t("Touche une tour pour l'améliorer, changer sa cible ou la vendre."), x0, y + 60, { align: "left", taille: 13, couleur: CRAYON });
  return { x: x0 + 236, y: 86 };
}

/** Un pouvoir dans le bandeau : son icône, sa recharge hachurée qui recule, et un sursaut quand il revient. */
function boutonPouvoir(p: Partie, k: Pouvoir, x: number, y: number): void {
  const ctx = ui.ctx;
  const j = p.jeu;
  const reste = j.recharges[k];
  const pret = reste <= 0;
  const arme = p.arme === k;
  const sursaut = fx.pretDepuis(k);
  const s = 1 + (sursaut < 0.4 ? Math.sin((sursaut / 0.4) * Math.PI) * 0.25 : 0) + (arme ? Math.sin(ui.temps * 8) * 0.05 : 0);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  cercle(ctx, 0, 0, 20, { couleur: arme ? ROUGE : pret ? BLEU : CRAYON, epaisseur: arme ? 2.6 : 1.6, graine: 60 + x, fond: arme ? "rgba(196,48,43,0.12)" : "rgba(246,239,220,0.9)" });
  icone(ctx, k, 0, 0, 12, pret);
  if (!pret) {
    // Ce qui reste à recharger, hachuré au crayon
    const part = Math.min(1, reste / POUVOIRS[k].recharge);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 19, -Math.PI / 2, -Math.PI / 2 + part * Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.strokeStyle = "rgba(90,92,105,0.55)";
    ctx.lineWidth = 1.2;
    for (let d = -24; d < 24; d += 4) {
      ctx.beginPath();
      ctx.moveTo(d - 20, -20);
      ctx.lineTo(d + 20, 20);
      ctx.stroke();
    }
    ctx.restore();
    // Les secondes restantes, sur une pastille de papier au coin
    ctx.fillStyle = PAPIER;
    ctx.beginPath();
    ctx.ellipse(14, 13, 12, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    cercle(ctx, 14, 13, 10, { couleur: CRAYON, epaisseur: 1, graine: 70 + x, amp: 0.3 });
    ecrire(ctx, String(Math.ceil(reste)), 14, 14, { couleur: "#3d3f4a", taille: 13, police: "titre" });
  }
  ctx.restore();
  zone(x - 24, y - 22, 48, 44, () => {
    if (!pret) {
      vibrer("refus");
      return;
    }
    p.arme = arme ? null : k;
    p.selection = null;
    if (p.arme) vibrer("leger");
  });
}

let menuOuvert: { t: Tour | null; depuis: number } = { t: null, depuis: 0 };

function menuTour(p: Partie, to: Tour): void {
  const ctx = ui.ctx;
  if (menuOuvert.t !== to) menuOuvert = { t: to, depuis: ui.temps };
  const ouvre = Math.min(1, (ui.temps - menuOuvert.depuis) / 0.18);
  const j = p.jeu;
  const f = TOURS[to.type];
  const s = stats(to);
  const h = to.niveau === 3 && !to.spec ? 196 : 150;
  const x = 10;
  const w = W - 20;
  const y = to.y > PAGE_H / 2 ? HAUT + 8 : HAUT + PAGE_H - h - 8;
  zone(0, HAUT, W, PAGE_H, () => (p.selection = null));
  zone(x, y, w, h, () => {});
  // Le menu se déplie depuis la tour, avec un petit rebond
  const k = 1 - Math.exp(-ouvre * 6) * Math.cos(ouvre * 9);
  ctx.save();
  const ox = to.x;
  const oy = HAUT + to.y;
  ctx.translate(ox, oy);
  ctx.scale(0.3 + 0.7 * k, 0.3 + 0.7 * k);
  ctx.translate(-ox, -oy);
  ctx.globalAlpha = Math.min(1, ouvre * 3);
  feuille(ctx, x, y, w, h, "rgba(255,252,240,0.97)", 120);
  boite(ctx, x, y, w, h, { epaisseur: 2, graine: 120 });
  const titre = t(to.spec ? f.specs[to.spec - 1].nom : f.nom);
  ecrire(ctx, titre, x + 14, y + 22, { align: "left", police: "titre", taille: 28 });
  ecrire(ctx, to.spec ? t("{nom} · spécialisée", { nom: t(f.nom) }) : t("niveau {n}/3", { n: to.niveau }), x + 14, y + 46, { align: "left", taille: 13, couleur: CRAYON });
  ecrire(ctx, decrireStats(to.type, s), x + 14, y + 66, { align: "left", taille: 14 });
  bouton(x + w - 40, y + 8, 30, 28, "×", () => (p.selection = null), { taille: 18 });
  let by = y + 84;
  if (to.niveau < 3) {
    const cout = coutAmelioration(j, to)!;
    bouton(x + 12, by, 170, 50, t("Améliorer"), () => faire(p, { k: "ameliorer", id: to.id }, () => ameliorer(j, to)), { sous: t("−{n} d'encre", { n: cout }), inactif: j.encre < cout, principal: true, taille: 19 });
  } else if (!to.spec) {
    f.specs.forEach((sp, i) => {
      const cout = coutAmelioration(j, to, i + 1)!;
      const bx = x + 12 + i * ((w - 36) / 2 + 12);
      const bw = (w - 36) / 2;
      bouton(bx, by, bw, 50, t(sp.nom), () => faire(p, { k: "ameliorer", id: to.id, spec: i + 1 }, () => ameliorer(j, to, i + 1)), { sous: `−${cout}`, inactif: j.encre < cout, principal: true, taille: 18 });
      paragraphe(ctx, t(sp.texte), bx + 4, by + 56, bw - 8, { align: "left", taille: 12, couleur: CRAYON });
    });
    by += 96;
  } else ecrire(ctx, t("au maximum"), x + 96, by + 25, { taille: 16, couleur: CRAYON });
  const bx2 = to.niveau === 3 && !to.spec ? x + 12 : x + 194;
  if (!f.passive) bouton(bx2, to.niveau === 3 && !to.spec ? by + 8 : by, 88, 50, t("Cible"), () => faire(p, { k: "cible", id: to.id }, () => changerCible(to)), { sous: t(to.cible), taille: 16 });
  bouton(x + w - 98, to.niveau === 3 && !to.spec ? by + 8 : by, 86, 50, t("Vendre"), () => faire(p, { k: "vendre", id: to.id }, () => {
    vendre(j, to);
    p.selection = null;
  }), { sous: `+${valeurRevente(to)}`, taille: 16 });
  ctx.restore();
}

/** Le petit menu d'un mur : l'effacer rend l'encre qui lui reste (elle baisse à mesure qu'il sèche et qu'on le ronge). */
function menuMur(p: Partie, m: Mur): void {
  const ctx = ui.ctx;
  const j = p.jeu;
  const s = m.segs[Math.floor(m.segs.length / 2)];
  const mx = (s.a.x + s.b.x) / 2;
  const my = (s.a.y + s.b.y) / 2;
  const w = 168;
  const h = 64;
  const x = Math.max(8, Math.min(W - w - 8, mx - w / 2));
  const y = HAUT + (my > 90 ? my - h - 18 : my + 18);
  zone(0, HAUT, W, PAGE_H, () => (p.selectionMur = null));
  zone(x, y, w, h, () => {});
  feuille(ctx, x, y, w, h, "rgba(255,252,240,0.97)", 130);
  boite(ctx, x, y, w, h, { epaisseur: 2, graine: 130 });
  bouton(x + 8, y + 7, w - 16, 50, t("Effacer le mur"), () => faire(p, { k: "effacer", id: m.id }, () => {
    effacerMur(j, m);
    p.selectionMur = null;
  }), { sous: `+${encreDuMur(m)}`, taille: 17 });
}

function decrireStats(type: TypeTour, s: ReturnType<typeof stats>): string {
  const c = (n: number) => (anglais() ? String(Math.round(n * 100) / 100) : String(Math.round(n * 100) / 100).replace(".", ","));
  const portee = s.portee >= PORTEE_INFINIE ? t("portée infinie") : t("portée {n}", { n: s.portee });
  const degats = t("dégâts {n}", { n: s.degats });
  const cadence = t("tous les {n} s", { n: c(s.intervalle) });
  let l: (string | false | 0 | undefined)[] = [];
  switch (type) {
    case "plume": l = [degats, cadence, portee, s.perce && t("traverse {n}", { n: s.perce })]; break;
    case "roquette": l = [degats, t("zone {n}", { n: s.zone ?? 0 }), cadence, s.dps && t("napalm")]; break;
    case "foudre": l = [degats, t("{n} rebonds", { n: s.rebonds ?? 0 }), cadence]; break;
    case "correction": l = [degats, cadence, portee]; break;
    case "spirale": l = [t("ralentit {n} %", { n: Math.round((s.ralenti ?? 0) * 100) }), portee, s.dps && t("brûle {n}/s", { n: s.dps })]; break;
    case "scie": l = [t("{n} lames", { n: s.lames ?? 0 }), t("{n} dégâts/s", { n: s.dps ?? 0 }), s.ignoreArmure && t("ignore l'armure")]; break;
    case "encrier": l = [t("+{n} d'encre/s", { n: c(s.encre ?? 0) }), s.interets && t("intérêts"), s.primeBonus && t("primes +50 %")]; break;
  }
  return l.filter(Boolean).join(" · ");
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
  feuille(ctx, x, y, w, h, "rgba(255,252,240,0.98)", 150);
  boite(ctx, x, y, w, h, { epaisseur: 2.2, graine: 150 });
  const nouvelle = !sauvegarde.appris.includes(type);
  if (nouvelle) ecrire(ctx, t("nouvelle tour !"), x + w - 20, y + 22, { align: "right", taille: 15, couleur: ROUGE, rotation: 0.08 });
  ecrire(ctx, t(f.nom), W / 2, y + 44, { police: "titre", taille: 40 });
  ecrire(ctx, t(f.role), W / 2, y + 78, { taille: 16, couleur: CRAYON });
  // Le symbole se dessine en boucle
  const avance = Math.min(1, ((ui.temps % 2.2) / 2.2) * 1.4);
  ctx.save();
  ctx.setLineDash([3, 5]);
  symbole(ctx, f.glyphe, W / 2, y + 178, 52, "rgba(60,62,75,0.3)", 2);
  ctx.restore();
  symbole(ctx, f.glyphe, W / 2, y + 178, 52, STYLOS[type], 3.5, avance);
  paragraphe(ctx, t("Dessine ce symbole en PETIT (moins de 2 cm) là où tu veux la tour."), W / 2, y + 256, w - 40, { taille: 16 });
  ecrire(ctx, t("{n} d'encre", { n: coutPose(j, type) }), W / 2, y + 318, { taille: 20, couleur: BLEU });
  ecrire(ctx, t("touche pour continuer"), W / 2, y + h - 18, { taille: 13, couleur: CRAYON });
}

function dessinerPause(): void {
  voile(0.88);
  // Bille profite de la pause pour glisser une astuce
  if (partie && !partie.tuto) placer({ x: 40, y: H - 30, h: 84, cle: "pause", repere: "dessus", texte: astuceDe(partie.jeu.stats.tues + partie.jeu.vague * 7) });
  ecrire(ui.ctx, t("Pause"), W / 2, 230, { police: "titre", taille: 64 });
  bouton(90, 300, 220, 56, t("Reprendre"), () => partie && mettrePause(partie, false), { principal: true });
  const c = partie?.coop;
  if (c) {
    // À deux : la pause vaut pour les deux, et seul l'hôte relance la page
    ecrire(ui.ctx, t("à deux · salon {code}", { code: c.code }), W / 2, 270, { taille: 15, couleur: CRAYON });
    let y = 376;
    if (c.rejouer) {
      bouton(90, y, 220, 50, t("Recommencer à deux"), c.rejouer, { taille: 19 });
      y += 70;
    }
    bouton(90, y, 220, 50, t("Quitter la coop"), c.quitter, { taille: 19 });
    bouton(90, y + 70, 160, 44, t("Réglages"), () => ouvrirReglages("partie"), { taille: 18 });
    boutonSon(262, y + 76);
    return;
  }
  bouton(90, 376, 220, 50, t("Recommencer la page"), recommencer, { taille: 19 });
  bouton(90, 446, 220, 50, t("Quitter la page"), () => nav.aller(partie?.mode === "jour" || partie?.mode === "interro" ? "titre" : "campagne"), { taille: 19 });
  bouton(90, 516, 160, 44, t("Réglages"), () => ouvrirReglages("partie"), { taille: 18 });
  boutonSon(262, 522);
}

function etoile(x: number, y: number, r: number, pleine: boolean, graine: number): void {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    pts.push({ x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr });
  }
  const ctx = ui.ctx;
  if (!pleine) {
    trait(ctx, pts, { ferme: true, couleur: CRAYON, epaisseur: 2, graine });
    return;
  }
  // Une étoile dorée autocollante, comme celles que la prof colle sur les bonnes copies
  ctx.save();
  ctx.shadowColor = "rgba(60,40,0,0.35)";
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 2;
  const g = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
  g.addColorStop(0, "#fff1a8");
  g.addColorStop(0.35, "#f0c43a");
  g.addColorStop(0.7, "#c9921a");
  g.addColorStop(1, "#f3cf5a");
  ctx.fillStyle = g;
  ctx.beginPath();
  pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = "rgba(150,100,10,0.6)";
  ctx.lineWidth = 0.8;
  ctx.stroke();
  // Le reflet brillant
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.beginPath();
  ctx.ellipse(x - r * 0.18, y - r * 0.28, r * 0.22, r * 0.09, -0.6, 0, Math.PI * 2);
  ctx.fill();
}

/** Le mot de la prof, au stylo rouge, selon la copie rendue. */
function motDeLaProf(p: Partie): string {
  const j = p.jeu;
  const n = etoiles(j);
  const tire = (l: string[]) => t(l[(j.regles.graine + j.stats.tues) % l.length]);
  if (p.mode === "interro") return t(j.phase === "gagne" ? "Remarquable !" : j.vague > 20 ? "Très bonne copie" : j.vague > 10 ? "Des efforts, continue" : "Il faut réviser !");
  if (j.phase !== "gagne") return tire(["Revois tes murs.", "Trop de bavardages !", "Tu peux mieux faire.", "Attention aux voleurs !"]);
  if (n >= 3) return tire(["Excellent !", "Parfait, bravo !", "Très bien !"]);
  if (n === 2) return tire(["Bien. Surveille ton Cœur.", "Bon travail !", "C'est bien, continue."]);
  return tire(["Juste… peut mieux faire.", "Passable.", "Ouf ! De justesse."]);
}
export { etoile };

/** Ce que Bille dit à la fin de la page. */
function motDeBille(p: Partie): string {
  const j = p.jeu;
  const gagne = j.phase === "gagne";
  if (p.mode === "interro") return t(gagne ? "Remarquable, comme dit la prof !" : "On révise un peu et on y retourne ?");
  if (p.mode === "sansFin") return t("Joli score ! On essaie de le battre ?");
  if (!gagne) return t("C'est pas grave. On recommence ? Je t'aiderai.");
  return t(etoiles(j) >= 3 ? "Trois étoiles ! Je suis fière de toi." : "Bravo ! Je savais que tu y arriverais.");
}

/** La copie rendue : la page reste à l'écran, la prof l'annote, et une fiche en bas mène au bilan. */
function carteCopie(p: Partie, c: CopieFin): void {
  const ctx = ui.ctx;
  const tm = ui.temps - c.depuis;
  const y = HAUT + PAGE_H + 6;
  const h = H - y - 6;
  feuille(ctx, 10, y, W - 20, h, "rgba(255,252,240,0.97)", 210);
  boite(ctx, 10, y, W - 20, h, { couleur: ROUGE, epaisseur: 1.6, graine: 211 });
  if (tm < 0.6) return;
  const fini = tm > dureeCopie(c.notes);
  bouton(22, y + 10, 160, h - 20, t("Partager"), () => partagerCopie(p), { taille: 18, sous: t("ma copie") });
  bouton(W - 22 - 180, y + 10, 180, h - 20, t("Mon bilan"), () => {
    c.etape = "bilan";
    c.revue = true;
  }, { principal: fini, taille: 20 });
}

/** L'image de la copie, et le lien pour qu'un ami la batte (pas pour l'interro ni le tutoriel). */
function partagerCopie(p: Partie): void {
  const c = p.copie;
  if (!c) return;
  const j = p.jeu;
  c.image ??= imageCopie(j, c.notes, p.libelle);
  const note = c.note !== null ? `${afficherNote(c.note, anglais())}/20` : "";
  const page = p.page;
  if (page && c.note !== null && (p.mode === "campagne" || p.mode === "ami")) {
    const url = lienDefi({ page: page.id, note: c.note, tours: j.options.toursDispo, pouvoir: j.options.pouvoirs?.[0] ?? null });
    void partager(c.image, t("J'ai eu {note} à la page {page} de Rature. Bats ma copie !", { note, page: page.id }), url);
  } else void partager(c.image, note ? t("Ma copie sur Rature : {note}", { note }) : t("Ma copie sur Rature"));
}

function dessinerFin(p: Partie): void {
  const ctx = ui.ctx;
  const j = p.jeu;
  if (p.copie?.etape === "copie") return carteCopie(p, p.copie);
  voile(0.92);
  const gagne = j.phase === "gagne";
  const sansFin = p.mode === "sansFin";
  const interro = p.mode === "interro";
  const titreFin = t(interro ? (gagne ? "Interro réussie !" : "Copie ramassée") : sansFin ? "Fin de la page" : gagne ? "Page gagnée !" : "Page perdue");
  const tm = ui.temps - p.finDepuis;
  // Le titre s'écrit de gauche à droite
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 60, W * Math.min(1, tm / 0.5), 120);
  ctx.clip();
  ecrire(ctx, titreFin, W / 2, 120, { police: "titre", taille: 54, couleur: gagne || sansFin ? BLEU : ROUGE });
  ctx.restore();
  const apparition = Math.min(1, Math.max(0, (tm - 0.3) * 3));
  ctx.save();
  ctx.globalAlpha = apparition;
  if (gagne && p.mode === "campagne") {
    ctx.globalAlpha = 1;
    const n = etoiles(j);
    for (let k = 0; k < 3; k++) {
      // Chaque étoile est tamponnée à son tour : elle tombe de haut, s'écrase, et l'encre gicle
      const tk = tm - 0.55 - k * 0.35;
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
  } else if (interro) {
    // La note de la prof, entourée deux fois au stylo rouge
    const tenues = gagne ? j.regles.total : j.vague - 1;
    const note = Math.round((tenues / j.regles.total) * 20);
    ecrire(ctx, `${note}/20`, W / 2, 222, { police: "titre", taille: 58, couleur: ROUGE, rotation: -0.06 });
    cercle(ctx, W / 2, 222, 62, { couleur: ROUGE, epaisseur: 2.4, graine: 190 });
    cercle(ctx, W / 2 + 3, 220, 66, { couleur: ROUGE, epaisseur: 1.2, graine: 191, alpha: 0.7 });
    ecrire(ctx, t("{n} vagues tenues · {m} fournitures", { n: tenues, m: j.prises.length }), W / 2, 302, { taille: 16, couleur: CRAYON });
  } else if (sansFin) {
    ecrire(ctx, t("{n} vagues tenues", { n: j.vague - 1 }), W / 2, 220, { police: "titre", taille: 44, couleur: ROUGE });
  } else if (!gagne) {
    ecrire(ctx, t("tombée à la vague {n}", { n: j.vague }), W / 2, 200, { police: "titre", taille: 32, couleur: ROUGE, rotation: -0.04 });
    // Le tampon de la prof
    const tk = tm - 0.6;
    if (tk > 0) {
      const chute = Math.max(0, 1 - tk / 0.14);
      ctx.save();
      ctx.globalAlpha = Math.min(1, tk * 8) * 0.9;
      ctx.translate(W / 2, 250);
      ctx.rotate(-0.18);
      ctx.scale(1 + chute * 1.8, 1 + chute * 1.8);
      boite(ctx, -78, -24, 156, 48, { couleur: ROUGE, epaisseur: 3.5, graine: 181 });
      boite(ctx, -72, -19, 144, 38, { couleur: ROUGE, epaisseur: 1.2, graine: 182 });
      ecrire(ctx, t("À REFAIRE"), 0, 1, { police: "titre", taille: 34, couleur: ROUGE });
      ctx.restore();
    }
  } else {
    ecrire(ctx, t(j.vies > 1 ? "{n} vies gardées" : "{n} vie gardée", { n: j.vies }), W / 2, 220, { police: "titre", taille: 40, couleur: ROUGE });
  }
  // La note de la copie (l'interro a déjà la sienne, en grand), et celle de l'ami qui nous a défié
  const note = p.copie?.note ?? null;
  if (note !== null && !interro) {
    const ami = p.defiAmi;
    const texte = ami
      ? t(note > ami.note ? "{moi}/20 contre {lui}/20 : copie battue !" : note === ami.note ? "{moi}/20 contre {lui}/20 : égalité" : "{moi}/20 contre {lui}/20 : pas encore…", { moi: afficherNote(note, anglais()), lui: afficherNote(ami.note, anglais()) })
      : t("note : {n}/20", { n: afficherNote(note, anglais()) });
    ecrire(ctx, texte, W / 2, gagne && p.mode === "campagne" ? 266 : 262, { police: "titre", taille: 24, couleur: ROUGE, rotation: -0.03 });
  }
  ctx.restore();
  if (p.record) ecrire(ctx, t("record !"), W / 2 + 120, 175, { couleur: ROUGE, taille: 18, rotation: 0.3 });
  if (p.message) {
    boite(ctx, 40, 278, W - 80, 44, { couleur: ROUGE, epaisseur: 1.8, graine: 170 });
    ecrire(ctx, p.message, W / 2, 300, { taille: 17, couleur: ROUGE });
  }
  [
    t("mots rayés : {n}", { n: j.stats.tues }),
    t(j.stats.meilleurTrait > 1 ? "meilleur trait : {n} mots d'un coup" : "meilleur trait : {n} mot", { n: j.stats.meilleurTrait }),
    t("vies perdues : {n}", { n: j.stats.fuites }),
    t("encre gaspillée : {n}", { n: Math.round(j.stats.encreGaspillee) }),
  ].forEach((l, i) => ecrire(ctx, l, W / 2, 360 + i * 28, { taille: 18 }));
  if (tm > 1.6) {
    const mot = motDeLaProf(p);
    ecrire(ctx, mot, W / 2 + 10, 476, { police: "titre", taille: 26, couleur: ROUGE, rotation: -0.05, alpha: Math.min(1, (tm - 1.6) * 3) });
    ctx.font = `700 26px Caveat, cursive`;
    const lm = ctx.measureText(mot).width;
    trait(ctx, [{ x: W / 2 + 10 - lm / 2, y: 494 }, { x: W / 2 + 10 + lm / 2, y: 489 }], { couleur: ROUGE, epaisseur: 1.6, graine: 199, alpha: Math.min(1, (tm - 1.6) * 3) });
  }
  if (tm > 1.6) placer({ x: 36, y: H - 16, h: 66, cle: "fin", repere: "dessus", humeur: gagne || sansFin ? "joie" : "triste", texte: motDeBille(p) });
  if (ui.temps - p.finDepuis < 0.8) return;
  const suivante = p.page && p.mode === "campagne" && gagne ? PAGES[PAGES.indexOf(p.page) + 1] : undefined;
  let y = 512;
  if (suivante) {
    bouton(70, y, 260, 56, t("Page suivante"), () => nav.ouvrirPage?.(suivante), { principal: true, taille: 22 });
    y += 70;
  }
  if (p.mode === "coop") {
    if (p.coop?.rejouer) bouton(70, y, 260, 50, t("Rejouer à deux"), p.coop.rejouer, { principal: true, taille: 20 });
    else ecrire(ui.ctx, p.coop ? t("l'hôte peut relancer la page") : "", W / 2, y + 25, { taille: 16, couleur: CRAYON });
    bouton(70, y + 64, 260, 50, p.coop ? t("Quitter la coop") : t("Menu"), () => (p.coop ? p.coop.quitter() : nav.aller("titre")), { taille: 20 });
    boutonsCopie(p, y + 134);
    return;
  }
  const versMenu = p.mode === "jour" || p.mode === "interro" || p.mode === "ami";
  bouton(70, y, 260, 50, t(p.mode === "interro" ? "Nouvelle interro" : "Rejouer cette page"), recommencer, { principal: !suivante, taille: 20 });
  bouton(70, y + 64, 260, 50, versMenu ? t("Menu") : t("Les cahiers"), () => nav.aller(versMenu ? "titre" : "campagne"), { taille: 20 });
  boutonsCopie(p, y + 134);
}

/** Revoir la copie (sur le cahier ouvert, elle est déjà sur la page de gauche) et la partager. */
function boutonsCopie(p: Partie, y: number): void {
  const c = p.copie;
  if (!c) return;
  const defi = !!p.page && c.note !== null && (p.mode === "campagne" || p.mode === "ami");
  if (p.mise !== "ouvert") {
    bouton(70, y, 125, 46, t("Ma copie"), () => (c.etape = "copie"), { taille: 17 });
    bouton(205, y, 125, 46, defi ? t("Défier un ami") : t("Partager"), () => partagerCopie(p), { taille: 17 });
  } else bouton(70, y, 260, 46, defi ? t("Défier un ami") : t("Partager ma copie"), () => partagerCopie(p), { taille: 17 });
}

export { PAPIER, cercle, BAS };
