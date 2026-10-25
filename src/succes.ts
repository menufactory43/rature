// Les succès et les classements. Gardés dans la sauvegarde (on les voit partout), et envoyés à Game Center sur
// l'iPhone. Les mêmes identifiants servent à les déclarer dans App Store Connect (tools/gamecenter.mjs).
import { natif, plugin } from "./natif";
import { enregistrer, pageGagnee, sauvegarde, totalEtoiles } from "./progression";
import { ENNEMIS, type TypeEnnemi } from "./sim/ennemis";
import type { Jeu } from "./sim/jeu";
import { PAGES } from "./sim/pages";

export interface Succes {
  id: string;
  nom: string;
  texte: string;
  points: number;
}

export const SUCCES: Succes[] = [
  { id: "rature.tuto", nom: "Bon élève", texte: "Finir le tutoriel avec Bille.", points: 5 },
  { id: "rature.page1", nom: "Première page", texte: "Gagner la page 1-1.", points: 5 },
  { id: "rature.cahier1", nom: "Brouillon propre", texte: "Gagner toutes les pages du cahier de brouillon.", points: 20 },
  { id: "rature.cahier2", nom: "Fort en maths", texte: "Gagner toutes les pages du cahier de maths.", points: 30 },
  { id: "rature.cahier3", nom: "Oreille absolue", texte: "Gagner toutes les pages du cahier de musique.", points: 40 },
  { id: "rature.cahier4", nom: "Dictée sans faute", texte: "Gagner toutes les pages du cahier de dictée.", points: 50 },
  { id: "rature.etoiles", nom: "Premier de la classe", texte: "Trois étoiles sur toutes les pages de la campagne.", points: 100 },
  { id: "rature.sansfaute", nom: "Sans faute", texte: "Gagner une page sans perdre une seule vie.", points: 15 },
  { id: "rature.combo5", nom: "Grande rature", texte: "Raturer cinq monstres d'un seul trait.", points: 15 },
  { id: "rature.serpent", nom: "Charmeur de serpent", texte: "Vaincre le Mot-Serpent.", points: 20 },
  { id: "rature.esperluette", nom: "Et puis quoi encore", texte: "Vaincre l'Esperluette.", points: 25 },
  { id: "rature.oe", nom: "Ouvre-boîte", texte: "Vaincre l'Œ blindé.", points: 30 },
  { id: "rature.dictateur", nom: "Le dernier mot", texte: "Vaincre le Point Final.", points: 40 },
  { id: "rature.interro", nom: "20/20", texte: "Réussir une interro surprise jusqu'au bout.", points: 40 },
  { id: "rature.defi", nom: "Défi relevé", texte: "Réussir le défi d'une page.", points: 15 },
  { id: "rature.coop", nom: "À quatre mains", texte: "Gagner une page à deux.", points: 20 },
  { id: "rature.trousse", nom: "Artiste", texte: "Redessiner une tour dans la Trousse.", points: 5 },
  { id: "rature.jour7", nom: "Assidu", texte: "Jouer la page du jour sept jours différents.", points: 25 },
];

export const TABLEAUX = {
  /** La page du jour : vagues × 100 + vies, remis à zéro chaque jour. */
  jour: "rature.classement.jour",
  /** L'interro surprise : vagues tenues. */
  interro: "rature.classement.interro",
  /** Les étoiles de la campagne. */
  etoiles: "rature.classement.etoiles",
} as const;

const BOSS: Partial<Record<TypeEnnemi | "point", string>> = { mere: "rature.serpent", compas: "rature.esperluette", taille: "rature.oe", point: "rature.dictateur" };

/** Les succès obtenus mais pas encore partis vers Game Center (pas connecté, hors ligne). */
const enAttente = new Set<string>();
let connecte = false;

export const obtenu = (id: string) => sauvegarde.succes.includes(id);

