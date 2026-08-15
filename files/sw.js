/* =========================================================
   sw.js — Service Worker
   Görev: ilk ziyarette tüm dosyaları indirip cihazda tutmak.
   Sonrasında internet olmasa da uygulama açılır.
   Sadece https:// (veya localhost) altında çalışır — file:// altında değil.
   ========================================================= */

const CACHE = "cografya-sahasi-v2";   // dosyaları güncelleyince bu sayıyı artır

const DOSYALAR = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/style.css",
  "./js/tr-cities-data.js",
  "./js/config.js",
  "./js/data.js",
  "./js/audio.js",
  "./js/map.js",
  "./js/quiz.js",
  "./js/stats.js",
  "./js/ui.js",
  "./vendor/d3.v5.min.js",
  "./vendor/html2canvas.min.js",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

/* Kurulum: hepsini indir. Biri bile inmezse kurulum iptal olur,
   o yüzden tek tek ekleyip hatayı yutuyoruz. */
self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(c =>
      Promise.all(DOSYALAR.map(u =>
        c.add(u).catch(err => console.warn("[sw] atlandı:", u, err.message))
      ))
    ).then(() => self.skipWaiting())
  );
});

/* Etkinleşme: eski sürüm önbelleklerini temizle */
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* İstek yakalama: önce önbellek, yoksa ağ (cache-first).
   Uygulama dosyaları hiç değişmediği için bu strateji en hızlısı. */
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).then(hit => {
      if (hit) return hit;
      return fetch(e.request).then(res => {
        if (res && res.status === 200 && res.type === "basic") {
          const kopya = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, kopya));
        }
        return res;
      }).catch(() => caches.match("./index.html"));
    })
  );
});
