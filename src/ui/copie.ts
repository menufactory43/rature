// La copie corrigée : à la fin d'une page, la prof rend la page elle-même, annotée au stylo rouge. La note sur 20, le
// meilleur trait entouré (« Bien vu ! »), la tour qui a le mieux travaillé, l'endroit où les mots sont passés
// (« Attention ! ») ou un « Rien n'est passé ! » à côté du Cœur, et son mot en bas de la page. Les annotations
// arrivent l'une après l'autre ; la même copie, figée, sert d'image à partager.
import { CRAYON, ROUGE, cercle, ecrire, trait } from "../render/encre";
import { papier } from "../render/papier";
import { decor, scene } from "../render/scene";
import type { V } from "../sim/geom";
import type { Jeu } from "../sim/jeu";
import { statsTour, PORTEE_INFINIE } from "../sim/tours";
import { natif } from "../natif";
import { t } from "../i18n";
import { PAGE_H, W } from "./base";

/** Ce que la prof écrit : à quoi ça se rapporte, et où elle a posé son texte (tx, ty : le milieu du texte). */
export type Annotation = { tx: number; ty: number } & (
  | { k: "note"; texte: string }
  | { k: "trait"; pts: V[]; n: number }
  | { k: "tour"; x: number; y: number; n: number }
  | { k: "attention"; x: number; y: number; vies: number }
  | { k: "coeur"; x: number; y: number }
  | { k: "mot"; texte: string }
);

/** La taille des textes de la copie, et leur largeur à peu près (l'écriture Caveat, en gras). */
const TAILLES = { note: 36, trait: 23, tour: 21, attention: 23, coeur: 24, mot: 30 } as const;
const largeur = (texte: string, taille: number) => texte.length * taille * 0.42 + 10;

/** Une demi-note, à la française : « 15,5 ». */
export const afficherNote = (n: number, anglais = false) => (Number.isInteger(n) ? String(n) : anglais ? n.toFixed(1) : n.toFixed(1).replace(".", ","));

/**
 * La note de la copie, au demi-point. Gagnée : 10 points pour la page, jusqu'à 8 pour les vies gardées, 2 pour la
 * précision des ratures (1 si on n'en a fait aucune). Perdue : la part de la page tenue, sur 10.
 */
export function noteSur20(j: Jeu): number {
  const total = Number.isFinite(j.regles.total) ? j.regles.total : Math.max(1, j.vague);
  const precision = j.stats.ratures ? (j.stats.ratures - j.stats.ratees) / j.stats.ratures : 0.5;
  const n = j.phase === "gagne"
    ? 10 + 8 * (j.vies / Math.max(1, j.viesMax)) + 2 * precision
    : 10 * Math.max(0, j.vague - 1) / total;
  return Math.max(0, Math.min(20, Math.round(n * 2) / 2));
}

/** L'endroit du chemin le moins gardé : là où le trajet d'une entrée est le plus loin de la portée des tours. */
function pointFaible(j: Jeu, entree: number): V | null {
  const chemin = j.trajets[entree];
  if (!chemin || chemin.length < 6) return null;
  let best: V | null = null;
  let bs = -Infinity;
  // On laisse de côté le début (hors de la page) et la fin (le Cœur lui-même)
  for (let i = Math.floor(chemin.length * 0.15); i < Math.floor(chemin.length * 0.85); i++) {
    const q = chemin[i];
    if (q.y < 30 || q.y > PAGE_H - 30 || q.x < 20 || q.x > W - 20) continue;
    let garde = 0;
    for (const to of j.tours) {
      const p = statsTour(to.type, to.niveau, to.spec).portee;
      if (!p || p >= PORTEE_INFINIE) continue;
      const d = Math.hypot(to.x - q.x, to.y - q.y);
      if (d < p) garde += 1 - d / p;
    }
    if (-garde > bs) {
      bs = -garde;
      best = q;
    }
  }
  return best;
}

/** Les textes de chaque annotation (ceux qu'on écrit, pour mesurer la place qu'ils prennent). */
export function texteDe(n: Annotation): string {
  switch (n.k) {
    case "note": case "mot": return n.texte;
    case "trait": return t("Bien vu ! {n} mots d'un trait", { n: n.n });
    case "tour": return t("Bravo : {n} mots", { n: n.n });
    case "attention": return t("Attention ! ça passe ici");
    case "coeur": return t("Rien n'est passé !");
  }
}

