// Le tutoriel : une vraie partie, menée pas à pas par Bille. Le temps s'arrête pendant qu'elle parle ; les mots
// arrivent un par un, au ralenti ; chaque geste est d'abord montré en pointillés par un stylo fantôme, et un autre
// geste que celui demandé est refusé avec une explication (rien n'est dépensé). On peut le rejouer depuis « Comment
// jouer », et le passer à tout moment.
import { bille } from "../render/bille";
import { BLEU, CRAYON, ROUGE, cercle, ecrire, feuille, paragraphe, trait } from "../render/encre";
import type { TypeEnnemi } from "../sim/ennemis";
import { polylineLength, type V } from "../sim/geom";
import { classer, type Pt } from "../sim/gestures";
import { refusPose, type Jeu, type Resultat } from "../sim/jeu";
import { HAUT, PAGE_H, W, bouton, zone } from "./base";

type Attente =
  | { k: "toucher" }
  /** Une condition sur la partie, vérifiée à chaque image. */
  | { k: "fait"; quand: (j: Jeu, t: Tuto) => boolean };

type Geste = "tour" | "mur" | "rature" | "cercle";

interface Etape {
  texte: string | ((t: Tuto) => string);
  attente: Attente;
  /** Le seul geste permis pendant l'étape (aucun : tous). */
  geste?: Geste | "tous";
  /** Ce qu'on montre : un guide en pointillés, une flèche vers un endroit. */
  guide?: (t: Tuto, j: Jeu) => Guide | null;
  /** À l'entrée dans l'étape. */
  entree?: (t: Tuto, j: Jeu) => void;
  /** Bille est contente (après une réussite). */
  joie?: boolean;
}

interface Guide {
  /** Le tracé à reproduire, en coordonnées de la carte. */
  trace?: V[];
  /** Le tracé est un geste rapide (la rature) : le stylo fantôme file. */
  vite?: boolean;
  /** Une flèche vers ce point (coordonnées du cadre, bandeaux compris). */
  fleche?: V;
  /** Un cercle qui pulse autour de ce point (coordonnées de la carte). */
  halo?: { x: number; y: number; r: number };
}

export interface Tuto {
  etape: number;
  depuis: number;
  /** Un mot de Bille après un geste refusé ou raté. */
  note: string | null;
  noteDepuis: number;
  /** Les endroits choisis sur cette carte. */
  spot: V;
  mur: [V, V];
  boucle: { x: number; y: number; r: number };
  /** Les fuites et les morts au début de l'étape (pour savoir si le mot est passé). */
  fuites: number;
  tues: number;
  fini: boolean;
  /** Le temps du tutoriel (pour les animations). */
  temps: number;
  /** Une tour est choisie (son menu est ouvert), et où s'ouvre ce menu. */
  menu: "haut" | "bas" | null;
}

/** Le chemin des mots, en points de la carte. */
const chemin = (j: Jeu): V[] => j.trajets[0] ?? [];

function pointA(pts: V[], f: number): { p: V; n: V } {
  const i = Math.max(1, Math.min(pts.length - 2, Math.round(f * (pts.length - 1))));
  const a = pts[i - 1];
  const b = pts[i + 1];
  const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  return { p: pts[i], n: { x: -(b.y - a.y) / l, y: (b.x - a.x) / l } };
}

const loinDuChemin = (pts: V[], q: V, d: number) => pts.every((p) => Math.hypot(p.x - q.x, p.y - q.y) >= d);

