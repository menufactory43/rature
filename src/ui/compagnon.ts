// Bille partout, comme le trombone d'Office : elle se tient dans un coin de chaque écran, commente la partie, donne des
// conseils et propose son aide quand on hésite. La toucher : une astuce. Les réglages peuvent la faire taire.
import { couper, feuille, paragraphe } from "../render/encre";
import { bille } from "../render/bille";
import { ENNEMIS } from "../sim/ennemis";
import type { Geste } from "../sim/gestures";
import type { Jeu } from "../sim/jeu";
import { reglages } from "../reglages";
import { H, W, bouton, ui, zone } from "./base";
import type { Ecran } from "./nav";

export type Humeur = "joie" | "triste" | "surprise";

interface Choix {
  texte: string;
  action: () => void;
}

interface Replique {
  texte: string;
  depuis: number;
  duree: number;
  humeur?: Humeur;
  choix?: Choix[];
}

export interface Dire {
  /** Une clé : la même réplique n'est pas redite avant `recharge` secondes (jamais plus, sans recharge). */
  cle?: string;
  recharge?: number;
  /** Une seule fois pour toujours (gardé dans le navigateur). */
  unique?: boolean;
  duree?: number;
  humeur?: Humeur;
  choix?: Choix[];
  /** Coupe la parole à la réplique en cours. */
  urgent?: boolean;
}

const etat = {
  replique: null as Replique | null,
  dernieres: new Map<string, number>(),
  /** Le conseil du moment : affiché quand elle n'a rien d'autre à dire. */
  fixe: null as string | null,
  astuce: 0,
};

const CLE_DITS = "rature.bille";
const dits = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(CLE_DITS) ?? "[]") as string[];
  } catch {
    return [];
  }
};

export const billeActive = () => reglages.bille;

/** Bille dit quelque chose ; renvoie faux si elle se tait (déjà dit, déjà en train de parler, coupée). */
export function dire(texte: string, o: Dire = {}): boolean {
  if (!reglages.bille) return false;
  const t = ui.temps;
  if (o.cle) {
    const d = etat.dernieres.get(o.cle);
    if (d !== undefined && t - d < (o.recharge ?? Infinity)) return false;
    if (o.unique && dits().includes(o.cle)) return false;
  }
  if (parle() && !o.urgent) return false;
  if (o.cle) {
    etat.dernieres.set(o.cle, t);
    if (o.unique) {
      try {
        localStorage.setItem(CLE_DITS, JSON.stringify([...dits(), o.cle]));
      } catch {
        // Navigation privée : elle le redira la prochaine fois
      }
    }
  }
  etat.replique = { texte, depuis: t, duree: o.duree ?? Math.min(9, 3 + texte.length * 0.045), humeur: o.humeur, choix: o.choix };
  return true;
}

/** Est-elle en train de dire quelque chose ? */
export function parle(): boolean {
  const r = etat.replique;
  return !!r && ui.temps - r.depuis < r.duree;
}

export function taire(): void {
  etat.replique = null;
}

/** Le conseil qui reste affiché tant qu'il vaut (null : plus rien). */
export function conseil(texte: string | null): void {
  etat.fixe = texte;
}

const ASTUCES = [
  "Un PETIT cercle pose une Plume. Les autres tours ont chacune leur symbole : un triangle, un éclair…",
  "Un mur rallonge le chemin de la horde : plus il est long, plus tes tours ont le temps de tirer.",
  "Appelle la vague suivante plus tôt : chaque seconde gagnée rapporte de l'encre.",
  "Une rature dans le vide, c'est de l'encre perdue. Vise bien !",
  "La colle ralentit tout ce qui passe dedans… sauf ce qui vole.",
  "Touche une tour pour l'améliorer, la spécialiser ou la vendre.",
  "Si tu enfermes complètement la horde, elle s'attaque à tes tours. Laisse-lui un passage !",
  "Trois étoiles si tu gardes presque toutes tes vies. Elles se changent en bons points dans les Talents.",
  "Trop lent ? Le bouton ×1, en haut à droite, accélère la partie.",
  "Les fautes rongent les murs. Les avions de dictée passent par-dessus. Les ratures les arrêtent tous.",
  "Les voleurs repartent avec tes vies : rature-les avant qu'ils sortent, et elles reviennent.",
  "Dans la Trousse, tu peux redessiner tes tours à ta main.",
];

