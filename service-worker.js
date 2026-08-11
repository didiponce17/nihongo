const CACHE_NAME = "nihon-study-shell-v1.4.0";
const APP_SHELL = [
  "./", "./index.html", "./offline.html", "./styles.css", "./app.js?v=1.4.0", "./manifest.webmanifest",
  "./icons/icon-192.png", "./icons/icon-512.png",
  "./js/analytics.js", "./js/router.js", "./js/srs.js", "./js/storage.js", "./js/study.js", "./js/utils.js", "./js/validators.js", "./js/writing.js",
  "./vendor/bootstrap/css/bootstrap.min.css", "./vendor/bootstrap/js/bootstrap.bundle.min.js", "./vendor/lucide/lucide.min.js",
  "./data/manifest.json", "./data/app-policy.json", "./data/progress-model.json", "./data/lessons.json", "./data/grammar.json", "./data/grammar-study.json", "./data/exam-blueprints.json", "./data/questions.json",
  "./data/kana.json", "./data/kanji.json", "./data/vocabulary.json", "./data/media.json", "./data/audio-transcripts.json", "./data/oral-presentation.json"
];

self.addEventListener("install", (event) => event.waitUntil((async () => {
  const cache = await caches.open(CACHE_NAME);
  await cache.addAll(APP_SHELL);
  const [kanaResponse, kanjiResponse] = await Promise.all([cache.match("./data/kana.json"), cache.match("./data/kanji.json")]);
  const [kana, kanji] = await Promise.all([kanaResponse.json(), kanjiResponse.json()]);
  const characters = [...new Set([...kana.kana, ...kanji.kanji].flatMap((item) => [...item.character]))];
  await cache.addAll(characters.map((character) => `./assets/stroke-order/${character.codePointAt(0).toString(16).padStart(5, "0")}.svg`));
})()));
self.addEventListener("message", (event) => { if (event.data === "SKIP_WAITING") self.skipWaiting(); });
self.addEventListener("activate", (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))));
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(fetch(event.request).then((response) => {
    const copy = response.clone();
    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
    return response;
  }).catch(() => caches.match(event.request).then((cached) => cached ?? (event.request.mode === "navigate" ? caches.match("./offline.html") : Response.error()))));
});