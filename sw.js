const CACHE_NAME = "dicero-no-cache-v3";

self.addEventListener("install", event => {
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    Promise.all([
      caches.keys().then(keys =>
        Promise.all(
          keys.map(key => caches.delete(key))
        )
      ),
      self.clients.claim()
    ])
  );
});

self.addEventListener("fetch", event => {

  if(event.request.method !== "GET")
    return;

  /*
    Never serve old cached files.
    Always get the newest game files from the server.
  */

  event.respondWith(
    fetch(event.request)
  );

});
