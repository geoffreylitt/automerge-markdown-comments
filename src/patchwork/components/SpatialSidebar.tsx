import { next as A } from "@automerge/automerge";
import React, {
  forwardRef,
  useEffect,
  useMemo,
  useRef,
  useState,
  useReducer,
} from "react";
import {
  AnnotationGroup,
  Discussion,
  DiscussionComment,
  HasPatchworkMetadata,
} from "@/patchwork/schema";
import { ContactAvatar } from "@/DocExplorer/components/ContactAvatar";
import { getRelativeTimeString, useStaticCallback } from "@/tee/utils";
import { useCurrentAccount } from "@/DocExplorer/account";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  PopoverClose,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Check } from "lucide-react";
import { uuid } from "@automerge/automerge";
import { sortBy } from "lodash";
import {
  Annotation,
  AnnotationPosition,
  AnnotationGroupWithState,
} from "@/patchwork/schema";
import { DocType, docTypes } from "@/DocExplorer/doctypes";
import { MarkdownDocAnchor } from "@/tee/schema";
import { truncate } from "lodash";
import { MessageCircleIcon } from "lucide-react";
import { TLDrawDocAnchor } from "@/tldraw/schema";
import { TLShape } from "@tldraw/tldraw";
import { doAnchorsOverlap, getAnnotationGroupId } from "../utils";

type SpatialSidebarProps = {
  docType: string;
  annotationGroups: AnnotationGroupWithState<unknown, unknown>[];
  selectedAnchors: unknown[];
  changeDoc: (
    changeFn: (doc: HasPatchworkMetadata<unknown, unknown>) => void
  ) => void;
  onChangeCommentPositionMap: (map: PositionMap) => void;
  setSelectedAnnotationGroupId: (id: string) => void;
  setHoveredAnnotationGroupId: (id: string) => void;
};

