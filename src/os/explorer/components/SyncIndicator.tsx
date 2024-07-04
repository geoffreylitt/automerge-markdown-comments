import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
// TODO move these utils
import { getRelativeTimeString } from "@/os/lib/dates";
import { next as A } from "@automerge/automerge";
import { AutomergeUrl, DocHandle, StorageId } from "@automerge/automerge-repo";
import { useHandle, useRepo } from "@automerge/automerge-repo-react-hooks";
import { Button } from "@/components/ui/button";
import { useMachine } from "@xstate/react";
import { WifiIcon, WifiOffIcon, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createMachine, raise, stateIn } from "xstate";

export const AUTOMERGE_SYNC_SERVER_STORAGE_ID = (import.meta.env
  ?.VITE_SYNC_SERVER_STORAGE_ID ??
  "3760df37-a4c6-4f66-9ecd-732039a9385d") as StorageId;

export const JACQUARD_SYNC_SERVER_STORAGE_ID =
  "b9645395-f69a-40ca-ab42-b3a63e11ea18" as StorageId;

export const BACKUP_SYNC = localStorage.getItem("BACKUP_SYNC");

export const SyncIndicator = ({
  docUrl,
  storageId,
  name,
}: {
  docUrl: AutomergeUrl;
  storageId?: StorageId;
  name?: string;
}) => {
  const handle = useHandle(docUrl);
  if (!handle) {
    return null;
  }
  return (
    <SyncIndicatorInner
      key={handle.url}
      handle={handle}
      storageId={storageId}
      name={name}
    />
  );
};

