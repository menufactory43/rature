// La coop, côté salon : créer ou rejoindre, choisir la page (l'hôte), lancer la partie des deux côtés, et ce qui se
// passe quand l'un s'en va. L'hôte envoie « debut » avec tout ce qu'il faut pour que l'invité construise exactement la
// même partie ; ensuite, seul le lockstep parle.
import { colleDebloquee, pageOuverte, pouvoirsDebloques, toursDebloquees } from "../progression";
import { grainePageDuJour } from "../sauvegarde";
import { PAGES, optionsDePage, optionsPageDuJour, type Page } from "../sim/pages";
import { TYPES_POUVOIRS, type Pouvoir } from "../sim/pouvoirs";
import { TYPES_TOURS, type TypeTour } from "../sim/tours";
import { continuerSeul, demarrerPartie, partie, type CoopPartie } from "../ui/partie";
import { nav } from "../ui/nav";
import { Lien, type Role } from "./lien";
import { t } from "../i18n";
import { Lockstep, type MessageTour } from "./lockstep";

interface Debut {
  t: "debut";
  /** Le numéro de la partie dans ce salon : un tour d'une partie précédente qui traîne est ignoré. */
  g: number;
  page: string;
  jour?: string;
  tours: TypeTour[];
  pouvoirs: Pouvoir[];
  colle: boolean;
}

export const coop = {
  lien: null as Lien | null,
  /** Le numéro de la partie en cours (0 : pas encore commencé). */
  g: 0,
  debut: null as Debut | null,
  /** La page choisie par l'hôte, dans choixPossibles(). */
  choix: 0,
  /** Un mot pour l'écran du salon (l'autre est parti, la page a été relancée…). */
  note: "",
};

export const role = (): Role | null => coop.lien?.role ?? null;

/** Ce que l'hôte peut proposer : la page du jour, et les pages de campagne qu'il a ouvertes. */
export const choixPossibles = (): ("jour" | Page)[] => ["jour", ...PAGES.filter((p) => pageOuverte(p))];

function brancher(r: Role, code: string): void {
  fermer();
  coop.g = 0;
  coop.debut = null;
  coop.note = "";
  coop.lien = new Lien(r, code, recevoir, retrouvailles);
}

export const creer = (code: string) => brancher("hote", code);
export const rejoindre = (code: string) => brancher("invite", code.toUpperCase());

function fermer(): void {
  coop.lien?.fermer();
  coop.lien = null;
}

/** On s'en va pour de bon : l'autre est prévenu, et continue seul s'il était en partie. */
export function quitter(): void {
  coop.lien?.envoyer({ t: "quitte" });
  fermer();
  coop.debut = null;
  nav.aller("titre");
}

/** L'hôte lance (ou relance) la page choisie, pour les deux. */
export function lancer(): void {
  const l = coop.lien;
  if (!l || l.role !== "hote" || !l.pair) return;
  const c = choixPossibles()[coop.choix] ?? "jour";
  const d: Debut = {
    t: "debut", g: coop.g + 1, page: c === "jour" ? "jour" : c.id, jour: c === "jour" ? grainePageDuJour() : undefined,
    tours: toursDebloquees(), pouvoirs: pouvoirsDebloques(), colle: colleDebloquee(),
  };
  l.envoyer(d);
  commencer(d);
}

function valide(m: Record<string, unknown>): m is Record<string, unknown> & Debut {
  return typeof m.g === "number" && typeof m.page === "string" && Array.isArray(m.tours) && m.tours.every((t) => (TYPES_TOURS as string[]).includes(t as string))
    && Array.isArray(m.pouvoirs) && m.pouvoirs.every((k) => (TYPES_POUVOIRS as string[]).includes(k as string)) && typeof m.colle === "boolean"
    && (m.page === "jour" ? typeof m.jour === "string" : PAGES.some((p) => p.id === m.page));
}

function commencer(d: Debut): void {
  const l = coop.lien;
  if (!l) return;
  coop.debut = d;
  coop.g = d.g;
  const page = d.page === "jour" ? null : PAGES.find((p) => p.id === d.page)!;
  const options = page
    ? () => ({ ...optionsDePage(page, { toursDispo: d.tours, colle: d.colle }), pouvoirs: d.pouvoirs, coop: true, heros: true })
    : () => ({ ...optionsPageDuJour(d.jour!, [...TYPES_TOURS]), pouvoirs: [...TYPES_POUVOIRS], coop: true, heros: true });
  const hote = l.role === "hote";
  const c: CoopPartie = {
    ls: new Lockstep((m) => l.envoyer({ ...m, g: d.g }), hote),
    commun: { vitesse: 1, pause: false },
    hote, code: l.code,
    envoyer: (m) => l.envoyer(m),
    pair: () => l.pair,
    quitter,
    rejouer: hote ? lancer : null,
    crayon: null, envoye: 0, dernierEnvoi: 0, absentDepuis: 0, parti: false, vitesseDemandee: null,
  };
  const libelle = t("{base} · à deux", { base: page ? `${page.id} ${t(page.nom)}` : t("Page du {d}", { d: d.jour!.split("-").reverse().slice(0, 2).join("/") }) });
  demarrerPartie(options, { page: page ?? undefined, mode: "coop", libelle, coop: c });
}

function recevoir(m: Record<string, unknown>): void {
  const l = coop.lien;
  if (!l) return;
  const c = partie?.coop;
  switch (m.t) {
    case "debut":
      if (l.role === "invite" && valide(m)) commencer(m);
      return;
    case "tour":
      if (c && m.g === coop.g && typeof m.n === "number" && Array.isArray(m.a)) c.ls.recevoir(m as unknown as MessageTour);
      return;
    case "crayon":
      if (!c) return;
      if (m.fin) c.crayon = null;
      else if (Array.isArray(m.d)) {
        const pts = [];
        for (let i = 0; i + 1 < m.d.length; i += 2) pts.push({ x: Number(m.d[i]), y: Number(m.d[i + 1]) });
        c.crayon = m.debut || !c.crayon ? pts : [...c.crayon, ...pts];
      }
      return;
    case "bonjour":
      // L'invité arrive sans partie (premier passage, ou il a rechargé sa page) : l'hôte en partie relance pour les deux
      if (l.role === "hote" && coop.debut && partie?.coop) {
        coop.note = t("ton binôme est revenu : on reprend la page au début");
        lancer();
      }
      return;
    case "quitte":
      if (c) c.parti = true;
      else if (partie && nav.ecran === "partie") continuerSeul(partie);
      coop.note = t("ton binôme est parti");
      if (l.role === "invite") {
        fermer();
        coop.debut = null;
      }
      return;
  }
}

/** L'autre arrive ou revient, ou c'est nous qui revenons : on renvoie les derniers tours, il a pu les manquer. */
function retrouvailles(): void {
  const l = coop.lien;
  if (!l) return;
  const c = partie?.coop;
  if (c) c.ls.renvoyer();
  else if (l.role === "invite") l.envoyer({ t: "bonjour" });
}
