import {
  AutomergeUrl,
  Repo,
  isValidAutomergeUrl,
} from "@automerge/automerge-repo";
import React, { useCallback, useEffect, useState } from "react";
import { TinyEssayEditor } from "../../tee/components/TinyEssayEditor";
import { useDocument, useRepo } from "@automerge/automerge-repo-react-hooks";
import { init } from "../../tee/datatype";
import { Button } from "@/components/ui/button";

import {
  DocType,
  FolderDoc,
  useCurrentAccount,
  useCurrentAccountDoc,
  useCurrentRootFolderDoc,
} from "../account";

import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { LoadingScreen } from "../../automerge-repo-schema-utils/LoadingScreen";
import { Essay } from "@/tee/schemas/Essay";
import { ChangeFn } from "@automerge/automerge";
import { getTitle } from "@/tee/schemas/transforms";
import { withDocument } from "@/automerge-repo-schema-utils/LoadDocument";

export const DocExplorer: React.FC = () => {
  const repo = useRepo();
  const currentAccount = useCurrentAccount();
  const [accountDoc, changeAccountDoc] = useCurrentAccountDoc();
  const [rootFolderDoc, changeRootFolderDoc] = useCurrentRootFolderDoc();

  const [showSidebar, setShowSidebar] = useState(true);

  const { selectedDoc, selectDoc, selectedDocUrl, openDocFromUrl } =
    useSelectedDoc({ rootFolderDoc, changeRootFolderDoc, repo });

  const selectedDocName = rootFolderDoc?.docs.find(
    (doc) => doc.url === selectedDocUrl
  )?.name;

  const addNewDocument = useCallback(
    ({ type }: { type: DocType }) => {
      if (type !== "essay") {
        throw new Error("Only essays are supported right now");
      }

      const newDocHandle = repo.create<Essay>();
      newDocHandle.change(init);

      if (!rootFolderDoc) {
        return;
      }

      changeRootFolderDoc((doc) =>
        doc.docs.unshift({
          type: "essay",
          name: "Untitled document",
          url: newDocHandle.url,
        })
      );

      selectDoc(newDocHandle.url);
    },
    [changeRootFolderDoc, repo, rootFolderDoc, selectDoc]
  );

  // sync doc names up from TEE docs to the sidebar list.
  useEffect(() => {
    if (selectedDoc === undefined) {
      return;
    }

    if (!selectedDoc.content || typeof selectedDoc.content !== "string") {
      return;
    }
    const title = getTitle(selectedDoc.content);
    // const { title } = parseSync(EssayV1ToHasTitleV1)(selectedDoc);

    changeRootFolderDoc((doc) => {
      const existingDocLink = doc.docs.find(
        (link) => link.url === selectedDocUrl
      );
      if (existingDocLink && existingDocLink.name !== title) {
        existingDocLink.name = title;
      }
    });
  }, [
    selectedDoc,
    selectedDocUrl,
    changeAccountDoc,
    rootFolderDoc,
    changeRootFolderDoc,
  ]);

  // update tab title to be the selected doc
  useEffect(() => {
    document.title = selectedDocName ?? "Essay Editor"; // TODO: generalize beyond TEE
  }, [selectedDocName]);

  // keyboard shortcuts
  useEffect(() => {
    const keydownHandler = (event: KeyboardEvent) => {
      // toggle the sidebar open/closed when the user types cmd-backslash
      if (event.key === "\\" && event.metaKey) {
        setShowSidebar((prev) => !prev);
      }

      // if there's no document selected and the user hits enter, make a new document
      if (!selectedDocUrl && event.key === "Enter") {
        addNewDocument({ type: "essay" });
      }
    };

    window.addEventListener("keydown", keydownHandler);

    // Clean up listener on unmount
    return () => {
      window.removeEventListener("keydown", keydownHandler);
    };
  }, [addNewDocument, selectedDocUrl]);

  const deleteFromRootFolder = (id: string) => {
    const itemIndex = rootFolderDoc?.docs.findIndex((item) => item.url === id);
    if (itemIndex >= 0) {
      if (itemIndex < rootFolderDoc?.docs.length - 1) {
        selectDoc(rootFolderDoc?.docs[itemIndex + 1].url);
      } else if (itemIndex > 1) {
        selectDoc(rootFolderDoc?.docs[itemIndex - 1].url);
      } else {
        selectDoc(null);
      }
      changeRootFolderDoc((doc) => {
        doc.docs.splice(itemIndex, 1);
      });
    }
  };

  if (!accountDoc || !rootFolderDoc) {
    return (
      <LoadingScreen
        docUrl={currentAccount?.handle?.url}
        handle={currentAccount?.handle}
      />
    );
  }

  return (
    <div className="flex flex-row w-screen h-screen overflow-hidden">
      <div
        className={`${
          showSidebar ? "w-64" : "w-0 translate-x-[-100%]"
        } flex-shrink-0 bg-gray-100 border-r border-gray-400 transition-all duration-100 overflow-hidden  `}
      >
        <Sidebar
          selectedDocUrl={selectedDocUrl}
          selectDoc={selectDoc}
          hideSidebar={() => setShowSidebar(false)}
          addNewDocument={addNewDocument}
          openDocFromUrl={openDocFromUrl}
        />
      </div>
      <div
        className={`flex-grow relative h-screen ${
          !selectedDocUrl ? "bg-gray-200" : ""
        }`}
      >
        <div className="flex flex-col h-screen">
          <Topbar
            showSidebar={showSidebar}
            setShowSidebar={setShowSidebar}
            selectedDocUrl={selectedDocUrl}
            selectDoc={selectDoc}
            deleteFromAccountDocList={deleteFromRootFolder}
          />
          <div className="flex-grow overflow-hidden">
            {!selectedDocUrl && (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div>
                  <p className="text-center cursor-default select-none mb-4">
                    No document selected
                  </p>
                  <Button
                    onClick={() => addNewDocument({ type: "essay" })}
                    variant="outline"
                  >
                    Create new document
                    <span className="ml-2">(&#9166;)</span>
                  </Button>
                </div>
              </div>
            )}

            {selectedDocUrl &&
              withDocument(TinyEssayEditor, selectedDocUrl, Essay)}
          </div>
        </div>
      </div>
    </div>
  );
};

// Drive the currently selected doc using the URL hash
// (We encapsulate the selection state in a hook so that the only
// API for changing the selection is properly thru the URL)
const useSelectedDoc = ({
  rootFolderDoc,
  changeRootFolderDoc,
  repo,
}: {
  rootFolderDoc: FolderDoc;
  changeRootFolderDoc: ChangeFn<(doc: FolderDoc) => void>;
  repo: Repo;
}) => {
  const [selectedDocUrl, setSelectedDocUrl] = useState<AutomergeUrl>(null);
  const [selectedDoc] = useDocument<Essay>(selectedDocUrl);

  const selectDoc = (docUrl: AutomergeUrl | null) => {
    if (docUrl) {
      window.location.hash = docUrl;
    } else {
      window.location.hash = "";
    }
  };

  // Add an existing doc to our collection
  const openDocFromUrl = useCallback(
    (docUrl: AutomergeUrl) => {
      if (!rootFolderDoc) {
        return;
      }
      // TODO: validate the doc's data schema here before adding to our collection
      if (!rootFolderDoc?.docs.find((doc) => doc.url === docUrl)) {
        changeRootFolderDoc((doc) =>
          doc.docs.unshift({
            type: "essay",
            name: "Unknown document", // TODO: sync up the name once we load the data
            url: docUrl,
          })
        );
      }

      setSelectedDocUrl(docUrl);
    },
    [rootFolderDoc, changeRootFolderDoc]
  );

  // observe the URL hash to change the selected document
  useEffect(() => {
    const hashChangeHandler = () => {
      const hash = window.location.hash;
      if (hash && hash.length > 1) {
        const docUrl = hash.slice(1);
        if (!isValidAutomergeUrl(docUrl)) {
          console.error(`Invalid Automerge URL in URL: ${docUrl}`);
          return;
        }
        openDocFromUrl(docUrl);

        // @ts-expect-error - adding property to window
        window.handle = repo.find(docUrl);
      }
    };

    hashChangeHandler();

    // Listen for hash changes
    window.addEventListener("hashchange", hashChangeHandler, false);

    // Clean up listener on unmount
    return () => {
      window.removeEventListener("hashchange", hashChangeHandler, false);
    };
  }, [openDocFromUrl]);

  return {
    selectedDocUrl,
    selectedDoc,
    selectDoc,
    openDocFromUrl,
  };
};
