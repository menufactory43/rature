// Rature : la boucle du jeu, les écrans (titre, aide, page, pause, bulletin) et le doigt-stylo.
import "@fontsource/caveat/700.css";
import "@fontsource/patrick-hand/400.css";
import "./style.css";
import * as audio from "./audio";
import { BLEU, CRAYON, PAPIER, ROUGE, cercle, ecrire, paragraphe, rectangle, regler, trait } from "./render/encre";
import { fleches, monstre, papier, scene, tour, type Brouillon } from "./render/dessin";
import { AMELIORATIONS, type IdAmelioration } from "./sim/ameliorations";
import { ENNEMIS, type TypeEnnemi } from "./sim/ennemis";
import { polylineLength, truncate } from "./sim/geom";
import { classer, type Pt } from "./sim/gestures";
import { appliquerTrace, choisir, coutParPx, coutRature, HAUTEUR, LARGEUR, lancer, longueurPossible, note, nouveauJeu, step, vaguesTenues, type Jeu } from "./sim/jeu";
import { DERNIERE_VAGUE, planifier, resume, type PlanVague } from "./sim/vagues";
import { enregistrer, grainePageDuJour, marquerTutoVu, meilleur, tutoVu } from "./sauvegarde";

const W = LARGEUR;
/** La page fait 720 de haut ; 60 au-dessus pour le bandeau, 60 en dessous pour l'encre. */
const HAUT = 60;
const H = HAUTEUR + 120;

type Ecran = "titre" | "aide" | "jeu" | "pause" | "fin";

interface Bouton {
  x: number;
  y: number;
  w: number;
  h: number;
  action: () => void;
}

const canvas = document.getElementById("jeu") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
let echelle = 1;
let ox = 0;
let oy = 0;
let dpr = 1;
let fond: HTMLCanvasElement | null = null;

let ecran: Ecran = "titre";
let jeu: Jeu | null = null;
let cleRecord = "";
let libelle = "";
let finDepuis = 0;
let record = false;
let boutons: Bouton[] = [];
let temps = 0;

// Le trait en cours
let trace: Pt[] | null = null;
let doigt: number | null = null;
let sec = false;

// Le tuto, la première fois : mur, puis rature, puis colle
let tuto = tutoVu() ? 3 : 0;

function redimensionner(): void {
  dpr = Math.min(window.devicePixelRatio || 1, 3);
  const cw = window.innerWidth;
  const ch = window.innerHeight;
  canvas.width = Math.round(cw * dpr);
  canvas.height = Math.round(ch * dpr);
  echelle = Math.min(cw / W, ch / H);
  ox = (cw - W * echelle) / 2;
  oy = (ch - H * echelle) / 2;
  fond = papier(W, H, echelle * dpr);
}

function versPage(e: PointerEvent): { x: number; y: number } {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left - ox) / echelle, y: (e.clientY - r.top - oy) / echelle };
}

function demarrer(graine: string, cle: string, nom: string): void {
  jeu = nouveauJeu(graine);
  cleRecord = cle;
  libelle = nom;
  ecran = "jeu";
  record = false;
  trace = null;
  audio.jouer(["page"]);
}

const pageDuJour = () => {
  const g = grainePageDuJour();
  demarrer("jour-" + g, "jour-" + g, "Page du " + g.split("-").reverse().slice(0, 2).join("/"));
};
const pageLibre = () => demarrer("libre-" + Math.floor(Math.random() * 1e9), "libre", "Page libre");

// --- Le doigt ---

canvas.addEventListener("pointerdown", (e) => {
  audio.deverrouiller();
  const p = versPage(e);
  for (let i = boutons.length - 1; i >= 0; i--) {
    const b = boutons[i];
    if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) {
      b.action();
      return;
    }
  }
  if (ecran !== "jeu" || !jeu || doigt !== null) return;
  if (jeu.phase !== "prep" && jeu.phase !== "vague") return;
  if (p.y < HAUT || p.y > HAUT + HAUTEUR) return;
  doigt = e.pointerId;
  canvas.setPointerCapture(e.pointerId);
  trace = [{ x: p.x, y: p.y - HAUT, t: e.timeStamp }];
  sec = false;
});