/** Ce que la prof écrit sur la page, dans l'ordre où elle l'écrit ; chaque texte est posé là où il ne gêne aucun autre. */
export function annoter(j: Jeu, note: number | null, motProf: string, anglais = false): Annotation[] {
  type Brouillon = Annotation extends infer A ? (A extends Annotation ? Omit<A, "tx" | "ty"> & { vx: number; vy: number } : never) : never;
  const l: Brouillon[] = [];
  const coeur = j.carte.coeur;
  // La note, en haut de la page, du côté opposé au Cœur
  if (note !== null) {
    const texte = `${afficherNote(note, anglais)}/20`;
    l.push({ k: "note", texte, vx: coeur.x > W / 2 ? 84 : W - 84, vy: coeur.y < 140 ? PAGE_H - 110 : 64 });
  }
  // Le mot de la prof, en bas de la page (un peu plus haut si le Cœur y est)
  l.push({ k: "mot", texte: motProf, vx: W / 2, vy: PAGE_H - 60 });
  if (j.stats.meilleurTrait >= 2 && j.stats.meilleurTraitPts) {
    const pts = j.stats.meilleurTraitPts;
    const m = pts[Math.floor(pts.length / 2)];
    l.push({ k: "trait", pts, n: j.stats.meilleurTrait, vx: m.x, vy: m.y - 34 });
  }
  const meilleure = [...j.tours].sort((x, y) => (y.tues ?? 0) - (x.tues ?? 0))[0];
  if (meilleure && (meilleure.tues ?? 0) >= 3) l.push({ k: "tour", x: meilleure.x, y: meilleure.y, n: meilleure.tues ?? 0, vx: meilleure.x, vy: meilleure.y + 40 });
  if (j.stats.fuites > 0 && j.stats.passages.length) {
    // L'entrée par où il en est passé le plus
    const parEntree = new Map<number, number>();
    for (const p of j.stats.passages) parEntree.set(p.entree, (parEntree.get(p.entree) ?? 0) + p.vies);
    const [entree, vies] = [...parEntree.entries()].sort((x, y) => y[1] - x[1])[0];
    const q = pointFaible(j, entree);
    if (q) l.push({ k: "attention", x: q.x, y: q.y, vies: Math.min(vies, j.stats.fuites), vx: q.x + (q.x > W / 2 ? -80 : 80), vy: q.y - 64 });
  } else if (j.phase === "gagne") l.push({ k: "coeur", x: coeur.x, y: coeur.y, vx: coeur.x, vy: coeur.y + (coeur.y > PAGE_H - 80 ? -46 : 44) });

  // On pose les textes un à un : à l'endroit voulu si c'est libre, sinon un peu plus haut ou plus bas
  const pris: { x: number; y: number; w: number; h: number }[] = [];
  // Le Cœur et la tour entourée ne se recouvrent pas non plus
  pris.push({ x: coeur.x - 22, y: coeur.y - 22, w: 44, h: 44 });
  for (const n of l) if (n.k === "tour" || n.k === "attention") pris.push({ x: n.x - 26, y: n.y - 26, w: 52, h: 52 });
  const chevauche = (r: { x: number; y: number; w: number; h: number }) => pris.some((o) => r.x < o.x + o.w && o.x < r.x + r.w && r.y < o.y + o.h && o.y < r.y + r.h);
  const poses: Annotation[] = [];
  for (const n of l) {
    const taille = TAILLES[n.k];
    const w = Math.min(W - 16, largeur(texteDe({ ...n, tx: 0, ty: 0 } as unknown as Annotation), taille) + (n.k === "note" ? 40 : 0));
    const h = taille * (n.k === "note" ? 2.6 : n.k === "attention" ? 2.1 : 1.2);
    let best = { x: n.vx, y: n.vy };
    for (const dy of [0, -36, 36, -72, 72, -108, 108, -144, 144, 180, -180]) {
      const x = Math.max(w / 2 + 8, Math.min(W - w / 2 - 8, n.vx));
      const y = Math.max(h / 2 + 6, Math.min(PAGE_H - h / 2 - 6, n.vy + dy));
      if (!chevauche({ x: x - w / 2, y: y - h / 2, w, h })) {
        best = { x, y };
        break;
      }
      if (dy === 0) best = { x, y };
    }
    pris.push({ x: best.x - w / 2, y: best.y - h / 2, w, h });
    const { vx: _vx, vy: _vy, ...reste } = n;
    poses.push({ ...reste, tx: best.x, ty: best.y } as unknown as Annotation);
  }
  // Dans l'ordre où la prof les écrit : la note, ce qui est bien, ce qui ne va pas, puis son mot
  const ordre = { note: 0, trait: 1, tour: 2, coeur: 3, attention: 4, mot: 5 };
  return poses.sort((x, y) => ordre[x.k] - ordre[y.k]);
}

