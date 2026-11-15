// Service worker mínimo: o app abre sem internet. Os dados offline ficam com o Firestore (IndexedDB).
// shortcut: cache simples por URL; trocar por Serwist se precisar de pré-cache ou versões.
const CACHE = "cantinho-v2";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;

  // Arquivos com hash no nome nunca mudam: cache primeiro.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/marca/")) {
    e.respondWith(caches.match(req).then((r) => r || fetch(req).then((res) => guardar(req, res))));
    return;
  }
  // Páginas e dados de navegação: rede primeiro, cache se cair a internet.
  e.respondWith(
    fetch(req)
      .then((res) => guardar(req, res))
      .catch(() => caches.match(req).then((r) => r || (req.mode === "navigate" ? caches.match("/admin") : Response.error()))),
  );
});

function guardar(req, res) {
  if (res.ok) {
    const copia = res.clone();
    caches.open(CACHE).then((c) => c.put(req, copia));
  }
  return res;
}

// Pedido novo com o app fechado (Web Push, mandado pela rota de pedido). Mesma tag do alarme: não duplica.
self.addEventListener("push", (e) => {
  const a = e.data ? e.data.json() : { titulo: "Pedido novo no site", corpo: "", tag: "pedido" };
  e.waitUntil(
    self.registration.showNotification(a.titulo, { body: a.corpo, tag: a.tag, icon: "/marca/icone-192.png", requireInteraction: true, vibrate: [500, 200, 500] }),
  );
});

// Toque na notificação de pedido novo: volta pro sistema aberto ou abre a tela ao vivo.
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((ws) => {
      const aberta = ws.find((w) => new URL(w.url).pathname.startsWith("/admin"));
      return aberta ? aberta.focus() : self.clients.openWindow("/admin/ao-vivo");
    }),
  );
});
