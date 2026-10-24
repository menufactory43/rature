// Le relais de la coop de Rature (src/coop/ côté jeu).
//
//   wss://rature-relais.<compte>.workers.dev/salon/ABCD?role=hote|invite&cle=<clé>[&nouveau=1]
//
// Un salon par code de 4 lettres, un Durable Object par salon. L'hôte et l'invité s'y branchent ; chaque message de
// l'un part tel quel chez l'autre (le jeu fait tout le reste : le lockstep, la vérification de synchro). Le relais dit
// aussi à chacun quand l'autre arrive ou s'en va ({"t":"pair","on":…}). Une place quittée reste à son joueur une
// minute ; un salon vide est effacé ensuite, et aucun ne vit plus de 12 h. Hibernation : entre deux messages le salon
// ne tourne pas, et le « ping » du jeu reçoit son « pong » sans le réveiller.
//
// Mise en ligne : npx wrangler deploy depuis ce dossier (CLOUDFLARE_API_TOKEN dans l'environnement).

import { DurableObject } from "cloudflare:workers";
import { FERME, Seau, admettre, autre, codeDe, entrer, origineAdmise, perime, prochainReveil, relayable, sortir, CLE_MAX, type Etat, type Role } from "./salon";

interface Env {
  SALON: DurableObjectNamespace<Salon>;
}

const VIDE: Etat = { cree: null, hote: null, invite: null };

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === "/") return new Response("Rature — relais de la coop", { headers: { "content-type": "text/plain; charset=utf-8" } });
    const code = codeDe(url.pathname);
    if (!code) return new Response("introuvable", { status: 404 });
    if (!origineAdmise(req.headers.get("Origin"))) return new Response("origine refusée", { status: 403 });
    if (req.headers.get("Upgrade")?.toLowerCase() !== "websocket") return new Response("websocket attendu", { status: 426 });
    return env.SALON.get(env.SALON.idFromName(code)).fetch(req);
  },
};

function envoyer(ws: WebSocket, msg: string): void {
  try {
    ws.send(msg);
  } catch {
    // parti
  }
}

function fermer(ws: WebSocket, code: number, raison: string): void {
  try {
    ws.close(code, raison);
  } catch {
    // déjà fermé
  }
}

export class Salon extends DurableObject<Env> {
  /** Le débit de chaque connexion (en mémoire : il repart à neuf après une hibernation, sans gravité). */
  private seaux = new Map<WebSocket, Seau>();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }

  private async etat(): Promise<Etat> {
    return (await this.ctx.storage.get<Etat>("etat")) ?? VIDE;
  }

  private ouverts(role: Role): WebSocket[] {
    return this.ctx.getWebSockets(role).filter((w) => w.readyState === WebSocket.OPEN);
  }

  private branches(sauf?: WebSocket): Set<Role> {
    const s = new Set<Role>();
    for (const r of ["hote", "invite"] as const) if (this.ouverts(r).some((w) => w !== sauf)) s.add(r);
    return s;
  }

  private roleOf(ws: WebSocket): Role {
    return this.ctx.getTags(ws).includes("hote") ? "hote" : "invite";
  }

  private async reveil(e: Etat, branches: Set<Role>): Promise<void> {
    const t = prochainReveil(e, branches);
    if (t === null) await this.ctx.storage.deleteAlarm();
    else await this.ctx.storage.setAlarm(t + 1000);
  }

  async fetch(req: Request): Promise<Response> {
    const q = new URL(req.url).searchParams;
    const role: Role = q.get("role") === "hote" ? "hote" : "invite";
    const cle = (q.get("cle") ?? "").slice(0, CLE_MAX);
    const nouveau = q.get("nouveau") === "1";
    const now = Date.now();
    const e = await this.etat();
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
    const ok = admettre(e, role, cle, nouveau, this.branches(), now);
    if (!ok.ok) {
      // (refusé par la WebSocket : un navigateur lit le code de fermeture, pas le statut de la poignée de main)
      server.accept();
      fermer(server, ok.code, ok.raison);
      return new Response(null, { status: 101, webSocket: client });
    }
    const next = entrer(e, role, cle, nouveau, now);
    await this.ctx.storage.put("etat", next);
    for (const old of this.ctx.getWebSockets(role)) fermer(old, FERME.remplace, "remplacé");
    this.ctx.acceptWebSocket(server, [role]);
    const other = this.ouverts(autre(role));
    envoyer(server, JSON.stringify({ t: "salut", role, pair: other.length > 0 }));
    for (const o of other) envoyer(o, JSON.stringify({ t: "pair", on: true }));
    await this.reveil(next, new Set([...this.branches(), role]));
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, msg: string | ArrayBuffer): Promise<void> {
    if (!relayable(msg)) return;
    let seau = this.seaux.get(ws);
    if (!seau) this.seaux.set(ws, (seau = new Seau(Date.now())));
    if (!seau.prendre(Date.now())) {
      if (seau.refus > 400) fermer(ws, FERME.abus, "trop de messages");
      return;
    }
    for (const o of this.ouverts(autre(this.roleOf(ws)))) envoyer(o, msg);
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    this.seaux.delete(ws);
    const role = this.roleOf(ws);
    if (this.ouverts(role).some((w) => w !== ws)) return;
    const e = await this.etat();
    if (!e[role]) return;
    const next = sortir(e, role, Date.now());
    await this.ctx.storage.put("etat", next);
    for (const o of this.ouverts(autre(role))) envoyer(o, JSON.stringify({ t: "pair", on: false }));
    await this.reveil(next, this.branches(ws));
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.webSocketClose(ws);
  }

  async alarm(): Promise<void> {
    const e = await this.etat();
    const branches = this.branches();
    const now = Date.now();
    if (!perime(e, branches, now)) return void (await this.reveil(e, branches));
    for (const w of this.ctx.getWebSockets()) fermer(w, FERME.expire, "salon expiré");
    await this.ctx.storage.deleteAll();
  }
}
