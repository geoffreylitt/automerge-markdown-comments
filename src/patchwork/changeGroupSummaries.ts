import { DocHandle } from "@automerge/automerge-repo";
import { ChangeGroup } from "./groupChanges";
import { DiffWithProvenance, HasChangeGroupSummaries } from "./schema";
import { Doc } from "@automerge/automerge";
import { getStringCompletion } from "@/llm";
import { debounce, pick } from "lodash";
import { useCallback, useEffect } from "react";

export const populateChangeGroupSummaries = async <T>({
  groups,
  handle,
  force,
}: {
  groups: ChangeGroup<T>[];
  handle: DocHandle<HasChangeGroupSummaries>;
  force?: boolean;
}) => {
  handle.change((doc) => {
    if (!doc.changeGroupSummaries) {
      doc.changeGroupSummaries = {};
    }
  });

  for (const [index, group] of groups.entries()) {
    if (!force && handle.docSync().changeGroupSummaries[group.id]) {
      continue;
    }
    await populateGroupSummary({
      group,
      docBefore: groups[index - 1]?.docAtEndOfChangeGroup ?? {},
      handle,
    });
  }
};

const populateGroupSummary = async <T>({
  group,
  docBefore,
  handle,
}: {
  group: ChangeGroup<T>;
  docBefore: any;
  handle: DocHandle<HasChangeGroupSummaries>;
}) => {
  const docAfter = group.docAtEndOfChangeGroup;
  const summary = await autoSummarizeGroup({
    docBefore,
    docAfter,
    diff: group.diff,
  });
  handle.change((doc) => {
    doc.changeGroupSummaries[group.id] = {
      title: summary,
    };
  });
};

// TODO: This thing hardcodes logic specific to TEE docs;
// move that stuff to the TEE datatype somehow...

const autoSummarizeGroup = async ({
  docBefore,
  docAfter,
  diff,
}: {
  docBefore: Doc<unknown>;
  docAfter: Doc<unknown>;
  diff: DiffWithProvenance;
}): Promise<string> => {
  const prompt = `
Summarize the changes in this diff in a few words.

Only return a few words, not a full description. No bullet points.

Here are some good examples of descriptive summaries:

wrote initial outline
changed title
small wording changes
turned outline into prose
lots of small edits
total rewrite
a few small tweaks
reworded a paragraph

## Doc before

${JSON.stringify(pick(docBefore, ["content", "commentThreads"]), null, 2)}

## Doc after

${JSON.stringify(pick(docAfter, ["content", "commentThreads"]), null, 2)}

## Diff

${JSON.stringify(
  diff.patches.filter(
    (p) => p.path[0] === "content" || p.path[0] === "commentThreads"
  ),
  null,
  2
)}
`;

  return getStringCompletion(prompt);
};

export const useAutoPopulateChangeGroupSummaries = <T>({
  changeGroups,
  handle,
  msBetween = 10000,
}: {
  changeGroups: ChangeGroup<T>[];
  handle: DocHandle<HasChangeGroupSummaries>;
  msBetween?: number;
}) => {
  const debouncedPopulate = useCallback(
    debounce(({ groups, handle, force }) => {
      populateChangeGroupSummaries({ groups, handle, force });
    }, msBetween),
    []
  );

  useEffect(() => {
    debouncedPopulate({
      groups: changeGroups,
      handle,
    });

    // Cleanup function to cancel the debounce if the component unmounts
    return () => {
      debouncedPopulate.cancel();
    };
  }, [changeGroups, handle, debouncedPopulate]);
};
