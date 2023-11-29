import { MarkdownDoc } from "../schema";
import { DocHandle } from "@automerge/automerge-repo";
import {
  Heads,
  decodeChange,
  diff,
  getAllChanges,
  getHeads,
} from "@automerge/automerge/next";
import { EditorView } from "@codemirror/view";

type DocLine = {
  text: string;
  start: number;
  type: "inserted" | "deleted" | "unchanged";
};

function patchOverlapsLine(start: number, end: number, patch: Patch): boolean {
  if (
    !(patch.action === "splice" || patch.action === "del") &&
    patch.path[0] !== "content"
  ) {
    return false;
  }
  return patch.path[1] < end && patch.path[1] + (patch.length || 0) > start;
}

export const History: React.FC<{
  handle: DocHandle<MarkdownDoc>;
  diffHeads: Heads;
  setDiffHeads: (heads: Heads) => void;
  codemirrorView: EditorView;
}> = ({ handle, diffHeads, setDiffHeads }) => {
  const doc = handle.docSync();
  const changes = getAllChanges(doc);

  // TODO: pass in patches from above, don't duplicate diff work
  const patches = diff(doc, diffHeads, getHeads(doc));

  let currentIndex = 0;
  const linesNested = doc.content.split("\n").map((line) => {
    const lineObjects = (line.match(/.{1,80}/g) || [""]).map((text) => {
      const lineObject: DocLine = {
        text,
        start: currentIndex,
        type: "unchanged",
      };
      for (const patch of patches) {
        if (
          !(
            (patch.action === "splice" || patch.action === "del") &&
            patch.path[0] === "content"
          )
        ) {
          continue;
        }
        if (
          patchOverlapsLine(currentIndex, currentIndex + text.length, patch)
        ) {
          console.log("in here!");
          console.log({ patch });
          if (patch.action === "splice") {
            lineObject.type = "inserted";
          } else if (patch.action === "del" && lineObject.type !== "inserted") {
            lineObject.type = "deleted";
          }
        }
      }
      currentIndex += text.length;
      return lineObject;
    });
    return lineObjects;
  });
  const lines = [].concat(...linesNested);

  return (
    <div>
      <div className="p-4 text-gray-500 uppercase font-medium text-sm">
        Version Control
      </div>
      <div className="p-2 border-t border-b border-gray-300">
        <div className="text-xs">Diff against older draft</div>
        <input
          type="range"
          min="0"
          max={changes.length - 1}
          onChange={(e) => {
            const change = changes[e.target.value];
            setDiffHeads([decodeChange(change).hash]);
          }}
          value={changes.findIndex(
            (change) => decodeChange(change).hash === diffHeads[0]
          )}
        />
      </div>
      <div className="p-2">
        {lines.map((line, i) => (
          <div
            className={`text-[4px] h-[6px] w-48 ${
              line.type === "inserted"
                ? "bg-green-200"
                : line.type === "deleted"
                ? "bg-red-200"
                : ""
            }`}
            key={i}
          >
            {line.text}
          </div>
        ))}
      </div>
    </div>
  );
};
