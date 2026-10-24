// Rature hors ligne : la page d'accueil passe par le réseau d'abord (pour les mises à jour),
// tout le reste (scripts, polices, icônes) sort du cache une fois vu.
const CACHE = "rature-v1";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["./", "./index.html", "./manifest.webmanifest", "./icone-192.png"])));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((cles) => Promise.all(cles.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  const page = req.mode === "navigate";
  e.respondWith(
    page
      ? fetch(req)
          .then((r) => {
            const copie = r.clone();
            caches.open(CACHE).then((c) => c.put(req, copie));
            return r;
          })
          .catch(() => caches.match(req).then((r) => r || caches.match("./")))
      : caches.match(req).then(
          (r) =>
            r ||
            fetch(req).then((rep) => {
              const copie = rep.clone();
              caches.open(CACHE).then((c) => c.put(req, copie));
              return rep;
            }),
        ),
  );
});