/** L'astuce suivante, chacune son tour. */
export function astuceSuivante(): string {
  return ASTUCES[etat.astuce++ % ASTUCES.length];
}

/** Une astuce qui ne change pas tant que la graine ne change pas (pour la pause). */
export const astuceDe = (graine: number) => ASTUCES[Math.abs(Math.round(graine)) % ASTUCES.length];

const ON_DIRAIT = "On dirait que tu essaies de ";

/** Toucher Bille : une astuce, et de quoi revoir le tutoriel. */
export function toucherBille(tuto?: () => void): void {
  if (!reglages.bille) return;
  dire(astuceSuivante(), { urgent: true, choix: tuto ? [{ texte: "Revoir le tutoriel", action: tuto }, { texte: "Merci !", action: taire }] : undefined });
}

// --- Le dessin ---

export interface Place {
  /** La pointe de Bille, et sa hauteur. */
  x: number;
  y: number;
  h: number;
  /** La bulle, si elle ne se met pas au-dessus de Bille : son coin haut-gauche et sa largeur. */
  bulle?: { x: number; y: number; w: number };
  /** Ce que fait un toucher sur elle. */
  touche?: () => void;
  /** Rien dans la bulle (on dessine par-dessus). */
  muette?: boolean;
  /** Une réplique imposée, qui passe avant tout le reste. */
  texte?: string;
  /** Dessinée même quand les réglages l'ont fait taire (le titre, sans bulle). */
  toujours?: boolean;
  humeur?: Humeur;
  montre?: { x: number; y: number };
  alpha?: number;
}

export function dessinerCompagnon(ctx: CanvasRenderingContext2D, pl: Place): void {
  const active = reglages.bille;
  if (!active && !pl.toujours) return;
  const t = ui.temps;
  const r = parle() ? etat.replique : null;
  const texte = active && !pl.muette ? pl.texte ?? r?.texte ?? etat.fixe : null;
  const humeur = pl.humeur ?? r?.humeur;
  ctx.save();
  ctx.globalAlpha = pl.alpha ?? 1;
  const depuis = r && !pl.texte ? t - r.depuis : 9;
  const salue = !texte && t % 7 < 1.1;
  bille(ctx, pl.x, pl.y, pl.h, t, {
    joie: humeur === "joie" ? depuis < 2 : salue,
    triste: humeur === "triste",
    surprise: humeur === "surprise" && depuis < 2.5,
    parle: !!texte && depuis < 2.5,
    montre: pl.montre,
    regard: 0.6,
  });
  if (pl.touche) zone(pl.x - pl.h * 0.3, pl.y - pl.h * 1.1, pl.h * 0.6, pl.h * 1.1, pl.touche);
  if (texte) bulle(ctx, pl, texte, r && !pl.texte ? r : null);
  ctx.restore();
}