canvas.addEventListener("pointermove", (e) => {
  if (e.pointerId !== doigt || !trace || !jeu) return;
  const evts = e.getCoalescedEvents?.() ?? [e];
  for (const ev of evts.length ? evts : [e]) {
    if (sec) break;
    const p = versPage(ev);
    const pt = { x: p.x, y: p.y - HAUT, t: ev.timeStamp };
    const dernier = trace[trace.length - 1];
    if (Math.hypot(pt.x - dernier.x, pt.y - dernier.y) < 2) continue;
    trace.push(pt);
    // Le stylo sèche : le trait s'arrête là où l'encre manque
    const possible = longueurPossible(jeu);
    if (polylineLength(trace) > possible) {
      trace = truncate(trace, possible).map((q, i) => ({ ...q, t: trace![Math.min(i, trace!.length - 1)].t }));
      sec = true;
    }
  }
  const n = trace.length;
  if (n > 2) {
    const a = trace[Math.max(0, n - 4)];
    const b = trace[n - 1];
    audio.gratter(Math.hypot(b.x - a.x, b.y - a.y) / Math.max(1, b.t - a.t));
  }
});

function lever(e: PointerEvent): void {
  if (e.pointerId !== doigt) return;
  doigt = null;
  audio.gratter(0);
  if (!trace || !jeu) return;
  const r = appliquerTrace(jeu, trace);
  trace = null;
  if (!r.ok) return;
  if (tuto === 0 && r.geste === "mur") tuto = 1;
  else if (tuto === 1 && r.geste === "rature" && r.touches > 0) tuto = 2;
  else if (tuto === 2 && r.geste === "cercle") {
    tuto = 3;
    marquerTutoVu();
  }
}
canvas.addEventListener("pointerup", lever);
canvas.addEventListener("pointercancel", lever);

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" || e.key === " ") {
    if (ecran === "jeu") ecran = "pause";
    else if (ecran === "pause") ecran = "jeu";
  }
});
window.addEventListener("blur", () => {
  if (ecran === "jeu" && jeu && (jeu.phase === "vague" || jeu.phase === "prep")) ecran = "pause";
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && ecran === "jeu") ecran = "pause";
});
window.addEventListener("resize", redimensionner);

// --- Les éléments d'interface ---

function bouton(x: number, y: number, w: number, h: number, texte: string, action: () => void, o: { principal?: boolean; taille?: number; sous?: string } = {}): void {
  const couleur = o.principal ? ROUGE : BLEU;
  rectangle(ctx, x, y, w, h, { couleur, epaisseur: o.principal ? 2.4 : 1.8, graine: Math.round(x * 7 + y), fond: "rgba(246,239,220,0.92)" });
  if (o.sous) {
    ecrire(ctx, texte, x + w / 2, y + h / 2 - 8, { couleur, taille: o.taille ?? 22 });
    ecrire(ctx, o.sous, x + w / 2, y + h / 2 + 13, { couleur: CRAYON, taille: 13 });
  } else ecrire(ctx, texte, x + w / 2, y + h / 2 + 1, { couleur, taille: o.taille ?? 22 });
  boutons.push({ x, y, w, h, action });
}

function voile(alpha = 0.82): void {
  ctx.fillStyle = `rgba(246,239,220,${alpha})`;
  ctx.fillRect(0, 0, W, H);
}

function souligner(x: number, y: number, w: number, graine: number): void {
  trait(ctx, [{ x: x - w / 2, y }, { x: x, y: y + 3 }, { x: x + w / 2, y: y - 1 }], { couleur: ROUGE, epaisseur: 2.2, graine });
}

function boutonSon(x: number, y: number): void {
  bouton(x, y, 40, 32, audio.actif ? "♪" : "×♪", () => audio.basculer(), { taille: 18 });
}

// --- Les écrans ---

