import { AutomergeUrl } from "@automerge/automerge-repo";
import * as A from "@automerge/automerge/next";
import { TextPatch } from "./utils";
import { HasAssets } from "@/os/assets";

export type Branch = {
  name: string;
  /** URL pointing to the clone doc */
  url: AutomergeUrl;
  /** timestamp when the branch was created */
  createdAt: number;
  /** Heads when the branch was created */
  branchHeads: A.Heads;
  /** author contact doc URL for branch creator */
  createdBy?: AutomergeUrl;

  mergeMetadata?: {
    /** timestamp when the branch was merged */
    mergedAt: number;
    /** Heads of the branch at the point it was merged */
    mergeHeads: A.Heads;
    /** author contact doc URL for branch merger */
    mergedBy: AutomergeUrl;
  };
};

export type Branchable = {
  branchMetadata: {
    /* A pointer to the source where this was copied from */
    source: {
      url: AutomergeUrl;
      branchHeads: A.Heads; // the heads at which this branch was forked off
    } | null;

    /* A pointer to copies of this doc */
    branches: Array<Branch>;
  };
};

export type Tag = {
  name: string;
  heads: A.Heads;
  createdAt: number;
  createdBy?: AutomergeUrl;
};
export type Taggable = {
  // TODO: should we model this as a map instead?
  tags: Tag[];
};

export type Diffable = {
  diffBase: A.Heads;
};

// A data structure that lets us pass around diffs while remembering
// where they came from
export type DiffWithProvenance = {
  patches: (A.Patch | TextPatch)[];
  /** The heads of the doc before the patches */
  fromHeads: A.Heads;
  /** The heads of the doc after the patches */
  toHeads: A.Heads;
};

export type DiscussionComment = {
  id: string;
  content: string;
  contactUrl?: AutomergeUrl;
  timestamp: number;
};

// Right now discussions are both used in the timeline and for comments on the document
// We should split this up and use separate concepts
export type Discussion<T> = {
  id: string;
  heads: A.Heads;
  resolved: boolean;
  comments: DiscussionComment[];

  // a list of doc anchors that this discussion refers to
  // an empty anchors array means, that this discussion is a general comment on the overall document
  anchors: T[];
};

export type AnnotationGroup<T, V> = {
  annotations: Annotation<T, V>[];
  discussion?: Discussion<T>;
};

export type CommentState<T> =
  | { type: "edit"; commentId: string }
  | { type: "create"; target: string | T[] | undefined };

export type AnnotationGroupCommentState =
  | { type: "create" }
  | { type: "edit"; commentId: string };

export type AnnotationGroupWithUIState<T, V> = AnnotationGroup<T, V> & {
  state: "focused" | "expanded" | "neutral";
  comment?: AnnotationGroupCommentState;
};

export type Discussable<T> = {
  discussions: { [key: string]: Discussion<T> };
};

export type HasChangeGroupSummaries = {
  changeGroupSummaries: {
    [key: string]: {
      title: string;
    };
  };
};

export type HasVersionControlMetadata<T, V> = HasChangeGroupSummaries &
  Branchable &
  Taggable &
  Diffable &
  Discussable<T> &
  // @Paul 5/24/24
  // todo: we should rethink how to structure core interfaces
  // the application now assumes that all document types in the system implement HasVersionControlMetadata
  // HasAssets is also a universal interface that can be used with any document but it's not really related to versioning
  // We should create a base schema that's a union of all interfaces that we can assume all documents implement but
  // split them up into logical sub interfaces like versioning, commenting, assets, etc
  HasAssets;

export type AnnotationId = string & { __annotationId: true };

interface AddAnnotation<A, V> {
  type: "added";
  anchor: A;
  added: V;
}

interface DeleteAnnotation<A, V> {
  type: "deleted";
  anchor: A;
  deleted: V;
}

interface ChangeAnnotation<A, V> {
  type: "changed";
  anchor: A;
  before: V;
  after: V;
}

export interface HighlightAnnotation<A, V> {
  type: "highlighted";
  anchor: A;
  value: V;
}

export type Annotation<T, V> =
  | AddAnnotation<T, V>
  | DeleteAnnotation<T, V>
  | ChangeAnnotation<T, V>
  | HighlightAnnotation<T, V>;

export type AnnotationWithUIState<T, V> = Annotation<T, V> & {
  /** Whether the annotation should be visually emphasized in the UI (eg, with darker coloring).
   *  This is used to indicate hovered/selected annotations within the UI.
   */
  isEmphasized: boolean;

  /** Whether the annotation should be scrolled into view in the UI.
   */
  shouldBeVisibleInViewport: boolean;
};

export interface AnnotationPosition<T, V> {
  x: number;
  y: number;
  annotation: Annotation<T, V>;
}

export const initVersionControlMetadata = (doc: any) => {
  doc.branchMetadata = {
    source: null,
    branches: [],
  };
  doc.discussions = {};
  doc.tags = [];
  doc.changeGroupSummaries = {};
};
