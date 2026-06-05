var CACHE = "soter-v1";

// Arquivos críticos pré-cacheados na instalação
var PRECACHE = [
  "/",
  "/index.html",
  "/apresentacao.html",
  "/css/design-system.css",
  "/css/app-shell.css",
  "/css/apresentacao.css",
  "/js/firebase-config.js",
  "/js/app-shell.js",
  "/js/apresentacao.js",
  "/img/soldesoter_logo.png",
];

// Rotas que nunca devem ser servidas do cache (Firebase, Google Fonts CDN)
function isNetworkOnly(url) {
  return (
    url.includes("firebaseio.com") ||
    url.includes("firestore.googleapis.com") ||
    url.includes("googleapis.com/identitytoolkit") ||
    url.includes("securetoken.googleapis.com") ||
    url.includes("fonts.googleapis.com") ||
    url.includes("fonts.gstatic.com")
  );
}

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(PRECACHE);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE; }).map(function (k) {
          return caches.delete(k);
        })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;

  // Só intercepta GET
  if (req.method !== "GET") return;

  // Rotas de API/auth: sempre busca na rede
  if (isNetworkOnly(req.url)) return;

  // Estratégia: network-first com fallback para cache
  e.respondWith(
    fetch(req).then(function (res) {
      // Cacheia respostas válidas de mesma origem
      if (res && res.status === 200 && req.url.startsWith(self.location.origin)) {
        var clone = res.clone();
        caches.open(CACHE).then(function (cache) { cache.put(req, clone); });
      }
      return res;
    }).catch(function () {
      // Rede falhou — serve do cache se disponível
      return caches.match(req).then(function (cached) {
        return cached || new Response("Sem conexão. Recarregue quando online.", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      });
    })
  );
});