function dessinerTitre(): void {
  ecrire(ctx, "Rature", W / 2, 150, { police: "titre", taille: 96 });
  souligner(W / 2, 200, 220, 2);
  ecrire(ctx, "un tower defense au stylo bille", W / 2, 232, { couleur: CRAYON, taille: 18 });
  // Une petite scène : la tour et quelques monstres qui tournent autour
  const cx = W / 2;
  const cy = 360;
  tour(ctx, cx, cy, temps * 0.8, temps, null);
  const types: TypeEnnemi[] = ["gribouille", "carre", "avion", "araignee", "tache", "gomme"];
  types.forEach((t, i) => {
    const a = temps * 0.25 + (i / types.length) * Math.PI * 2;
    const x = cx + Math.cos(a) * 110;
    const y = cy + Math.sin(a) * 70;
    monstre(ctx, t, x, y, ENNEMIS[t].rayon, i + 1, temps, ROUGE, a + Math.PI / 2);
  });
  const jour = grainePageDuJour();
  const mj = meilleur("jour-" + jour);
  const ml = meilleur("libre");
  bouton(60, 480, 280, 64, "Page du jour", pageDuJour, { principal: true, sous: mj ? `record : vague ${mj.vagues} · ${mj.note}/20` : "la même page pour tout le monde" });
  bouton(60, 560, 280, 64, "Page libre", pageLibre, { sous: ml ? `record : vague ${ml.vagues} · ${ml.note}/20` : "une page au hasard" });
  bouton(60, 640, 280, 50, "Comment jouer", () => (ecran = "aide"));
  boutonSon(W - 54, 14);
  paragraphe(ctx, `${DERNIERE_VAGUE} vagues par page. Une seule tour. Pas de seconde chance.`, W / 2, 730, 300, { couleur: CRAYON, taille: 15 });
}

function demoGeste(geste: "mur" | "rature" | "cercle", x: number, y: number): void {
  // Le stylo refait le geste en boucle
  const cycle = geste === "mur" ? 2.2 : geste === "rature" ? 1.4 : 2.2;
  const t = (temps % cycle) / cycle;
  const dessin = geste === "rature" ? Math.min(1, t * 5) : Math.min(1, t * 1.6);
  const pts = [];
  const n = 24;
  for (let i = 0; i <= n * dessin; i++) {
    const k = i / n;
    if (geste === "cercle") pts.push({ x: x + Math.cos(k * Math.PI * 2 - 1.2) * 26, y: y + Math.sin(k * Math.PI * 2 - 1.2) * 20 });
    else if (geste === "mur") pts.push({ x: x - 34 + k * 68, y: y + Math.sin(k * 3) * 8 });
    else pts.push({ x: x - 34 + k * 68, y: y + 10 - k * 20 });
  }
  if (geste === "rature") monstre(ctx, "gribouille", x, y, 10, 1, temps);
  if (geste === "cercle") {
    monstre(ctx, "gribouille", x - 8, y - 4, 7, 2, temps);
    monstre(ctx, "araignee", x + 9, y + 5, 6, 3, temps);
  }
  if (geste === "mur") monstre(ctx, "gribouille", x, y - 22, 8, 4, temps);
  trait(ctx, pts, { epaisseur: geste === "mur" ? 3.5 : 2.4, graine: 9 });
}

