import { DocHandle, isValidAutomergeUrl, Doc } from "@automerge/automerge-repo";
import React, { useCallback } from "react";
import {
  Bot,
  Download,
  EditIcon,
  GitForkIcon,
  Menu,
  MoreHorizontal,
  SaveIcon,
  ShareIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";
import { useRepo } from "@automerge/automerge-repo-react-hooks";
import {
  AUTOMERGE_SYNC_SERVER_STORAGE_ID,
  JACQUARD_SYNC_SERVER_STORAGE_ID,
  SyncIndicator,
} from "./SyncIndicator";
import { AccountPicker } from "./AccountPicker";
import { saveFile } from "../utils";
import { DocLink, DocLinkWithFolderPath, FolderDoc } from "@/datatypes/folder";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { getHeads, save } from "@automerge/automerge";
import { MarkdownDoc } from "@/datatypes/markdown/schema";
import { DatatypeId, DATA_TYPES } from "../../datatypes";
import { runBot } from "@/datatypes/bot/essayEditingBot";
import { Button } from "@/components/ui/button";
import { HasVersionControlMetadata } from "@/os/versionControl/schema";
import { useDatatypeSettings, useRootFolderDocWithChildren } from "../account";
import botDataType from "@/datatypes/bot";
import { getUrlSafeName } from "../hooks/useSelectedDocLink";
import { genericExportMethods } from "@/os/fileExports";

type TopbarProps = {
  showSidebar: boolean;
  setShowSidebar: (showSidebar: boolean) => void;
  selectedDocLink: DocLinkWithFolderPath | undefined;
  selectDocLink: (docLink: DocLinkWithFolderPath | null) => void;
  selectedDoc: Doc<HasVersionControlMetadata<unknown, unknown>> | undefined;
  selectedDocHandle:
    | DocHandle<HasVersionControlMetadata<unknown, unknown>>
    | undefined;
  addNewDocument: (doc: { type: DatatypeId }) => void;
  removeDocLink: (link: DocLinkWithFolderPath) => void;
};

export const Topbar: React.FC<TopbarProps> = ({
  showSidebar,
  setShowSidebar,
  selectDocLink,
  selectedDocLink,
  selectedDoc,
  selectedDocHandle,
  removeDocLink,
}) => {
  const repo = useRepo();
  const { flatDocLinks } = useRootFolderDocWithChildren();

  const datatypeSettings = useDatatypeSettings();
  const isBotDatatypeEnabled =
    datatypeSettings?.enabledDatatypeIds[botDataType.id];

  const selectedDocUrl = selectedDocLink?.url;
  const selectedDocName = selectedDocLink?.name;
  const selectedDocType = selectedDocLink?.type;

  const selectedDatatypeMetadata = DATA_TYPES[selectedDocType];

  const downloadAsAutomerge = useCallback(() => {
    const file = new Blob([save(selectedDoc)], {
      type: "application/octet-stream",
    });
    saveFile(file, `${selectedDocUrl}.automerge`, [
      {
        accept: {
          "application/octet-stream": [".automerge"],
        },
      },
    ]);
  }, [selectedDocUrl, selectedDoc]);

  const botDocLinks = flatDocLinks?.filter((doc) => doc.type === "bot") ?? [];

  return (
    <div className="h-10 bg-gray-100 flex items-center flex-shrink-0 border-b border-gray-300">
      {!showSidebar && (
        <div
          className="ml-1 p-1 text-gray-500 bg-gray-100 hover:bg-gray-300 hover:text-gray-500 cursor-pointer  transition-all rounded-sm"
          onClick={() => setShowSidebar(!showSidebar)}
        >
          <Menu size={18} />
        </div>
      )}
      <div className="ml-3 text-sm text-gray-700 font-bold">
        {selectedDatatypeMetadata && (
          <selectedDatatypeMetadata.icon className="inline mr-1" size={14} />
        )}
        {selectedDocName}
      </div>
      <div className="ml-1 mt-[-2px]">
        {isValidAutomergeUrl(selectedDocUrl) && (
          <>
            <SyncIndicator
              docUrl={selectedDocUrl}
              storageId={AUTOMERGE_SYNC_SERVER_STORAGE_ID}
              name={"sync.automerge.org"}
            />
            <SyncIndicator
              docUrl={selectedDocUrl}
              storageId={JACQUARD_SYNC_SERVER_STORAGE_ID}
              name={"jacquard.sync"}
            />
          </>
        )}
      </div>

      {/* todo: the logic for running bots and when to show the menu should
       probably live inside the bots directory --
       how do datatypes contribute things to the global topbar? */}
      {selectedDocLink?.type === "essay" && (
        <div className="ml-auto mr-4">
          {isBotDatatypeEnabled && (
            <DropdownMenu>
              <DropdownMenuTrigger>
                <Bot
                  size={18}
                  className="mt-1 mr-21 text-gray-500 hover:text-gray-800"
                />
              </DropdownMenuTrigger>
              <DropdownMenuContent className="mr-4">
                {botDocLinks.length === 0 && (
                  <div>
                    <div className="text-gray-500 max-w-48 p-2">
                      No bots in sidebar. <br />
                      Click "New Bot" or get a share link from someone.
                    </div>
                  </div>
                )}
                {botDocLinks.map((botDocLink) => (
                  <DropdownMenuItem
                    key={botDocLink.url}
                    onClick={async () => {
                      const resultPromise = runBot({
                        botDocUrl: botDocLink.url,
                        targetDocHandle:
                          selectedDocHandle as DocHandle<MarkdownDoc>,
                        repo,
                      });
                      toast.promise(resultPromise, {
                        loading: `Running ${botDocLink.name}...`,
                        success: (result) => (
                          <div className="flex gap-1">
                            <div className="flex items-center gap-2">
                              <div className="max-w-48">
                                {botDocLink.name} ran successfully.
                              </div>
                              <Button
                                onClick={() => {
                                  selectDocLink({
                                    ...selectedDocLink,
                                    branchUrl: result,
                                  });
                                }}
                                className="px-4 h-6"
                              >
                                View branch
                              </Button>
                            </div>
                          </div>
                        ),
                        error: `${botDocLink.name} failed, see console`,
                      });
                    }}
                  >
                    Run {botDocLink.name}
                    <EditIcon
                      size={14}
                      className="inline-block ml-2 cursor-pointer"
                      onClick={(e) => {
                        selectDocLink({ ...botDocLink, type: "essay" });
                        e.stopPropagation();
                      }}
                    />
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      )}
      <div className={`mr-4 ${selectedDocLink?.type !== "essay" && "ml-auto"}`}>
        <DropdownMenu>
          <DropdownMenuTrigger>
            <MoreHorizontal
              size={18}
              className="mt-1 mr-21 text-gray-500 hover:text-gray-800"
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="mr-4">
            <DropdownMenuItem
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                toast.success("Copied to clipboard");
              }}
            >
              <ShareIcon
                className="inline-block text-gray-500 mr-2"
                size={14}
              />{" "}
              Copy share URL
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={async () => {
                const newHandle =
                  repo.clone<HasVersionControlMetadata<unknown, unknown>>(
                    selectedDocHandle
                  );
                newHandle.change((doc: any) => {
                  DATA_TYPES[selectedDocType].markCopy(doc);
                  doc.branchMetadata.source = {
                    url: selectedDocUrl,
                    branchHeads: getHeads(selectedDocHandle.docSync()),
                  };
                });

                const newDocLink: DocLink = {
                  url: newHandle.url,
                  name: await DATA_TYPES[selectedDocType].getTitle(
                    newHandle.docSync(),
                    repo
                  ),
                  type: selectedDocLink.type,
                };

                const folderHandle = repo.find<FolderDoc>(
                  selectedDocLink.folderPath[
                    selectedDocLink.folderPath.length - 1
                  ]
                );
                await folderHandle.whenReady();

                const index = folderHandle
                  .docSync()
                  .docs.findIndex((doc) => doc.url === selectedDocUrl);
                folderHandle.change((doc) =>
                  doc.docs.splice(index + 1, 0, newDocLink)
                );

                // TODO: we used to have a setTimeout here, see if we need to bring it back.
                selectDocLink({
                  ...newDocLink,
                  folderPath: selectedDocLink.folderPath,
                });
              }}
            >
              <GitForkIcon
                className="inline-block text-gray-500 mr-2"
                size={14}
              />{" "}
              Make a copy
            </DropdownMenuItem>

            {(selectedDatatypeMetadata?.fileExportMethods ?? [])
              .concat(genericExportMethods)
              .map((method) => (
                <DropdownMenuItem
                  onClick={async () => {
                    const blob = await method.export(selectedDoc, repo);
                    const filename = `${getUrlSafeName(selectedDocLink.name)}.${
                      method.extension
                    }`;
                    saveFile(blob, filename, [
                      {
                        accept: {
                          [method.contentType]: [`.${method.extension}`],
                        },
                      },
                    ]);
                  }}
                >
                  <Download
                    size={14}
                    className="inline-block text-gray-500 mr-2"
                  />{" "}
                  Export as {method.name}
                </DropdownMenuItem>
              ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => removeDocLink(selectedDocLink)}>
              <Trash2Icon
                className="inline-block text-gray-500 mr-2"
                size={14}
              />{" "}
              Remove from My Documents
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mr-4 mt-1">
        <AccountPicker />
      </div>
    </div>
  );
};
