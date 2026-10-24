// L'interro surprise : une page tirée au hasard, 30 vagues, et toutes les deux vagues une fourniture à choisir parmi trois.
import type { Jeu } from "./jeu";
import { POUVOIRS, TYPES_POUVOIRS, type Pouvoir } from "./pouvoirs";
import { Rng } from "./rng";
import { TOURS, TYPES_TOURS, type TypeTour } from "./tours";

/** Ce que les fournitures changent aux tours d'un type (l'objet est partagé par toutes ces tours). */
export interface Boost {
  degats: number;
  cadence: number;
  portee: number;
  /** Change à chaque modification, pour que les tours recalculent leurs statistiques. */
  version: number;
}

export const boostNeutre = (): Boost => ({ degats: 1, cadence: 1, portee: 1, version: 0 });

export type Famille = "tour" | "boost" | "pouvoir" | "encre" | "defense" | "pacte";

export interface Fourniture {
  id: string;
  nom: string;
  texte: string;
  famille: Famille;
  /** Un pacte : un avantage contre un prix (écrit en rouge). */
  pacte?: boolean;
  tour?: TypeTour;
  pouvoir?: Pouvoir;
}

/** Toutes les deux vagues, une fois la page vide. */
export const VAGUES_ENTRE_CHOIX = 2;

function candidats(j: Jeu): Fourniture[] {
  const dispo = j.options.toursDispo;
  const res: Fourniture[] = [];
  for (const t of TYPES_TOURS) {
    if (!dispo.includes(t)) res.push({ id: `tour-${t}`, nom: TOURS[t].nom, texte: `Nouvelle tour : ${TOURS[t].role.toLowerCase()}`, famille: "tour", tour: t });
    else {
      res.push({ id: `affute-${t}`, nom: `${TOURS[t].nom} affûtée`, texte: `${TOURS[t].nom} : +30 % de dégâts`, famille: "boost", tour: t });
      res.push({ id: `vif-${t}`, nom: `${TOURS[t].nom} vive`, texte: `${TOURS[t].nom} : tire 25 % plus vite`, famille: "boost", tour: t });
    }
  }
  for (const p of TYPES_POUVOIRS) {
    if (!j.options.pouvoirs?.includes(p)) res.push({ id: `pouvoir-${p}`, nom: POUVOIRS[p].nom, texte: `Nouveau pouvoir : ${POUVOIRS[p].conseil.toLowerCase()}`, famille: "pouvoir", pouvoir: p });
  }
  if (j.options.pouvoirs?.length) res.push({ id: "recharge", nom: "Taille-crayon", texte: "Les pouvoirs rechargent 30 % plus vite", famille: "pouvoir" });
  res.push(
    { id: "longue-vue", nom: "Longue-vue", texte: "Toutes les tours : portée +15 %", famille: "boost" },
    { id: "encrier", nom: "Encrier plein", texte: "+150 d'encre tout de suite", famille: "encre" },
    { id: "regen", nom: "Plume agile", texte: "L'encre revient 25 % plus vite", famille: "encre" },
    { id: "primes", nom: "Bons points", texte: "Chaque monstre rapporte 20 % de plus", famille: "encre" },
    { id: "coeur", nom: "Cœur solide", texte: "+5 vies, et 5 de plus au maximum", famille: "defense" },
    { id: "murs", nom: "Encre épaisse", texte: "Murs 40 % plus solides", famille: "defense" },
    { id: "ratures", nom: "Coup de poignet", texte: "Ratures : +50 % de dégâts", famille: "defense" },
    { id: "rabais", nom: "Soldes", texte: "Tours 15 % moins chères", famille: "encre" },
    { id: "pacte-pv", nom: "Contrôle surprise", texte: "+250 d'encre, mais les monstres ont 20 % de PV en plus", famille: "pacte", pacte: true },
    { id: "pacte-vies", nom: "Copie bâclée", texte: "Toutes les tours +20 % de dégâts, mais 4 vies en moins (et au maximum)", famille: "pacte", pacte: true },
  );
  return res;
}

/** Trois fournitures différentes, tirées de la graine de la partie et du numéro de vague (rejouable à l'identique). */
export function tirer(j: Jeu): Fourniture[] {
  const rng = new Rng((j.regles.graine ^ (j.vague * 0x9e3779b1)) >>> 0);
  const tas = candidats(j).filter((f) => !(f.pacte && j.prises.includes(f.id)));
  // Une nouvelle tour vaut une carte sur trois au moins tant qu'il en reste à découvrir, pour que la partie change de visage
  const tours = tas.filter((f) => f.famille === "tour");
  const choix: Fourniture[] = [];
  if (tours.length && j.vague <= 12) choix.push(tours[rng.int(0, tours.length - 1)]);
  while (choix.length < 3 && choix.length < tas.length) {
    const f = tas[rng.int(0, tas.length - 1)];
    if (!choix.some((c) => c.id === f.id)) choix.push(f);
  }
  return rng.shuffle(choix);
}

export function appliquer(j: Jeu, f: Fourniture): void {
  const boost = (t: TypeTour, k: "degats" | "cadence" | "portee", x: number) => {
    j.boosts[t][k] *= x;
    j.boosts[t].version++;
  };
  j.prises.push(f.id);
  if (f.famille === "tour" && f.tour) {
    j.options.toursDispo = [...j.options.toursDispo, f.tour];
    return;
  }
  if (f.famille === "pouvoir" && f.pouvoir) {
    j.options.pouvoirs = [...(j.options.pouvoirs ?? []), f.pouvoir];
    return;
  }
  if (f.id.startsWith("affute-") && f.tour) return boost(f.tour, "degats", 1.3);
  if (f.id.startsWith("vif-") && f.tour) return boost(f.tour, "cadence", 1.25);
  switch (f.id) {
    case "recharge": j.mods.recharge *= 0.7; break;
    case "longue-vue": for (const t of TYPES_TOURS) boost(t, "portee", 1.15); break;
    case "encrier": j.encre += 150; break;
    case "regen": j.talents.regen *= 1.25; break;
    case "primes": j.talents.primes *= 1.2; break;
    case "coeur": j.vies += 5; j.viesMax += 5; break;
    case "murs": j.talents.murPv *= 1.4; break;
    case "ratures": j.talents.ratureDegats *= 1.5; break;
    case "rabais": j.talents.coutTours *= 0.85; break;
    case "pacte-pv": j.encre += 250; j.mods.pvMonstres *= 1.2; break;
    case "pacte-vies":
      for (const t of TYPES_TOURS) boost(t, "degats", 1.2);
      j.viesMax = Math.max(1, j.viesMax - 4);
      j.vies = Math.max(1, Math.min(j.vies - 4, j.viesMax));
      break;
  }
}