function dessinerAide(): void {
  ecrire(ctx, "Comment jouer", W / 2, 40, { police: "titre", taille: 42 });
  paragraphe(ctx, "La tour tire seule. Toi, tu dessines du doigt. Chaque trait coûte de l'encre, qui revient lentement.", W / 2, 66, 340, { couleur: CRAYON, taille: 15 });
  const gestes: ["mur" | "rature" | "cercle", string, string][] = [
    ["mur", "Trace lentement : un MUR", "La horde bute dessus et le ronge. Il sèche en 30 s."],
    ["rature", "Un trait sec : une RATURE", "Frappe tous les monstres touchés. Dans le vide, c'est de l'encre perdue."],
    ["cercle", "Une boucle : de la COLLE", "Ralentit tout ce qui est dedans (pas les avions)."],
  ];
  gestes.forEach(([g, titre, texte], i) => {
    const y = 140 + i * 78;
    demoGeste(g, 62, y + 14);
    ecrire(ctx, titre, 112, y, { align: "left", taille: 19 });
    paragraphe(ctx, texte, 112, y + 12, 270, { align: "left", couleur: CRAYON, taille: 14 });
  });
  ecrire(ctx, "Les monstres des marges", W / 2, 392, { police: "titre", taille: 28 });
  const liste: TypeEnnemi[] = ["gribouille", "carre", "avion", "araignee", "tache", "gomme", "mere", "compas"];
  liste.forEach((t, i) => {
    const y = 432 + i * 44;
    const f = ENNEMIS[t];
    monstre(ctx, t, 50, y, Math.min(14, f.rayon), i + 1, temps, ROUGE, -0.6);
    ecrire(ctx, f.nom, 82, y - 9, { align: "left", taille: 16, couleur: ROUGE });
    paragraphe(ctx, f.conseil, 82, y + 1, 300, { align: "left", couleur: CRAYON, taille: 13 });
  });
  bouton(120, 788, 160, 42, "Retour", () => (ecran = "titre"));
}

function dessinerBandeau(j: Jeu): void {
  bouton(10, 12, 40, 34, "II", () => (ecran = "pause"), { taille: 18 });
  ecrire(ctx, `vague ${j.vague}/${DERNIERE_VAGUE}`, 62, 22, { align: "left", taille: 20 });
  ecrire(ctx, libelle, W - 12, 22, { align: "right", taille: 14, couleur: CRAYON });
  // Les PV de la tour, en carreaux
  const x0 = 62;
  const w = W - x0 - 12;
  const y = 44;
  rectangle(ctx, x0, y - 5, w, 10, { epaisseur: 1.2, graine: 70, couleur: CRAYON, amp: 0.3 });
  const r = Math.max(0, j.tour.pv / j.tour.pvMax);
  const n = 30;
  for (let i = 0; i < Math.ceil(n * r); i++) {
    ctx.fillStyle = r < 0.3 ? ROUGE : BLEU;
    ctx.fillRect(x0 + 2 + (i * (w - 4)) / n, y - 3, (w - 4) / n - 1.5, 6);
  }
  ecrire(ctx, `PV ${Math.ceil(j.tour.pv)}/${j.tour.pvMax}`, W - 12, y + 12, { align: "right", taille: 11, couleur: CRAYON });
}

function dessinerEncre(j: Jeu): void {
  const y = HAUT + HAUTEUR + 26;
  const x0 = 70;
  const w = W - x0 - 16;
  ecrire(ctx, "encre", 12, y, { align: "left", taille: 18 });
  rectangle(ctx, x0, y - 9, w, 18, { epaisseur: 1.6, graine: 71, amp: 0.3 });
  const r = j.encre / j.encreMax;
  ctx.fillStyle = "rgba(34,64,143,0.75)";
  ctx.fillRect(x0 + 2, y - 7, (w - 4) * r, 14);
  // Ce que coûterait le trait en cours
  if (trace && trace.length > 1) {
    const l = polylineLength(trace);
    const g = classer([...trace, { ...trace[trace.length - 1], t: performance.now() }]);
    const cout = g === "rature" ? coutRature(j, l) : l * coutParPx(j);
    const c = Math.min(cout, j.encre) / j.encreMax;
    ctx.fillStyle = "rgba(246,239,220,0.7)";
    ctx.fillRect(x0 + 2 + (w - 4) * (r - c), y - 7, (w - 4) * c, 14);
  }
  // Une graduation tous les 25 d'encre
  for (let k = 25; k < j.encreMax; k += 25) {
    const x = x0 + 2 + ((w - 4) * k) / j.encreMax;
    trait(ctx, [{ x, y: y - 9 }, { x, y: y - 4 }], { couleur: CRAYON, epaisseur: 1, amp: 0.2 });
  }
  ecrire(ctx, `${Math.floor(j.encre)}`, x0 + w - 6, y + 1, { align: "right", taille: 13, couleur: r > 0.85 ? PAPIER : CRAYON });
}