/** Combien de temps la prof met à tout écrire (secondes). */
export const DEBUT_COPIE = 0.5;
export const ENTRE_ANNOTATIONS = 0.55;
export const dureeCopie = (a: Annotation[]) => DEBUT_COPIE + a.length * ENTRE_ANNOTATIONS + 0.4;

/** Une flèche au stylo rouge, un peu courbe, de a vers b. */
function fleche(ctx: CanvasRenderingContext2D, a: V, b: V, graine: number, alpha: number): void {
  const m = { x: (a.x + b.x) / 2 + (b.y - a.y) * 0.15, y: (a.y + b.y) / 2 - (b.x - a.x) * 0.15 };
  const pts: V[] = [];
  for (let i = 0; i <= 10; i++) {
    const u = i / 10;
    pts.push({ x: (1 - u) * (1 - u) * a.x + 2 * u * (1 - u) * m.x + u * u * b.x, y: (1 - u) * (1 - u) * a.y + 2 * u * (1 - u) * m.y + u * u * b.y });
  }
  trait(ctx, pts, { couleur: ROUGE, epaisseur: 2, graine, alpha });
  const fin = pts[pts.length - 1];
  const av = pts[pts.length - 3];
  const ang = Math.atan2(fin.y - av.y, fin.x - av.x);
  for (const s of [-1, 1]) trait(ctx, [fin, { x: fin.x - Math.cos(ang + s * 0.5) * 10, y: fin.y - Math.sin(ang + s * 0.5) * 10 }], { couleur: ROUGE, epaisseur: 2, graine: graine + 3 + s, alpha, pate: false });
}

/**
 * Les annotations, dans le repère de la page (0, 0 en haut à gauche de la carte). `tm` : secondes depuis la fin ;
 * chaque annotation s'écrit à son tour (Infinity : tout est déjà écrit).
 */
export function dessinerAnnotations(ctx: CanvasRenderingContext2D, a: Annotation[], tm: number): void {
  a.forEach((n, i) => {
    const age = tm - DEBUT_COPIE - i * ENTRE_ANNOTATIONS;
    if (age < 0) return;
    const al = Math.min(1, age * 4);
    // Le stylo avance : les traits se dévoilent en 0,35 s
    const u = Math.min(1, age / 0.35);
    const g = 900 + i * 17;
    const texte = texteDe(n);
    const taille = TAILLES[n.k];
    switch (n.k) {
      case "note": {
        const s = 1 + Math.max(0, 1 - age / 0.15) * 0.8;
        ctx.save();
        ctx.translate(n.tx, n.ty);
        ctx.scale(s, s);
        ecrire(ctx, texte, 0, 0, { police: "titre", taille, couleur: ROUGE, rotation: -0.08, alpha: al });
        ctx.restore();
        if (u > 0.3) {
          const r = largeur(texte, taille) / 2 + 8;
          cercle(ctx, n.tx, n.ty, r, { couleur: ROUGE, epaisseur: 2.4, graine: g, alpha: al });
          cercle(ctx, n.tx + 3, n.ty - 2, r + 4, { couleur: ROUGE, epaisseur: 1.1, graine: g + 1, alpha: al * 0.7 });
        }
        return;
      }
      case "trait": {
        const k = Math.max(2, Math.ceil(n.pts.length * u));
        trait(ctx, n.pts.slice(0, k), { couleur: ROUGE, epaisseur: 3, graine: g, alpha: 0.75 * al });
        break;
      }
      case "tour":
        cercle(ctx, n.x, n.y, 24, { couleur: ROUGE, epaisseur: 2, graine: g, alpha: al });
        break;
      case "attention":
        if (u > 0.2) fleche(ctx, { x: n.tx, y: n.ty + (n.ty < n.y ? 16 : -16) }, { x: n.x, y: n.y + (n.ty < n.y ? -14 : 14) }, g, al);
        ecrire(ctx, t(n.vies > 1 ? "−{n} vies" : "−{n} vie", { n: n.vies }), n.tx, n.ty - 22, { taille: 15, couleur: ROUGE, alpha: al });
        // Le point faible, entouré
        cercle(ctx, n.x, n.y, 16, { couleur: ROUGE, epaisseur: 1.8, graine: g + 7, alpha: al });
        break;
      case "mot": {
        const lm = largeur(texte, taille) - 10;
        trait(ctx, [{ x: n.tx - lm / 2, y: n.ty + 18 }, { x: n.tx - lm / 2 + lm * u, y: n.ty + 14 }], { couleur: ROUGE, epaisseur: 1.6, graine: g, alpha: al });
        break;
      }
      case "coeur":
        break;
    }
    ecrire(ctx, texte, n.tx, n.ty, { police: "titre", taille, couleur: ROUGE, rotation: n.k === "tour" ? 0.04 : -0.05, alpha: al });
  });
}

