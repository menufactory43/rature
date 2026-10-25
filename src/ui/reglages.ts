// L'écran des réglages : volumes, vibrations, gaucher, effets réduits. Ouvert depuis le titre ou la pause.
import { CRAYON, ROUGE, BLEU, ecrire, boite, trait } from "../render/encre";
import { changer, reglages, type Reglages } from "../reglages";
import { vibrer } from "../vibre";
import { H, W, bouton, titre, ui, zone } from "./base";
import { nav, type Ecran } from "./nav";

let retour: Ecran = "titre";

export function ouvrirReglages(depuis: Ecran): void {
  retour = depuis;
  nav.aller("reglages");
}

/** Un volume : dix cases à hachurer, et un toucher pour choisir. */
function volume(nom: string, k: "musique" | "effets", y: number): void {
  const ctx = ui.ctx;
  ecrire(ctx, nom, 44, y, { align: "left", taille: 22 });
  const n = Math.round(reglages[k] * 10);
  const x0 = 44;
  const w = 26;
  for (let i = 0; i < 10; i++) {
    const x = x0 + i * (w + 4);
    const plein = i < n;
    boite(ctx, x, y + 18, w, 26, { couleur: plein ? BLEU : CRAYON, epaisseur: plein ? 1.6 : 1, graine: i * 7 + y, fond: plein ? "rgba(34,64,143,0.18)" : undefined });
    if (plein) for (let d = 4; d < w + 26; d += 6) trait(ctx, [{ x: x + Math.max(0, d - 26), y: y + 18 + Math.min(26, d) }, { x: x + Math.min(w, d), y: y + 18 + Math.max(0, d - w) }], { couleur: BLEU, epaisseur: 0.9, amp: 0.2, graine: i * 13 + d });
    zone(x - 2, y + 10, w + 4, 42, () => changer(k, (i + 1) / 10 === reglages[k] ? i / 10 : (i + 1) / 10));
  }
  ecrire(ctx, n ? `${n * 10} %` : "coupé", x0 + 10 * (w + 4) + 6, y + 32, { align: "left", taille: 16, couleur: n ? BLEU : ROUGE });
}

/** Une case à cocher, cochée au stylo rouge comme une correction. */
function caseACocher(texte: string, sous: string, k: keyof Pick<Reglages, "vibrations" | "gaucher" | "effetsReduits" | "bille">, y: number): void {
  const ctx = ui.ctx;
  boite(ctx, 44, y - 14, 28, 28, { epaisseur: 1.6, graine: y });
  if (reglages[k]) trait(ctx, [{ x: 48, y: y - 1 }, { x: 56, y: y + 9 }, { x: 74, y: y - 18 }], { couleur: ROUGE, epaisseur: 3, graine: y + 1 });
  ecrire(ctx, texte, 86, y - 4, { align: "left", taille: 20 });
  ecrire(ctx, sous, 86, y + 16, { align: "left", taille: 13, couleur: CRAYON });
  zone(36, y - 22, W - 72, 48, () => {
    changer(k, !reglages[k]);
    if (k === "vibrations" && reglages.vibrations) vibrer("moyen");
  });
}

export function dessinerReglages(): void {
  titre("Réglages", 70);
  volume("Musique", "musique", 140);
  volume("Bruitages", "effets", 230);
  caseACocher("Vibrations", "sur l'app iPhone et Android", "vibrations", 350);
  caseACocher("Gaucher", "les pouvoirs passent à gauche du bandeau", "gaucher", 420);
  caseACocher("Effets réduits", "moins de secousses, d'éclairs et d'éclats", "effetsReduits", 490);
  caseACocher("Bille", "la mascotte commente et donne des conseils", "bille", 560);
  bouton(120, H - 90, 160, 50, "Retour", () => nav.aller(retour), { principal: true });
}