// NOTE: this sync indicator component does *not* support changing the handle between renders.
// If you want to change the handle, you should re-mount the component.
const SyncIndicatorInner = ({
  handle,
  storageId = AUTOMERGE_SYNC_SERVER_STORAGE_ID,
  name,
}: {
  handle: DocHandle<unknown>;
  storageId?: StorageId;
  name?: string;
}) => {
  const {
    lastSyncUpdate,
    isInternetConnected,
    syncState,
    syncServerConnectionError,
    syncServerResponseError,
    syncServerHeads,
    ownHeads,
  } = useSyncIndicatorState(handle, storageId);
  const repo = useRepo();
  const isSynced = syncState === SyncState.InSync;

  const prevHandle = useRef(undefined);

  useEffect(() => {
    if (prevHandle.current && prevHandle.current.url !== handle.url) {
      console.warn(
        "Warning: do not change the handle between renders of SyncIndicator",
        {
          previous: prevHandle.current.url,
          current: handle.url,
        }
      );
    }
    prevHandle.current = handle;
  }, [handle]);

  const onCopySyncState = async () => {
    if (repo.peers.length !== 1) {
      throw new Error("tab is connected to multiple peers");
    }

    const storageId = await repo.storageId();

    const ownSyncState = await repo.storageSubsystem.loadSyncState(
      handle.documentId,
      storageId
    );

    const syncServerSyncState = await repo.storageSubsystem.loadSyncState(
      handle.documentId,
      storageId
    );

    const data = {
      syncServerHeads,
      self: {
        storageId,
        heads: ownHeads,
        syncState: ownSyncState,
      },
      syncServer: {
        name,
        heads: syncServerHeads,
        storageId,
        syncState: syncServerSyncState,
      },
    };

    navigator.clipboard.writeText(JSON.stringify(data, null, 2)).then(
      () => {
        console.log("Copied sync state to clipboard", data);
      },
      (err) => {
        console.error("Failed to copy sync state:", err);
      }
    );
  };

  const headsView = (
    <div className="mt-2 pt-2 border-t border-gray-300 relative">
      {name && (
        <div className="whitespace-nowrap flex">
          <dt className="font-bold inline mr-1">Name:</dt>
          <dd className="inline text-ellipsis flex-shrink overflow-hidden min-w-0">
            {name}
          </dd>
        </div>
      )}

      <div className="whitespace-nowrap flex">
        <dt className="font-bold inline mr-1">Server heads:</dt>
        <dd className="inline text-ellipsis flex-shrink overflow-hidden min-w-0">
          {JSON.stringify(
            (syncServerHeads ?? []).map((part) => part.slice(0, 4))
          )}
        </dd>
      </div>
      <div className="whitespace-nowrap flex">
        <dt className="font-bold inline mr-1">Local heads:</dt>
        <dd className="inline text-ellipsis flex-shrink overflow-hidden min-w-0">
          {JSON.stringify((ownHeads ?? []).map((part) => part.slice(0, 4)))}
        </dd>
      </div>

      <div className="absolute right-0 top-2 flex items-center justify-center">
        <Button
          variant="ghost"
          className="w-full"
          size="sm"
          onClick={onCopySyncState}
        >
          <Copy size={14} />
        </Button>
      </div>
    </div>
  );

  if (isInternetConnected) {
    if (!syncServerConnectionError && !syncServerResponseError) {
      return (
        <Popover>
          <PopoverTrigger className=" p-1 rounded-md text-gray-500 hover:text-gray-900 align-top">
            <WifiIcon size={"20px"} />
          </PopoverTrigger>
          <PopoverContent className="flex flex-col gap-1.5 pb-2">
            <dl className="text-sm text-gray-600">
              <div>
                <dt className="font-bold inline mr-1">Connection:</dt>
                <dd className="inline">Connected to server</dd>
              </div>
              <div>
                <dt className="font-bold inline mr-1">Last synced:</dt>
                <dd className="inline">
                  {lastSyncUpdate ? getRelativeTimeString(lastSyncUpdate) : "-"}
                </dd>
              </div>
              <div>
                <dt className="font-bold inline mr-1">Sync status:</dt>
                <dd className="inline">
                  {isSynced ? "Up to date" : "Syncing..."}
                </dd>
              </div>
              {headsView}
            </dl>
          </PopoverContent>
        </Popover>
      );
    } else {
      return (
        <Popover>
          <PopoverTrigger className="bg-red-50 border border-red-100 hover:bg-red-100 p-2 rounded-md">
            <div className="text-red-500 flex items-center text-sm">
              <WifiIcon
                size={"20px"}
                className={`inline-block ${isSynced ? "mr-[7px]" : ""}`}
              />
              {!isSynced && <div className="inline text-xs">*</div>}
            </div>
          </PopoverTrigger>
          <PopoverContent className="flex flex-col gap-1.5 pb-2">
            <div className="mb-2 text-sm">
              <p>
                There was an unexpected error connecting to the sync server.
                Don't worry, your changes are saved locally.
              </p>
              <p className="mt-2">
                Please try reloading and see if that fixes the issue. If not,
                drop a note in the lab Discord with a screenshot.
              </p>
            </div>
            <dl className="text-sm text-gray-600">
              <div>
                <dt className="font-bold inline mr-1">Connection:</dt>
                <dd className="inline text-red-500">
                  {syncServerConnectionError
                    ? "Server not connected"
                    : "Server not responding"}
                </dd>
              </div>
              <div>
                <dt className="font-bold inline mr-1">Last synced:</dt>
                <dd className="inline">
                  {lastSyncUpdate ? getRelativeTimeString(lastSyncUpdate) : "-"}
                </dd>
              </div>
              <div>
                <dt className="font-bold inline mr-1">Sync status:</dt>
                <dd className="inline">
                  {syncState === SyncState.Unknown ? (
                    "-"
                  ) : syncState === SyncState.InSync ? (
                    "No unsynced changes"
                  ) : (
                    <span className="text-red-500">Unsynced changes (*)</span>
                  )}
                </dd>
                {headsView}
              </div>
            </dl>
          </PopoverContent>
        </Popover>
      );
    }
  } else {
    return (
      <Popover>
        <PopoverTrigger className="hover:bg-gray-100 p-2 rounded-md">
          <div className="text-gray-500">
            <WifiOffIcon
              size={"20px"}
              className={`inline-block ${isSynced ? "mr-[7px]" : ""}`}
            />
            {!isSynced && (
              <div className="inline text-xs font-bold text-red-600">*</div>
            )}
          </div>
        </PopoverTrigger>
        <PopoverContent>
          <dl className="text-sm text-gray-600">
            <div>
              <dt className="font-bold inline mr-1">Connection:</dt>
              <dd className="inline">Offline</dd>
            </div>
            <div>
              <dt className="font-bold inline mr-1">Last synced:</dt>
              <dd className="inline">
                {lastSyncUpdate ? getRelativeTimeString(lastSyncUpdate) : "-"}
              </dd>
            </div>
            <div>
              <dt className="font-bold inline mr-1">Sync status:</dt>
              <dd className="inline">
                {syncState === SyncState.Unknown ? (
                  "-"
                ) : isSynced ? (
                  "No unsynced changes"
                ) : (
                  <span className="text-red-500">
                    You have unsynced changes. They are saved locally and will
                    sync next time you have internet and you open the app.
                  </span>
                )}
              </dd>
            </div>
            {headsView}
          </dl>
        </PopoverContent>
      </Popover>
    );
  }
};