/** La bulle : un bout de papier, sa queue vers la tête de Bille, et des choix s'il y en a. */
function bulle(ctx: CanvasRenderingContext2D, pl: Place, texte: string, r: Replique | null): void {
  const taille = pl.h > 80 ? 16 : 15;
  const choix = r?.choix ?? [];
  const w = pl.bulle?.w ?? Math.min(W - 12 - (pl.x + pl.h * 0.15), 300);
  const lignes = couper(ctx, texte, w - 20, { taille });
  const h = lignes.length * taille * 1.2 + 18 + (choix.length ? 38 : 0);
  const x = pl.bulle?.x ?? pl.x + pl.h * 0.15;
  const y = pl.bulle?.y ?? pl.y - pl.h * 1.12 - 14 - h;
  // Elle apparaît d'un coup, et s'efface à la fin
  const age = r ? ui.temps - r.depuis : 9;
  const fin = r ? r.duree - age : 9;
  ctx.save();
  ctx.globalAlpha *= Math.min(1, age / 0.15, fin / 0.35);
  const tete = { x: pl.x + pl.h * 0.08, y: pl.y - pl.h * 1.02 };
  // La queue part du bord de la bulle le plus proche de la tête
  const bas = tete.y > y + h / 2;
  const qx = Math.max(x + 18, Math.min(x + w - 18, tete.x + 16));
  const qy = bas ? y + h - 2 : y + 2;
  ctx.fillStyle = "rgba(253,250,240,0.97)";
  ctx.strokeStyle = "rgba(60,60,80,0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(qx - 9, qy);
  ctx.lineTo(tete.x + (bas ? 6 : 10), tete.y + (bas ? -4 : 4));
  ctx.lineTo(qx + 7, qy);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  feuille(ctx, x, y, w, h, "rgba(253,250,240,0.97)", 300 + Math.round(x), 0.16);
  // Recouvre le pied de la queue, pour qu'elle sorte du papier
  ctx.beginPath();
  ctx.moveTo(qx - 8, qy + (bas ? -3 : 3));
  ctx.lineTo(qx + 6, qy + (bas ? -3 : 3));
  ctx.lineTo(qx, qy + (bas ? 4 : -4));
  ctx.closePath();
  ctx.fill();
  paragraphe(ctx, texte, x + 10, y + 9, w - 20, { align: "left", taille, couleur: "#2a2a35" });
  const lc = choix.length ? (w - 20 - (choix.length - 1) * 8) / choix.length : 0;
  choix.forEach((c, i) =>
    bouton(x + 10 + i * (lc + 8), y + h - 36, lc, 28, c.texte, () => {
      taire();
      c.action();
    }, { taille: 14, principal: i === 0 }),
  );
  ctx.restore();
}

// --- Les menus ---

type EcranMenu = Exclude<Ecran, "partie">;

const INTROS: Partial<Record<EcranMenu, [string, Humeur?]>> = {
  campagne: ["Chaque page gagnée ouvre la suivante. Trois étoiles si tu ne perds presque aucune vie !"],
  talents: ["Chaque étoile te donne un bon point. Place-les ici : ils valent pour toutes les pages."],
  trousse: ["Repasse le pochoir d'une tour : ton dessin deviendra son apparence en jeu. Applique-toi !"],
  reglages: ["Si je parle trop, tu peux me faire taire ici. Mais je serai triste.", "triste"],
  aide: ["Tout est écrit là. Si tu préfères que je te montre, touche « Le tutoriel »."],
  coop: ["À deux, c'est mieux ! Un seul pot d'encre pour deux stylos : partagez bien.", "joie"],
};

/** Où se tient Bille sur chaque écran : dans un coin libre. */
const PLACES: Partial<Record<EcranMenu, Omit<Place, "touche">>> = {
  campagne: { x: 22, y: 772, h: 58 },
  aide: { x: W / 2, y: H - 18, h: 48 },
};

let ecranAvant = "";
let calmeDepuis = 0;

/** Bille sur un écran de menu (appelée après le dessin de l'écran, dans ses coordonnées). */
export function compagnonMenu(ctx: CanvasRenderingContext2D, ecran: Ecran, tuto: () => void): void {
  if (ecran === "partie") return;
  if (ecran !== ecranAvant) {
    ecranAvant = ecran;
    calmeDepuis = ui.temps;
    taire();
    etat.fixe = null;
    const intro = INTROS[ecran];
    if (intro) dire(intro[0], { cle: "intro-" + ecran, unique: true, humeur: intro[1], duree: 7 });
  }
  if (ecran === "titre") return;
  const pl = PLACES[ecran] ?? { x: 36, y: H - 18, h: 62 };
  dessinerCompagnon(ctx, { ...pl, touche: () => toucherBille(tuto) });
}