export function creerTuto(j: Jeu): Tuto {
  const pts = chemin(j);
  // La tour : à côté du chemin, assez tôt sur le parcours pour avoir le temps de tirer
  let spot: V = { x: 200, y: 300 };
  trouve: for (const f of [0.32, 0.4, 0.25, 0.5, 0.6, 0.2]) {
    const { p, n } = pointA(pts, f);
    for (const s of [1, -1]) for (const d of [36, 46, 56]) {
      const q = { x: p.x + n.x * d * s, y: p.y + n.y * d * s };
      if (!refusPose(j, q.x, q.y) && loinDuChemin(pts, q, 26)) {
        spot = q;
        break trouve;
      }
    }
  }
  // Le mur : en travers du chemin, plus loin
  const m = pointA(pts, 0.62);
  const mur: [V, V] = [{ x: m.p.x - m.n.x * 48, y: m.p.y - m.n.y * 48 }, { x: m.p.x + m.n.x * 48, y: m.p.y + m.n.y * 48 }];
  // La colle : une grande boucle sur le chemin, vers la fin
  const c = pointA(pts, 0.8);
  return { etape: 0, depuis: 0, note: null, noteDepuis: 0, spot, mur, boucle: { x: c.p.x, y: c.p.y, r: 48 }, fuites: 0, tues: 0, fini: false, temps: 0, menu: null };
}

/** Des mots qui entrent par la flèche, un par un. */
function envoyer(j: Jeu, type: TypeEnnemi, n: number, ecart: number): void {
  const e = j.carte.entrees[0].depart;
  for (let k = 0; k < n; k++) j.file.push({ type, x: e.x, y: e.y, t: j.temps + 0.3 + k * ecart, vague: 1 });
}

const vide = (j: Jeu) => !j.file.length && !j.ennemis.length;
/** Où est le compteur d'encre, en portrait (coordonnées du cadre). */
const ENCRE: V = { x: 40, y: HAUT + PAGE_H + 20 };

