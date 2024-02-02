import * as A from "@automerge/automerge/next";
import { AutomergeUrl } from "@automerge/automerge-repo";
import { PatchWithAttr } from "@automerge/automerge-wasm"; // todo: should be able to import from @automerge/automerge
import { TextPatch } from "@/chronicle/utils";

export type Comment = {
  id: string;
  content: string;
  contactUrl?: AutomergeUrl;
  timestamp: number;

  // A legacy field for backwards compatibility.
  // Was used to point to user objects in the doc itself.
  // Now superceded by contactUrl.
  userId?: string | null;
};

/** Attempting to give diff patches stable identity across doc versions,
 * for the purposes of equivalence checks... TBD how this turns out.
 **/
// type PatchWithStableID = A.Patch & { id: string }; // patch id = fromCursor + action
// two heads + a numeric extent?
// just a mark?
// "diff from heads" + spatial range (as cursor) + (optional to heads)
// groupings as an input to the diff algorithm?

export type EditRange = {
  fromCursor: string;
  toCursor: string;
};

export type ResolvedEditRange = EditRange & {
  from: number;
  to: number;
};

export type ThreadAnnotation = {
  type: "thread";
  id: string;
  comments: Comment[];
  resolved: boolean;
  fromCursor: string; // Automerge cursor
  toCursor: string; // Automerge cursor
};

export type PatchAnnotation = {
  type: "patch";
  patch: A.Patch | PatchWithAttr<AutomergeUrl> | TextPatch;
  id: string;
  fromHeads: A.Heads;
  toHeads: A.Heads;
  fromCursor: A.Cursor; // Automerge cursor
  toCursor: A.Cursor; // Automerge cursor
};

export type PersistedDraft = {
  type: "draft";
  id: string;
  title?: string;

  /** generating unique numbers concurrently isn't possible... */
  /** what to do? haiku names...? */
  number: number;
  /** Overall comments on the draft */
  comments: Comment[];
  fromHeads: A.Heads;
  // in the future, add toHeads...?

  /** Individual edits, each with their own comment thread */
  editRangesWithComments: Array<{
    editRange: EditRange;
    comments: Comment[];
  }>;

  // map of authorUrl to heads at which they have approved this
  reviews: Record<AutomergeUrl, A.Heads>;
};

// An in-memory draft annotation, derived from a persisted draft
// - Turn edit ranges into numbers
// - Claim some patches from the current diff
export type DraftAnnotation = Omit<PersistedDraft, "editRangesWithComments"> & {
  editRangesWithComments: Array<{
    editRange: ResolvedEditRange;
    patches: (A.Patch | PatchWithAttr<AutomergeUrl> | TextPatch)[];
    comments: Comment[];
  }>;
};

export type TextAnnotation =
  | DraftAnnotation
  | PatchAnnotation
  | ThreadAnnotation;

// TODO: define some helpers for TextAnnotation which switch on the type;
// eg for seeing if the annotation overlaps with a given cursor position...

export type AnnotationPosition = {
  from: number;
  to: number;
  active: boolean;
};

/** Augment a persistent comment thread w/ ephemeral info for the UI */
export type TextAnnotationForUI = TextAnnotation & AnnotationPosition;

export type TextAnnotationWithPosition = TextAnnotationForUI & {
  yCoord: number;
};

export type User = {
  id: string;
  name: string;
};

type _MarkdownDoc = {
  content: string;
  commentThreads: { [key: string]: ThreadAnnotation };
  drafts: { [key: string]: PersistedDraft };
  users: User[];
};

export type Copyable = {
  copyMetadata: {
    /* A pointer to the source where this was copied from */
    source: {
      url: AutomergeUrl;
      copyHeads: A.Heads;
    } | null;

    /* A pointer to copies of this doc */
    copies: Array<{
      url: AutomergeUrl;
      copyTimestamp: number;
      name: string;
    }>;
  };
};

export type Tag = { name: string; heads: A.Heads };
export type Taggable = {
  // TODO: should we model this as a map instead?
  tags: Tag[];
};

export type Diffable = {
  diffBase: A.Heads;
};

export type MarkdownDoc = _MarkdownDoc & Copyable & Taggable & Diffable;

// A data structure that lets us pass around diffs while remembering
// where they came from
export type DiffWithProvenance = {
  patches: (A.Patch | PatchWithAttr<AutomergeUrl> | TextPatch)[]; // just pile on more things, it could be anyone of these three ...
  fromHeads: A.Heads;
  toHeads: A.Heads;
};
