var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.ts
import { DurableObject } from "cloudflare:workers";

// src/salon.ts
var RECONNEXION_MS = 6e4;
var VIE_MAX_MS = 12 * 36e5;
var MESSAGE_MAX = 32e3;
var DEBIT_PAR_S = 60;
var DEBIT_RAFALE = 150;
var CLE_MAX = 64;
var FERME = {
  /** Remplacé par une nouvelle connexion du même joueur. */
  remplace: 4e3,
  /** Origine refusée. */
  origine: 4003,
  /** Pas de salon sous ce code (personne n'héberge). */
  inconnu: 4004,
  /** La place est prise par quelqu'un d'autre : salon complet. */
  complet: 4009,
  /** L'hôte veut créer un salon sous un code déjà pris : il en tire un autre. */
  pris: 4010,
  /** Le salon a expiré. */
  expire: 4011,
  /** Trop de messages. */
  abus: 4008
};
var autre = /* @__PURE__ */ __name((r) => r === "hote" ? "invite" : "hote", "autre");
function tenue(p, branche, now) {
  return branche || !!p && now - p.vu < RECONNEXION_MS;
}
__name(tenue, "tenue");
function admettre(e, role, cle, nouveau, branches, now) {
  if (e.cree !== null && now - e.cree >= VIE_MAX_MS) return { ok: false, code: FERME.expire, raison: "salon expir\xE9" };
  const hote = tenue(e.hote, branches.has("hote"), now);
  const invite = tenue(e.invite, branches.has("invite"), now);
  if (role === "hote") {
    if (nouveau) {
      if (hote && e.hote?.cle !== cle || !hote && invite) return { ok: false, code: FERME.pris, raison: "code pris" };
      return { ok: true };
    }
    if (!hote) return { ok: false, code: FERME.inconnu, raison: "salon ferm\xE9" };
    if (e.hote?.cle !== cle) return { ok: false, code: FERME.complet, raison: "place prise" };
    return { ok: true };
  }
  if (!hote) return { ok: false, code: FERME.inconnu, raison: "salon introuvable" };
  if (invite && e.invite?.cle !== cle) return { ok: false, code: FERME.complet, raison: "salon complet" };
  return { ok: true };
}
__name(admettre, "admettre");
function entrer(e, role, cle, nouveau, now) {
  const base = role === "hote" && nouveau && e.hote?.cle !== cle ? { cree: now, hote: null, invite: null } : { ...e, cree: e.cree ?? now };
  return { ...base, [role]: { cle, vu: now } };
}
__name(entrer, "entrer");
function sortir(e, role, now) {
  const p = e[role];
  return p ? { ...e, [role]: { ...p, vu: now } } : e;
}
__name(sortir, "sortir");
function prochainReveil(e, branches) {
  if (e.cree === null) return null;
  const fin = e.cree + VIE_MAX_MS;
  if (branches.size > 0) return fin;
  const vus = [e.hote, e.invite].filter((p) => !!p).map((p) => p.vu + RECONNEXION_MS);
  return vus.length ? Math.min(fin, Math.max(...vus)) : null;
}
__name(prochainReveil, "prochainReveil");
function perime(e, branches, now) {
  if (e.cree === null) return true;
  if (now - e.cree >= VIE_MAX_MS) return true;
  return !tenue(e.hote, branches.has("hote"), now) && !tenue(e.invite, branches.has("invite"), now);
}
__name(perime, "perime");
function relayable(msg) {
  return typeof msg === "string" && msg.length > 2 && msg.length <= MESSAGE_MAX && msg.charCodeAt(0) === 123;
}
__name(relayable, "relayable");
var Seau = class {
  static {
    __name(this, "Seau");
  }
  jetons = DEBIT_RAFALE;
  t;
  /** Messages refusés d'affilée. */
  refus = 0;
  constructor(now) {
    this.t = now;
  }
  prendre(now) {
    this.jetons = Math.min(DEBIT_RAFALE, this.jetons + (now - this.t) / 1e3 * DEBIT_PAR_S);
    this.t = now;
    if (this.jetons < 1) {
      this.refus++;
      return false;
    }
    this.jetons--;
    this.refus = 0;
    return true;
  }
};
var APP_IPHONE = "capacitor://localhost";
function origineAdmise(origin) {
  if (origin === null || origin === "") return true;
  if (origin === "https://menufactory43.github.io" || origin === APP_IPHONE) return true;
  let u;
  try {
    u = new URL(origin);
  } catch {
    return false;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  const h = u.hostname;
  if (h === "localhost" || h === "127.0.0.1" || h === "[::1]") return true;
  return /^(10\.\d+|192\.168|172\.(1[6-9]|2\d|3[01]))\.\d+\.\d+$/.test(h);
}
__name(origineAdmise, "origineAdmise");
function codeDe(pathname) {
  const m = pathname.match(/^\/salon\/([A-Za-z]{4})\/?$/);
  return m ? m[1].toUpperCase() : null;
}
__name(codeDe, "codeDe");

// src/index.ts
var VIDE = { cree: null, hote: null, invite: null };
var src_default = {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === "/") return new Response("Rature \u2014 relais de la coop", { headers: { "content-type": "text/plain; charset=utf-8" } });
    const code = codeDe(url.pathname);
    if (!code) return new Response("introuvable", { status: 404 });
    if (!origineAdmise(req.headers.get("Origin"))) return new Response("origine refus\xE9e", { status: 403 });
    if (req.headers.get("Upgrade")?.toLowerCase() !== "websocket") return new Response("websocket attendu", { status: 426 });
    return env.SALON.get(env.SALON.idFromName(code)).fetch(req);
  }
};
function envoyer(ws, msg) {
  try {
    ws.send(msg);
  } catch {
  }
}
__name(envoyer, "envoyer");
function fermer(ws, code, raison) {
  try {
    ws.close(code, raison);
  } catch {
  }
}
__name(fermer, "fermer");
var Salon = class extends DurableObject {
  static {
    __name(this, "Salon");
  }
  /** Le débit de chaque connexion (en mémoire : il repart à neuf après une hibernation, sans gravité). */
  seaux = /* @__PURE__ */ new Map();
  constructor(ctx, env) {
    super(ctx, env);
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }
  async etat() {
    return await this.ctx.storage.get("etat") ?? VIDE;
  }
  ouverts(role) {
    return this.ctx.getWebSockets(role).filter((w) => w.readyState === WebSocket.OPEN);
  }
  branches(sauf) {
    const s = /* @__PURE__ */ new Set();
    for (const r of ["hote", "invite"]) if (this.ouverts(r).some((w) => w !== sauf)) s.add(r);
    return s;
  }
  roleOf(ws) {
    return this.ctx.getTags(ws).includes("hote") ? "hote" : "invite";
  }
  async reveil(e, branches) {
    const t = prochainReveil(e, branches);
    if (t === null) await this.ctx.storage.deleteAlarm();
    else await this.ctx.storage.setAlarm(t + 1e3);
  }
  async fetch(req) {
    const q = new URL(req.url).searchParams;
    const role = q.get("role") === "hote" ? "hote" : "invite";
    const cle = (q.get("cle") ?? "").slice(0, CLE_MAX);
    const nouveau = q.get("nouveau") === "1";
    const now = Date.now();
    const e = await this.etat();
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    const ok = admettre(e, role, cle, nouveau, this.branches(), now);
    if (!ok.ok) {
      server.accept();
      fermer(server, ok.code, ok.raison);
      return new Response(null, { status: 101, webSocket: client });
    }
    const next = entrer(e, role, cle, nouveau, now);
    await this.ctx.storage.put("etat", next);
    for (const old of this.ctx.getWebSockets(role)) fermer(old, FERME.remplace, "remplac\xE9");
    this.ctx.acceptWebSocket(server, [role]);
    const other = this.ouverts(autre(role));
    envoyer(server, JSON.stringify({ t: "salut", role, pair: other.length > 0 }));
    for (const o of other) envoyer(o, JSON.stringify({ t: "pair", on: true }));
    await this.reveil(next, /* @__PURE__ */ new Set([...this.branches(), role]));
    return new Response(null, { status: 101, webSocket: client });
  }
  async webSocketMessage(ws, msg) {
    if (!relayable(msg)) return;
    let seau = this.seaux.get(ws);
    if (!seau) this.seaux.set(ws, seau = new Seau(Date.now()));
    if (!seau.prendre(Date.now())) {
      if (seau.refus > 400) fermer(ws, FERME.abus, "trop de messages");
      return;
    }
    for (const o of this.ouverts(autre(this.roleOf(ws)))) envoyer(o, msg);
  }
  async webSocketClose(ws) {
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
  async webSocketError(ws) {
    await this.webSocketClose(ws);
  }
  async alarm() {
    const e = await this.etat();
    const branches = this.branches();
    const now = Date.now();
    if (!perime(e, branches, now)) return void await this.reveil(e, branches);
    for (const w of this.ctx.getWebSockets()) fermer(w, FERME.expire, "salon expir\xE9");
    await this.ctx.storage.deleteAll();
  }
};

// ../../.npm/_npx/d46824d0cc92ff9a/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../.npm/_npx/d46824d0cc92ff9a/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    const body = JSON.stringify(error);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-49Hpcb/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// ../../.npm/_npx/d46824d0cc92ff9a/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-49Hpcb/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  Salon,
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