/** Un succès : noté une fois pour toutes, et envoyé à Game Center. Renvoie vrai s'il est nouveau. */
export function debloquer(id: string): boolean {
  const nouveau = !obtenu(id);
  if (nouveau) {
    sauvegarde.succes.push(id);
    enregistrer();
    nouveaux.push(id);
  }
  envoyer(id);
  return nouveau;
}

function envoyer(id: string): void {
  if (!plugin) return;
  if (!connecte) {
    enAttente.add(id);
    return;
  }
  void plugin.succes({ id }).then((r) => (r.ok ? enAttente.delete(id) : enAttente.add(id))).catch(() => enAttente.add(id));
}

export function score(tableau: string, valeur: number): void {
  if (plugin && connecte) void plugin.score({ tableau, valeur: Math.round(valeur) }).catch(() => {});
}

/** Les succès tout juste obtenus, que l'écran peut annoncer. */
export const nouveaux: string[] = [];

/** Au démarrage de l'app : la connexion à Game Center, puis tout ce qui attendait. */
export async function connecterGameCenter(): Promise<void> {
  if (!plugin) return;
  const fin = (ok: boolean) => {
    connecte = ok;
    if (!ok) return;
    for (const id of sauvegarde.succes) envoyer(id);
    score(TABLEAUX.etoiles, totalEtoiles());
    if (sauvegarde.interro) score(TABLEAUX.interro, sauvegarde.interro);
  };
  void plugin.addListener("gameCenter", (d) => fin(d.ok));
  const r = await plugin.connecter().catch(() => ({ ok: false }));
  fin(r.ok);
}

export const gameCenterDispo = () => natif;
export const ouvrirGameCenter = () => void plugin?.tableau({}).catch(() => {});

// --- Ce qui les déclenche ---

/** Fin d'une page : pages, cahiers, étoiles, défis, interro, coop, page du jour. */
export function finDePage(o: { mode: string; pageId?: string; gagne: boolean; fuites: number; defi: boolean; vagues: number; vies: number; total: number; joursJoues: number }): void {
  if (o.gagne && o.pageId === "1-1") debloquer("rature.page1");
  for (let c = 1; c <= 4; c++) {
    const pages = PAGES.filter((p) => p.cahier === c);
    if (pages.length && pages.every((p) => pageGagnee(p.id))) debloquer(`rature.cahier${c}`);
  }
  if (PAGES.every((p) => (sauvegarde.etoiles[p.id] ?? 0) >= 3)) debloquer("rature.etoiles");
  if (o.gagne && o.fuites === 0 && o.mode !== "tuto") debloquer("rature.sansfaute");
  if (o.gagne && o.defi) debloquer("rature.defi");
  if (o.gagne && o.mode === "interro") debloquer("rature.interro");
  if (o.gagne && o.mode === "coop") debloquer("rature.coop");
  if (o.mode === "jour") {
    score(TABLEAUX.jour, o.vagues * 100 + o.vies);
    if (o.joursJoues >= 7) debloquer("rature.jour7");
  }
  if (o.mode === "interro") score(TABLEAUX.interro, o.vagues);
  score(TABLEAUX.etoiles, totalEtoiles());
}

const suivis = new WeakMap<Jeu, { tues: number; ratures: number; boss: Set<number> }>();

/** À chaque image de la partie : une grande rature, un boss abattu. */
export function surveiller(j: Jeu): void {
  let s = suivis.get(j);
  if (!s) suivis.set(j, (s = { tues: j.stats.tues, ratures: j.stats.ratures, boss: new Set() }));
  if (j.stats.ratures > s.ratures && j.stats.tues - s.tues >= 5) debloquer("rature.combo5");
  s.tues = j.stats.tues;
  s.ratures = j.stats.ratures;
  for (const e of j.ennemis) {
    const id = BOSS[e.type as TypeEnnemi];
    if (!id || !e.mort || s.boss.has(e.id) || !ENNEMIS[e.type].boss) continue;
    s.boss.add(e.id);
    // Mort sans avoir atteint le Cœur : vaincu
    if (e.pv <= 0) debloquer(id);
  }
}
