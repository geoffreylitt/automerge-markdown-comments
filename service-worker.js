import * as AutomergeWasm from "@automerge/automerge-wasm";
import * as Automerge from "@automerge/automerge";
import { Repo, isValidAutomergeUrl } from "@automerge/automerge-repo";
import { IndexedDBStorageAdapter } from "@automerge/automerge-repo-storage-indexeddb";
import { BrowserWebSocketClientAdapter } from "@automerge/automerge-repo-network-websocket";
import { MessageChannelNetworkAdapter } from "@automerge/automerge-repo-network-messagechannel";

const CACHE_NAME = "v6";

const PEER_ID = "service-worker-" + Math.round(Math.random() * 1000000);

async function initializeRepo() {
  console.log(`${PEER_ID}: Creating repo`);
  const repo = new Repo({
    storage: new IndexedDBStorageAdapter(),
    network: [new BrowserWebSocketClientAdapter("wss://sync.automerge.org")],
    peerId: PEER_ID,
    sharePolicy: async (peerId) => peerId.includes("storage-server"),
    enableRemoteHeadsGossiping: true,
  });

  await AutomergeWasm.promise;
  Automerge.use(AutomergeWasm);

  return repo;
}

const repo = initializeRepo();

// put it on the global context for interactive use
repo.then((r) => {
  self.repo = r;
  self.Automerge = Automerge;
});

// Paul: I'm not sure what this comment means
// return a promise from this so that we can wait on it before returning fetch/addNetworkAdapter
// because otherwise we might not have the WASM module loaded before we get to work.

self.addEventListener("install", () => {
  /* We skip waiting which means the service worker immediately takes over once it's installed
   * Any existing tab that is connected to a previous worker gets sent an "controllerchange" event to switch over to the new service worker
   */
  self.skipWaiting();
});

self.addEventListener("message", async (event) => {
  console.log(`${PEER_ID}: Client messaged`, event.data);
  if (event.data && event.data.type === "INIT_PORT") {
    const clientPort = event.ports[0];
    (await repo).networkSubsystem.addNetworkAdapter(
      new MessageChannelNetworkAdapter(clientPort, { useWeakRef: true })
    );
  }
});

function addSyncServer(url) {
  repo.then((repo) =>
    repo.networkSubsystem.addNetworkAdapter(
      new BrowserWebSocketClientAdapter(url)
    )
  );
}
self.addSyncServer = addSyncServer;

async function clearOldCaches() {
  const cacheWhitelist = [CACHE_NAME];
  const cacheNames = await caches.keys();
  const deletePromises = cacheNames.map((cacheName) => {
    if (!cacheWhitelist.includes(cacheName)) {
      return caches.delete(cacheName);
    }
  });
  await Promise.all(deletePromises);
}

self.addEventListener("activate", async (event) => {
  console.log(`${PEER_ID}: Activating service worker.`);
  await clearOldCaches();
  clients.claim();
});

const ASSETS_REQUEST_URL_REGEX =
  /^https?:\/\/automerge\/(?<docId>[a-zA-Z0-9]+)(\/(?<path>.*))?$/;

self.addEventListener("fetch", async (event) => {
  const url = new URL(event.request.url);
  const match = event.request.url.match(ASSETS_REQUEST_URL_REGEX);

  if (match) {
    const { docId, path } = match.groups;

    const automergeUrl = `automerge:${docId}`;
    if (!isValidAutomergeUrl(automergeUrl)) {
      event.respondWith(
        new Response(`Invalid document id ${docId}`, {
          status: 404,
          headers: { "Content-Type": "text/plain" },
        })
      );
      return;
    }

    event.respondWith(
      (async () => {
        const handle = (await repo).find(automergeUrl);
        await handle.whenReady();
        const doc = await handle.doc();

        if (!doc) {
          return new Response(
            `Document unavailable.\n${automergeUrl}: ${handle.state}`,
            {
              status: 500,
              headers: { "Content-Type": "text/plain" },
            }
          );
        }

        const parts = decodeURI(path).split("/");
        const file = parts.reduce((acc, curr) => acc?.[curr], doc);
        if (!file) {
          return new Response(
            `Not found\nObject path: ${path}\n${JSON.stringify(doc, null, 2)}`,
            {
              status: 404,
              headers: { "Content-Type": "text/plain" },
            }
          );
        }

        if (!file.contentType) {
          return new Response(
            `Invalid file entry.\n${
              assetsHandle.url
            }:\nfileEntry:${JSON.stringify(file)}`,
            {
              status: 404,
              headers: { "Content-Type": "text/plain" },
            }
          );
        }

        return new Response(file.contents, {
          headers: { "Content-Type": file.contentType },
        });
      })()
    );
  } else if (
    // enable caching only in production
    import.meta.env.PROD &&
    event.request.method === "GET" &&
    url.origin === self.location.origin
  ) {
    event.respondWith(
      (async () => {
        const r = await caches.match(event.request);
        console.log(
          `[Service Worker] Fetching resource from cache: ${event.request.url}`
        );
        if (r) {
          return r;
        }
        const response = await fetch(event.request);
        const cache = await caches.open(CACHE_NAME);
        console.log(
          `[Service Worker] Caching new resource: ${event.request.url}`
        );
        cache.put(event.request, response.clone());
        return response;
      })()
    );
  }
});