export const SpatialSidebar = React.memo(
  ({
    docType,
    annotationGroups,
    selectedAnchors,
    changeDoc,
    setSelectedAnnotationGroupId,
    setHoveredAnnotationGroupId,
  }: SpatialSidebarProps) => {
    const [pendingCommentText, setPendingCommentText] = useState("");
    const [annotationGroupIdOfActiveReply, setAnnotationGroupIdOfActiveReply] =
      useState<string>();
    const [scrollOffset, setScrollOffset] = useState(0);
    const account = useCurrentAccount();
    const [scrollContainer, setScrollContainer] = useState<HTMLDivElement>();
    const scrollContainerRect = useMemo(
      () => scrollContainer?.getBoundingClientRect(),
      [scrollContainer]
    );

    const addCommentToAnnotationGroup = (
      annotationGroup: AnnotationGroup<unknown, unknown>,
      content: string
    ) => {
      setAnnotationGroupIdOfActiveReply(undefined);

      changeDoc((doc) => {
        let discussions = doc.discussions;

        // convert docs without discussions
        if (!discussions) {
          doc.discussions = {};
          discussions = doc.discussions;
        }

        let discussionId = annotationGroup?.discussion?.id;

        if (!discussionId) {
          discussionId = uuid();
          discussions[discussionId] = {
            id: discussionId,
            heads: A.getHeads(doc),
            comments: [],
            resolved: false,
            target: annotationGroup.annotations.map(
              (annotation) => annotation.target
            ),
          };
        }

        discussions[discussionId].comments.push({
          id: uuid(),
          content,
          contactUrl: account.contactHandle.url,
          timestamp: Date.now(),
        });
      });
    };

    const createDiscussion = (content: string) => {
      setPendingCommentText("");

      const discussionId = uuid();

      changeDoc((doc) => {
        let discussions = doc.discussions;

        // convert docs without discussions
        if (!discussions) {
          doc.discussions = {};
          discussions = doc.discussions;
        }

        discussions[discussionId] = {
          id: discussionId,
          heads: A.getHeads(doc),
          comments: [
            {
              id: uuid(),
              content,
              contactUrl: account.contactHandle.url,
              timestamp: Date.now(),
            },
          ],
          resolved: false,
          target: selectedAnchors,
        };
      });

      setSelectedAnnotationGroupId(discussionId);
    };

    const resolveDiscussionAtIndex = (index: number) => {
      const discussionGroup = annotationGroups[index];

      let newSelectedAnnotationGroupId;

      const nextAnnotation = annotationGroups[index + 1];
      if (nextAnnotation) {
        newSelectedAnnotationGroupId = getAnnotationGroupId(nextAnnotation);
      } else {
        const prevAnnotation = annotationGroups[index - 1];
        if (prevAnnotation) {
          newSelectedAnnotationGroupId = getAnnotationGroupId(prevAnnotation);
        }
      }

      setSelectedAnnotationGroupId(newSelectedAnnotationGroupId);

      changeDoc((doc) => {
        doc.discussions[discussionGroup.discussion.id].resolved = true;
      });
    };

    return (
      <div className="h-full flex flex-col">
        <div
          ref={setScrollContainer}
          onScroll={(evt) =>
            setScrollOffset((evt.target as HTMLDivElement).scrollTop)
          }
          className="bg-gray-50 flex-1 p-2 flex flex-col z-20 m-h-[100%] overflow-y-auto overflow-x-visible"
        >
          {annotationGroups.map((annotationGroup, index) => {
            const id = getAnnotationGroupId(annotationGroup);
            return (
              <AnnotationGroupView
                docType={docType}
                key={id}
                annotationGroup={annotationGroup}
                isReplyBoxOpen={annotationGroupIdOfActiveReply === id}
                setIsReplyBoxOpen={(isOpen) => {
                  setAnnotationGroupIdOfActiveReply(isOpen ? id : undefined);
                }}
                onResolveDiscussion={() => resolveDiscussionAtIndex(index)}
                onAddComment={(content) => {
                  addCommentToAnnotationGroup(annotationGroup, content);
                }}
                setIsHovered={(isHovered) => {
                  setHoveredAnnotationGroupId(isHovered ? id : undefined);
                }}
                setIsSelected={(isSelected) => {
                  setSelectedAnnotationGroupId(isSelected ? id : undefined);
                }}
                ref={(element) => {
                  /*registerAnnotationElement(
                    JSON.stringify(annotation.target),
                    element
                  )*/
                }}
                onSelectNext={() => {
                  const nextAnnotation = annotationGroups[index + 1];
                  if (nextAnnotation) {
                    setSelectedAnnotationGroupId(
                      getAnnotationGroupId(nextAnnotation)
                    );
                  }
                }}
                onSelectPrev={() => {
                  const prevAnnotation = annotationGroups[index - 1];
                  if (prevAnnotation) {
                    setSelectedAnnotationGroupId(
                      getAnnotationGroupId(prevAnnotation)
                    );
                  }
                }}
              />
            );
          })}
        </div>
        <div className="bg-gray-50 z-10 p-2 flex flex-col gap-2">
          <Textarea
            value={pendingCommentText}
            onChange={(event) => setPendingCommentText(event.target.value)}
            // GL Nov: figure out how to close the popover upon cmd-enter submit
            // GL 12/14: the answer here is going to be to control Popover open
            // state ourselves as we now do elsewhere in the codebase
            onKeyDown={(event) => {
              if (event.key === "Enter" && event.metaKey) {
                /* createDiscussion(pendingCommentText);
                setIsCommentBoxOpen(false);
                event.preventDefault(); */
              }
              event.stopPropagation();
            }}
          />

          <Button
            variant="outline"
            onClick={() => {
              createDiscussion(pendingCommentText);
            }}
          >
            Comment
            <span className="text-gray-400 ml-2 text-xs">⌘⏎</span>
          </Button>
        </div>
      </div>
    );
  }
);

