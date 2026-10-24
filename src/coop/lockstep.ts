// Le lockstep de la coop : les deux appareils font tourner la même partie, et ne s'échangent que ce que les joueurs
// font. Le temps est découpé en tours de 100 ms ; ce qu'on fait pendant le tour n est joué au tour n + RETARD, chez
// soi comme chez l'autre, dans le même ordre (l'hôte d'abord). Un tour ne se joue que quand on a reçu celui de
// l'autre : si le réseau traîne, les deux attendent, mais ne divergent jamais (la simulation est déterministe, et
// sim/maths.ts la rend identique d'un navigateur à l'autre). De temps en temps, une empreinte de l'état part avec le
// tour pour vérifier que les deux parties sont bien les mêmes.

/** Une action d'un joueur sur la partie (un trait, une amélioration, la vague, la pause…). */
export type Action = { k: string } & Record<string, unknown>;

/** Le message d'un tour : ses actions, et parfois l'empreinte de la partie à la fin d'un tour déjà joué. */
export interface MessageTour {
  t: "tour";
  n: number;
  a: Action[];
  /** L'empreinte de l'état après le tour `hn`. */
  hn?: number;
  h?: number;
}

export const DUREE_TOUR = 0.1;
export const RETARD = 2;
/** Une empreinte tous les tant de tours. */
const TOUS_LES = 10;
/** Ce qu'on garde de ses propres messages, pour les renvoyer après une coupure. */
const HISTORIQUE = 3 * RETARD + 4;

export class Lockstep {
  /** Le prochain tour à jouer. */
  tour = 0;
  /** Depuis combien de temps on attend l'autre (s), 0 si tout va bien. */
  attente = 0;
  /** Le tour où les deux parties ont divergé, s'il y en a un. */
  divergence: number | null = null;
  private reste = 0;
  private miens = new Map<number, Action[]>();
  private siens = new Map<number, Action[]>();
  private enCours: Action[] = [];
  private envoyes: MessageTour[] = [];
  private empreintesMiennes = new Map<number, number>();
  private empreintesSiennes = new Map<number, number>();

  constructor(
    private envoyer: (m: MessageTour) => void,
    /** L'hôte joue ses actions en premier dans chaque tour. */
    readonly hote: boolean,
  ) {
    for (let n = 0; n < RETARD; n++) {
      this.miens.set(n, []);
      this.siens.set(n, []);
    }
  }

  /** Une action du joueur d'ici : elle sera jouée dans RETARD tours, des deux côtés. */
  agir(a: Action): void {
    this.enCours.push(a);
  }

  recevoir(m: MessageTour): void {
    if (m.n >= this.tour) this.siens.set(m.n, m.a);
    if (m.hn !== undefined && m.h !== undefined) {
      this.empreintesSiennes.set(m.hn, m.h);
      this.comparer(m.hn);
    }
  }

  /** Après une coupure : on renvoie ce que l'autre a pu manquer (le recevoir deux fois ne fait rien). */
  renvoyer(): void {
    for (const m of this.envoyes) this.envoyer(m);
  }

  /**
   * Fait avancer le temps réel de dt secondes et joue les tours qui peuvent l'être. `jouer` reçoit les actions du tour
   * dans l'ordre (hôte d'abord, avec qui les a faites) et renvoie l'empreinte de la partie après le tour.
   */
  avancer(dt: number, jouer: (actions: { a: Action; hote: boolean }[], n: number) => number): void {
    this.reste = Math.min(this.reste + dt, DUREE_TOUR * 6);
    let joues = 0;
    while (this.reste >= DUREE_TOUR && joues < 6) {
      const siens = this.siens.get(this.tour);
      if (!siens) break;
      const miens = this.miens.get(this.tour) ?? [];
      const liste = this.hote
        ? [...miens.map((a) => ({ a, hote: true })), ...siens.map((a) => ({ a, hote: false }))]
        : [...siens.map((a) => ({ a, hote: true })), ...miens.map((a) => ({ a, hote: false }))];
      const h = jouer(liste, this.tour);
      this.siens.delete(this.tour);
      this.miens.delete(this.tour);
      const m: MessageTour = { t: "tour", n: this.tour + RETARD, a: this.enCours };
      if (this.tour % TOUS_LES === 0) {
        m.hn = this.tour;
        m.h = h;
        this.empreintesMiennes.set(this.tour, h);
        this.comparer(this.tour);
      }
      this.miens.set(m.n, this.enCours);
      this.enCours = [];
      this.envoyes.push(m);
      if (this.envoyes.length > HISTORIQUE) this.envoyes.shift();
      this.envoyer(m);
      this.tour++;
      this.reste -= DUREE_TOUR;
      joues++;
    }
    // On attend l'autre : le temps ne s'accumule pas au-delà de quelques tours
    this.attente = this.reste >= DUREE_TOUR && !this.siens.has(this.tour) ? this.attente + dt : 0;
  }

  private comparer(n: number): void {
    const a = this.empreintesMiennes.get(n);
    const b = this.empreintesSiennes.get(n);
    if (a === undefined || b === undefined) return;
    if (a !== b && this.divergence === null) this.divergence = n;
    this.empreintesMiennes.delete(n);
    this.empreintesSiennes.delete(n);
  }
}
