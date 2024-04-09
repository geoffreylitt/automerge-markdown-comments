import { isEqual } from "lodash";
import { useEffect, useRef, useState } from "react";
import { AnnotationWithState } from "@/patchwork/schema";
import {
  Editor,
  TLCamera,
  TLShape,
  TLShapeId,
  TLStoreWithStatus,
} from "@tldraw/tldraw";
import { TLDrawDoc, TLDrawDocAnchor } from "../schema";
import { areAnchorSelectionsEqual } from "@/patchwork/utils";

export const useCameraSync = ({
  camera: camera,
  onChangeCamera: onChangeCamera,
  editor,
}: {
  camera?: TLCamera;
  onChangeCamera?: (camera: TLCamera) => void;
  editor: Editor;
}) => {
  useEffect(() => {
    if (!editor || !camera || isEqual(editor.camera, camera)) {
      return;
    }

    editor.setCamera(camera);
  }, [editor, camera]);

  useEffect(() => {
    if (!editor || !onChangeCamera) {
      return;
    }

    const onChange = () => {
      if (editor.cameraState === "moving") {
        onChangeCamera(editor.camera);
      }
    };

    editor.on("change", onChange);

    return () => {
      editor.off("change", onChange);
    };
  }, [editor, onChangeCamera]);
};
export const useDiffStyling = ({
  doc,
  annotations,
  store,
  editor,
}: {
  doc: TLDrawDoc;
  annotations: AnnotationWithState<TLDrawDocAnchor, TLShape>[];
  store: TLStoreWithStatus;
  editor: Editor;
}) => {
  const tempShapeIdsRef = useRef(new Set<TLShapeId>());
  const highlightedElementsRef = useRef(new Set<HTMLElement>());
  const [camera, setCamera] = useState<TLCamera>();

  useEffect(() => {
    if (!editor) {
      return;
    }

    editor.on("change", () => {
      if (editor.cameraState === "moving") {
        setCamera(editor.camera);
      }
    });

    return () => {};
  }, [editor]);

  useEffect(() => {
    if (!store.store) {
      return;
    }

    if (!annotations) {
      store.store.remove(Array.from(tempShapeIdsRef.current));
      highlightedElementsRef.current.forEach((element) => {
        element.style.filter = "";
      });

      tempShapeIdsRef.current = new Set();
      highlightedElementsRef.current = new Set();
      return;
    }

    setTimeout(() => {
      // track which temp shapes and highlighted elements are active in the current diff
      const activeHighlightedElements = new Set<HTMLElement>();
      const activeTempShapeIds = new Set<TLShapeId>();
      const container = editor.getContainer();

      annotations.forEach((annotation) => {
        switch (annotation.type) {
          case "highlighted":
          case "added":
            {
              const id =
                annotation.type === "highlighted"
                  ? annotation.value.id
                  : annotation.added.id;

              const shapeElem = container.querySelector(
                `#${id.replace(":", "\\:")}`
              ) as HTMLElement;
              if (!shapeElem) {
                return;
              }

              activeHighlightedElements.add(shapeElem);
              if (!highlightedElementsRef.current.has(shapeElem)) {
                highlightedElementsRef.current.add(shapeElem);
              }

              const dropShadowFilter = `drop-shadow(0 0 ${
                annotation.isFocused ? "0.25rem" : "0.75rem"
              } ${annotation.type === "highlighted" ? "yellow" : "green"})`;

              // drop shadow has no spread option, to intesify it when annotation is focused we apply it twice
              shapeElem.style.filter =
                dropShadowFilter +
                (annotation.isFocused ? ` ${dropShadowFilter}` : "");
            }
            break;

          case "deleted": {
            activeTempShapeIds.add(annotation.deleted.id);
            if (tempShapeIdsRef.current.has(annotation.deleted.id)) {
              break;
            }

            const deletedShape = annotation.deleted;

            deletedShape.opacity = 0.1;
            deletedShape.isLocked = true;

            activeTempShapeIds.add(deletedShape.id);
            tempShapeIdsRef.current.add(deletedShape.id);
            store.store.put([deletedShape]);

            break;
          }
        }
      }, 100);

      // delete shapes that are not part of the current diff
      store.store.remove(
        Array.from(tempShapeIdsRef.current).filter(
          (id) => !activeTempShapeIds.has(id)
        )
      );
      tempShapeIdsRef.current = activeTempShapeIds;

      // remove highlights that are not part of the current diff
      Array.from(highlightedElementsRef.current)
        .filter((element) => !activeHighlightedElements.has(element))
        .forEach((element) => {
          element.style.filter = "";
        });
      highlightedElementsRef.current = activeHighlightedElements;
    });
  }, [annotations, store, doc, camera]);
};
export const useAnchorEventListener = ({
  editor,
  selectedAnchors,
  hoveredAnchor,
  setSelectedAnchors,
  setHoveredAnchor,
}: {
  editor: Editor;
  selectedAnchors: TLDrawDocAnchor[];
  setSelectedAnchors: (anchors: TLDrawDocAnchor[]) => void;
  hoveredAnchor: TLDrawDocAnchor;
  setHoveredAnchor: (anchors: TLDrawDocAnchor) => void;
}) => {
  const selectedAnchorsRef = useRef<TLDrawDocAnchor[]>();
  selectedAnchorsRef.current = selectedAnchors;

  const hoveredAnchorRef = useRef<TLDrawDocAnchor>();
  hoveredAnchorRef.current = hoveredAnchor;

  useEffect(() => {
    if (!editor) {
      return;
    }

    const onChange = () => {
      if (editor.hoveredShapeId !== hoveredAnchorRef.current) {
        setHoveredAnchor(editor.hoveredShapeId);
      }

      if (
        !areAnchorSelectionsEqual(
          "tldraw",
          editor?.selectedShapeIds,
          selectedAnchorsRef.current
        )
      ) {
        setSelectedAnchors(editor.selectedShapeIds);
      }
    };

    editor.on("change", onChange);

    return () => {
      editor.off("change", onChange);
    };
  }, [editor]);
};
