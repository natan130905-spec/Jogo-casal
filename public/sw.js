// Service worker: guarda o jogo para abrir rápido e funcionar no treino sem internet.
// Estratégia: rede primeiro para a página (pega versões novas), cache primeiro para os outros arquivos (os do build
// têm hash; arte e som entram no cache na primeira vez que são usados). A interface (rostos, ícones) já vai na instalação.
const CACHE = 'edm-v2';
const ESSENCIAIS = ['./', './manifest.webmanifest', './icone-192.png', './icone.svg', './arte/14_rosto_natan.webp', './arte/15_rosto_bruna.webp'];
self.addEventListener('install', (e) => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ESSENCIAIS)).catch(() => {})); });
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // pedidos parciais (áudio em pedaços) vão direto à rede: o cache não guarda respostas 206
  if (e.request.headers.has('range')) return;
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).then((r) => { const c = r.clone(); caches.open(CACHE).then((k) => k.put('./', c)); return r; }).catch(() => caches.match('./')));
    return;
  }
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((r) => {
    if (r.ok && r.status === 200) { const c = r.clone(); caches.open(CACHE).then((k) => k.put(e.request, c)); }
    return r;
  })));
});
