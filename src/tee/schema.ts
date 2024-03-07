import * as A from "@automerge/automerge/next";
import { AutomergeUrl } from "@automerge/automerge-repo";
import { PatchWithAttr } from "@automerge/automerge-wasm"; // todo: should be able to import from @automerge/automerge
import { TextPatch } from "@/patchwork/utils";
import {
  Branchable,
  Taggable,
  Diffable,
  SpatialBranchable,
  Discussable,
  Discussion,
  HasChangeGroupSummaries,
  HasPatchworkMetadata,
} from "@/patchwork/schema";

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

// this will eventually replace thread annotations
export type DiscussionAnnotation = {
  type: "discussion";
  id: string;
  discussion: Discussion;
};

export type TextAnnotation =
  | DraftAnnotation
  | PatchAnnotation
  | ThreadAnnotation
  | DiscussionAnnotation;

// TODO: define some helpers for TextAnnotation which switch on the type;
// eg for seeing if the annotation overlaps with a given cursor position...

export type AnnotationPosition = {
  from: number;
  to: number;
  active: boolean;
};

/** Augment a persistent comment thread w/ ephemeral info for the UI */
export type TextAnnotationForUI = TextAnnotation & AnnotationPosition;

export type DiscussionAnotationForUI = DiscussionAnnotation &
  AnnotationPosition;

export type TextAnnotationWithPosition = TextAnnotationForUI & {
  yCoord: number;
};

export type User = {
  id: string;
  name: string;
};

// todo: split content of document and metadata
// currently branches copy also global metadata
// unclear if comments should be part of the doc or the content
export type MarkdownDoc = HasPatchworkMetadata & {
  content: string;
  commentThreads: { [key: string]: ThreadAnnotation };

  /** Important note: these are what we call "edit groups" in the UI currently */
  drafts: { [key: string]: PersistedDraft };
  users: User[];
};