enum SyncState {
  InSync,
  OutOfSync,
  Unknown,
}

interface SyncIndicatorState {
  syncServerHeads: A.Heads;
  ownHeads: A.Heads;
  lastSyncUpdate?: number;
  isInternetConnected: boolean;
  syncState: SyncState;
  syncServerConnectionError: boolean;
  syncServerResponseError: boolean;
}

function useSyncIndicatorState(
  handle: DocHandle<unknown>,
  storageId: StorageId
): SyncIndicatorState {
  const repo = useRepo();
  const [lastSyncUpdate, setLastSyncUpdate] = useState<number | undefined>(); // todo: should load that from persisted sync state
  const [syncServerHeads, setSyncServerHeads] = useState<A.Heads | undefined>();
  const [ownHeads, setOwnHeads] = useState<A.Heads | undefined>();

  useEffect(() => {
    // hack: since we have two sync indictators we hard code the storage ids here
    // otherwise one of the subscriptions would win, since subscribe unsubscribes any existing storageIds that are not in the list
    // maybe we should reconsider this api
    // todo: remove this once we got rid of the duplicte
    repo.subscribeToRemotes([
      AUTOMERGE_SYNC_SERVER_STORAGE_ID,
      JACQUARD_SYNC_SERVER_STORAGE_ID,
    ]);
  }, [repo]);

  const [machineConfig] = useState(() =>
    getSyncIndicatorMachine({
      connectionInitTimeout: 2000,
      maxSyncMessageDelay: 1000,
      isInternetConnected: navigator.onLine,
      isSyncServerConnected: true,
    })
  );

  const [machine, send] = useMachine(machineConfig);

  // online / offline listener
  useEffect(() => {
    const onOnline = () => {
      send({ type: "INTERNET_CONNECTED" });
    };

    const onOffline = () => {
      send({ type: "INTERNET_DISCONNECTED" });
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [send]);

  // sync server connect / disconnect handling
  // todo: need reachability information for that

  // heads change listener
  useEffect(() => {
    if (machine.matches("sync.unknown")) {
      const syncServerHeads = handle.getRemoteHeads(storageId);
      setSyncServerHeads(syncServerHeads ?? []); // initialize to empty heads if we have no state

      handle.doc().then((doc) => {
        setOwnHeads(A.getHeads(doc));
      });
    }

    const onChange = () => {
      const doc = handle.docSync();
      if (doc) {
        setOwnHeads(A.getHeads(doc));
      }
    };

    const onRemoteHeads = ({ storageId, heads }) => {
      if (storageId === storageId) {
        send({ type: "RECEIVED_SYNC_MESSAGE" });
        setSyncServerHeads(heads);
        setLastSyncUpdate(Date.now());
      }
    };

    handle.on("change", onChange);
    handle.on("remote-heads", onRemoteHeads);

    return () => {
      handle.off("change", onChange);
      handle.off("remote-heads", onRemoteHeads);
    };
  }, [handle]);

  useEffect(() => {
    if (!ownHeads || !syncServerHeads) {
      return;
    }

    if (A.equals(ownHeads, syncServerHeads)) {
      send({ type: "IS_IN_SYNC" });
    } else {
      send({ type: "IS_OUT_OF_SYNC" });
    }
  }, [ownHeads, syncServerHeads]);

  return {
    ownHeads,
    syncServerHeads,
    lastSyncUpdate,
    isInternetConnected: machine.matches("internet.connected"),
    syncState: machine.matches("sync.unknown")
      ? SyncState.Unknown
      : machine.matches("sync.inSync")
      ? SyncState.InSync
      : SyncState.OutOfSync,

    // todo: add reachability check, currently this value will be always true
    syncServerConnectionError: machine.matches("syncServer.disconnected.error"),
    syncServerResponseError: machine.matches("sync.outOfSync.error"),
  };
}

interface SyncIndicatorMachineConfig {
  // the duration we wait for the sync server to respond in the unsynced state before we show an error
  // the timer starts once both internet.connected and sync.isOutOfSync become true
  connectionInitTimeout: number;

  // the duration we wait for the sync server to respond in the unsynced state before we show an error
  // the timer starts once both internet.connected and sync.isOutOfSync become true
  maxSyncMessageDelay: number;

  // initial internet connection state
  isInternetConnected?: boolean;

  // initial sync server connection state
  isSyncServerConnected?: boolean;

  // initial is sync state
  isInSync?: boolean;
}

export function getSyncIndicatorMachine({
  connectionInitTimeout,
  maxSyncMessageDelay,
  isInternetConnected = false,
  isSyncServerConnected = false,
}: SyncIndicatorMachineConfig) {
  return createMachine(
    {
      id: "syncIndicator",
      type: "parallel",
      states: {
        internet: {
          initial: isInternetConnected ? "connected" : "disconnected",
          states: {
            connected: {
              after: {
                [connectionInitTimeout]: {
                  actions: "connectionInitTimeout",
                },
              },
              on: {
                INTERNET_DISCONNECTED: "disconnected",
              },
            },
            disconnected: {
              on: {
                INTERNET_CONNECTED: "connected",
              },
            },
          },
        },
        sync: {
          initial: "unknown",
          states: {
            unknown: {
              on: {
                IS_OUT_OF_SYNC: "outOfSync",
                IS_IN_SYNC: "inSync",
              },
            },
            inSync: {
              on: {
                IS_OUT_OF_SYNC: "outOfSync",
              },
            },
            outOfSync: {
              initial: "ok",
              on: {
                IS_IN_SYNC: "inSync",
                RECEIVED_SYNC_MESSAGE: "outOfSync",
                CONNECTION_INIT_TIMEOUT: "outOfSync",
              },
              states: {
                ok: {
                  after: {
                    // every time we re-enter the out of sync state the timeout gets reset
                    [maxSyncMessageDelay]: {
                      target: "error",
                      guard: stateIn({ internet: "connected" }),
                    },
                  },
                },
                error: {},
              },
            },
          },
        },
        syncServer: {
          initial: isSyncServerConnected ? "connected" : "disconnected",
          states: {
            connected: {
              on: {
                SYNC_SERVER_DISCONNECTED: "disconnected.error",
              },
            },
            disconnected: {
              initial: "ok",
              on: {
                SYNC_SERVER_CONNECTED: "connected",
                CONNECTION_INIT_TIMEOUT: ".error",
              },
              states: {
                ok: {},
                error: {},
              },
            },
          },
        },
      },
    },
    {
      actions: {
        connectionInitTimeout: raise({ type: "CONNECTION_INIT_TIMEOUT" }),
      },
    }
  );
}