const TUTO = [
  "Trace LENTEMENT devant les monstres : un mur.",
  "D'un trait SEC sur un monstre : une rature.",
  "Une BOUCLE autour d'un groupe : de la colle.",
];

function dessinerPage(j: Jeu): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, HAUT, W, HAUTEUR);
  ctx.clip();
  ctx.translate(0, HAUT);
  let brouillon: Brouillon | null = null;
  if (trace) brouillon = { pts: trace, geste: classer([...trace, { ...trace[trace.length - 1], t: performance.now() }]) };
  scene(ctx, j, brouillon);
  if (brouillon && trace && trace.length > 3) {
    const b = trace[trace.length - 1];
    const nom = sec ? "plus d'encre" : brouillon.geste === "cercle" ? "colle" : brouillon.geste === "rien" ? "" : brouillon.geste;
    ecrire(ctx, nom, b.x + 18, b.y - 22, { couleur: sec ? ROUGE : CRAYON, taille: 15 });
  }
  if (tuto < 3 && (j.phase === "vague" || j.phase === "prep")) {
    // Un voile léger : les monstres qui arrivent par le bas restent visibles dessous
    ctx.fillStyle = "rgba(246,239,220,0.45)";
    ctx.fillRect(10, HAUTEUR - 48, W - 20, 36);
    ecrire(ctx, TUTO[tuto], W / 2, HAUTEUR - 30, { couleur: BLEU, taille: 17 });
  }
  ctx.restore();
  trait(ctx, [{ x: 0, y: HAUT }, { x: W, y: HAUT }], { couleur: CRAYON, epaisseur: 1, amp: 0.3, graine: 80 });
  trait(ctx, [{ x: 0, y: HAUT + HAUTEUR }, { x: W, y: HAUT + HAUTEUR }], { couleur: CRAYON, epaisseur: 1, amp: 0.3, graine: 81 });
  dessinerBandeau(j);
  dessinerEncre(j);

  if (j.phase === "prep") dessinerPreparation(j);
  if (j.phase === "choix") dessinerChoix(j);
}

function listeVague(plan: PlanVague, x: number, y: number, largeur: number): number {
  const items = resume(plan);
  let cx = x;
  let cy = y;
  for (const it of items) {
    const f = ENNEMIS[it.type];
    const texte = f.boss ? f.nom : `${it.nombre} ${it.nombre > 1 ? f.pluriel : f.nom}`;
    ctx.font = `15px "Patrick Hand", cursive`;
    const w = 26 + ctx.measureText(texte).width + 14;
    if (cx + w > x + largeur) {
      cx = x;
      cy += 26;
    }
    monstre(ctx, it.type, cx + 10, cy, Math.min(it.type === "gomme" ? 7 : 9, f.rayon * 0.7), 3, temps, ROUGE, -0.5);
    ecrire(ctx, texte, cx + 24, cy, { align: "left", taille: 15, couleur: f.boss ? ROUGE : BLEU });
    cx += w;
  }
  return cy - y + 26;
}

function dessinerPreparation(j: Jeu): void {
  const y = HAUT + 10;
  ctx.fillStyle = "rgba(246,239,220,0.88)";
  ctx.fillRect(12, y, W - 24, 104);
  rectangle(ctx, 12, y, W - 24, 104, { epaisseur: 1.4, graine: 90, couleur: CRAYON });
  ecrire(ctx, `Vague ${j.vague}`, 26, y + 20, { align: "left", police: "titre", taille: 30 });
  ecrire(ctx, `dans ${Math.ceil(j.prep)}…`, 140, y + 22, { align: "left", taille: 16, couleur: CRAYON });
  listeVague(j.plan, 26, y + 52, W - 170);
  bouton(W - 128, y + 14, 104, 40, "Go !", () => lancer(j), { principal: true });
  ecrire(ctx, "flèches rouges : d'où ils viennent", W - 76, y + 74, { taille: 11, couleur: CRAYON });
  ecrire(ctx, "tu peux déjà dessiner", W - 76, y + 88, { taille: 11, couleur: CRAYON });
  ctx.save();
  ctx.translate(0, HAUT);
  fleches(ctx, j);
  ctx.restore();
}