const ETAPES: Etape[] = [
  {
    texte: "Salut ! Moi, c'est Bille, le bout de ton stylo. Je vais te montrer, tout doucement, comment défendre ta page.",
    attente: { k: "toucher" },
  },
  {
    texte: "Des mots-monstres vont entrer par la flèche rouge et suivre le chemin en pointillés jusqu'au Cœur. Chaque mot qui touche le Cœur te coûte une vie.",
    attente: { k: "toucher" },
    guide: (_t, j) => ({ halo: { x: j.carte.entrees[0].bord.x, y: j.carte.entrees[0].bord.y, r: 26 } }),
  },
  {
    texte: "Le Cœur, c'est lui. Tu as des vies : quand il n'y en a plus, la page est perdue.",
    attente: { k: "toucher" },
    guide: (_t, j) => ({ halo: { x: j.carte.coeur.x, y: j.carte.coeur.y, r: 24 } }),
  },
  {
    texte: "Tout se paie avec de l'encre : les tours, les murs, les ratures. Ton encre est là, en bas. Raturer des mots en rapporte.",
    attente: { k: "toucher" },
    guide: () => ({ fleche: ENCRE }),
  },
  {
    texte: "Ta première tour ! Dessine un PETIT cercle, là où je te montre, à côté du chemin. Pas trop vite, pas trop grand : un cercle de la taille d'une pièce.",
    attente: { k: "fait", quand: (j) => j.tours.length > 0 },
    geste: "tour",
    guide: (t) => ({ trace: rond(t.spot, 15) }),
  },
  {
    texte: "Bravo, c'est une Plume ! Elle tire toute seule sur les mots qui passent près d'elle.",
    attente: { k: "toucher" },
    joie: true,
  },
  {
    texte: "Voilà un mot qui arrive. Ne fais rien : regarde ta Plume s'en occuper.",
    attente: { k: "fait", quand: (j, t) => vide(j) && t.temps - t.depuis > 1.5 },
    geste: "tous",
    entree: (_t, j) => envoyer(j, "gribouille", 1, 1),
  },
  {
    texte: (t) => (t.fuites ? "Il est passé, ce n'est pas grave : c'était pour voir." : "Raturé ! Chaque mot raturé te rapporte un peu d'encre.") + " Plus tu as de tours, plus tu tiens.",
    attente: { k: "toucher" },
    joie: true,
  },
  {
    texte: (t) => (t.menu ? "Son menu est ouvert. Touche le bouton « Améliorer » : ça coûte de l'encre, mais elle tirera plus fort." : "On peut rendre une tour plus forte. TOUCHE ta Plume du bout du doigt (un simple toucher, sans glisser)."),
    attente: { k: "fait", quand: (j) => j.tours.some((x) => x.niveau > 1) },
    geste: "tous",
    entree: (_t, j) => (j.encre = Math.max(j.encre, 220)),
    guide: (_t, j) => (j.tours[0] ? { halo: { x: j.tours[0].x, y: j.tours[0].y, r: 22 } } : null),
  },
  {
    texte: "Elle est au niveau 2 : elle tire plus fort. Tu pourras aller jusqu'au niveau 3, puis choisir une spécialité.",
    attente: { k: "toucher" },
    joie: true,
  },
  {
    texte: "Maintenant, un mur. Trace un grand trait LENT, en suivant mes pointillés, en travers du chemin. Lentement, comme pour souligner un titre.",
    attente: { k: "fait", quand: (j) => j.murs.length > 0 },
    geste: "mur",
    entree: (_t, j) => (j.encre = Math.max(j.encre, 200)),
    guide: (t) => ({ trace: [t.mur[0], t.mur[1]] }),
  },
  {
    texte: "Les mots ne traversent pas les murs : ils font le tour. Leur chemin s'allonge, et tes tours ont plus de temps pour tirer. Les murs s'effacent tout seuls au bout d'un moment.",
    attente: { k: "toucher" },
    joie: true,
  },
  {
    texte: "Le geste le plus important : la RATURE. Un mot arrive, je vais arrêter le temps. Raye-le d'un trait SEC et RAPIDE, droit sur lui, comme pour barrer une faute.",
    attente: { k: "fait", quand: (_j, t) => t.tues > 0 },
    geste: "rature",
    entree: (_t, j) => {
      j.encre = Math.max(j.encre, 200);
      envoyer(j, "gribouille", 1, 1);
    },
    guide: (_t, j) => {
      const e = j.ennemis.find((x) => !x.mort);
      return e ? { trace: [{ x: e.x - 26, y: e.y + 18 }, { x: e.x + 26, y: e.y - 18 }], vite: true } : null;
    },
  },
  {
    texte: "En plein dedans ! Une rature coûte un peu d'encre, et si tu rates, l'encre est perdue. Vise bien.",
    attente: { k: "toucher" },
    joie: true,
  },
  {
    texte: "Dernier geste : la COLLE. Fais une GRANDE boucle fermée autour du chemin, en suivant mes pointillés. Tout ce qui passe dedans ralentit.",
    attente: { k: "fait", quand: (j) => j.colles.length > 0 },
    geste: "cercle",
    entree: (_t, j) => (j.encre = Math.max(j.encre, 260)),
    guide: (t) => ({ trace: rond(t.boucle, t.boucle.r) }),
  },
  {
    texte: "Parfait. Retiens bien : petit cercle = une tour. Trait lent = un mur. Trait rapide = une rature. Grande boucle = de la colle.",
    attente: { k: "toucher" },
    joie: true,
  },
  {
    texte: "En haut, tu as la pause (II), et la vitesse (×1, ×2, ×3) pour aller plus vite quand tu es sûr de toi.",
    attente: { k: "toucher" },
    guide: () => ({ fleche: { x: W - 29, y: HAUT - 22 } }),
  },
  {
    texte: "Dernier exercice : six mots arrivent, doucement. Tu as le droit à tout : tours, murs, ratures, colle. À toi de jouer !",
    attente: { k: "fait", quand: (j, t) => vide(j) && t.temps - t.depuis > 2 },
    geste: "tous",
    entree: (_t, j) => {
      j.encre = Math.max(j.encre, 260);
      envoyer(j, "gribouille", 6, 2.4);
    },
  },
];

function rond(c: { x: number; y: number }, r: number): V[] {
  return Array.from({ length: 33 }, (_, i) => {
    const a = -Math.PI / 2 + (i / 32) * Math.PI * 2;
    return { x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r };
  });
}

const texte = (t: Tuto) => {
  const e = ETAPES[t.etape];
  return typeof e.texte === "function" ? e.texte(t) : e.texte;
};

