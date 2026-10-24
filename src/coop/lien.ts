// La connexion au relais Cloudflare (relais/ à la racine) : une WebSocket par joueur vers le salon de 4 lettres. Elle
// se rebranche toute seule après une coupure, avec la même clé, pour reprendre sa place.

/** Le relais en ligne ; en développement, `?relais=ws://127.0.0.1:8787` essaie un relais lancé avec wrangler dev. */
export const RELAIS = (import.meta.env.DEV ? new URLSearchParams(location.search).get("relais") : null) ?? "wss://rature-relais.meffysto.workers.dev";

export type Role = "hote" | "invite";

/** Les lettres d'un code : pas de I ni de O, qu'on confond avec 1 et 0. */
export const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ";

export const tirerCode = () => Array.from({ length: 4 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join("");

/** Ce que veulent dire les fermetures définitives du relais. */
const FATALES: Record<number, string> = {
  4003: "Le relais refuse cette adresse.",
  4004: "Pas de salon sous ce code.",
  4008: "Trop de messages : la connexion a été coupée.",
  4009: "Ce salon est déjà complet.",
  4011: "Ce salon a expiré.",
};

export class Lien {
  /** Le relais nous a acceptés. */
  ouvert = false;
  /** L'autre joueur est branché. */
  pair = false;
  /** Une erreur définitive (on ne se rebranche plus). */
  erreur: string | null = null;
  private ws: WebSocket | null = null;
  private ping = 0;
  private fini = false;
  private essais = 0;
  private cle: string;

  constructor(
    public role: Role,
    public code: string,
    private surMessage: (m: Record<string, unknown>) => void,
    /** Appelé quand l'autre arrive (ou revient), et quand on se rebranche soi-même. */
    private surRetrouvailles: () => void,
  ) {
    const k = `rature.coop.${code}.${role}`;
    this.cle = sessionStorage.getItem(k) ?? Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    sessionStorage.setItem(k, this.cle);
    this.brancher(role === "hote");
  }

  private brancher(nouveau: boolean): void {
    const url = `${RELAIS}/salon/${this.code}?role=${this.role}&cle=${encodeURIComponent(this.cle)}${nouveau ? "&nouveau=1" : ""}`;
    const ws = new WebSocket(url);
    this.ws = ws;
    ws.onmessage = (ev) => {
      if (typeof ev.data !== "string" || ev.data === "pong") return;
      let m: Record<string, unknown>;
      try {
        m = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (m.t === "salut") {
        this.ouvert = true;
        this.essais = 0;
        this.pair = m.pair === true;
        this.surRetrouvailles();
      } else if (m.t === "pair") {
        this.pair = m.on === true;
        if (this.pair) this.surRetrouvailles();
      } else this.surMessage(m);
    };
    ws.onclose = (ev) => {
      if (this.ws !== ws) return;
      this.ouvert = false;
      this.pair = false;
      clearInterval(this.ping);
      if (this.fini) return;
      if (ev.code === 4010 && this.role === "hote") {
        // Le code est pris : on en tire un autre
        this.code = tirerCode();
        this.brancher(true);
        return;
      }
      if (FATALES[ev.code]) {
        this.erreur = FATALES[ev.code];
        return;
      }
      // Une coupure : on revient, avec la même clé, un peu plus tard à chaque fois
      if (++this.essais > 30) {
        this.erreur = "Impossible de joindre le relais.";
        return;
      }
      setTimeout(() => !this.fini && this.brancher(false), Math.min(4000, 400 * this.essais));
    };
    clearInterval(this.ping);
    this.ping = window.setInterval(() => ws.readyState === WebSocket.OPEN && ws.send("ping"), 2000);
  }

  envoyer(m: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m));
  }

  fermer(): void {
    this.fini = true;
    clearInterval(this.ping);
    this.ws?.close(1000, "parti");
  }
}