/** Le titre : Bille en grand à côté du nom du jeu ; la première fois, elle propose le tutoriel. */
export function compagnonTitre(ctx: CanvasRenderingContext2D, tutoVu: boolean, tuto: () => void): void {
  if (ecranAvant !== "titre") compagnonMenu(ctx, "titre", tuto);
  const t = ui.temps;
  if (tutoVu && t - calmeDepuis > 25)
    dire(ON_DIRAIT + "jouer à un jeu. Veux-tu de l'aide ?", {
      cle: "titre-aide", duree: 12, choix: [{ texte: "Oui, montre-moi", action: tuto }, { texte: "Non merci", action: taire }],
    });
  const premiere = !tutoVu && t > 1.2 ? "Première fois ? Touche-moi : je t'explique tout, tout doucement." : undefined;
  dessinerCompagnon(ctx, {
    x: 44, y: 252, h: 92, bulle: { x: 74, y: 24, w: W - 148 }, toujours: true, texte: parle() ? undefined : premiere,
    touche: () => (tutoVu && reglages.bille ? dire("Besoin d'aide ?", { urgent: true, duree: 10, choix: [{ texte: "Le tutoriel", action: tuto }, { texte: "Une astuce", action: () => dire(astuceSuivante(), { urgent: true }) }] }) : tuto()),
  });
  // Toucher la bulle de la première fois lance aussi le tutoriel
  if (premiere && !parle()) zone(74, 24, W - 148, 60, tuto);
}

// --- La partie ---

export interface InfoPartie {
  mode: string;
  /** Le nom de la page, si c'en est une de la campagne jamais gagnée. */
  nouvellePage?: string;
  /** Le stylo vient de manquer d'encre. */
  sec: boolean;
  /** Combien de monstres jamais vus attendent leur post-it. */
  nouveaux: number;
  /** Un doigt dessine. */
  dessine: boolean;
  tuto: () => void;
}

interface Suivi {
  debut: number;
  fuites: number;
  tues: number;
  ratures: number;
  ratees: number;
  poses: number;
  dernierePose: number;
  bossVus: Set<string>;
  monstres: boolean;
  alerte: boolean;
  ratesDites: number;
  nouveaux: number;
}

const suivis = new WeakMap<Jeu, Suivi>();
const tirer = <T>(l: T[]) => l[Math.floor(Math.random() * l.length)];