function entrer(t: Tuto, j: Jeu, n: number): void {
  t.etape = n;
  t.depuis = t.temps;
  t.note = null;
  t.fuites = j.stats.fuites;
  t.tues = 0;
  if (n >= ETAPES.length) {
    t.fini = true;
    return;
  }
  ETAPES[n].entree?.(t, j);
}

/** À chaque image : la vitesse du temps, et l'étape suivante quand celle-ci est faite. Renvoie la vitesse du jeu (0 : arrêté). */
export function avancerTuto(t: Tuto, j: Jeu, dt: number): number {
  t.temps += dt;
  // Le tutoriel mène la danse : jamais de vague toute seule, jamais de défaite
  if (j.phase === "attente") j.phase = "jeu";
  j.prochaine = 1e9;
  j.vies = Math.max(j.vies, 5);
  if (t.fini) return 1;
  const e = ETAPES[t.etape];
  if (e.attente.k === "fait" && e.attente.quand(j, t)) {
    entrer(t, j, t.etape + 1);
    return 0;
  }
  const vivants = j.ennemis.length > 0 || j.file.length > 0;
  // Pendant que Bille explique, rien ne bouge (sauf les effets, quand la page est vide)
  if (e.attente.k === "toucher") return vivants ? 0 : 1;
  // La rature : le mot avance un peu, puis le temps s'arrête pour qu'on puisse viser
  if (e.geste === "rature") {
    const m = j.ennemis.find((x) => !x.mort);
    const entre = m && m.x > 20 && m.x < W - 20 && m.y > 20 && m.y < PAGE_H - 20;
    return entre && t.temps - t.depuis > 1 ? 0 : 0.6;
  }
  return vivants ? 0.45 : 1;
}

/** Un toucher pendant que Bille parle : on passe à la suite. */
export function toucherTuto(t: Tuto, j: Jeu): boolean {
  if (t.fini) return false;
  if (ETAPES[t.etape].attente.k !== "toucher") return false;
  // Un petit délai : on ne saute pas une explication par un toucher en trop
  if (t.temps - t.depuis < 0.6) return true;
  entrer(t, j, t.etape + 1);
  return true;
}

function noter(t: Tuto, mot: string): void {
  t.note = mot;
  t.noteDepuis = t.temps;
}

/** Avant de jouer un trait : est-ce le geste attendu ? Sinon, Bille explique et rien n'est dépensé. */
export function tutoRefuse(t: Tuto, trace: Pt[]): boolean {
  if (t.fini) return false;
  const e = ETAPES[t.etape];
  if (e.attente.k === "toucher") return true;
  if (!e.geste || e.geste === "tous") return false;
  const c = classer(trace);
  if (c.geste === e.geste) return false;
  const l = polylineLength(trace);
  const pourquoi: Record<Geste, string> = {
    tour: c.geste === "cercle" ? "Trop grand : une grande boucle, c'est de la colle. Fais un PETIT cercle, de la taille d'une pièce." : c.geste === "rature" ? "Trop vite : ça, c'est une rature. Dessine ton petit cercle tranquillement." : "Ce n'est pas un cercle. Ferme bien ton petit rond, de la taille d'une pièce.",
    mur: c.geste === "rature" ? "Trop rapide : ça, c'est une rature. Pour un mur, va LENTEMENT." : l < 40 ? "Trop court : un mur, c'est un grand trait." : "Un simple trait, lent et presque droit, comme mes pointillés.",
    rature: c.geste === "mur" ? "Trop lent : ça ferait un mur. Une rature, c'est un coup sec et RAPIDE." : "Un seul trait sec et rapide, droit sur le mot.",
    cercle: c.geste === "tour" ? "Trop petit : ça ferait une tour. Fais une GRANDE boucle, qui se referme." : "Il faut une grande boucle FERMÉE : reviens bien à ton point de départ.",
  };
  noter(t, c.geste === "rien" ? "Trop petit : appuie et dessine plus grand." : pourquoi[e.geste]);
  return true;
}

