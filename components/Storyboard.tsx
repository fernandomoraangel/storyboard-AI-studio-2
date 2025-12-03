import React, { useState, useEffect, useRef } from "react";
import type { Scene, Character, Shot, StoryboardStyle } from "../types";
import { SceneCard } from "./SceneCard";
import { GalleryView } from "./GalleryView";
import { CommentModal } from "./CommentModal";
import { useLanguage } from "../contexts/languageContext";
import { useCommentShortcut } from "../hooks/useCommentShortcut";
import { RowsIcon, PanelTopCloseIcon, GalleryIcon } from "./icons";

interface StoryboardProps {
  scenes: Scene[];
  characters: Character[];
  updateSceneDetails: (sceneId: number, details: Partial<Scene>) => void;
  deleteScene: (sceneId: number) => void;
  addShot: (sceneId: number) => void;
  updateShot: (sceneId: number, updatedShot: Shot) => void;
  deleteShot: (sceneId: number, shotId: number) => void;
  storyboardStyle: StoryboardStyle;
  aspectRatio: string;
  reorderScenes: (startIndex: number, endIndex: number) => void;
  reorderShots: (sceneId: number, startIndex: number, endIndex: number) => void;
  episodeId?: number;
  episodeTitle?: string;
  comments?: any[];
}

export const Storyboard: React.FC<StoryboardProps> = ({
  scenes,
  characters,
  updateSceneDetails,
  deleteScene,
  addShot,
  updateShot,
  deleteShot,
  storyboardStyle,
  aspectRatio,
  reorderScenes,
  reorderShots,
  episodeId,
  episodeTitle,
  comments = [],
}) => {
  const { t } = useLanguage();
  const [openScenes, setOpenScenes] = useState<Record<number, boolean>>({});
  const [showGallery, setShowGallery] = useState(false);

  // Comment functionality
  const {
    showCommentModal,
    setShowCommentModal,
    locationLabel,
    handleSubmitComment,
  } = useCommentShortcut(
    () => ({
      type: "storyboard",
      episodeId: episodeId || 0,
      sceneId: scenes[0]?.id || 0,
    }),
    () => `${t("storyBoardTab")} - Scene ${scenes[0]?.title || ""}`
  );

  useEffect(() => {
    setOpenScenes((prev) => {
      const newState = { ...prev };
      scenes.forEach((scene) => {
        if (newState[scene.id] === undefined) {
          newState[scene.id] = true;
        }
      });
      return newState;
    });
  }, [scenes]);

  const toggleScene = (id: number) =>
    setOpenScenes((p) => ({ ...p, [id]: !p[id] }));
  const expandAll = () =>
    setOpenScenes(scenes.reduce((acc, s) => ({ ...acc, [s.id]: true }), {}));
  const collapseAll = () =>
    setOpenScenes(scenes.reduce((acc, s) => ({ ...acc, [s.id]: false }), {}));

  const dragItemIndex = useRef<number | null>(null);
  const dragOverItemIndex = useRef<number | null>(null);
  const [dragging, setDragging] = useState(false);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    dragItemIndex.current = index;
    e.dataTransfer.effectAllowed = "move";
    setTimeout(() => setDragging(true), 0);
  };

  const handleDragEnter = (index: number) => {
    dragOverItemIndex.current = index;
  };

  const handleDragEnd = () => {
    if (
      dragItemIndex.current !== null &&
      dragOverItemIndex.current !== null &&
      dragItemIndex.current !== dragOverItemIndex.current
    ) {
      reorderScenes(dragItemIndex.current, dragOverItemIndex.current);
    }
    dragItemIndex.current = null;
    dragOverItemIndex.current = null;
    setDragging(false);
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-end gap-2">
        <button
          onClick={() => setShowGallery(true)}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-transparent hover:bg-gray-700 h-9 px-3 text-sky-400 hover:text-sky-300"
          title={t("galleryView")}
        >
          <GalleryIcon className="w-4 h-4 mr-2" /> {t("galleryView")}
        </button>
        <button
          onClick={expandAll}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-transparent hover:bg-gray-700 h-9 px-3 text-sky-400 hover:text-sky-300"
          title={t("expandAll")}
        >
          <RowsIcon className="w-4 h-4 mr-2" /> {t("expandAll")}
        </button>
        <button
          onClick={collapseAll}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-transparent hover:bg-gray-700 h-9 px-3 text-sky-400 hover:text-sky-300"
          title={t("collapseAll")}
        >
          <PanelTopCloseIcon className="w-4 h-4 mr-2" /> {t("collapseAll")}
        </button>
      </div>
      {showGallery && (
        <GalleryView
          scenes={scenes}
          characters={characters}
          onClose={() => setShowGallery(false)}
        />
      )}
      <div className="space-y-6">
        {scenes.map((scene, index) => (
          <div
            key={scene.id}
            className={`relative ${
              dragOverItemIndex.current === index && dragging
                ? "drag-over-placeholder"
                : ""
            }`}
            onDragEnter={() => handleDragEnter(index)}
          >
            <SceneCard
              scene={scene}
              sceneNumber={index + 1}
              characters={characters}
              updateSceneDetails={updateSceneDetails}
              deleteScene={deleteScene}
              addShot={addShot}
              updateShot={updateShot}
              deleteShot={deleteShot}
              isLastScene={index === scenes.length - 1}
              storyboardStyle={storyboardStyle}
              aspectRatio={aspectRatio}
              reorderShots={reorderShots}
              isExpanded={openScenes[scene.id] ?? true}
              onToggleExpand={() => toggleScene(scene.id)}
              isDragging={dragging && dragItemIndex.current === index}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragEnd={handleDragEnd}
              episodeId={episodeId}
              comments={comments}
            />
          </div>
        ))}
      </div>

      {/* Comment Modal */}
      {showCommentModal && (
        <CommentModal
          onSubmit={handleSubmitComment}
          onClose={() => setShowCommentModal(false)}
          locationLabel={locationLabel}
          episodeTitle={episodeTitle}
          sceneTitle={scenes[0]?.title}
        />
      )}
    </div>
  );
};