/** Bille regarde la partie et réagit : vies perdues, belles ratures, boss, encre qui dort, hésitation. */
export function observerPartie(j: Jeu, info: InfoPartie): void {
  ecranAvant = "partie";
  if (!reglages.bille) return;
  const t = ui.temps;
  let s = suivis.get(j);
  if (!s) {
    s = { debut: t, fuites: 0, tues: 0, ratures: 0, ratees: 0, poses: 0, dernierePose: t, bossVus: new Set(), monstres: false, alerte: false, ratesDites: 0, nouveaux: 0 };
    suivis.set(j, s);
    taire();
    const accueil =
      info.mode === "interro" ? "Une interro surprise ! Pas de panique, je suis là."
      : info.mode === "jour" ? "La page du jour : la même pour tout le monde. Fais mieux que les autres !"
      : info.mode === "coop" ? "À deux, c'est mieux ! Partagez bien l'encre."
      : info.nouvellePage ? `${info.nouvellePage}. Une nouvelle page ! Prends le temps de regarder le chemin.`
      : info.mode === "sansFin" ? "Sans fin : on tient le plus longtemps possible. Courage !"
      : tirer(["On remet ça ?", "Allez, cette fois c'est la bonne.", "Je sens que ça va bien se passer."]);
    dire(accueil, { urgent: true, duree: 4.5, humeur: "joie" });
  }
  const st = j.stats;
  // Une vie perdue, ou presque plus
  if (st.fuites > s.fuites) {
    if (!s.alerte && j.vies > 0 && j.vies <= j.viesMax * 0.3) {
      s.alerte = true;
      dire(`Plus que ${j.vies} vie${j.vies > 1 ? "s" : ""} ! Rature tout ce qui approche du Cœur.`, { urgent: true, humeur: "surprise" });
    } else dire(tirer(["Aïe ! Un monstre est passé.", "Oups, il en est passé un.", "Le Cœur a pris un coup."]), { cle: "fuite", recharge: 25, humeur: "triste" });
  }
  // Une belle rature
  const tuesDuCoup = st.tues - s.tues;
  if (st.ratures > s.ratures && tuesDuCoup >= 3) dire(tuesDuCoup >= 5 ? `${tuesDuCoup} d'un coup ! Quelle rature !` : `${tuesDuCoup} d'un coup !`, { cle: "multi", recharge: 12, humeur: "joie", urgent: true });
  if (st.ratees > s.ratees && s.ratesDites < 2 && dire("Une rature dans le vide, c'est de l'encre perdue. Vise les monstres !", { cle: "rate", recharge: 40 })) s.ratesDites++;
  // Un boss
  for (const e of j.ennemis) {
    const f = ENNEMIS[e.type];
    if (e.mort || !f.boss || s.bossVus.has(e.type) || e.y < 0) continue;
    s.bossVus.add(e.type);
    dire(`Attention : ${f.nom} ! ${f.conseil}`, { urgent: true, humeur: "surprise", duree: 7 });
  }
  // Un monstre jamais vu : son post-it arrive
  if (info.nouveaux > s.nouveaux) dire("Oh, une nouvelle tête ! Lis bien le post-it.", { cle: "nouveau", recharge: 10, humeur: "surprise" });
  s.nouveaux = info.nouveaux;
  if (info.sec) dire("Plus d'encre dans le stylo ! Elle revient toute seule, et chaque monstre raturé en rapporte.", { cle: "sec", recharge: 30 });
  // L'encre qui dort
  if (st.toursPosees > s.poses) s.dernierePose = t;
  if (j.phase === "jeu" && j.encre >= 150 && t - s.dernierePose > 25) dire(`Tu as ${Math.floor(j.encre)} d'encre qui dort. Une tour de plus ?`, { cle: "encre", recharge: 50 });
  // Une vague tenue
  const vivants = j.ennemis.some((e) => !e.mort);
  if (s.monstres && !vivants && !j.file.length && j.phase === "jeu" && Math.random() < 0.5) dire(tirer(["Vague tenue !", "Et une de plus !", "Propre !"]), { cle: "vague", recharge: 30, humeur: "joie" });
  s.monstres = vivants;
  // On hésite avant la première vague
  if (j.phase === "attente" && info.mode !== "coop") {
    if (!j.tours.length && t - s.debut > 15)
      dire(ON_DIRAIT + "défendre une page. Veux-tu de l'aide ?", { cle: "hesite", duree: 14, choix: [{ texte: "Oui, le tutoriel", action: info.tuto }, { texte: "Non merci", action: taire }] });
    else if (j.tours.length && t - s.dernierePose > 20) dire("Quand tu es prêt, touche « Go ! ». Je ne regarde pas.", { cle: "go", recharge: 60 });
  }
  s.fuites = st.fuites;
  s.tues = st.tues;
  s.ratures = st.ratures;
  s.ratees = st.ratees;
  s.poses = st.toursPosees;
}

/** Un geste refusé : elle explique, façon trombone. */
export function refusBille(geste: Geste, raison: string): void {
  const quoi: Record<Geste, string> = { tour: "poser une tour", mur: "tracer un mur", rature: "raturer", cercle: "poser de la colle", rien: "dessiner" };
  dire(`${ON_DIRAIT}${quoi[geste]}… mais ${raison}.`, { cle: "refus", recharge: 8, urgent: true });
}

/** Où elle se tient pendant la partie : dans la marge, en bas de la page. */
export function placeEnPartie(haut: number, pageH: number): { x: number; y: number; h: number } {
  return { x: 24, y: haut + pageH - 6, h: 54 };
}