/** Après un trait joué : le résultat (refus du jeu, rature ratée…). */
export function tutoApres(t: Tuto, r: Resultat): void {
  if (t.fini) return;
  const e = ETAPES[t.etape];
  if (!r.ok && r.raison) noter(t, `Pas là : ${r.raison}. Essaie à l'endroit que je montre.`);
  else if (e.geste === "rature" && r.geste === "rature" && !r.touches) noter(t, "Raté : il faut que ton trait passe SUR le mot. Réessaie, il ne bouge pas.");
  else if (r.geste === "rature" && r.touches) t.tues += r.touches;
}

/** Le dessin : le guide, Bille et sa bulle. Appelé dans les coordonnées du cadre (la carte commence à HAUT). */
export function dessinerTuto(ctx: CanvasRenderingContext2D, t: Tuto, j: Jeu, portrait: boolean, actions: { passer: () => void; finir: (rejouer: boolean) => void; page: () => void }): void {
  if (t.fini) {
    finTuto(ctx, t, actions);
    return;
  }
  const e = ETAPES[t.etape];
  const g = e.guide?.(t, j) ?? null;
  const tt = t.temps;
  // Le guide, sur la carte
  ctx.save();
  ctx.translate(0, HAUT);
  if (g?.halo) {
    const p = (tt * 1.2) % 1;
    cercle(ctx, g.halo.x, g.halo.y, g.halo.r + p * 14, { couleur: ROUGE, epaisseur: 2, alpha: 1 - p, graine: 31 });
    cercle(ctx, g.halo.x, g.halo.y, g.halo.r, { couleur: ROUGE, epaisseur: 2.2, alpha: 0.8, graine: 32 });
  }
  if (g?.trace) {
    const pts = g.trace;
    ctx.save();
    ctx.setLineDash([5, 6]);
    ctx.lineDashOffset = -tt * 20;
    ctx.strokeStyle = "rgba(196,48,43,0.75)";
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.beginPath();
    pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
    ctx.stroke();
    ctx.restore();
    // Le stylo fantôme qui montre le geste, à la bonne vitesse
    const duree = g.vite ? 0.35 : pts.length > 3 ? 1.8 : 2.2;
    const cycle = duree + 1.1;
    const u = Math.min(1, ((tt - t.depuis) % cycle) / duree);
    const total = polylineLength(pts);
    let reste = u * total;
    const faits: V[] = [pts[0]];
    let bout = pts[0];
    for (let i = 1; i < pts.length; i++) {
      const l = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      if (reste >= l) {
        faits.push(pts[i]);
        bout = pts[i];
        reste -= l;
      } else {
        const k = reste / l;
        bout = { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * k, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * k };
        faits.push(bout);
        break;
      }
    }
    trait(ctx, faits, { couleur: "rgba(34,64,143,0.45)", epaisseur: 3, amp: 0.2, pate: false });
    stylo(ctx, bout.x, bout.y);
  }
  ctx.restore();
  if (g?.fleche && portrait) fleche(ctx, g.fleche, tt);
  // La bulle : en bas de la carte, ou en haut si ce qu'on montre est en bas
  // La bulle se met du côté opposé à ce qu'on montre (et au menu de la tour, s'il est ouvert)
  const gy = g?.trace ? g.trace.reduce((s2, q) => s2 + q.y, 0) / g.trace.length : g?.halo ? g.halo.y : g?.fleche ? g.fleche.y - HAUT : PAGE_H / 2;
  const bas = t.menu ? t.menu === "haut" : gy < PAGE_H * 0.55;
  const mots = t.note ?? texte(t);
  ctx.font = `17px "Patrick Hand", cursive`;
  const largeur = W - 120;
  const lignes = Math.ceil(ctx.measureText(mots).width / (largeur - 10)) + 1;
  const h = Math.max(96, lignes * 21 + 34);
  const y = bas ? HAUT + PAGE_H - h - 10 : HAUT + 54;
  feuille(ctx, 84, y, W - 96, h, t.note ? "rgba(255,236,226,0.97)" : "rgba(253,250,240,0.97)", 70 + t.etape, 0.2);
  paragraphe(ctx, mots, 94, y + 14, largeur, { align: "left", taille: 17, couleur: t.note ? ROUGE : "#2a2a35" });
  const pied = e.attente.k === "toucher" ? (tt - t.depuis > 0.6 ? "touche l'écran pour continuer ›" : "") : t.note ? "réessaie !" : "à toi !";
  ecrire(ctx, pied, W - 22, y + h - 14, { align: "right", taille: 13, couleur: CRAYON });
  ecrire(ctx, `${t.etape + 1}/${ETAPES.length}`, 96, y + h - 14, { align: "left", taille: 12, couleur: CRAYON });
  const montre = g?.halo ? { x: g.halo.x, y: g.halo.y + HAUT } : g?.trace ? { x: g.trace[0].x, y: g.trace[0].y + HAUT } : g?.fleche;
  bille(ctx, 44, y + h + 4, 84, tt, { joie: e.joie && tt - t.depuis < 1.6, parle: tt - t.depuis < 2.5 || (!!t.note && tt - t.noteDepuis < 2), montre });
  // Passer
  bouton(W - 92, HAUT + 8, 84, 30, "passer ›", actions.passer, { taille: 14 });
}