export interface AnnotationGroupViewProps {
  docType: string;
  annotationGroup: AnnotationGroupWithState<unknown, unknown>;
  isReplyBoxOpen: boolean;
  setIsReplyBoxOpen: (isOpen: boolean) => void;
  onResolveDiscussion: () => void;
  onAddComment: (content: string) => void;
  onSelectNext: () => void;
  onSelectPrev: () => void;
  setIsHovered: (isHovered: boolean) => void;
  setIsSelected: (isSelected: boolean) => void;
}

const AnnotationGroupView = forwardRef<
  HTMLDivElement,
  AnnotationGroupViewProps
>(
  <T, V>(
    {
      docType,
      annotationGroup,
      isReplyBoxOpen,
      setIsReplyBoxOpen,
      onResolveDiscussion,
      onAddComment: onReply,
      setIsHovered,
      setIsSelected,
      onSelectNext,
      onSelectPrev,
    }: AnnotationGroupViewProps,
    ref
  ) => {
    const [pendingCommentText, setPendingCommentText] = useState("");
    const [height, setHeight] = useState();
    const [isBeingResolved, setIsBeingResolved] = useState(false);
    const localRef = useRef(null); // Use useRef to create a local ref
    const isExpanded = annotationGroup.state === "expanded";
    const isFocused = annotationGroup.state !== "neutral";

    const setRef = (element: HTMLDivElement) => {
      localRef.current = element; // Assign the element to the local ref
      // Forward the ref to the parent
      if (typeof ref === "function") {
        ref(element);
      } else if (ref) {
        ref.current = element;
      }
    };

    const onStartResolve = () => {
      setHeight(localRef.current.clientHeight);
      // delay, so height is set first for transition
      requestAnimationFrame(() => {
        setIsBeingResolved(true);
      });
    };

    // handle keyboard shortcuts
    /*
     * k / ctrl + p / cmd + p : select previous discussion
     * j / ctrl + n / cmd + n: select next discussion
     * cmd + r / ctrl + r : resolve
     * cmd + enter / ctrl + enter : reply
     * cmd + z / ctrl + z : revert
     */
    useEffect(() => {
      if (!isExpanded) {
        return;
      }

      const onKeydown = (evt: KeyboardEvent) => {
        const isMetaOrControlPressed = evt.ctrlKey || evt.metaKey;

        // select previous discussion
        if (evt.key === "k" || (evt.key === "p" && isMetaOrControlPressed)) {
          onSelectPrev();
          evt.preventDefault();
          evt.stopPropagation();

          return;
        }

        // select next discussion
        if (evt.key === "j" || evt.key === "n") {
          onSelectNext();
          return;
        }

        if (evt.key === "r" && isMetaOrControlPressed) {
          onStartResolve();
          evt.preventDefault();
          evt.stopPropagation();
        }

        if (evt.key === "Enter" && isMetaOrControlPressed) {
          setIsReplyBoxOpen(true);
          evt.preventDefault();
          evt.stopPropagation();
        }
      };

      window.addEventListener("keydown", onKeydown);

      return () => {
        window.removeEventListener("keydown", onKeydown);
      };
    }, [isExpanded, onSelectNext, onSelectPrev]);

    return (
      <div
        onClick={(event) => event.stopPropagation()}
        ref={setRef}
        className={`pt-2 transition-all ${
          isBeingResolved ? "overflow-hidden" : ""
        }`}
        style={
          height !== undefined
            ? {
                height: isBeingResolved ? "0" : `${height}px`,
              }
            : undefined
        }
        onTransitionEnd={() => {
          if (isBeingResolved) {
            onResolveDiscussion();
          }
        }}
      >
        <div
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onClick={() => setIsSelected(true)}
          className="flex flex-col gap-1"
        >
          <div
            className={`flex flex-col gap-1 ${
              isFocused
                ? "border bg-white rounded-sm p-2 border-gray-400 shadow-xl"
                : "border bg-white rounded-sm p-2 border-gray-200 "
            }`}
          >
            {annotationGroup.annotations.map((annotation, index) => {
              if (
                (annotation.type === "added" && !annotation.added) ||
                (annotation.type === "changed" && !annotation.after) ||
                (annotation.type == "deleted" && !annotation.deleted) ||
                (annotation.type == "highlighted" && !annotation.value)
              ) {
                return null;
              }

              const annotationView = (
                <AnnotationView
                  docType={docType}
                  annotation={annotation}
                  key={index}
                />
              );

              return annotationGroup.discussion ? (
                <div
                  className={
                    annotationGroup.discussion
                      ? "p-2 border border-gray-200 rounded-sm"
                      : ""
                  }
                >
                  {annotationView}
                </div>
              ) : (
                annotationView
              );
            })}
            {annotationGroup.discussion?.comments.map((comment, index) => (
              <DiscusssionCommentView comment={comment} key={comment.id} />
            ))}
          </div>

          <div
            className={`overflow-hidden transition-all flex items-center gap-2 ${
              isExpanded ? "h-[43px] opacity-100 mt-2" : "h-[0px] opacity-0"
            }`}
          >
            <Popover
              open={isReplyBoxOpen}
              onOpenChange={(isOpen) => setIsReplyBoxOpen(isOpen)}
            >
              <PopoverTrigger>
                <Button
                  variant="ghost"
                  className="select-none p-2 flex flex-col w-fit"
                  onClick={() => setIsReplyBoxOpen(true)}
                >
                  <div className="flex gap-2 text-gray-600">
                    <MessageCircleIcon size={16} /> Comment
                  </div>
                  <span className="text-gray-400 text-xs w-full text-center">
                    (⌘ + ⏎)
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent>
                <Textarea
                  className="mb-4"
                  value={pendingCommentText}
                  onChange={(event) =>
                    setPendingCommentText(event.target.value)
                  }
                  onKeyDown={(event) => {
                    event.stopPropagation();
                    if (event.key === "Enter" && event.metaKey) {
                      onReply(pendingCommentText);
                      setPendingCommentText("");
                      event.preventDefault();
                    }
                  }}
                />

                <PopoverClose>
                  <Button
                    variant="outline"
                    onClick={() => {
                      onReply(pendingCommentText);
                      setPendingCommentText("");
                    }}
                  >
                    Comment
                    <span className="text-gray-400 ml-2 text-xs">(⌘ + ⏎)</span>
                  </Button>
                </PopoverClose>
              </PopoverContent>
            </Popover>

            {annotationGroup.discussion && (
              <Button
                variant="ghost"
                className="select-none px-2 flex flex-col w-fi"
                onClick={onStartResolve}
              >
                <div className="flex text-gray-600 gap-2">
                  <Check size={16} /> Resolve
                </div>
                <span className="text-gray-400 text-xs w-full text-center">
                  (⌘ + R)
                </span>
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }
);

const DiscusssionCommentView = ({
  comment,
}: {
  comment: DiscussionComment;
}) => {
  return (
    <div>
      <div className="flex items-center justify-between p-1.5 text-sm">
        <div className="">
          <ContactAvatar url={comment.contactUrl} showName={true} size="sm" />
        </div>

        <div className="text-xs text-gray-400">
          {getRelativeTimeString(comment.timestamp)}
        </div>
      </div>

      <div className="p-1.5">
        <p>{comment.content}</p>
      </div>
    </div>
  );
};

const AnnotationView = <T, V>({
  docType,
  annotation,
}: {
  docType: DocType;
  annotation: Annotation<T, V>;
}) => {
  switch (docType) {
    case "tldraw":
      return (
        <TLDrawAnnotationView
          annotation={annotation as Annotation<TLDrawDocAnchor, TLShape>}
        />
      );

    case "essay":
      return (
        <EssayAnnotationView
          annotation={annotation as Annotation<MarkdownDocAnchor, string>}
        />
      );
  }
};

// Todo: move this to tee
const EssayAnnotationView = ({
  annotation,
}: {
  annotation: Annotation<MarkdownDocAnchor, string>;
}) => {
  switch (annotation.type) {
    case "added":
      return (
        <div className="text-sm whitespace-nowrap overflow-ellipsis overflow-hidden">
          <span className="font-serif bg-green-50 border-b border-green-400">
            {annotation.added}
          </span>
        </div>
      );

    case "deleted":
      return (
        <div className="text-sm whitespace-nowrap overflow-ellipsis overflow-hidden">
          <span className="font-serif bg-red-50 border-b border-red-400">
            {annotation.deleted}
          </span>
        </div>
      );

    case "changed":
      return (
        <div className="text-sm">
          <span className="font-serif bg-red-50 border-b border-red-400">
            {truncate(annotation.before, { length: 45 })}
          </span>{" "}
          →{" "}
          <span className="font-serif bg-green-50 border-b border-green-400">
            {truncate(annotation.after, { length: 45 })}
          </span>
        </div>
      );

    case "highlighted":
      return (
        <div className="text-sm whitespace-nowrap overflow-ellipsis overflow-hidden">
          <span className="font-serif bg-yellow-50 border-b border-yellow-400">
            {annotation.value}
          </span>
        </div>
      );
  }
};

// Todo: move this to tldraw
const TLDrawAnnotationView = ({
  annotation,
}: {
  annotation: Annotation<TLDrawDocAnchor, TLShape>;
}) => {
  switch (annotation.type) {
    case "added":
      return (
        <div className="text-sm whitespace-nowrap overflow-ellipsis overflow-hidden">
          added {getShapeName(annotation.added)}
        </div>
      );

    case "deleted":
      return (
        <div className="text-sm whitespace-nowrap overflow-ellipsis overflow-hidden">
          deleted {getShapeName(annotation.deleted)}
        </div>
      );

    case "changed":
      return (
        <div className="text-sm">changed {getShapeName(annotation.after)}</div>
      );

    case "highlighted":
      return (
        <div className="text-sm whitespace-nowrap overflow-ellipsis overflow-hidden">
          highlighted {getShapeName(annotation.value)}
        </div>
      );
  }
};

function getShapeName(shape: TLShape) {
  switch (shape.type) {
    case "arrow":
      return "arrow";
    case "geo":
      return (shape.props as any).geo.replaceAll("-", " ");
    case "draw":
      return "pencil line";

    case "text":
      return "text";
  }
}

export type PositionMap = Record<string, { top: number; bottom: number }>;

interface UseAnnotationPositionMapResult {
  registerAnnotationElement: (
    discussionId: string,
    element: HTMLDivElement
  ) => void;
  annotationsPositionMap: PositionMap;
}

interface UseAnnotationPositionOptions<T, V> {
  annotations: Annotation<T, V>[];
  onChangeCommentPositionMap?: (map: PositionMap) => void;
  offset: number;
}

const useAnnotationsPositionMap = <T, V>({
  annotations,
  onChangeCommentPositionMap,
  offset,
}: UseAnnotationPositionOptions<T, V>): UseAnnotationPositionMapResult => {
  const elementByAnnotationId = useRef(new Map<string, HTMLDivElement>());
  const annotationIdByElement = useRef(new Map<HTMLDivElement, string>());
  const [elementSizes, setElementSizes] = useState<Record<string, number>>({});
  // create an artificial dependency that triggeres a re-eval of effects / memos
  // that depend on it when forceChange is called
  const [, forceChange] = useReducer(() => ({}), {});
  const [resizeObserver] = useState(
    () =>
      new ResizeObserver((events) => {
        for (const event of events) {
          const annotationId = annotationIdByElement.current.get(
            event.target as HTMLDivElement
          );
          setElementSizes((sizes) => ({
            ...sizes,
            [annotationId]: event.borderBoxSize[0].blockSize,
          }));
        }

        forceChange();
      })
  );

  // cleanup resize observer
  useEffect(() => {
    return () => {
      resizeObserver.disconnect();
    };
  }, [resizeObserver]);

  const registerAnnotationElement = (
    discussionId: string,
    element?: HTMLDivElement
  ) => {
    const prevElement = elementByAnnotationId.current[discussionId];
    if (prevElement) {
      resizeObserver.unobserve(prevElement);
      annotationIdByElement.current.delete(prevElement);
      delete elementByAnnotationId.current[discussionId];
    }

    if (element) {
      resizeObserver.observe(element);
      elementByAnnotationId.current[discussionId];
      annotationIdByElement.current.set(element, discussionId);
    }
  };

  const annotationsPositionMap = useMemo(() => {
    let currentPos = offset;
    const positionMap = {};

    for (const annotation of annotations) {
      const id = JSON.stringify(annotation.target);

      if (!elementSizes[id] || annotation.type !== "highlighted") {
        continue;
      }

      const top = currentPos;
      const bottom = top + elementSizes[id];

      positionMap[id] = { top, bottom };
      currentPos = bottom;
    }

    if (onChangeCommentPositionMap) {
      onChangeCommentPositionMap(positionMap);
    }
    return positionMap;
  }, [annotations, offset, onChangeCommentPositionMap, elementSizes]);

  return { registerAnnotationElement, annotationsPositionMap };
};

export const useSetScrollTarget = (
  positionMap: PositionMap,
  scrollContainer: HTMLDivElement
) => {
  const targetIdRef = useRef<string>();

  const triggerScrollPositionUpdate = useStaticCallback(() => {
    const maxScrollPos =
      scrollContainer.scrollHeight - scrollContainer.clientHeight;
    const targetPos = positionMap[targetIdRef.current]?.top;

    // abort, if target no longer exists
    if (targetPos === undefined) {
      return;
    }

    const scrollToPos = Math.min(maxScrollPos, targetPos);

    // hack: for some reason the scrolling get's stuck when it's close to the target but not quite
    // haven't figured out yet why this is happening
    if (Math.abs(scrollContainer.scrollTop - scrollToPos) < 5) {
      scrollContainer.scrollTo({
        top: scrollToPos,
        behavior: "instant",
      });
      targetIdRef.current = undefined;
      return;
    }

    // incrementally converge towards scrollToPos
    const nextPosition = (scrollContainer.scrollTop * 9 + scrollToPos) / 10;

    scrollContainer.scrollTo({
      top: nextPosition,
      behavior: "instant",
    });

    requestAnimationFrame(triggerScrollPositionUpdate);
  });

  useEffect(() => {
    if (scrollContainer && targetIdRef.current !== undefined) {
      triggerScrollPositionUpdate();
    }
  }, [scrollContainer, triggerScrollPositionUpdate]);

  return (discussionId: string) => {
    const prevTarget = targetIdRef.current;

    targetIdRef.current = discussionId;

    if (!prevTarget && scrollContainer) {
      triggerScrollPositionUpdate();
    }
  };
};

const COMMENT_ANCHOR_OFFSET = 30;

export const SpatialCommentsLinesLayer = ({
  annotationsPositionsInSidebarMap,
  annotationsTargetPositions,
  activeDiscussionIds,
}: {
  annotationsPositionsInSidebarMap: PositionMap;
  annotationsTargetPositions: AnnotationPosition<unknown, unknown>[];
  activeDiscussionIds: string[];
}) => {
  const [bezierCurveLayerRect, setBezierCurveLayerRect] = useState<DOMRect>();
  const [bezierCurveLayerElement, setBezierCurveLayerElement] =
    useState<HTMLDivElement>();

  // handle resize of bezierCureveLayerElement
  useEffect(() => {
    if (!bezierCurveLayerElement) {
      return;
    }

    const observer = new ResizeObserver(() => {
      setBezierCurveLayerRect(bezierCurveLayerElement.getBoundingClientRect());
    });

    setBezierCurveLayerRect(bezierCurveLayerElement.getBoundingClientRect());

    observer.observe(bezierCurveLayerElement);

    return () => {
      observer.disconnect();
    };
  }, [bezierCurveLayerElement]);

  return (
    <div
      ref={setBezierCurveLayerElement}
      className="absolute z-50 top-0 right-0 bottom-0 left-0 pointer-events-none"
      style={{ zIndex: 999 }}
    >
      {bezierCurveLayerRect && (
        <svg
          width={bezierCurveLayerRect.width}
          height={bezierCurveLayerRect.height}
        >
          {sortBy(
            annotationsTargetPositions,
            (pos) => 0
            /* activeDiscussionIds.includes(pos.discussion.id) ? 1 : 0 */
          ).map((position, index) => {
            const id = JSON.stringify(position.annotation.target);
            const sidebarPosition =
              annotationsPositionsInSidebarMap &&
              annotationsPositionsInSidebarMap[id];

            if (!sidebarPosition) {
              return;
            }

            return (
              <BezierCurve
                color={
                  false // activeDiscussionIds.includes(position.discussion.id)
                    ? "#facc15"
                    : "#d1d5db"
                }
                key={index}
                x1={bezierCurveLayerRect.width}
                y1={
                  annotationsPositionsInSidebarMap[id].top +
                  COMMENT_ANCHOR_OFFSET -
                  bezierCurveLayerRect.top
                }
                // todo: draw the line to the border of the editor
                // x2={editorContainerRect.right - bezierCurveLayerRect.left + 30}
                // y2={position.y + bezierCurveLayerRect.top}
                x2={position.x}
                y2={position.y - bezierCurveLayerRect.top}
                x3={position.x}
                y3={position.y - bezierCurveLayerRect.top}
              />
            );
          })}
        </svg>
      )}
    </div>
  );
};

interface BezierCurveProps {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  x3: number;
  y3: number;
  x4?: number;
  y4?: number;
  color: string;
}

const BezierCurve: React.FC<BezierCurveProps> = ({
  x1,
  y1,
  x2,
  y2,
  x3,
  y3,
  x4,
  y4,
  color,
}) => {
  // Control points for the Bezier curve from point 1 to point 2
  const controlPoint1 = { x: x1 + (x2 - x1) / 3, y: y1 };
  const controlPoint2 = { x: x2 - (x2 - x1) / 3, y: y2 };

  // Path data for the Bezier curve from point 1 to point 2
  const pathDataBezier1 = `M ${x1} ${y1} C ${controlPoint1.x} ${controlPoint1.y}, ${controlPoint2.x} ${controlPoint2.y}, ${x2} ${y2}`;

  // Path data for the straight line from point 2 to point 3
  const pathDataLine = `M ${x2} ${y2} L ${x3} ${y3}`;

  let pathDataBezier2 = "";

  if (x4 !== undefined && y4 !== undefined) {
    // Control points for the Bezier curve from point 3 to point 4 that bends outwards
    const controlPoint3 = { x: x4, y: y3 };
    const controlPoint4 = { x: x4, y: y3 };

    // Path data for the Bezier curve from point 3 to point 4
    pathDataBezier2 = `M ${x3} ${y3} C ${controlPoint3.x} ${controlPoint3.y}, ${controlPoint4.x} ${controlPoint4.y}, ${x4} ${y4}`;
  }

  // Combine all path datas
  const combinedPathData = `${pathDataBezier1} ${pathDataLine} ${pathDataBezier2}`;

  return (
    <path d={combinedPathData} stroke={color} fill="none" strokeWidth="1" />
  );
};
