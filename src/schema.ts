import { Heads } from "@automerge/automerge";

export type Comment = {
  id: string;
  content: string;
  userId: string | null;
  timestamp: number;
};

export type CommentThread = {
  id: string;
  comments: Comment[];
  resolved: boolean;
  fromCursor: string; // Automerge cursor
  toCursor: string; // Automerge cursor
};

export type CommentThreadForUI = CommentThread & {
  from: number;
  to: number;
  active: boolean;
};

export type CommentThreadWithPosition = CommentThreadForUI & { yCoord: number };

export type User = {
  id: string;
  name: string;
};

export type MarkdownDoc = {
  content: string;
  commentThreads: { [key: string]: CommentThread };
  users: User[];
};

export type LocalSession = {
  userId: string | null;
};