function dessinerChoix(j: Jeu): void {
  voile(0.85);
  ecrire(ctx, `Vague ${j.vague} tenue`, W / 2, 110, { police: "titre", taille: 44 });
  souligner(W / 2, 136, 180, 12);
  ecrire(ctx, "Choisis une amélioration pour cette page :", W / 2, 166, { couleur: CRAYON, taille: 16 });
  j.offres.forEach((id: IdAmelioration, i) => {
    const f = AMELIORATIONS[id];
    const niv = j.niv[id] + 1;
    const x = 30;
    const y = 192 + i * 124;
    const w = W - 60;
    const h = 108;
    rectangle(ctx, x, y, w, h, { epaisseur: 2, graine: 100 + i, fond: "rgba(255,252,240,0.95)", couleur: f.arme ? ROUGE : BLEU });
    ecrire(ctx, f.nom, x + 16, y + 28, { align: "left", police: "titre", taille: 30, couleur: f.arme ? ROUGE : BLEU });
    ecrire(ctx, f.max > 1 ? `niveau ${niv}/${f.max}` : "", x + w - 14, y + 26, { align: "right", taille: 14, couleur: CRAYON });
    paragraphe(ctx, f.texte(niv), x + 16, y + 52, w - 32, { align: "left", taille: 17 });
    boutons.push({ x, y, w, h, action: () => choisir(j, id) });
  });
  ecrire(ctx, `Ensuite, vague ${j.vague + 1} :`, 30, 584, { align: "left", taille: 16, couleur: CRAYON });
  listeVague(planSuivant(j), 30, 614, W - 60);
}

let cachePlan: { cle: string; plan: PlanVague } | null = null;
/** Le plan de la vague suivante : il ne dépend que de la graine et du numéro. */
function planSuivant(j: Jeu): PlanVague {
  const cle = `${j.g}-${j.vague + 1}`;
  if (cachePlan?.cle !== cle) cachePlan = { cle, plan: planifier(j.g, j.vague + 1) };
  return cachePlan.plan;
}

function dessinerPause(): void {
  voile(0.88);
  ecrire(ctx, "Pause", W / 2, 230, { police: "titre", taille: 64 });
  souligner(W / 2, 266, 140, 30);
  bouton(90, 320, 220, 56, "Reprendre", () => (ecran = "jeu"), { principal: true });
  bouton(90, 396, 220, 50, "Recommencer la page", () => jeu && demarrer(jeu.graine, cleRecord, libelle), { taille: 19 });
  bouton(90, 466, 220, 50, "Abandonner", () => (ecran = "titre"), { taille: 19 });
  boutonSon(W / 2 - 20, 546);
}

const COMMENTAIRES: [number, string][] = [
  [4, "Peut mieux faire. Beaucoup mieux."],
  [8, "Des efforts, mais la horde a gagné."],
  [10, "Presque la moyenne. Persévère."],
  [13, "Page tenue. Soigne un peu ta tour."],
  [17, "Très bien. Belle maîtrise du stylo."],
  [20, "Excellent. Rien à redire."],
];