/** La copie en image : la page telle qu'on l'a laissée, toutes les annotations écrites, et un titre en haut. */
export function imageCopie(j: Jeu, a: Annotation[], titre: string): HTMLCanvasElement {
  const k = 2;
  const haut = 54;
  const c = document.createElement("canvas");
  c.width = W * k;
  c.height = (PAGE_H + haut) * k;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(papier(W, PAGE_H + haut, k, j.carte.papier, haut), 0, 0, W * k, (PAGE_H + haut) * k);
  ctx.setTransform(k, 0, 0, k, 0, 0);
  ecrire(ctx, titre, 16, haut / 2, { police: "titre", taille: 26, align: "left" });
  ecrire(ctx, "Rature", W - 16, haut / 2, { police: "titre", taille: 22, align: "right", couleur: CRAYON });
  ctx.translate(0, haut);
  decor(ctx, j.carte);
  scene(ctx, j, null, null);
  dessinerAnnotations(ctx, a, Infinity);
  return c;
}


/** L'adresse publique du jeu : celle de la page dans le navigateur, celle du site depuis l'app. */
export const ADRESSE_PUBLIQUE = "https://menufactory43.github.io/rature/";
export const adresseJeu = () => (natif || typeof location === "undefined" || !location.protocol.startsWith("http") ? ADRESSE_PUBLIQUE : `${location.origin}${location.pathname}`);

export interface Defi {
  page: string;
  note: number;
  tours: string[];
  pouvoir: string | null;
}

/** Le lien « Bats ma copie » : la page, la note à battre, et le cartable qu'on avait (pour jouer à armes égales). */
export function lienDefi(d: Defi): string {
  const q = new URLSearchParams({ bats: d.page, note: String(d.note), tours: d.tours.join(",") });
  if (d.pouvoir) q.set("pouvoir", d.pouvoir);
  return `${adresseJeu()}?${q.toString()}`;
}

/** Relit un lien de défi (null s'il n'y en a pas, ou s'il est abîmé). */
export function lireDefi(recherche: string): Defi | null {
  const q = new URLSearchParams(recherche);
  const page = q.get("bats");
  const note = Number(q.get("note"));
  if (!page || !/^\d-\d$/.test(page) || !Number.isFinite(note)) return null;
  const tours = (q.get("tours") ?? "").split(",").filter(Boolean);
  return { page, note: Math.max(0, Math.min(20, note)), tours, pouvoir: q.get("pouvoir") };
}

/** Partager la copie (et le défi) par la feuille de partage du système ; sinon, télécharger l'image. */
export async function partager(image: HTMLCanvasElement, texte: string, url?: string): Promise<void> {
  const blob = await new Promise<Blob | null>((ok) => image.toBlob(ok, "image/png"));
  const nav2 = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (blob) {
    const fichier = new File([blob], "ma-copie-rature.png", { type: "image/png" });
    const donnees: ShareData = { files: [fichier], text: url ? `${texte} ${url}` : texte };
    if (nav2.share && (!nav2.canShare || nav2.canShare(donnees))) {
      await nav2.share(donnees).catch(() => {});
      return;
    }
  }
  if (nav2.share && url) {
    await nav2.share({ text: texte, url }).catch(() => {});
    return;
  }
  const a = document.createElement("a");
  a.href = image.toDataURL("image/png");
  a.download = "ma-copie-rature.png";
  a.click();
}