/** Le petit stylo du guide, pointe en bas à gauche. */
function stylo(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.7);
  ctx.fillStyle = "rgba(236,242,252,0.95)";
  ctx.strokeStyle = "#1e2a5a";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(4, -10);
  ctx.lineTo(4, -44);
  ctx.lineTo(-4, -44);
  ctx.lineTo(-4, -10);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = BLEU;
  ctx.fillRect(-4.5, -58, 9, 16);
  ctx.strokeRect(-4.5, -58, 9, 16);
  ctx.restore();
}

function fleche(ctx: CanvasRenderingContext2D, cible: V, tt: number): void {
  const recul = 10 + Math.sin(tt * 6) * 5;
  const depuis = { x: cible.x + (cible.x > W / 2 ? -50 : 50), y: cible.y + (cible.y > HAUT + PAGE_H / 2 ? -60 : 60) };
  const a = Math.atan2(cible.y - depuis.y, cible.x - depuis.x);
  const bout = { x: cible.x - Math.cos(a) * recul, y: cible.y - Math.sin(a) * recul };
  trait(ctx, [depuis, { x: (depuis.x + bout.x) / 2 + 8, y: (depuis.y + bout.y) / 2 }, bout], { couleur: ROUGE, epaisseur: 3, graine: 61, pate: false });
  for (const s of [-1, 1]) trait(ctx, [bout, { x: bout.x - Math.cos(a + s * 0.5) * 14, y: bout.y - Math.sin(a + s * 0.5) * 14 }], { couleur: ROUGE, epaisseur: 3, graine: 62 + s, pate: false });
}

function finTuto(ctx: CanvasRenderingContext2D, t: Tuto, actions: { finir: (rejouer: boolean) => void; page: () => void }): void {
  const y = HAUT + 150;
  ctx.fillStyle = "rgba(246,239,220,0.82)";
  ctx.fillRect(0, HAUT, W, PAGE_H);
  zone(0, HAUT, W, PAGE_H, () => {});
  feuille(ctx, 30, y, W - 60, 330, "rgba(253,250,240,0.98)", 99, 0.2);
  ecrire(ctx, "Tu sais tout !", W / 2, y + 44, { police: "titre", taille: 40 });
  paragraphe(ctx, "Petit cercle : une tour. Trait lent : un mur. Trait rapide : une rature. Grande boucle : de la colle. Sur la vraie page, ça va plus vite : bon courage !", W / 2, y + 78, W - 110, { taille: 17 });
  bouton(70, y + 186, W - 140, 56, "Commencer la page 1-1", actions.page, { principal: true, taille: 21 });
  bouton(70, y + 254, (W - 150) / 2, 46, "Rejouer", () => actions.finir(true), { taille: 18 });
  bouton(80 + (W - 150) / 2, y + 254, (W - 150) / 2, 46, "Menu", () => actions.finir(false), { taille: 18 });
  bille(ctx, W - 70, y - 4, 90, t.temps, { joie: true });
}