function dessinerFin(j: Jeu): void {
  voile(0.9);
  const gagne = j.phase === "gagne";
  const n = note(j);
  ecrire(ctx, gagne ? "Page réussie !" : "Page perdue", W / 2, 110, { police: "titre", taille: 54, couleur: gagne ? BLEU : ROUGE });
  // La note, entourée au stylo rouge
  const apparition = Math.min(1, (temps - finDepuis) * 2);
  ctx.save();
  ctx.globalAlpha = apparition;
  ecrire(ctx, `${String(n).padStart(2, "0")}/20`, W / 2, 220, { police: "titre", taille: 80, couleur: ROUGE, rotation: -0.06 });
  cercle(ctx, W / 2, 222, 78, { couleur: ROUGE, epaisseur: 2.6, graine: 140 });
  ecrire(ctx, COMMENTAIRES.find(([max]) => n <= max)![1], W / 2, 322, { couleur: ROUGE, taille: 20, rotation: -0.03 });
  ctx.restore();
  if (record) ecrire(ctx, "nouveau record !", W / 2 + 108, 160, { couleur: ROUGE, taille: 16, rotation: 0.3 });
  const precision = j.ratures ? Math.round((100 * (j.ratures - j.ratees)) / j.ratures) : 0;
  const lignes = [
    `vagues tenues : ${vaguesTenues(j)}/${DERNIERE_VAGUE}`,
    `monstres raturés : ${j.tues}`,
    `encre dépensée : ${Math.round(j.encreDepensee)}`,
    `ratures dans le mille : ${precision} %`,
  ];
  lignes.forEach((l, i) => ecrire(ctx, l, W / 2, 380 + i * 30, { taille: 19 }));
  ecrire(ctx, libelle, W / 2, 510, { taille: 14, couleur: CRAYON });
  // Un doigt encore sur la page quand elle se termine ne doit rien déclencher
  if (temps - finDepuis < 0.8) return;
  bouton(80, 550, 240, 56, "Rejouer cette page", () => demarrer(j.graine, cleRecord, libelle), { principal: true, taille: 21 });
  bouton(80, 622, 240, 50, "Page libre", pageLibre, { taille: 20 });
  bouton(80, 688, 240, 50, "Menu", () => (ecran = "titre"), { taille: 20 });
}

// --- La boucle ---

let avant = performance.now();
let reste = 0;
const PAS = 1 / 60;

function image(maintenant: number): void {
  const dt = Math.min(0.1, (maintenant - avant) / 1000);
  avant = maintenant;
  temps += dt;
  regler(temps);

  if (jeu && ecran === "jeu") {
    reste += dt;
    let n = 0;
    while (reste >= PAS && n++ < 6) {
      step(jeu, PAS);
      reste -= PAS;
    }
    audio.jouer(jeu.sons);
    jeu.sons.length = 0;
    if (jeu.phase === "perdu" || jeu.phase === "gagne") {
      if (!finDepuis) finDepuis = temps;
      if (temps - finDepuis > 1.4) {
        ecran = "fin";
        finDepuis = temps;
        record = enregistrer(cleRecord, { vagues: vaguesTenues(jeu), note: note(jeu) });
        trace = null;
        doigt = null;
      }
    } else finDepuis = 0;
  } else reste = 0;

  boutons = [];
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#e4d9bf";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(dpr * echelle, 0, 0, dpr * echelle, ox * dpr, oy * dpr);
  // L'ombre de la feuille, puis la feuille
  ctx.fillStyle = "rgba(80,60,30,0.18)";
  ctx.fillRect(3, 4, W, H);
  if (fond) ctx.drawImage(fond, 0, 0, W, H);

  if (ecran === "titre") dessinerTitre();
  else if (ecran === "aide") dessinerAide();
  else if (jeu) {
    dessinerPage(jeu);
    if (ecran === "pause") dessinerPause();
    if (ecran === "fin") dessinerFin(jeu);
  }
  requestAnimationFrame(image);
}

redimensionner();
void document.fonts.load('700 20px Caveat').then(() => document.fonts.load('20px "Patrick Hand"')).finally(() => requestAnimationFrame(image));

// Hors ligne une fois chargé (en production seulement : en dev, le cache gênerait le rechargement)
if (import.meta.env.PROD && "serviceWorker" in navigator) void navigator.serviceWorker.register("./sw.js");

// Pour les tests de bout en bout : l'état du jeu, lisible depuis la console
(window as unknown as { rature: unknown }).rature = { get jeu() { return jeu; }, get ecran() { return ecran; }, demarrer,
  /** Avance la page de `s` secondes d'un coup (tests). */
  avancer(s: number) { for (let i = 0; jeu && i < s * 60; i++) step(jeu, PAS); },
};
