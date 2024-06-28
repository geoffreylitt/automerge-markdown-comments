import * as A from "@automerge/automerge";
import ReactDom from "react-dom/client";
//@ts-ignore
import {
  AutomergeUrl,
  DocHandle,
  PeerId,
  Repo,
} from "@automerge/automerge-repo";
import { MessageChannelNetworkAdapter } from "@automerge/automerge-repo-network-messagechannel";

import wasmBlobUrl from "@automerge/automerge/automerge.wasm?url";
import { next as Automerge } from "@automerge/automerge";
import { IndexedDBStorageAdapter } from "@automerge/automerge-repo-storage-indexeddb";

import { RepoContext } from "@automerge/automerge-repo-react-hooks";
import { getAccount } from "./explorer/account.js";
import { Explorer } from "./explorer/components/Explorer.js";
import "./index.css";

const serviceWorker = await setupServiceWorker();
// See the notes in service-worker.js for why we need to do this
serviceWorker.postMessage({ type: "INITIALIZE_WASM", wasmBlobUrl });

// Service workers stop on their own, which breaks sync.
// Here we ping the service worker while the tab is running
// to keep it alive (and make it restart if it did stop.)
setInterval(() => {
  serviceWorker.postMessage({ type: "PING" });
}, 5000);

// This case should never happen
// if the service worker is not defined here either the initialization failed
// or we found a new case that we haven't considered yet
if (!serviceWorker) {
  throw new Error("Failed to setup service worker");
}

const repo = await setupRepo();

establishMessageChannel(serviceWorker);

async function setupServiceWorker(): Promise<ServiceWorker> {
  return navigator.serviceWorker
    .register("/service-worker.js")
    .then((registration) => {
      // If the service worker is still installing, we wait until it is activated
      if (registration.installing) {
        return new Promise((resolve) => {
          registration.installing.onstatechange = (event) => {
            const serviceWorker = event.target as ServiceWorker;
            if (serviceWorker.state === "activated") {
              resolve(serviceWorker);
            }
          };
        });
      }

      // otherwise return the active service worker
      return registration.active;
    });
}

async function setupRepo() {

  // We create a repo without any network adapters.
  // Later we connect the repo with the repo in the service worker through a message channel
  const repo = new Repo({
    storage: new IndexedDBStorageAdapter(),
    network: [],
    peerId: ("frontend-" + Math.round(Math.random() * 10000)) as PeerId,
    sharePolicy: async (peerId) => peerId.includes("service-worker"),
    // We need to enable remote heads gossiping so the remote heads of the sync server
    // are forwarded from the service worker to the repo here in the main thread
    enableRemoteHeadsGossiping: true,
  });

  return repo;
}

// Re-establish the MessageChannel if the controlling service worker changes.
navigator.serviceWorker.addEventListener("controllerchange", (event) => {
  const newServiceWorker = (event.target as ServiceWorkerContainer).controller;
  // controllerchange is fired after a new service worker is installed
  // even if we wait above in setupServiceWorker() until the service worker state changes to activated.
  // To make sure we don't call establishMessageChannel twice check if this is actually a new service worker
  if (newServiceWorker !== serviceWorker) {
    establishMessageChannel(newServiceWorker);
  }
});

// Re-establish the MessageChannel if the service worker restarts
navigator.serviceWorker.addEventListener("message", (event) => {
  if (event.data.type === "SERVICE_WORKER_RESTARTED") {
    console.log("Service worker restarted, establishing message channel");
    establishMessageChannel(serviceWorker);
  }
});

// Connects the repo in the tab with the repo in the service worker through a message channel.
// The repo in the tab takes advantage of loaded state in the SW.
// TODO: clean up MessageChannels to old repos
function establishMessageChannel(serviceWorker: ServiceWorker) {
  // Send one side of a MessageChannel to the service worker and register the other with the repo.
  const messageChannel = new MessageChannel();
  repo.networkSubsystem.addNetworkAdapter(
    new MessageChannelNetworkAdapter(messageChannel.port1)
  );
  serviceWorker.postMessage({ type: "INIT_PORT" }, [messageChannel.port2]);
  console.log("Connected to service worker");
}

// Setup account

let author: AutomergeUrl;

getAccount(repo).then((account) => {
  author = account.contactHandle.url;

  account.on("change", () => {
    author = account.contactHandle.url;
  });
});

/** Here we monkey patch the DocHandle to
 *  always add the currently logged in user as author
 *  and the current timestamp as metadata to each change.
 *
 *  Eventually, we would like to ship this functionality directly
 *  inside automerge-repo, but that's currently blocked on having a
 *  more efficient approach to storing change metadata in Automerge.
 *
 *  Once that's done we should remove this monkey patch.
 */
const oldChange = DocHandle.prototype.change;
DocHandle.prototype.change = function <T>(
  callback: A.ChangeFn<T>,
  options: A.ChangeOptions<T> = {}
) {
  const optionsWithAttribution: A.ChangeOptions<T> = {
    time: Date.now(),
    message: JSON.stringify({ author }),
    ...options,
  };
  oldChange.call(this, callback, optionsWithAttribution);
};

const oldChangeAt = DocHandle.prototype.changeAt;
DocHandle.prototype.changeAt = function <T>(
  heads: A.Heads,
  callback: A.ChangeFn<T>,
  options: A.ChangeOptions<T> = {}
) {
  const optionsWithAttribution: A.ChangeOptions<T> = {
    time: Date.now(),
    message: JSON.stringify({ author }),
    ...options,
  };
  return oldChangeAt.call(this, heads, callback, optionsWithAttribution);
};

// @ts-expect-error - adding property to window
window.Automerge = Automerge;

// @ts-expect-error - adding property to window
window.repo = repo;

const Root = () => (
  <RepoContext.Provider value={repo}>
    <Explorer />
  </RepoContext.Provider>
);

ReactDom.createRoot(document.getElementById("root")).render(<Root />);
