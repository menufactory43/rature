// L'écran « À deux » : créer un salon (on reçoit un code de 4 lettres à donner), ou rejoindre celui d'un ami en tapant
// son code sur un clavier dessiné. L'hôte choisit la page et lance la partie quand son binôme est là.
import { BLEU, CRAYON, ROUGE, ecrire, paragraphe, boite } from "../render/encre";
import { ALPHABET, tirerCode } from "../coop/lien";
import { choixPossibles, coop, creer, lancer, quitter, rejoindre } from "../coop/session";
import { bouton, titre, ui, W, H } from "./base";
import { nav } from "./nav";
import { t } from "../i18n";

/** Le code en cours de saisie (null : on ne saisit pas). */
let saisie: string | null = null;
let copie = 0;

export function ouvrirCoop(code?: string): void {
  saisie = null;
  if (code && /^[A-Z]{4}$/i.test(code)) rejoindre(code);
  nav.aller("coop");
}

/** Quatre cases à la main, une lettre dans chacune. */
function cases(code: string, y: number, taille = 56): void {
  const ctx = ui.ctx;
  const w = taille;
  const x0 = W / 2 - (w * 4 + 12 * 3) / 2;
  for (let i = 0; i < 4; i++) {
    const x = x0 + i * (w + 12);
    boite(ctx, x, y, w, w * 1.15, { epaisseur: 1.8, graine: 400 + i, fond: "rgba(255,252,240,0.9)" });
    if (code[i]) ecrire(ctx, code[i], x + w / 2, y + w * 0.6, { police: "titre", taille: w * 0.8, couleur: BLEU });
  }
}

function partager(code: string): void {
  const url = `${location.origin}${location.pathname}?salon=${code}`;
  const nav2 = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
  if (nav2.share) void nav2.share({ title: t("Rature à deux"), text: t("Viens défendre ma page sur Rature ! Code du salon : {code}", { code }), url }).catch(() => {});
  else void navigator.clipboard?.writeText(url).then(() => (copie = ui.temps));
}

export function dessinerCoop(): void {
  const ctx = ui.ctx;
  titre(t("À deux"), 70);
  const l = coop.lien;
  if (l?.erreur) {
    paragraphe(ctx, t(l.erreur), W / 2, 200, W - 80, { taille: 20, couleur: ROUGE });
    bouton(100, 300, 200, 54, t("Réessayer"), () => {
      coop.lien?.fermer();
      coop.lien = null;
    }, { principal: true });
    bouton(120, H - 90, 160, 50, t("Retour"), quitter);
    return;
  }
  if (!l && saisie === null) {
    paragraphe(ctx, t("Deux stylos, une seule encre. Chacun sur son appareil, vous défendez la même page : ce que l'un dessine apparaît chez l'autre."), W / 2, 130, W - 80, { taille: 18 });
    paragraphe(ctx, t("Les monstres sont plus coriaces, et l'encre un peu plus généreuse."), W / 2, 236, W - 80, { taille: 15, couleur: CRAYON });
    bouton(60, 320, 280, 64, t("Créer un salon"), () => creer(tirerCode()), { principal: true, sous: t("tu choisis la page") });
    bouton(60, 404, 280, 64, t("Rejoindre un salon"), () => (saisie = ""), { sous: t("avec le code d'un ami") });
    if (coop.note) ecrire(ctx, coop.note, W / 2, 520, { taille: 15, couleur: ROUGE });
    bouton(120, H - 90, 160, 50, t("Retour"), () => nav.aller("titre"));
    return;
  }
  if (!l && saisie !== null) {
    // Le clavier : les 24 lettres des codes, à toucher
    ecrire(ctx, t("Le code de ton ami"), W / 2, 140, { taille: 20, couleur: CRAYON });
    cases(saisie, 170);
    const col = 6;
    const k = 54;
    const x0 = W / 2 - (col * k + (col - 1) * 6) / 2;
    [...ALPHABET].forEach((c, i) => {
      const x = x0 + (i % col) * (k + 6);
      const y = 280 + Math.floor(i / col) * (k + 6);
      bouton(x, y, k, k, c, () => saisie !== null && saisie.length < 4 && (saisie += c), { taille: 26 });
    });
    bouton(60, 530, 130, 50, t("⌫ effacer"), () => saisie !== null && (saisie = saisie.slice(0, -1)), { taille: 18 });
    bouton(210, 530, 130, 50, t("Rejoindre"), () => {
      if (saisie?.length === 4) {
        rejoindre(saisie);
        saisie = null;
      }
    }, { principal: true, inactif: saisie.length < 4, taille: 20 });
    bouton(120, H - 90, 160, 50, t("Retour"), () => (saisie = null));
    return;
  }
  if (!l) return;
  const points = ".".repeat(1 + (Math.floor(ui.temps * 2) % 3));
  if (l.role === "hote") {
    ecrire(ctx, t("Le code du salon"), W / 2, 136, { taille: 18, couleur: CRAYON });
    cases(l.ouvert ? l.code : "", 160);
    if (!l.ouvert) ecrire(ctx, t("connexion au relais{points}", { points }), W / 2, 196, { taille: 16, couleur: CRAYON });
    bouton(90, 248, 220, 46, ui.temps - copie < 2 ? t("lien copié !") : t("Partager le lien"), () => partager(l.code), { taille: 19, inactif: !l.ouvert });
    // La page : l'hôte la choisit parmi celles qu'il a ouvertes
    const liste = choixPossibles();
    coop.choix = Math.min(coop.choix, liste.length - 1);
    const c = liste[coop.choix];
    ecrire(ctx, t("La page"), W / 2, 336, { taille: 18, couleur: CRAYON });
    bouton(30, 356, 50, 54, "‹", () => (coop.choix = (coop.choix + liste.length - 1) % liste.length), { taille: 30 });
    bouton(320, 356, 50, 54, "›", () => (coop.choix = (coop.choix + 1) % liste.length), { taille: 30 });
    ecrire(ctx, c === "jour" ? t("Page du jour") : `${c.id} ${t(c.nom)}`, W / 2, 384, { police: "titre", taille: 28 });
    ecrire(ctx, c === "jour" ? t("la même pour tous, toutes les tours") : t("{n} vagues · tes tours débloquées", { n: c.vagues }), W / 2, 410, { taille: 13, couleur: CRAYON });
    ecrire(ctx, l.pair ? t("Ton binôme est là !") : t("en attente de ton binôme{points}", { points }), W / 2, 470, { taille: 20, couleur: l.pair ? BLEU : CRAYON });
    bouton(80, 500, 240, 60, t("Commencer"), lancer, { principal: true, inactif: !l.pair, taille: 24 });
  } else {
    ecrire(ctx, t("Salon"), W / 2, 136, { taille: 18, couleur: CRAYON });
    cases(l.code, 160);
    const etat = !l.ouvert ? t("connexion{points}", { points }) : !l.pair ? t("l'hôte n'est pas là{points}", { points }) : t("Connecté ! L'hôte choisit la page{points}", { points });
    ecrire(ctx, etat, W / 2, 300, { taille: 20, couleur: l.pair ? BLEU : CRAYON });
  }
  if (coop.note) ecrire(ctx, coop.note, W / 2, 600, { taille: 15, couleur: ROUGE });
  bouton(110, H - 90, 180, 50, t("Quitter le salon"), quitter, { taille: 19 });
}
