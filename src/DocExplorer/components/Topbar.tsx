import { AutomergeUrl, isValidAutomergeUrl } from "@automerge/automerge-repo";
import React, { useCallback } from "react";
import {
  Download,
  GitForkIcon,
  Menu,
  MoreHorizontal,
  SaveIcon,
  ShareIcon,
  Trash2Icon,
} from "lucide-react";
import {
  useDocument,
  useHandle,
  useRepo,
} from "@automerge/automerge-repo-react-hooks";
import { asMarkdownFile, markCopy } from "../../tee/datatype";
import { SyncIndicatorWrapper } from "./SyncIndicator";
import { AccountPicker } from "./AccountPicker";
import { MarkdownDoc } from "@/tee/schema";
import { getTitle } from "@/tee/datatype";
import { saveFile } from "../utils";
import { DocLink, useCurrentRootFolderDoc } from "../account";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { save } from "@automerge/automerge";
import { Tool } from "./DocExplorer";

type TopbarProps = {
  showSidebar: boolean;
  setShowSidebar: (showSidebar: boolean) => void;
  selectedDocUrl: AutomergeUrl | null;
  selectDoc: (docUrl: AutomergeUrl | null) => void;
  deleteFromAccountDocList: (docUrl: AutomergeUrl) => void;

  tools: Tool[];
  activeTool: Tool;
  setActiveTool: (tool: Tool) => void;
};

export const Topbar: React.FC<TopbarProps> = ({
  showSidebar,
  setShowSidebar,
  selectedDocUrl,
  selectDoc,
  deleteFromAccountDocList,
  tools,
  activeTool,
  setActiveTool,
}) => {
  const repo = useRepo();
  const [rootFolderDoc, changeRootFolderDoc] = useCurrentRootFolderDoc();
  const selectedDocName = rootFolderDoc?.docs.find(
    (doc) => doc.url === selectedDocUrl
  )?.name;
  const selectedDocHandle = useHandle<MarkdownDoc>(selectedDocUrl);

  // GL 12/13: here we assume this is a TEE Markdown doc, but in future should be more generic.
  const [selectedDoc] = useDocument<MarkdownDoc>(selectedDocUrl);

  const exportAsMarkdown = useCallback(() => {
    const file = asMarkdownFile(selectedDoc);
    saveFile(file, "index.md", [
      {
        accept: {
          "text/markdown": [".md"],
        },
      },
    ]);
  }, [selectedDoc]);

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
        {selectedDocName}
      </div>
      <div className="ml-1 mt-[-2px]">
        {isValidAutomergeUrl(selectedDocUrl) && (
          <SyncIndicatorWrapper docUrl={selectedDocUrl} />
        )}
      </div>
      <div className="ml-6">
        {tools.map((tool) => (
          <div
            key={tool.id}
            className={`inline-block px-2 py-1 mr-1 text-xs text-gray-700 hover:bg-gray-200 cursor-pointer ${
              tool.id === activeTool.id ? "bg-gray-300" : ""
            } rounded-full`}
            onClick={() => setActiveTool(tool)}
          >
            {tool.name}
          </div>
        ))}
      </div>
      <div className="ml-auto mr-4">
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
                // todo: is this a reasonable way to get the base URL?
                // We could also get a base URL more explicitly somehow?
                const baseUrl = window.location.href.split("#")[0];
                navigator.clipboard.writeText(`${baseUrl}#${selectedDocUrl}`);
              }}
            >
              <ShareIcon
                className="inline-block text-gray-500 mr-2"
                size={14}
              />{" "}
              Copy share URL
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                const newHandle = repo.clone<MarkdownDoc>(selectedDocHandle);
                newHandle.change((doc) => {
                  markCopy(doc);
                });
                const newDocLink: DocLink = {
                  url: newHandle.url,
                  name: getTitle(newHandle.docSync().content),
                  type: "essay",
                };

                const index = rootFolderDoc.docs.findIndex(
                  (doc) => doc.url === selectedDocUrl
                );
                changeRootFolderDoc((doc) =>
                  doc.docs.splice(index + 1, 0, newDocLink)
                );

                selectDoc(newDocLink.url);
              }}
            >
              <GitForkIcon
                className="inline-block text-gray-500 mr-2"
                size={14}
              />{" "}
              Make a copy
            </DropdownMenuItem>

            <DropdownMenuItem onClick={() => exportAsMarkdown()}>
              <Download size={14} className="inline-block text-gray-500 mr-2" />{" "}
              Export as Markdown
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => downloadAsAutomerge()}>
              <SaveIcon size={14} className="inline-block text-gray-500 mr-2" />{" "}
              Download Automerge file
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => deleteFromAccountDocList(selectedDocUrl)}
            >
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
